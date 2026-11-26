/**
 * Pure benchmark report builder: aggregate stats + markdown, no I/O.
 *
 * Lives in its own side-effect-free module (runner.ts executes the VLM
 * benchmark on import) so the report logic — in particular the
 * raw/optimized per-case pairing — can be unit-tested in isolation.
 */

import { percentSavings, savingsPct } from '../src/core/provider-math.js';
import type { TokenMetrics } from './types.js';

export interface BenchmarkRunResult extends TokenMetrics {
  mode: 'without_zerovisual' | 'with_zerovisual';
  caseId: string;
  caseName: string;
  category: string;
  imageResolution: { width: number; height: number };
  imagePayloadBytes: number;
  imageFormat: string;
  defectFound: boolean;
  modelAnswer: string;
  modelReasoning: string;
  traceSessionId: string;
}

/**
 * Integer-rounded latency improvement for display — `NN% Faster` in the
 * report, `NN% faster` in the web export. Shared by both so the rounding
 * stays in one place.
 */
export function latencySavingsPct(before: number, after: number): number {
  return Math.round(percentSavings(before, after));
}

export function buildBenchmarkReport(results: BenchmarkRunResult[], model: string, baseUrl: string): string {
  // Compute Aggregate Stats
  const rawRuns = results.filter(r => r.mode === 'without_zerovisual');
  const optRuns = results.filter(r => r.mode === 'with_zerovisual');

  const totalRawTokens = rawRuns.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalOptTokens = optRuns.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalTokenSavings = savingsPct(totalRawTokens, totalOptTokens, '0');

  const totalRawImgTokens = rawRuns.reduce((sum, r) => sum + r.imageTokens, 0);
  const totalOptImgTokens = optRuns.reduce((sum, r) => sum + r.imageTokens, 0);
  const totalImgTokenSavings = savingsPct(totalRawImgTokens, totalOptImgTokens, '0');

  const totalRawBytes = rawRuns.reduce((sum, r) => sum + r.imagePayloadBytes, 0);
  const totalOptBytes = optRuns.reduce((sum, r) => sum + r.imagePayloadBytes, 0);
  const totalByteSavings = savingsPct(totalRawBytes, totalOptBytes, '0');

  const avgRawLatency =
    rawRuns.length > 0 ? Math.round(rawRuns.reduce((sum, r) => sum + r.latencyMs, 0) / rawRuns.length) : 0;
  const avgOptLatency =
    optRuns.length > 0 ? Math.round(optRuns.reduce((sum, r) => sum + r.latencyMs, 0) / optRuns.length) : 0;

  const avgRawAccuracy =
    rawRuns.length > 0 ? (rawRuns.reduce((sum, r) => sum + r.accuracyScore, 0) / rawRuns.length).toFixed(1) : '0';
  const avgOptAccuracy =
    optRuns.length > 0 ? (optRuns.reduce((sum, r) => sum + r.accuracyScore, 0) / optRuns.length).toFixed(1) : '0';

  // Build Markdown Report
  let md = `# 📊 ZeroVisual Empirical Benchmark Report\n\n`;
  md += `> **Model Evaluated:** \`${model}\` via \`${baseUrl}\`\n`;
  md += `> **Date:** ${new Date().toISOString()}\n`;
  md += `> **Total Test Cases:** ${rawRuns.length}\n\n`;

  md += `## 🌟 Executive Summary\n\n`;
  md += `| Core Metric | Without ZeroVisual (Raw) | With ZeroVisual (Optimized) | Empirical Improvement |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **Total Tokens Consumed** | **${totalRawTokens.toLocaleString()} tokens** | **${totalOptTokens.toLocaleString()} tokens** | **-${totalTokenSavings}% Token Reduction** |\n`;
  md += `| **Vision Image Tokens (ViT)** | **${totalRawImgTokens.toLocaleString()} tokens** | **${totalOptImgTokens.toLocaleString()} tokens** | **-${totalImgTokenSavings}% Vision Token Savings** |\n`;
  md += `| **Network Payload Transfer** | **${(totalRawBytes / 1024).toFixed(1)} KB** | **${(totalOptBytes / 1024).toFixed(1)} KB** | **-${totalByteSavings}% Payload Bandwidth Reduction** |\n`;
  md += `| **Average Roundtrip Latency** | **${avgRawLatency} ms** | **${avgOptLatency} ms** | **${avgRawLatency > avgOptLatency ? `${latencySavingsPct(avgRawLatency, avgOptLatency)}% Faster` : 'Comparable'}** |\n`;
  md += `| **Average Triage Accuracy** | **${avgRawAccuracy}%** | **${avgOptAccuracy}%** | **${Number(avgOptAccuracy) >= Number(avgRawAccuracy) ? `+${(Number(avgOptAccuracy) - Number(avgRawAccuracy)).toFixed(1)}% Accuracy` : `${(Number(avgOptAccuracy) - Number(avgRawAccuracy)).toFixed(1)}%`}** |\n\n`;

  md += `## 📋 Per-Case Benchmark Breakdown\n\n`;
  md += `| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  // Pair raw/optimized runs by caseId, not array index: when a case's Mode B
  // run is skipped (API failure after retries) it has no 'with_zerovisual'
  // entry, and positional pairing would silently attribute the next case's
  // optimized numbers to this case.
  const pairs = rawRuns.map(raw => ({ raw, opt: optRuns.find(o => o.caseId === raw.caseId) }));

  for (let i = 0; i < pairs.length; i++) {
    const { raw, opt } = pairs[i];

    md += `| **${raw.caseName}** | Raw Viewport | ${raw.imageResolution.width}×${raw.imageResolution.height} | ${(raw.imagePayloadBytes / 1024).toFixed(1)} KB | ${raw.totalTokens} | ${raw.imageTokens} | ${raw.latencyMs} ms | ${raw.accuracyScore}% |\n`;
    if (opt) {
      md += `| | **ZeroVisual** | **${opt.imageResolution.width}×${opt.imageResolution.height}** | **${(opt.imagePayloadBytes / 1024).toFixed(1)} KB** | **${opt.totalTokens}** | **${opt.imageTokens}** | **${opt.latencyMs} ms** | **${opt.accuracyScore}%** |\n`;
    }
  }

  md += `\n---\n\n`;
  md += `## 🔬 Deep-Dive Case Details & Model Responses\n\n`;

  for (let i = 0; i < pairs.length; i++) {
    const { raw, opt } = pairs[i];

    md += `### Case ${i + 1}: ${raw.caseName} (\`${raw.caseId}\`)\n\n`;
    md += `- **Category:** ${raw.category}\n`;
    md += `- **Without ZeroVisual Tokens:** ${raw.totalTokens} (Image: ${raw.imageTokens}) | Latency: ${raw.latencyMs}ms | Accuracy: ${raw.accuracyScore}%\n`;
    if (opt) {
      const savedPct = savingsPct(raw.totalTokens, opt.totalTokens);
      const imgSavedPct = savingsPct(raw.imageTokens, opt.imageTokens, '0');
      const bandSavedPct = savingsPct(raw.imagePayloadBytes, opt.imagePayloadBytes);
      md += `- **With ZeroVisual Tokens:** **${opt.totalTokens}** (Image: **${opt.imageTokens}**) | Latency: ${opt.latencyMs}ms | Accuracy: ${opt.accuracyScore}%\n`;
      md += `- **Savings:** **${savedPct}% total tokens**, **${imgSavedPct}% vision image tokens**, **${bandSavedPct}% bandwidth**\n\n`;

      md += `#### Model Diagnosis (ZeroVisual Optimized)\n`;
      const cleanAnswer = (opt.modelAnswer || opt.modelReasoning.slice(-400)).trim();
      md += `> ${cleanAnswer.replace(/\n/g, '\n> ')}\n\n`;
    }
  }

  md += `## 📂 Agent Session Traces\n\n`;
  md += `Full interaction sessions (prompts, raw reasoning, tool outputs, latency metrics) are archived in JSON format under \`benchmark/results/sessions/\`:\n\n`;
  results.forEach(r => {
    md += `- [\`${r.traceSessionId}.json\`](./sessions/${r.traceSessionId}.json) (${r.mode}, ${r.totalTokens} tokens)\n`;
  });

  return md;
}
