import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { cssRuleBody } from '../helpers/css-rule-body.js';

// Regression guard for zf-hdz-3962e993 (Ponytail Rung 1): six legacy
// `.action` / `.action.primary` / `.action.secondary` selectors in
// web/src/styles/custom.css matched no element in the rendered DOM (Starlight
// hero buttons render as `sl-link-button primary|secondary` since the
// LinkButton component era) and were removed. This test pins the removal so a
// future "restore the legacy selectors" edit cannot silently reintroduce the
// dead rules, and pins the surviving .sl-link-button.* overrides so the hero
// button styling cannot be lost.
const css = readFileSync(fileURLToPath(new URL('../../web/src/styles/custom.css', import.meta.url)), 'utf8');

// `.action` as a selector fragment: not followed by a word char or hyphen,
// so the live `.hero .actions` rule does not trip it.
const DEAD_SELECTOR = /\.action(?![\w-])/;

describe('custom.css hero button selectors', () => {
  it('contains no .action / .action.primary / .action.secondary selectors', () => {
    expect(css, 'dead .action selector present').not.toMatch(DEAD_SELECTOR);
  });

  it.each([
    ['.sl-link-button.primary {', 'background-color: #10b981 !important;'],
    ['.sl-link-button.primary:hover {', 'background-color: #34d399 !important;'],
    ['.sl-link-button.primary:active {', 'transform: scale(0.98);'],
    ['.sl-link-button.secondary {', 'background-color: var(--zv-surface) !important;'],
    ['.sl-link-button.secondary:hover {', 'background-color: var(--zv-surface-elevated) !important;'],
    ['.sl-link-button.secondary:active {', 'transform: scale(0.98);']
  ])('keeps the live %s override with its key declaration', (selector, prop) => {
    expect(cssRuleBody(css, selector), `missing ${prop} in ${selector}`).toContain(prop);
  });
});
