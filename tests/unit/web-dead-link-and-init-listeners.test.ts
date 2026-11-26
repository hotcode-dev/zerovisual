import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Regression guard for zf-hdz-e0f97d73 (Ponytail Rung 1):
//  1. The "sessions/ ↗" anchor in BenchmarkExplorer.astro pointed at
//     github.com/hotcode-dev/zerovisual/tree/main/benchmark/results/sessions,
//     but benchmark/results/ is gitignored and untracked, so the live docs
//     site rendered a user-visible 404. The dead link was deleted.
//  2. ImageCompare.astro and TokenCalculator.astro triple-registered their
//     setup function (DOMContentLoaded + astro:page-load + immediate call).
//     This is a static MPA with no SPA mode, astro:page-load never fires, and
//     the hoisted <script> runs with the DOM already available, so the two
//     addEventListener registrations were dead double-invokes. Only the
//     immediate call remains; each setup still runs exactly once.
const root = fileURLToPath(new URL('../..', import.meta.url));
const readText = (rel: string): string => readFileSync(join(root, rel), 'utf8');

/** Recursively collect every file under a directory. */
function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

const countMatches = (src: string, re: RegExp): number => (src.match(re) ?? []).length;

describe('web: dead GitHub sessions/ link removed', () => {
  const astro = readText('web/src/components/BenchmarkExplorer.astro');

  it('no longer links to the gitignored benchmark/results tree on GitHub', () => {
    expect(astro).not.toContain('benchmark/results');
    expect(astro).not.toContain('sessions/ ↗');
    expect(astro).not.toContain('View archived session JSONs');
  });

  it('no file under web/src references benchmark/results anywhere', () => {
    const offenders = listFilesRecursive(join(root, 'web/src'))
      .filter(f => /\.(astro|ts|md|css|json)$/.test(f))
      .filter(f => readFileSync(f, 'utf8').includes('benchmark/results'));
    expect(offenders).toEqual([]);
  });

  it('keeps the surrounding inspector header intact', () => {
    expect(astro).toContain('AI Session Trace &amp; VLM Diagnosis');
    expect(astro).toContain('id="session-model-chip"');
    expect(astro).toContain('role="tablist" aria-label="Session comparison mode"');
  });

  it('leaves the local relative ./sessions/ links in benchmark/report.ts untouched', () => {
    const report = readText('benchmark/report.ts');
    expect(report).toContain('./sessions/');
    expect(report).toContain('benchmark/results/sessions');
  });
});

describe('web: redundant init event listeners removed', () => {
  for (const [file, setupFn] of [
    ['web/src/components/ImageCompare.astro', 'setupImageCompareTabs'],
    ['web/src/components/TokenCalculator.astro', 'setupCalculator']
  ] as const) {
    const src = readText(file);

    it(`${file} registers no DOMContentLoaded or astro:page-load listeners`, () => {
      expect(src).not.toContain("document.addEventListener('DOMContentLoaded'");
      expect(src).not.toContain('astro:page-load');
    });

    it(`${file} still invokes ${setupFn}() exactly once at the end of the script`, () => {
      // The setup call must appear on its own line exactly once; the
      // `function ${setupFn}()` definition is separate and does not match.
      expect(countMatches(src, new RegExp(`^[ \\t]*${setupFn}\\(\\);[ \\t]*$`, 'm'))).toBe(1);
      expect(src.trimEnd().endsWith(`  ${setupFn}();\n</script>`)).toBe(true);
    });
  }
});
