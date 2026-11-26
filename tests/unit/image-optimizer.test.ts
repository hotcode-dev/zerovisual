import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { makePng } from '../helpers/make-png.js';
import {
  getProviderDimensions,
  detectDiffBoundingBox,
  optimizeImageForProvider,
  optimizeAndWriteCompanionImage
} from '../../src/core/image-optimizer.js';

describe('Model-Aware Image Optimizer', () => {
  describe('getProviderDimensions', () => {
    it('should return exact 512x512 tile grid for openai', () => {
      expect(getProviderDimensions('openai')).toEqual({ maxWidth: 512, maxHeight: 512 });
    });

    it('should return exact 504x504 (18x18 grid of 28px patches) for anthropic', () => {
      expect(getProviderDimensions('anthropic')).toEqual({ maxWidth: 504, maxHeight: 504 });
    });

    it('should return 768x768 for gemini standard and 384x384 for lowTokenMode', () => {
      expect(getProviderDimensions('gemini', false)).toEqual({ maxWidth: 768, maxHeight: 768 });
      expect(getProviderDimensions('gemini', true)).toEqual({ maxWidth: 384, maxHeight: 384 });
    });

    it('should return 768x768 for gemma standard and 384x384 for lowTokenMode', () => {
      expect(getProviderDimensions('gemma', false)).toEqual({ maxWidth: 768, maxHeight: 768 });
      expect(getProviderDimensions('gemma', true)).toEqual({ maxWidth: 384, maxHeight: 384 });
    });

    it('should return exact 560x560 for llama, 512x512 for mistral, and 384x384 for deepseek', () => {
      expect(getProviderDimensions('llama')).toEqual({ maxWidth: 560, maxHeight: 560 });
      expect(getProviderDimensions('mistral')).toEqual({ maxWidth: 512, maxHeight: 512 });
      expect(getProviderDimensions('deepseek')).toEqual({ maxWidth: 384, maxHeight: 384 });
    });

    it('should return 448x448 default for local and respect custom dimensions', () => {
      expect(getProviderDimensions('local')).toEqual({ maxWidth: 448, maxHeight: 448 });
      expect(getProviderDimensions('local', false, { maxWidth: 640, maxHeight: 480 })).toEqual({
        maxWidth: 640,
        maxHeight: 480
      });
    });
  });

  describe('detectDiffBoundingBox', () => {
    it('should detect minimal bounding box with 32px padding on synthetic 1920x1080 diff', async () => {
      // Create white 1920x1080 canvas
      const base = await makePng(1920, 1080, { r: 255, g: 255, b: 255 });

      // Create a red diff patch at (200, 300) with size 100x50
      const redPatch = await makePng(100, 50, { r: 255, g: 0, b: 0 });

      const diffImage = await sharp(base)
        .composite([{ input: redPatch, left: 200, top: 300 }])
        .png()
        .toBuffer();

      const result = await detectDiffBoundingBox(diffImage, 32);

      // (200 - 32) = 168, (300 - 32) = 268
      // width = 100 + 64 = 164, height = 50 + 64 = 114
      expect(result.boundingBox.x).toBe(168);
      expect(result.boundingBox.y).toBe(268);
      expect(result.boundingBox.width).toBe(164);
      expect(result.boundingBox.height).toBe(114);
      expect(result.diffPixelCount).toBe(100 * 50);
      expect(result.diffPixelRatio).toBeGreaterThan(0);
    });

    it('should clamp bounding box to boundaries when diff is near edges', async () => {
      const base = await makePng(500, 500, { r: 255, g: 255, b: 255 });

      const redPatch = await makePng(20, 20, { r: 255, g: 0, b: 0 });

      // Put diff at (5, 5)
      const diffImage = await sharp(base)
        .composite([{ input: redPatch, left: 5, top: 5 }])
        .png()
        .toBuffer();

      const result = await detectDiffBoundingBox(diffImage, 32);

      expect(result.boundingBox.x).toBe(0);
      expect(result.boundingBox.y).toBe(0);
      expect(result.boundingBox.width).toBe(57); // 5 + 20 + 32 = 57
      expect(result.boundingBox.height).toBe(57);
    });

    it('should fallback to full image if no diff pixels found', async () => {
      const base = await makePng(400, 300, { r: 255, g: 255, b: 255 });

      const result = await detectDiffBoundingBox(base, 32);

      expect(result.boundingBox).toEqual({ x: 0, y: 0, width: 400, height: 300 });
      expect(result.diffPixelCount).toBe(0);
      expect(result.diffPixelRatio).toBe(0);
    });
  });

  describe('optimizeImageForProvider', () => {
    it('should downscale 1920x1080 desktop screenshot to fit openai 512x512 grid without exceeding bounds', async () => {
      const imageBuffer = await makePng(1920, 1080, { r: 100, g: 150, b: 200 });

      const result = await optimizeImageForProvider(imageBuffer, { provider: 'openai' });

      expect(result.format).toBe('webp');
      expect(result.dataUri).toMatch(/^data:image\/webp;base64,/);
      expect(result.width).toBe(512);
      expect(result.height).toBe(288); // 1080 * (512 / 1920) = 288
      expect(result.width).toBeLessThanOrEqual(512);
      expect(result.height).toBeLessThanOrEqual(512);
    });

    it('should fit anthropic 504x504 grid on 375x812 mobile viewport', async () => {
      const imageBuffer = await makePng(375, 812, { r: 50, g: 50, b: 50 });

      const result = await optimizeImageForProvider(imageBuffer, { provider: 'anthropic' });

      expect(result.height).toBe(504);
      expect(result.width).toBe(233); // 375 * (504 / 812) = 232.75 -> 233
      expect(result.width).toBeLessThanOrEqual(504);
      expect(result.height).toBeLessThanOrEqual(504);
    });

    it('should honor gemini lowTokenMode 384x384', async () => {
      const imageBuffer = await makePng(1200, 1200, { r: 10, g: 20, b: 30 });

      const result = await optimizeImageForProvider(imageBuffer, {
        provider: 'gemini',
        lowTokenMode: true
      });

      expect(result.width).toBe(384);
      expect(result.height).toBe(384);
    });

    it('should honor withoutEnlargement: true when crop region is smaller than grid', async () => {
      const imageBuffer = await makePng(800, 600, { r: 200, g: 200, b: 200 });

      // Crop box is 200x150, smaller than 512x512
      const result = await optimizeImageForProvider(imageBuffer, {
        provider: 'openai',
        cropBox: { x: 50, y: 50, width: 200, height: 150 }
      });

      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });
  });

  describe('optimizeAndWriteCompanionImage', () => {
    let artifactsDir: string;

    beforeEach(() => {
      artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zv-companion-'));
    });

    afterEach(() => {
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    });

    it('should write `${baseName}-actual.webp` to artifactsDir and return its dataUri', async () => {
      const imageBuffer = await makePng(800, 600, { r: 20, g: 40, b: 60 });

      const result = await optimizeAndWriteCompanionImage(imageBuffer, {
        artifactsDir,
        baseName: 'test1-myproject',
        suffix: 'actual',
        provider: 'openai'
      });

      const expectedPath = path.join(artifactsDir, 'test1-myproject-actual.webp');
      expect(result.imagePath).toBe(expectedPath);
      expect(result.dataUri).toMatch(/^data:image\/webp;base64,/);
      expect(fs.existsSync(expectedPath)).toBe(true);

      const onDisk = fs.readFileSync(expectedPath);
      expect(onDisk.length).toBeGreaterThan(0);
      expect(result.dataUri).toBe(`data:image/webp;base64,${onDisk.toString('base64')}`);
    });

    it('should name the expected-suffix artifact `${baseName}-expected.webp`', async () => {
      const imageBuffer = await makePng(300, 300, { r: 1, g: 2, b: 3 });

      const result = await optimizeAndWriteCompanionImage(imageBuffer, {
        artifactsDir,
        baseName: 'test2-myproject',
        suffix: 'expected',
        provider: 'anthropic'
      });

      const expectedPath = path.join(artifactsDir, 'test2-myproject-expected.webp');
      expect(result.imagePath).toBe(expectedPath);
      expect(fs.existsSync(expectedPath)).toBe(true);
      expect(result.dataUri).toMatch(/^data:image\/webp;base64,/);
    });

    it('should apply cropBox when passed through the helper', async () => {
      const imageBuffer = await makePng(800, 600, { r: 100, g: 100, b: 100 });

      await optimizeAndWriteCompanionImage(imageBuffer, {
        artifactsDir,
        baseName: 'test3-myproject',
        suffix: 'actual',
        provider: 'openai',
        cropBox: { x: 10, y: 20, width: 200, height: 150 }
      });

      const meta = await sharp(path.join(artifactsDir, 'test3-myproject-actual.webp')).metadata();
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(150);
    });
  });
});
