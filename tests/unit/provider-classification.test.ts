import { describe, it, expect } from 'vitest';
import { classifyProvider } from '../../benchmark/provider.js';
import type { TargetProvider } from '../../src/core/schema.js';

describe('classifyProvider (benchmark provider classification)', () => {
  it('classifies Gemini-named models as gemini (the runner.ts divergence case)', () => {
    expect(classifyProvider('RadixArk/Gemini-2.5-Pro')).toBe('gemini');
    expect(classifyProvider('RadixArk/GEMINI-1.5-FLASH')).toBe('gemini');
    expect(classifyProvider('gemini-2.0-flash')).toBe('gemini');
  });

  it('classifies Gemma-named models as gemini', () => {
    expect(classifyProvider('google/gemma-3-27b-it')).toBe('gemini');
    expect(classifyProvider('Gemma-3-4B')).toBe('gemini');
  });

  it('classifies Qwen-named models as qwen', () => {
    expect(classifyProvider('RadixArk/Qwen3.8-27B-NVFP4')).toBe('qwen');
    expect(classifyProvider('Qwen/Qwen2-VL-7B-Instruct')).toBe('qwen');
    expect(classifyProvider('qwen-vl-plus')).toBe('qwen');
  });

  it('classifies anything else as local', () => {
    expect(classifyProvider('meta-llama/Llama-3.2-11B-Vision')).toBe('local');
    expect(classifyProvider('openai/gpt-4o')).toBe('local');
    expect(classifyProvider('mistralai/mistral-small-3.2')).toBe('local');
    expect(classifyProvider('')).toBe('local');
  });

  it('is case-insensitive', () => {
    expect(classifyProvider('QWEN3-VL')).toBe('qwen');
    expect(classifyProvider('GEMMA-3')).toBe('gemini');
    expect(classifyProvider('LLaMA-3.1')).toBe('local');
  });

  it('gives qwen precedence when a name matches both families', () => {
    // Mirrors the historical getBenchmarkProvider() ordering in
    // export-web-data.ts (qwen checked before gemma/gemini).
    expect(classifyProvider('Qwen-Gemma-Mix')).toBe('qwen');
  });

  it('returns a value assignable to TargetProvider (tile-math contract)', () => {
    // Compile-time guard: every classification must be a valid TargetProvider
    // so optimizeImageForProvider()/estimateVisionTokens() accept the result.
    const q: TargetProvider = classifyProvider('RadixArk/Qwen3.8-27B-NVFP4');
    const g: TargetProvider = classifyProvider('google/gemma-3-27b-it');
    const l: TargetProvider = classifyProvider('meta-llama/Llama-3.2-11B-Vision');
    expect([q, g, l]).toEqual(['qwen', 'gemini', 'local']);
  });
});
