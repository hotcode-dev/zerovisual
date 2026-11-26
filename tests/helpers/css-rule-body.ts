import { expect } from 'vitest';

/**
 * Extract one CSS rule body from a source string: from the given selector
 * (plain string search) to its closing brace.
 * Shared test helper — replaces the per-file rule-body extraction duplicated
 * in the benchmark-explorer-css and custom-css-hero-buttons regression guards.
 */
export function cssRuleBody(src: string, selector: string): string {
  const idx = src.indexOf(selector);
  expect(idx, `selector ${selector} not found`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', idx);
  const close = src.indexOf('}', open);
  return src.slice(open + 1, close);
}
