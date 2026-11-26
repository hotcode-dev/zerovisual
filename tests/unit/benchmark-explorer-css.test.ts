import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Regression guard for zf-hdz-2c3ea7d9 (Ponytail Rung 6/2): the three button
// classes in BenchmarkExplorer.astro shared a byte-identical 10-line base
// block plus a duplicated hover state. The base is now a single grouped
// selector and the two identical hover states are grouped. This test pins
// the consolidated structure so a future "restore the original classes"
// edit cannot silently reintroduce the duplication.
const readText = (rel: string): string => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');

// Extract one CSS rule body: from the given selector (line start) to its closing brace.
const ruleBody = (src: string, selector: string): string => {
  const idx = src.indexOf(selector);
  expect(idx, `selector ${selector} not found`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', idx);
  const close = src.indexOf('}', open);
  return src.slice(open + 1, close);
};

const SHARED_PROPS = [
  'min-height: 44px;',
  'padding: 0 0.875rem;',
  'border-radius: 6px;',
  'font-size: 0.75rem;',
  'font-weight: 500;',
  'color: #cbd5e1;',
  'background: transparent;',
  'border: 1px solid transparent;',
  'cursor: pointer;',
  'transition: background-color 150ms var(--zv-ease-out), color 150ms var(--zv-ease-out), border-color 150ms var(--zv-ease-out);'
];

describe('BenchmarkExplorer.astro button CSS dedupe', () => {
  const astro = readText('web/src/components/BenchmarkExplorer.astro');

  it('defines a single grouped base rule covering all three button classes', () => {
    const body = ruleBody(astro, '.filter-btn, .img-view-tab, .session-mode-btn {');
    for (const prop of SHARED_PROPS) {
      expect(body, `missing ${prop}`).toContain(prop);
    }
  });

  it('does not repeat the shared properties in any individual class rule', () => {
    const imgBody = ruleBody(astro, '.img-view-tab {');
    for (const prop of SHARED_PROPS) {
      expect(imgBody, `img-view-tab reintroduced ${prop}`).not.toContain(prop);
    }
    // No standalone base rules remain for the other two classes (only the
    // grouped base, grouped hover, and .active variants reference them).
    expect(astro).not.toMatch(/^[ \t]*\.filter-btn \{/m);
    expect(astro).not.toMatch(/^[ \t]*\.session-mode-btn \{/m);
  });

  it('keeps .img-view-tab layout-specific properties', () => {
    const body = ruleBody(astro, '.img-view-tab {');
    expect(body).toContain('display: inline-flex;');
    expect(body).toContain('align-items: center;');
  });

  it('groups the two identical hover:not(.active) states', () => {
    const body = ruleBody(astro, '.filter-btn:hover:not(.active), .session-mode-btn:hover:not(.active) {');
    expect(body).toContain('color: #ffffff;');
    expect(body).toContain('background: #161d2b;');
    // The standalone session-mode hover rule must be gone (grouped now).
    expect(astro).not.toMatch(/^[ \t]*\.session-mode-btn:hover:not\(\.active\)[ \t]*\{/m);
  });

  it('leaves the per-variant .active color rules untouched', () => {
    expect(astro).toContain('.filter-btn.active {');
    expect(astro).toContain('.filter-btn.active {\n    background: #161d2b;\n    color: #a7f3d0;');
    expect(astro).toContain('.session-mode-btn[data-mode="with"].active {');
    expect(astro).toContain('.session-mode-btn[data-mode="without"].active {');
    expect(astro).toContain('.img-view-tab[data-view="baseline"].active {');
    expect(astro).toContain('.img-view-tab[data-view="actual"].active {');
    expect(astro).toContain('.img-view-tab[data-view="diff"].active {');
    expect(astro).toContain('.img-view-tab[data-view="crop"].active {');
  });

  it('still references the classes in the template (no orphaned CSS)', () => {
    expect(astro).toContain('class="filter-btn');
    expect(astro).toContain('class="img-view-tab');
    expect(astro).toContain('class="session-mode-btn');
  });
});
