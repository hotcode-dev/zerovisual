import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import { makePng } from '../helpers/make-png.js';
import { estimateVisionTokens, optimizeImageStandalone } from '../../src/core/image-optimizer.js';
import { runOptimizeCommand } from '../../src/cli/commands/optimize.js';

describe('Image Optimization & Token Estimation', () => {
  const testDir = path.resolve(process.cwd(), './test-optimize-temp');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('estimateVisionTokens', () => {
    it('should correctly calculate Anthropic tokens based on 28x28 patches', () => {
      // 504x504 => 18x18 = 324 tokens
      expect(estimateVisionTokens(504, 504, 'anthropic')).toBe(324);
      // 1920x1080 => ceil(1920/28) * ceil(1080/28) = 69 * 39 = 2691 tokens
      expect(estimateVisionTokens(1920, 1080, 'anthropic')).toBe(2691);
      // 120x48 => ceil(120/28) * ceil(48/28) = 5 * 2 = 10 tokens
      expect(estimateVisionTokens(120, 48, 'anthropic')).toBe(10);
    });

    it('should correctly calculate OpenAI tokens based on 512x512 tiles', () => {
      // 512x512 => 85 + (1*1*170) = 255 tokens
      expect(estimateVisionTokens(512, 512, 'openai')).toBe(255);
      // 1920x1080 => 85 + (4*3*170) = 2125 tokens
      expect(estimateVisionTokens(1920, 1080, 'openai')).toBe(2125);
    });

    it('should correctly calculate Gemini tokens for standard and lowTokenMode', () => {
      // 768x768 => 1*1*258 = 258 tokens
      expect(estimateVisionTokens(768, 768, 'gemini', false)).toBe(258);
      // 384x384 in lowTokenMode => 1*1*258 = 258 tokens
      expect(estimateVisionTokens(384, 384, 'gemini', true)).toBe(258);
      // 1920x1080 standard => ceil(1920/768)*ceil(1080/768)*258 = 3*2*258 = 1548 tokens
      expect(estimateVisionTokens(1920, 1080, 'gemini', false)).toBe(1548);
    });
  });

  describe('optimizeImageStandalone', () => {
    it('should downscale large 1920x1080 image to target provider dimensions and report savings', async () => {
      const buffer = await makePng(1920, 1080, { r: 100, g: 150, b: 200 });

      const { result, stats } = await optimizeImageStandalone(buffer, {
        provider: 'anthropic'
      });

      expect(result.format).toBe('webp');
      expect(result.width).toBeLessThanOrEqual(504);
      expect(result.height).toBeLessThanOrEqual(504);
      expect(stats.originalWidth).toBe(1920);
      expect(stats.originalHeight).toBe(1080);
      expect(stats.tokenSavingsPercent).toBeGreaterThan(80);
      expect(stats.byteSavingsPercent).toBeGreaterThan(50);
    });

    it('should not enlarge small images when withoutEnlargement is active', async () => {
      const buffer = await makePng(200, 100, { r: 255, g: 0, b: 0 });

      const { result, stats } = await optimizeImageStandalone(buffer, {
        provider: 'anthropic'
      });

      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
      expect(stats.optimizedTokens).toBe(estimateVisionTokens(200, 100, 'anthropic'));
    });

    it('keeps token stats consistent with the resolved provider when no provider is supplied', async () => {
      const buffer = await makePng(1920, 1080, { r: 100, g: 150, b: 200 });

      // No provider supplied — the resize pipeline defaults to 'openai',
      // so the token stats must be computed with the same provider.
      const { result, stats } = await optimizeImageStandalone(buffer);

      expect(result.provider).toBe('openai');
      expect(stats.optimizedTokens).toBe(estimateVisionTokens(result.width, result.height, result.provider, false));
      expect(stats.originalTokens).toBe(estimateVisionTokens(1920, 1080, result.provider, false));

      // Guard: the providers genuinely disagree for this source, so a stats/
      // provider mismatch (the original bug) would have been caught here.
      expect(estimateVisionTokens(1920, 1080, 'openai', false)).not.toBe(
        estimateVisionTokens(1920, 1080, 'anthropic', false)
      );
    });
  });

  describe('runOptimizeCommand CLI', () => {
    it('should optimize image files in directory and write .optimized.webp files', async () => {
      const testImage = path.join(testDir, 'screenshot.png');
      const pngBuffer = await makePng(1200, 800, { r: 50, g: 100, b: 150 });
      fs.writeFileSync(testImage, pngBuffer);

      const summaries = await runOptimizeCommand({
        input: testDir,
        provider: 'openai'
      });

      expect(summaries).toHaveLength(1);
      expect(summaries[0].outputPath).toContain('screenshot.optimized.webp');
      expect(fs.existsSync(summaries[0].outputPath)).toBe(true);

      const meta = await sharp(summaries[0].outputPath).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBeLessThanOrEqual(512);
      expect(meta.height).toBeLessThanOrEqual(512);
    });
  });
});
