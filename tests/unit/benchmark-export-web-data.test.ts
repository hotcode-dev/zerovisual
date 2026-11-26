import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { extractFunctionSource } from '../helpers/extract-function-source.js';

// export-web-data.ts is not importable in unit tests: it is a script that runs
// exportWebData() on load (filesystem + sharp side effects) and
// buildSessionMetrics is module-local. To cover it without restructuring the
// module, we lift the function's actual source out of export-web-data.ts,
// transpile it to plain JS, and pin its exact semantics — same technique as
// benchmark-runner-effective-answer.test.ts.

const source = readFileSync(fileURLToPath(new URL('../../benchmark/export-web-data.ts', import.meta.url)), 'utf8');

const buildSessionMetrics = new Function(
  `${
    ts.transpileModule(extractFunctionSource(source, 'export-web-data.ts', 'buildSessionMetrics'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
    }).outputText
  }
return buildSessionMetrics;`
)() as (session: any, caseId: string, mode: 'without' | 'with', fallbacks: any) => any;

const FALLBACKS = {
  resolution: { width: 700, height: 500 },
  payloadBytes: 999,
  imageTokens: 777,
  completionTokens: 1111,
  reasoningTokens: 2222,
  totalTokens: 3333,
  latencyMs: 4444
};

function sessionWithMetrics(metrics: Record<string, number> | undefined) {
  return {
    id: 'session-case1-without',
    inputImage: { resolution: { width: 800, height: 600 }, bytes: 555 },
    metrics,
    output: { content: 'answer text', reasoning: 'reasoning text' }
  };
}

describe('buildSessionMetrics (benchmark/export-web-data.ts)', () => {
  it('preserves legitimate 0 measurements instead of substituting fabricated fallbacks', () => {
    const out = buildSessionMetrics(
      sessionWithMetrics({
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        accuracyScore: 0
      }),
      'case1',
      'without',
      FALLBACKS
    );
    expect(out.completionTokens).toBe(0);
    expect(out.reasoningTokens).toBe(0);
    expect(out.totalTokens).toBe(0);
    expect(out.latencyMs).toBe(0);
    expect(out.accuracyScore).toBe(0);
  });

  it('preserves 0 in "with" mode as well', () => {
    const out = buildSessionMetrics(
      sessionWithMetrics({
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        accuracyScore: 0
      }),
      'case1',
      'with',
      FALLBACKS
    );
    expect(out.completionTokens).toBe(0);
    expect(out.reasoningTokens).toBe(0);
    expect(out.totalTokens).toBe(0);
    expect(out.latencyMs).toBe(0);
    expect(out.accuracyScore).toBe(0);
  });

  it('still substitutes fallbacks for genuinely absent (undefined) fields', () => {
    const out = buildSessionMetrics(sessionWithMetrics(undefined), 'case1', 'without', FALLBACKS);
    expect(out.completionTokens).toBe(1111);
    expect(out.reasoningTokens).toBe(2222);
    expect(out.totalTokens).toBe(3333);
    expect(out.latencyMs).toBe(4444);
    expect(out.sessionId).toBe('session-case1-without');
  });

  it('handles mixed present-zero, present-nonzero, and absent fields independently', () => {
    const out = buildSessionMetrics(
      sessionWithMetrics({ completionTokens: 0, totalTokens: 42, latencyMs: 0 }),
      'case1',
      'with',
      FALLBACKS
    );
    expect(out.completionTokens).toBe(0);
    expect(out.reasoningTokens).toBe(2222); // absent → fallback
    expect(out.totalTokens).toBe(42); // nonzero → preserved
    expect(out.latencyMs).toBe(0);
  });

  it('uses a simulated sessionId and all fallbacks when no session trace exists', () => {
    const out = buildSessionMetrics(null, 'case1', 'without', FALLBACKS);
    expect(out.sessionId).toBe('simulated-case1-without');
    expect(out.imagePayloadBytes).toBe(999);
    expect(out.imageTokens).toBe(777);
    expect(out.completionTokens).toBe(1111);
    expect(out.reasoningTokens).toBe(2222);
    expect(out.totalTokens).toBe(3333);
    expect(out.latencyMs).toBe(4444);
  });

  it('keeps non-zero real measurements untouched', () => {
    const out = buildSessionMetrics(
      sessionWithMetrics({
        imageTokens: 100,
        completionTokens: 40,
        reasoningTokens: 30,
        totalTokens: 170,
        latencyMs: 1500,
        accuracyScore: 70
      }),
      'case1',
      'without',
      FALLBACKS
    );
    expect(out.imageTokens).toBe(100);
    expect(out.completionTokens).toBe(40);
    expect(out.reasoningTokens).toBe(30);
    expect(out.totalTokens).toBe(170);
    expect(out.latencyMs).toBe(1500);
    expect(out.accuracyScore).toBe(70);
  });

  it('pins the pre-existing imageTokens guard: 0 still falls back (unchanged behavior)', () => {
    const out = buildSessionMetrics(sessionWithMetrics({ imageTokens: 0 }), 'case1', 'without', FALLBACKS);
    expect(out.imageTokens).toBe(777);
  });

  it('applies the per-mode accuracy fallbacks', () => {
    // session present, accuracy missing → 65 for both modes
    expect(buildSessionMetrics(sessionWithMetrics({}), 'c', 'without', FALLBACKS).accuracyScore).toBe(65);
    expect(buildSessionMetrics(sessionWithMetrics({}), 'c', 'with', FALLBACKS).accuracyScore).toBe(65);
    // no session → with mode simulates a 100% pass, without mode stays 65
    expect(buildSessionMetrics(null, 'c', 'with', FALLBACKS).accuracyScore).toBe(100);
    expect(buildSessionMetrics(null, 'c', 'without', FALLBACKS).accuracyScore).toBe(65);
  });
});
