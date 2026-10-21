import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import { runRegressionCommand } from '../../src/cli/commands/regression.js';
import { runDesignQaCommand } from '../../src/cli/commands/design-qa.js';
import { TriagePayloadSchema } from '../../src/core/schema.js';

describe('ZeroVisual CLI Commands Integration', () => {
  const cliOutputDir = path.resolve(process.cwd(), './test-results-cli-test');

  beforeEach(() => {
    if (fs.existsSync(cliOutputDir)) {
      fs.rmSync(cliOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(cliOutputDir)) {
      fs.rmSync(cliOutputDir, { recursive: true, force: true });
    }
  });

  describe('runRegressionCommand', () => {
    it('should consume zero tokens and return empty payload when no diffs found', async () => {
      const emptyDir = path.join(cliOutputDir, 'empty-results');
      fs.mkdirSync(emptyDir, { recursive: true });

      const payload = await runRegressionCommand({
        inputDir: emptyDir,
        outputDir: cliOutputDir,
        provider: 'gemini',
        lowTokenMode: true
      });

      expect(payload.mode).toBe('regression');
      expect(payload.failures).toHaveLength(0);
      expect(payload.tileDimensions).toEqual({ maxWidth: 384, maxHeight: 384 });
    });

    it('should find diffs, crop them, downscale them, and produce valid triage-ready.json', async () => {
      const fixtureDir = path.join(cliOutputDir, 'my-test-Desktop-Chrome');
      fs.mkdirSync(fixtureDir, { recursive: true });

      const base = await sharp({
        create: {
          width: 600,
          height: 400,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      }).png().toBuffer();

      const red = await sharp({
        create: {
          width: 80,
          height: 40,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 }
        }
      }).png().toBuffer();

      const diffImg = await sharp(base)
        .composite([{ input: red, left: 100, top: 100 }])
        .png()
        .toBuffer();

      fs.writeFileSync(path.join(fixtureDir, 'button-diff.png'), diffImg);

      const payload = await runRegressionCommand({
        inputDir: cliOutputDir,
        outputDir: cliOutputDir,
        provider: 'openai'
      });

      expect(payload.failures).toHaveLength(1);
      const outputFile = path.join(cliOutputDir, 'triage-ready.json');
      expect(fs.existsSync(outputFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
      const parsed = TriagePayloadSchema.parse(content);
      expect(parsed.mode).toBe('regression');
      expect(parsed.failures[0]?.viewports[0]?.images.diffBase64).toMatch(/^data:image\/webp;base64,/);
    });
  });

  describe('runDesignQaCommand with mock browser', () => {
    it('should execute design-qa audit and write design-qa-ready.json', async () => {
      const mockScreenshotBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 4,
          background: { r: 240, g: 240, b: 240, alpha: 1 }
        }
      }).png().toBuffer();

      // Mock Page
      const mockPage = {
        goto: async () => {},
        evaluate: async (fn: any, args: any) => {
          // If captureDomContext (has selector property)
          if (args?.selector !== undefined) {
            return {
              resolvedSelector: 'body',
              tagName: 'body',
              computedStyles: { display: 'block' },
              boundingBox: { x: 0, y: 0, width: 800, height: 600 }
            };
          }
          // If auditPageHeuristics
          return [
            {
              selector: 'button#cta',
              tagName: 'button',
              isInteractive: true,
              computedStyles: {
                color: 'rgb(255, 255, 255)',
                backgroundColor: 'rgb(0, 102, 204)',
                padding: '13px', // Off-grid!
                fontSize: '16px',
                lineHeight: '24px'
              },
              boundingBox: { x: 50, y: 50, width: 36, height: 36 } // Smaller than 44x44 on mobile!
            }
          ];
        },
        locator: () => ({
          first: () => ({
            ariaSnapshot: async () => '- region "Main Content"'
          }),
          ariaSnapshot: async () => '- region "Main Content"'
        }),
        screenshot: async () => mockScreenshotBuffer,
        close: async () => {}
      };

      // Mock Browser
      const mockBrowser = {
        newPage: async () => mockPage,
        close: async () => {}
      };

      const penpotSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
          <rect id="cta" fill="#0066cc" rx="8" />
        </svg>
      `;
      const penpotFile = path.join(cliOutputDir, 'tokens.svg');
      fs.mkdirSync(cliOutputDir, { recursive: true });
      fs.writeFileSync(penpotFile, penpotSvg, 'utf-8');

      const payload = await runDesignQaCommand({
        url: 'http://localhost:3000',
        penpotPath: penpotFile,
        outputDir: cliOutputDir,
        provider: 'anthropic',
        browserInstance: mockBrowser as any
      });

      expect(payload.mode).toBe('design-qa');
      expect(payload.targetProvider).toBe('anthropic');
      expect(payload.failures).toHaveLength(1);

      const audit = payload.failures[0]!;
      expect(audit.designContext?.heuristicViolations.length).toBeGreaterThan(0);

      const outputFile = path.join(cliOutputDir, 'design-qa-ready.json');
      expect(fs.existsSync(outputFile)).toBe(true);

      const fileContent = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
      const validated = TriagePayloadSchema.parse(fileContent);
      expect(validated.mode).toBe('design-qa');
    });
  });
});
