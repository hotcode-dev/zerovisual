/**
 * Shared ground-truth shape for benchmark test cases.
 *
 * Reused by runner.ts (accuracy evaluation + trace sessions),
 * generate-dataset.ts (dataset case config), and export-web-data.ts
 * (web data export), so the 6-field shape cannot drift between the
 * three copies.
 *
 * `expectedBoundingBox` is optional: generate-dataset.ts already omits
 * it on some entries and computes/verifies it at run time, and runner.ts
 * already types the crop box as optional.
 */
export interface GroundTruth {
  defect: string;
  affectedElement: string;
  defectType: string;
  rootCause: string;
  suggestedFix: string;
  expectedBoundingBox?: { x: number; y: number; width: number; height: number };
}

/** Per-run vision-token + latency metrics shared by report.ts and export-web-data.ts. */
export interface TokenMetrics {
  imageTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  latencyMs: number;
  accuracyScore: number;
}
