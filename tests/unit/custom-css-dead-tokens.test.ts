import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Regression guard for zf-hdz-0f97eaf0 (Ponytail Rung 1): six ZeroVisual design
// tokens in web/src/styles/custom.css had zero usage sites anywhere in the repo
// (no `var(--zv-…)` reference in any .astro/.ts/.css/.mjs file) and were
// removed. This test pins the removal so a future "add the missing accent"
// edit cannot silently reintroduce the dead definitions, and pins a sample of
// live tokens so an over-eager cleanup cannot delete tokens that are still in
// use. Companion to custom-css-hero-buttons.test.ts (zf-hdz-3962e993).
const css = readFileSync(fileURLToPath(new URL('../../web/src/styles/custom.css', import.meta.url)), 'utf8');

// Exactly the tokens removed by zf-hdz-0f97eaf0.
const DEAD_TOKENS = [
  '--zv-surface-subtle',
  '--zv-accent-strong',
  '--zv-cyan',
  '--zv-rose',
  '--zv-rose-strong',
  '--zv-amber'
];

// Live tokens that must survive (spot-check; the full live set is pinned by
// the CSS rules that reference them).
const LIVE_TOKENS = [
  '--zv-surface',
  '--zv-surface-elevated',
  '--zv-border',
  '--zv-border-strong',
  '--zv-accent',
  '--zv-accent-soft',
  '--zv-text',
  '--zv-text-muted',
  '--zv-radius-md',
  '--zv-ease-out'
];

describe('custom.css dead design tokens', () => {
  it.each(DEAD_TOKENS)('contains no reference to the dead token %s', token => {
    expect(css, `${token} present in custom.css`).not.toContain(token);
  });

  it.each(LIVE_TOKENS)('still defines the live token %s', token => {
    expect(css, `${token} missing from custom.css`).toContain(`${token}:`);
  });
});
