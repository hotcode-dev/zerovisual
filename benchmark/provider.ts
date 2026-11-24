import fs from 'node:fs';
import path from 'node:path';

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

/**
 * Parse `benchmark/.env` into a flat key/value map.
 * Skips blank lines and `#` comments, strips inline comments,
 * preserves embedded `=` in values. Returns `{}` when the file is absent.
 */
export function readBenchmarkEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), 'benchmark/.env');
  const map: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return map;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleanLine = trimmed.split('#')[0]!.trim();
    const [k, ...v] = cleanLine.split('=');
    const key = k?.trim();
    if (!key) continue;
    map[key] = v.join('=').trim();
  }
  return map;
}
