import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';

// Spy on the core image pipeline functions with pass-through implementations:
// the citty command `run` handlers call these locally, so spying here captures
// the exact padding/quality values the CLI arg parsing produced.
vi.mock('../../src/core/image-optimizer.js', async importOriginal => {
  const mod = await importOriginal<typeof import('../../src/core/image-optimizer.js')>();
  return {
    ...mod,
    detectDiffBoundingBox: vi.fn(mod.detectDiffBoundingBox),
    optimizeImageStandalone: vi.fn(mod.optimizeImageStandalone)
  };
});

import { regressionCommand } from '../../src/cli/commands/regression.js';
import { optimizeCommand } from '../../src/cli/commands/optimize.js';
import { detectDiffBoundingBox, optimizeImageStandalone } from '../../src/core/image-optimizer.js';

const detectDiff = vi.mocked(detectDiffBoundingBox);
const optimizeStandalone = vi.mocked(optimizeImageStandalone);

/** Creates a temp dir with a single synthetic diff image and returns its path. */
async function createDiffFixture(baseDir: string, name: string): Promise<string> {
  const dir = path.join(baseDir, name, 'my-test-Desktop-Chrome');
  fs.mkdirSync(dir, { recursive: true });
  const base = await sharp({
    create: { width: 300, height: 200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .png()
    .toBuffer();
  const red = await sharp({
    create: { width: 40, height: 20, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } }
  })
    .png()
    .toBuffer();
  const diff = await sharp(base)
    .composite([{ input: red, left: 50, top: 50 }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(dir, 'button-diff.png'), diff);
  return dir;
}

/** Creates a temp dir with a single supported image and returns the dir. */
async function createImageFixture(baseDir: string, name: string): Promise<string> {
  const dir = path.join(baseDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const png = await sharp({
    create: { width: 640, height: 400, channels: 4, background: { r: 50, g: 100, b: 150, alpha: 1 } }
  })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(dir, 'shot.png'), png);
  return dir;
}

describe('CLI numeric arg parsing (--padding / --quality)', () => {
  const baseDir = path.resolve(process.cwd(), './test-cli-arg-parsing');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(baseDir)) fs.rmSync(baseDir, { recursive: true, force: true });
  });

  describe('--padding (regression)', () => {
    it('passes an explicit 0 through to detectDiffBoundingBox instead of the 32 default', async () => {
      const inputDir = await createDiffFixture(baseDir, 'padding-zero');
      await regressionCommand.run!({
        args: { input: inputDir, output: inputDir, provider: 'openai', lowTokenMode: false, padding: '0', json: false }
      } as never);

      expect(detectDiff).toHaveBeenCalledTimes(1);
      const [, padding] = detectDiff.mock.calls[0]!;
      expect(padding).toBe(0);
    });

    it('keeps a legitimate non-default value (16) as 16', async () => {
      const inputDir = await createDiffFixture(baseDir, 'padding-sixteen');
      await regressionCommand.run!({
        args: { input: inputDir, output: inputDir, provider: 'openai', lowTokenMode: false, padding: '16', json: false }
      } as never);

      const [, padding] = detectDiff.mock.calls[0]!;
      expect(padding).toBe(16);
    });

    it('falls back to 32 when the flag is unparsable garbage', async () => {
      const inputDir = await createDiffFixture(baseDir, 'padding-garbage');
      await regressionCommand.run!({
        args: {
          input: inputDir,
          output: inputDir,
          provider: 'openai',
          lowTokenMode: false,
          padding: 'abc',
          json: false
        }
      } as never);

      const [, padding] = detectDiff.mock.calls[0]!;
      expect(padding).toBe(32);
    });
  });

  describe('--quality (optimize)', () => {
    it('passes an explicit 0 through to optimizeImageStandalone instead of the 80 default', async () => {
      const inputDir = await createImageFixture(baseDir, 'quality-zero');
      // Sharp's WebP encoder only accepts quality 1-100, so stub the pipeline:
      // this test asserts the CLI parsing contract (0 is no longer coerced to
      // 80), not sharp's behavior.
      const realImpl = optimizeStandalone.getMockImplementation() as typeof optimizeStandalone | undefined;
      optimizeStandalone.mockImplementation(async () => ({
        result: {
          dataUri: 'data:image/webp;base64,x',
          buffer: Buffer.from([1, 2, 3]),
          width: 10,
          height: 10,
          format: 'webp',
          provider: 'anthropic',
          tileDimensions: { maxWidth: 504, maxHeight: 504 }
        },
        stats: {
          originalWidth: 640,
          originalHeight: 400,
          originalBytes: 1000,
          originalTokens: 345,
          optimizedWidth: 10,
          optimizedHeight: 10,
          optimizedBytes: 3,
          optimizedTokens: 1,
          tokenSavingsPercent: 99,
          byteSavingsPercent: 99
        }
      }));
      try {
        await optimizeCommand.run!({
          args: {
            input: inputDir,
            output: undefined,
            provider: 'anthropic',
            lowTokenMode: false,
            quality: '0',
            json: false
          }
        } as never);
      } finally {
        optimizeStandalone.mockImplementation(
          realImpl ??
            (async () => {
              throw new Error('unexpected real call');
            })
        );
      }

      expect(optimizeStandalone).toHaveBeenCalledTimes(1);
      const options = optimizeStandalone.mock.calls[0]![1]!;
      expect(options.quality).toBe(0);
    });

    it('keeps a legitimate non-default value (50) as 50', async () => {
      const inputDir = await createImageFixture(baseDir, 'quality-fifty');
      await optimizeCommand.run!({
        args: {
          input: inputDir,
          output: undefined,
          provider: 'anthropic',
          lowTokenMode: false,
          quality: '50',
          json: false
        }
      } as never);

      const options = optimizeStandalone.mock.calls[0]![1]!;
      expect(options.quality).toBe(50);
    });

    it('falls back to 80 when the flag is unparsable garbage', async () => {
      const inputDir = await createImageFixture(baseDir, 'quality-garbage');
      await optimizeCommand.run!({
        args: {
          input: inputDir,
          output: undefined,
          provider: 'anthropic',
          lowTokenMode: false,
          quality: 'abc',
          json: false
        }
      } as never);

      const options = optimizeStandalone.mock.calls[0]![1]!;
      expect(options.quality).toBe(80);
    });
  });
});
