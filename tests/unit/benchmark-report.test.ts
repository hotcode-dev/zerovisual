import { describe, it, expect } from 'vitest';
import { buildBenchmarkReport, type BenchmarkRunResult } from '../../benchmark/report.js';

// Fixture values are chosen to be unique per case so any misattribution
// between cases is detectable in the rendered markdown.
function mkResult(
  mode: BenchmarkRunResult['mode'],
  caseId: string,
  caseName: string,
  metrics: Partial<BenchmarkRunResult> = {}
): BenchmarkRunResult {
  return {
    mode,
    caseId,
    caseName,
    category: 'layout',
    imageResolution: { width: 1920, height: 1080 },
    imagePayloadBytes: 20480,
    imageFormat: 'png',
    promptTokens: 10,
    imageTokens: 800,
    completionTokens: 40,
    reasoningTokens: 0,
    totalTokens: 850,
    latencyMs: 1500,
    accuracyScore: 70,
    defectFound: true,
    modelAnswer: `Answer for ${caseId} (${mode})`,
    modelReasoning: `Reasoning for ${caseId} (${mode})`,
    traceSessionId: `session-${caseId}-${mode}`,
    ...metrics
  };
}

const RAW = {
  c1: mkResult('without_zerovisual', 'c1', 'Case One', {
    totalTokens: 1000,
    imageTokens: 800,
    imagePayloadBytes: 20480,
    latencyMs: 1500,
    accuracyScore: 70
  }),
  c2: mkResult('without_zerovisual', 'c2', 'Case Two', {
    totalTokens: 2000,
    imageTokens: 1600,
    imagePayloadBytes: 30720,
    latencyMs: 1600,
    accuracyScore: 60
  }),
  c3: mkResult('without_zerovisual', 'c3', 'Case Three', {
    totalTokens: 3000,
    imageTokens: 2400,
    imagePayloadBytes: 40960,
    latencyMs: 1700,
    accuracyScore: 50
  })
};

const OPT = {
  c1: mkResult('with_zerovisual', 'c1', 'Case One', {
    imageResolution: { width: 512, height: 512 },
    imagePayloadBytes: 10240,
    imageTokens: 200,
    totalTokens: 300,
    latencyMs: 900,
    accuracyScore: 90
  }),
  c2: mkResult('with_zerovisual', 'c2', 'Case Two', {
    imageResolution: { width: 512, height: 512 },
    imagePayloadBytes: 12288,
    imageTokens: 250,
    totalTokens: 400,
    latencyMs: 925,
    accuracyScore: 85
  }),
  c3: mkResult('with_zerovisual', 'c3', 'Case Three', {
    imageResolution: { width: 512, height: 512 },
    imagePayloadBytes: 15360,
    imageTokens: 300,
    totalTokens: 500,
    latencyMs: 950,
    accuracyScore: 85
  })
};

// The runner pushes resultA then resultB per case, in case-discovery order.
function fullRunResults(): BenchmarkRunResult[] {
  return [RAW.c1, OPT.c1, RAW.c2, OPT.c2, RAW.c3, OPT.c3];
}

function perCaseTableRows(md: string): string[] {
  const start = md.indexOf('| Test Case |');
  const end = md.indexOf('\n---\n');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return md.slice(start, end).trim().split('\n');
}

function deepDiveSections(md: string): string[] {
  const start = md.indexOf('## 🔬 Deep-Dive Case Details');
  const end = md.indexOf('## 📂 Agent Session Traces');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return md
    .slice(start, end)
    .split('\n### Case ')
    .slice(1)
    .map(s => '### Case ' + s);
}

