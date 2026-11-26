import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Drift-guard for zf-hdz-9b5df5e1 (Ponytail Rung 2):
// The one-decimal percentSavings display string was copy-pasted 11 times
// across runner.ts, export-web-data.ts and report.ts, with three different
// zero-denominator fallback spellings ('0.0', '0', none). It now lives in
// savingsPct() in src/core/provider-math.ts. This test pins the dedup so a
// future "fix one copy" cannot silently reintroduce an inline duplicate.
// Semantic coverage of savingsPct() itself lives in provider-math.test.ts.

const readSrc = (rel: string): string => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');

const FILES = ['benchmark/runner.ts', 'benchmark/export-web-data.ts', 'benchmark/report.ts'];

describe('benchmark savingsPct dedup (single source of truth)', () => {
  it('no inline percentSavings(...).toFixed(1) remains in any benchmark file', () => {
    for (const f of FILES) {
      const src = readSrc(f);
      expect(src).not.toMatch(/percentSavings\([^)]*\)\s*\.toFixed\(\s*1\s*\)/);
    }
  });

  it('each benchmark file routes through the shared savingsPct helper', () => {
    for (const f of FILES) {
      expect(readSrc(f)).toContain('savingsPct');
    }
  });
});
