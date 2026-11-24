/**
 * Single source of truth for mapping an AGENT_MODEL name to the
 * TargetProvider tile/token math the benchmark suite must apply.
 *
 * Both runner.ts (Mode B image optimization) and export-web-data.ts
 * (web data export) route through this helper so the classification
 * cannot drift between the two copies again.
 */
export function classifyProvider(model: string): 'qwen' | 'gemini' | 'local' {
  const m = model.toLowerCase();
  if (m.includes('qwen')) return 'qwen';
  if (m.includes('gemma') || m.includes('gemini')) return 'gemini';
  return 'local';
}
