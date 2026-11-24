import { describe, it, expect } from 'vitest';
import { PROVIDER_SPECS, getProviderDimensions, estimateVisionTokens } from '../../src/core/provider-math.js';

describe('provider-math', () => {
  describe('PROVIDER_SPECS', () => {
    it('contains all expected providers', () => {
      const keys = Object.keys(PROVIDER_SPECS).sort();
      expect(keys).toEqual(['anthropic', 'deepseek', 'gemini', 'gemma', 'llama', 'local', 'mistral', 'openai', 'qwen']);
    });

    it('openai uses 512 tile with 85 base + 170/tile', () => {
      expect(PROVIDER_SPECS.openai.tileWidth).toBe(512);
      expect(PROVIDER_SPECS.openai.tileHeight).toBe(512);
      expect(PROVIDER_SPECS.openai.patchSize).toBe(512);
      expect(PROVIDER_SPECS.openai.tokensPerPatch).toBe(170);
      expect(PROVIDER_SPECS.openai.baseTokens).toBe(85);
    });

    it('anthropic uses 28px patches x1', () => {
      expect(PROVIDER_SPECS.anthropic.patchSize).toBe(28);
      expect(PROVIDER_SPECS.anthropic.tokensPerPatch).toBe(1);
      expect(PROVIDER_SPECS.anthropic.baseTokens).toBeUndefined();
    });

    it('gemma and gemma-low share 768/384 tiles with 258 tokens', () => {
      expect(PROVIDER_SPECS.gemma.tileWidth).toBe(768);
      expect(PROVIDER_SPECS.gemma.lowTokenTileWidth).toBe(384);
      expect(PROVIDER_SPECS.gemma.tokensPerPatch).toBe(258);
      expect(PROVIDER_SPECS.gemma.lowTokenTileHeight).toBe(384);
    });
  });

  describe('getProviderDimensions', () => {
    it('returns default 512x512 for openai', () => {
      expect(getProviderDimensions('openai')).toEqual({ maxWidth: 512, maxHeight: 512 });
    });

    it('returns 504x504 for anthropic', () => {
      expect(getProviderDimensions('anthropic')).toEqual({ maxWidth: 504, maxHeight: 504 });
    });

    it('returns 768x768 for gemma standard', () => {
      expect(getProviderDimensions('gemma')).toEqual({ maxWidth: 768, maxHeight: 768 });
    });

    it('returns 384x384 for gemma in lowTokenMode', () => {
      expect(getProviderDimensions('gemma', true)).toEqual({ maxWidth: 384, maxHeight: 384 });
    });

    it('returns 560x560 for llama', () => {
      expect(getProviderDimensions('llama')).toEqual({ maxWidth: 560, maxHeight: 560 });
    });

    it('returns 512x512 for mistral', () => {
      expect(getProviderDimensions('mistral')).toEqual({ maxWidth: 512, maxHeight: 512 });
    });

    it('returns 384x384 for deepseek', () => {
      expect(getProviderDimensions('deepseek')).toEqual({ maxWidth: 384, maxHeight: 384 });
    });

    it('returns 448x448 for local by default', () => {
      expect(getProviderDimensions('local')).toEqual({ maxWidth: 448, maxHeight: 448 });
    });

    it('honours custom dimensions for local', () => {
      expect(getProviderDimensions('local', false, { maxWidth: 640, maxHeight: 480 })).toEqual({
        maxWidth: 640,
        maxHeight: 480
      });
    });
  });

  describe('estimateVisionTokens', () => {
    it('returns 0 for zero or negative dimensions', () => {
      expect(estimateVisionTokens(0, 100)).toBe(0);
      expect(estimateVisionTokens(100, 0)).toBe(0);
      expect(estimateVisionTokens(-5, 50)).toBe(0);
    });

    it('calculates anthropic tokens: 1920x1080 = 2691', () => {
      expect(estimateVisionTokens(1920, 1080, 'anthropic')).toBe(2691);
    });

    it('calculates openai tokens: 512x512 = 255', () => {
      expect(estimateVisionTokens(512, 512, 'openai')).toBe(255);
    });

    it('calculates gemma tokens in lowTokenMode: 384x384 = 258', () => {
      expect(estimateVisionTokens(384, 384, 'gemma', true)).toBe(258);
    });

    it('calculates llama tokens: 560x560 = 324', () => {
      expect(estimateVisionTokens(560, 560, 'llama')).toBe(324);
    });

    it('calculates mistral tokens: 32x32 = 4', () => {
      expect(estimateVisionTokens(32, 32, 'mistral')).toBe(4);
    });

    it('calculates deepseek tokens: 384x384 = 576', () => {
      expect(estimateVisionTokens(384, 384, 'deepseek')).toBe(576);
    });

    it('calculates local tokens: 56x56 = 4', () => {
      expect(estimateVisionTokens(56, 56, 'local')).toBe(4);
    });
  });
});