describe('buildBenchmarkReport', () => {
  it('pairs every raw run with its own optimized run on a fully successful run', () => {
    const md = buildBenchmarkReport(fullRunResults(), 'test-model', 'https://example.test/v1');

    expect(md).toContain('> **Total Test Cases:** 3');

    const rows = perCaseTableRows(md);
    expect(rows).toEqual([
      '| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
      '| **Case One** | Raw Viewport | 1920×1080 | 20.0 KB | 1000 | 800 | 1500 ms | 70% |',
      '| | **ZeroVisual** | **512×512** | **10.0 KB** | **300** | **200** | **900 ms** | **90%** |',
      '| **Case Two** | Raw Viewport | 1920×1080 | 30.0 KB | 2000 | 1600 | 1600 ms | 60% |',
      '| | **ZeroVisual** | **512×512** | **12.0 KB** | **400** | **250** | **925 ms** | **85%** |',
      '| **Case Three** | Raw Viewport | 1920×1080 | 40.0 KB | 3000 | 2400 | 1700 ms | 50% |',
      '| | **ZeroVisual** | **512×512** | **15.0 KB** | **500** | **300** | **950 ms** | **85%** |'
    ]);

    const sections = deepDiveSections(md);
    expect(sections).toHaveLength(3);
    expect(sections[0]).toContain('### Case 1: Case One (`c1`)');
    expect(sections[0]).toContain(
      '- **With ZeroVisual Tokens:** **300** (Image: **200**) | Latency: 900ms | Accuracy: 90%'
    );
    expect(sections[0]).toContain(
      '- **Savings:** **70.0% total tokens**, **75.0% vision image tokens**, **50.0% bandwidth**'
    );
    expect(sections[0]).toContain('> Answer for c1 (with_zerovisual)');
    expect(sections[1]).toContain('### Case 2: Case Two (`c2`)');
    expect(sections[1]).toContain(
      '- **With ZeroVisual Tokens:** **400** (Image: **250**) | Latency: 925ms | Accuracy: 85%'
    );
    expect(sections[1]).toContain('> Answer for c2 (with_zerovisual)');
    expect(sections[2]).toContain('### Case 3: Case Three (`c3`)');
    expect(sections[2]).toContain(
      '- **With ZeroVisual Tokens:** **500** (Image: **300**) | Latency: 950ms | Accuracy: 85%'
    );
    expect(sections[2]).toContain(
      '- **Savings:** **83.3% total tokens**, **87.5% vision image tokens**, **62.5% bandwidth**'
    );

    // Aggregate stats (unchanged logic, pinned here against accidental drift)
    expect(md).toContain(
      '| **Total Tokens Consumed** | **6,000 tokens** | **1,200 tokens** | **-80.0% Token Reduction** |'
    );
    expect(md).toContain(
      '| **Vision Image Tokens (ViT)** | **4,800 tokens** | **750 tokens** | **-84.4% Vision Token Savings** |'
    );
    expect(md).toContain(
      '| **Network Payload Transfer** | **90.0 KB** | **37.0 KB** | **-58.9% Payload Bandwidth Reduction** |'
    );
    expect(md).toContain('| **Average Roundtrip Latency** | **1600 ms** | **925 ms** | **42% Faster** |');
    expect(md).toContain('| **Average Triage Accuracy** | **60.0%** | **86.7%** | **+26.7% Accuracy** |');

    // Session trace links list every run, in input order
    expect(md).toContain(
      '- [`session-c1-without_zerovisual.json`](./sessions/session-c1-without_zerovisual.json) (without_zerovisual, 1000 tokens)'
    );
    expect(md).toContain(
      '- [`session-c3-with_zerovisual.json`](./sessions/session-c3-with_zerovisual.json) (with_zerovisual, 500 tokens)'
    );
  });

  it('keeps remaining pairs aligned when a case is missing its with_zerovisual run (Mode B skipped)', () => {
    // c2's Mode B API call failed after retries: its raw run was pushed, its
    // optimized run was not. With index-based pairing, c3's optimized numbers
    // would silently land on c2's rows.
    const md = buildBenchmarkReport([RAW.c1, OPT.c1, RAW.c2, RAW.c3, OPT.c3], 'test-model', 'https://example.test/v1');

    expect(md).toContain('> **Total Test Cases:** 3');

    const rows = perCaseTableRows(md);
    expect(rows).toEqual([
      '| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
      '| **Case One** | Raw Viewport | 1920×1080 | 20.0 KB | 1000 | 800 | 1500 ms | 70% |',
      '| | **ZeroVisual** | **512×512** | **10.0 KB** | **300** | **200** | **900 ms** | **90%** |',
      '| **Case Two** | Raw Viewport | 1920×1080 | 30.0 KB | 2000 | 1600 | 1600 ms | 60% |',
      '| **Case Three** | Raw Viewport | 1920×1080 | 40.0 KB | 3000 | 2400 | 1700 ms | 50% |',
      '| | **ZeroVisual** | **512×512** | **15.0 KB** | **500** | **300** | **950 ms** | **85%** |'
    ]);

    const sections = deepDiveSections(md);
    expect(sections).toHaveLength(3);

    // c2: raw numbers only, no optimized numbers misattributed from c3
    expect(sections[1]).toContain('### Case 2: Case Two (`c2`)');
    expect(sections[1]).toContain(
      '- **Without ZeroVisual Tokens:** 2000 (Image: 1600) | Latency: 1600ms | Accuracy: 60%'
    );
    expect(sections[1]).not.toContain('With ZeroVisual');
    expect(sections[1]).not.toContain('Savings');
    expect(sections[1]).not.toContain('Model Diagnosis');
    expect(sections[1]).not.toContain('**500**');

    // c3: keeps its own optimized numbers (the old index pairing dropped them)
    expect(sections[2]).toContain('### Case 3: Case Three (`c3`)');
    expect(sections[2]).toContain(
      '- **With ZeroVisual Tokens:** **500** (Image: **300**) | Latency: 950ms | Accuracy: 85%'
    );
    expect(sections[2]).toContain('> Answer for c3 (with_zerovisual)');

    // Aggregates only count the runs that actually exist
    expect(md).toContain(
      '| **Total Tokens Consumed** | **6,000 tokens** | **800 tokens** | **-86.7% Token Reduction** |'
    );
    expect(md).toContain('| **Average Roundtrip Latency** | **1600 ms** | **925 ms** | **42% Faster** |');

    // No session trace link for the skipped Mode B run
    expect(md).not.toContain('session-c2-with_zerovisual');
    expect(md).toContain(
      '- [`session-c3-with_zerovisual.json`](./sessions/session-c3-with_zerovisual.json) (with_zerovisual, 500 tokens)'
    );
  });

  it('drops a case entirely when its raw run is missing (Mode A failed) and keeps the rest aligned', () => {
    const md = buildBenchmarkReport([RAW.c1, OPT.c1, RAW.c3, OPT.c3], 'test-model', 'https://example.test/v1');

    expect(md).toContain('> **Total Test Cases:** 2');

    const rows = perCaseTableRows(md);
    expect(rows).toEqual([
      '| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
      '| **Case One** | Raw Viewport | 1920×1080 | 20.0 KB | 1000 | 800 | 1500 ms | 70% |',
      '| | **ZeroVisual** | **512×512** | **10.0 KB** | **300** | **200** | **900 ms** | **90%** |',
      '| **Case Three** | Raw Viewport | 1920×1080 | 40.0 KB | 3000 | 2400 | 1700 ms | 50% |',
      '| | **ZeroVisual** | **512×512** | **15.0 KB** | **500** | **300** | **950 ms** | **85%** |'
    ]);

    const sections = deepDiveSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toContain('### Case 1: Case One (`c1`)');
    expect(sections[1]).toContain('### Case 2: Case Three (`c3`)');
    expect(sections[1]).toContain('- **With ZeroVisual Tokens:** **500** (Image: **300**)');
    expect(md).not.toContain('Case Two');
  });

  it('preserves input (case discovery) order when results arrive out of case order', () => {
    const md = buildBenchmarkReport([RAW.c3, OPT.c3, RAW.c1, OPT.c1], 'test-model', 'https://example.test/v1');

    const rows = perCaseTableRows(md);
    const rawRowOrder = rows.filter(r => r.includes('Raw Viewport'));
    expect(rawRowOrder[0]).toContain('Case Three');
    expect(rawRowOrder[1]).toContain('Case One');

    const sections = deepDiveSections(md);
    expect(sections[0]).toContain('### Case 1: Case Three (`c3`)');
    expect(sections[0]).toContain('- **With ZeroVisual Tokens:** **500**');
    expect(sections[1]).toContain('### Case 2: Case One (`c1`)');
    expect(sections[1]).toContain('- **With ZeroVisual Tokens:** **300**');
  });

  it('handles an empty result set without crashing or emitting per-case rows', () => {
    const md = buildBenchmarkReport([], 'test-model', 'https://example.test/v1');

    expect(md).toContain('> **Total Test Cases:** 0');
    expect(md).toContain('-0% Token Reduction');
    expect(md).toContain('**0.0 KB**');
    expect(md).toContain('**Comparable**');

    const rows = perCaseTableRows(md);
    expect(rows).toEqual([
      '| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |'
    ]);
    expect(deepDiveSections(md)).toHaveLength(0);
  });

  it('reports zero optimized stats when no mode B run succeeded', () => {
    const md = buildBenchmarkReport([RAW.c1, RAW.c2], 'test-model', 'https://example.test/v1');

    expect(md).toContain('> **Total Test Cases:** 2');
    expect(md).toContain(
      '| **Total Tokens Consumed** | **3,000 tokens** | **0 tokens** | **-100.0% Token Reduction** |'
    );
    expect(md).toContain('| **Average Roundtrip Latency** | **1550 ms** | **0 ms** | **100% Faster** |');
    expect(md).toContain('| **Average Triage Accuracy** | **65.0%** | **0%** | **-65.0%** |');

    const rows = perCaseTableRows(md);
    expect(rows).toHaveLength(4); // header + separator + 2 raw rows, no ZeroVisual rows
    expect(rows.filter(r => r.includes('ZeroVisual'))).toHaveLength(0);

    const sections = deepDiveSections(md);
    expect(sections).toHaveLength(2);
    for (const section of sections) {
      expect(section).not.toContain('With ZeroVisual');
      expect(section).not.toContain('Savings');
    }
  });
});
