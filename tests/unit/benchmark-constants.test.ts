import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { DEFAULT_AGENT_MODEL, BENCHMARK_WEBP_QUALITY, BENCHMARK_CROP_PADDING_PX } from '../../benchmark/provider.js';

// Drift-guard for zf-hdz-d5a9983f (Ponytail Rung 2):
// Three magic constants (default model, WebP quality, crop padding) were
// copy-pasted across runner.ts, export-web-data.ts and generate-dataset.ts.
// They now live in benchmark/provider.ts. This test pins the canonical
// values and verifies that no inline literal survives in the entrypoints,
// so a future "fix one copy" cannot silently desync the others.

const readSrc = (rel: string): string => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');

describe('benchmark shared constants (single source of truth)', () => {
  it('pins the canonical values', () => {
    expect(DEFAULT_AGENT_MODEL).toBe('RadixArk/Qwen3.8-27B-NVFP4');
    expect(BENCHMARK_WEBP_QUALITY).toBe(85);
    expect(BENCHMARK_CROP_PADDING_PX).toBe(32);
  });

  it('runner.ts references the shared constants', () => {
    const src = readSrc('benchmark/runner.ts');
    expect(src).toContain('DEFAULT_AGENT_MODEL');
    expect(src).toContain('BENCHMARK_WEBP_QUALITY');
    expect(src).toContain('BENCHMARK_CROP_PADDING_PX');
  });

  it('export-web-data.ts references the shared constants', () => {
    const src = readSrc('benchmark/export-web-data.ts');
    expect(src).toContain('DEFAULT_AGENT_MODEL');
    expect(src).toContain('BENCHMARK_WEBP_QUALITY');
    expect(src).toContain('BENCHMARK_CROP_PADDING_PX');
  });

  it('generate-dataset.ts references the shared constant', () => {
    const src = readSrc('benchmark/generate-dataset.ts');
    expect(src).toContain('BENCHMARK_CROP_PADDING_PX');
  });

  it('no copy-pasted literals remain in the entrypoints', () => {
    for (const f of ['benchmark/runner.ts', 'benchmark/export-web-data.ts', 'benchmark/generate-dataset.ts']) {
      const src = readSrc(f);
      // The bare model literal (not inside a string that is the constant itself)
      expect(src).not.toContain("'RadixArk/Qwen3.8-27B-NVFP4'");
      // quality: 85 as a numeric literal in a call argument
      expect(src).not.toMatch(/quality:\s*85\b/);
      // padding: 32 passed to detectDiffBoundingBox (CSS padding: 32px is excluded)
      expect(src).not.toMatch(/detectDiffBoundingBox\([^)]*padding:\s*32\b/);
    }
  });
});
