import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { deactivateGroup, setGroupActive, type ToggleGroup } from '../../web/src/lib/toggle-group.js';

// Regression guard + unit coverage for zf-hdz-fbc7bca4 (Ponytail Rung 2):
// the "deactivate every group element, then activate the clicked one"
// pattern was duplicated in 4 inline copies across BenchmarkExplorer.astro,
// TokenCalculator.astro and ImageCompare.astro. It now lives in
// web/src/lib/toggle-group.ts as setGroupActive (full toggle) and
// deactivateGroup (reset-only variant used by TokenCalculator's img.onload).

/** Minimal DOM Element stand-in tracking classes and attributes (node env, no DOM). */
class FakeElement {
  readonly classes = new Set<string>();
  readonly attrs = new Map<string, string>();
  readonly classList = {
    add: (c: string) => {
      this.classes.add(c);
    },
    remove: (c: string) => {
      this.classes.delete(c);
    },
    contains: (c: string) => this.classes.has(c)
  };
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
}

const makeEl = (active = false, ariaValue?: string): FakeElement => {
  const el = new FakeElement();
  if (active) el.classes.add('active');
  if (ariaValue !== undefined) el.attrs.set('aria-pressed', ariaValue);
  return el;
};

/** Cast fake-element collections to the module's group type. */
const asGroup = (els: FakeElement[]): ToggleGroup => els as unknown as ToggleGroup;

/** Cast a fake element where the module expects a DOM Element. */
const asEl = (el: FakeElement): Element => el as unknown as Element;

/** Build a NodeList-shaped collection: length, numeric indices, item(), iterator. */
function fakeNodeList(els: FakeElement[]): ToggleGroup {
  const obj: Record<string, unknown> = {
    length: els.length,
    item: (i: number) => els[i] ?? null,
    [Symbol.iterator]: function* () {
      for (const el of els) yield el;
    }
  };
  els.forEach((el, i) => (obj[i] = el));
  return obj as unknown as ToggleGroup;
}

describe('setGroupActive', () => {
  it('deactivates every group member and activates the clicked element (aria-pressed)', () => {
    const a = makeEl(true, 'true');
    const b = makeEl(true, 'false');
    const c = makeEl(true, 'false');
    const group = asGroup([a, b, c]);

    setGroupActive(group, asEl(c), 'aria-pressed');

    expect(a.classes.has('active')).toBe(false);
    expect(a.attrs.get('aria-pressed')).toBe('false');
    expect(b.classes.has('active')).toBe(false);
    expect(b.attrs.get('aria-pressed')).toBe('false');
    expect(c.classes.has('active')).toBe(true);
    expect(c.attrs.get('aria-pressed')).toBe('true');
  });

  it('supports the aria-selected variant used by tab groups', () => {
    const a = makeEl(true);
    const b = makeEl(true);
    setGroupActive(asGroup([a, b]), asEl(a), 'aria-selected');
    expect(a.classes.has('active')).toBe(true);
    expect(a.attrs.get('aria-selected')).toBe('true');
    expect(b.classes.has('active')).toBe(false);
    expect(b.attrs.get('aria-selected')).toBe('false');
  });

  it('accepts a NodeList-shaped group (querySelectorAll result)', () => {
    const a = makeEl(true, 'true');
    const b = makeEl(false, 'false');
    setGroupActive(fakeNodeList([a, b]), asEl(b), 'aria-pressed');
    expect(a.classes.has('active')).toBe(false);
    expect(b.classes.has('active')).toBe(true);
    expect(b.attrs.get('aria-pressed')).toBe('true');
  });

  it('accepts a bare array-like group without an iterator', () => {
    const a = makeEl(true, 'true');
    const b = makeEl(false, 'false');
    const arrayLike = { 0: a, 1: b, length: 2 };
    setGroupActive(arrayLike as unknown as ToggleGroup, asEl(b), 'aria-pressed');
    expect(a.classes.has('active')).toBe(false);
    expect(a.attrs.get('aria-pressed')).toBe('false');
    expect(b.classes.has('active')).toBe(true);
    expect(b.attrs.get('aria-pressed')).toBe('true');
  });

  it('activates a clicked element that is not part of the group', () => {
    const a = makeEl(true, 'true');
    const outside = makeEl(false, 'false');
    setGroupActive(asGroup([a]), asEl(outside), 'aria-pressed');
    expect(a.classes.has('active')).toBe(false);
    expect(outside.classes.has('active')).toBe(true);
    expect(outside.attrs.get('aria-pressed')).toBe('true');
  });

  it('overwrites a stale aria value on the clicked element (false -> true)', () => {
    const a = makeEl(true, 'false');
    setGroupActive(asGroup([a]), asEl(a), 'aria-pressed');
    expect(a.classes.has('active')).toBe(true);
    expect(a.attrs.get('aria-pressed')).toBe('true');
  });

  it('is idempotent when the same element is clicked twice in a row', () => {
    const a = makeEl(false, 'false');
    const b = makeEl(false, 'false');
    setGroupActive(asGroup([a, b]), asEl(a), 'aria-pressed');
    setGroupActive(asGroup([a, b]), asEl(a), 'aria-pressed');
    expect(a.classes.has('active')).toBe(true);
    expect(a.attrs.get('aria-pressed')).toBe('true');
    expect(b.classes.has('active')).toBe(false);
    expect(b.attrs.get('aria-pressed')).toBe('false');
  });

  it('handles a single-element group and an empty group without throwing', () => {
    const only = makeEl(false, 'false');
    const clicked = makeEl(false, 'false');
    expect(() => setGroupActive(asGroup([only]), asEl(only), 'aria-pressed')).not.toThrow();
    expect(() => setGroupActive(asGroup([]), asEl(clicked), 'aria-pressed')).not.toThrow();
    expect(clicked.classes.has('active')).toBe(true);
  });
});

describe('deactivateGroup', () => {
  it('removes active and sets the aria attr to false on every element, activating nothing', () => {
    const a = makeEl(true, 'true');
    const b = makeEl(true, 'true');
    deactivateGroup(asGroup([a, b]), 'aria-pressed');
    for (const el of [a, b]) {
      expect(el.classes.has('active')).toBe(false);
      expect(el.attrs.get('aria-pressed')).toBe('false');
    }
  });

  it('supports the aria-selected variant', () => {
    const a = makeEl(true);
    const b = makeEl(true);
    deactivateGroup(asGroup([a, b]), 'aria-selected');
    for (const el of [a, b]) {
      expect(el.classes.has('active')).toBe(false);
      expect(el.attrs.get('aria-selected')).toBe('false');
    }
  });

  it('is a no-op on an empty group', () => {
    expect(() => deactivateGroup(asGroup([]), 'aria-pressed')).not.toThrow();
  });

  it('leaves already-inactive elements untouched (idempotent)', () => {
    const a = makeEl(false, 'false');
    const seen: string[] = [];
    const tracked = {
      add: () => seen.push('add'),
      remove: () => seen.push('remove'),
      contains: () => false
    };
    const el = {
      classList: tracked,
      setAttribute: (name: string, value: string) => seen.push(`${name}=${value}`)
    };
    deactivateGroup([el] as unknown as ToggleGroup, 'aria-pressed');
    // Still executed the reset (classes/attrs converge to the inactive state),
    // and never added the active class.
    expect(seen).toEqual(['remove', 'aria-pressed=false']);
    expect(a.classes.has('active')).toBe(false);
  });
});

describe('web: inline toggle-group loops removed from components', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const readText = (rel: string): string => readFileSync(`${root}/${rel}`, 'utf8');

  it('BenchmarkExplorer.astro imports the shared helper and keeps all 3 call sites', () => {
    const astro = readText('web/src/components/BenchmarkExplorer.astro');
    expect(astro).toContain("import { setGroupActive } from '../lib/toggle-group.ts';");
    // No inline deactivation loop and no local helper definition remain.
    expect(astro).not.toContain("classList.remove('active')");
    expect(astro).not.toMatch(/function setGroupActive\(/);
    // The 3 original call sites are intact with their per-site aria attrs.
    expect(astro).toContain("setGroupActive(filterBtns, btn, 'aria-pressed')");
    expect(astro).toContain("setGroupActive(imgViewTabs, tab, 'aria-selected')");
    expect(astro).toContain("setGroupActive(sessionModeBtns, btn, 'aria-selected')");
    // The script must stay a bundled module script so the import works
    // (a re-introduced is:inline script would silently break the import).
    expect(astro).toContain('<script define:vars={{ benchmarkData }}>');
    expect(astro).not.toContain('is:inline');
  });

  it('TokenCalculator.astro uses the shared helpers at both sites', () => {
    const astro = readText('web/src/components/TokenCalculator.astro');
    expect(astro).toContain("import { deactivateGroup, setGroupActive } from '../lib/toggle-group.ts';");
    expect(astro).not.toContain("classList.remove('active')");
    // Reset-only variant for the img.onload path; full toggle for clicks.
    expect(astro).toContain("deactivateGroup(scenarioBtns, 'aria-pressed');");
    expect(astro).toContain("setGroupActive(scenarioBtns, btn, 'aria-pressed');");
  });

  it('ImageCompare.astro uses the shared helper and keeps its panel + keyboard logic', () => {
    const astro = readText('web/src/components/ImageCompare.astro');
    expect(astro).toContain("import { setGroupActive } from '../lib/toggle-group.ts';");
    expect(astro).toContain("setGroupActive(tabs, tab, 'aria-selected');");
    // No inline tab deactivation/activation setAttribute calls remain;
    // the static aria-selected="…" markup attributes are untouched.
    expect(astro).not.toContain("t.setAttribute('aria-selected'");
    expect(astro).not.toContain("tab.setAttribute('aria-selected'");
    expect(astro).toContain('aria-selected="true"');
    expect(astro).toContain('aria-selected="false"');
    // The contents panel show/hide loop is deliberately NOT part of the helper.
    expect(astro).toContain(
      "contents.forEach((c) => {\n        c.classList.remove('active');\n        c.hidden = true;\n      });"
    );
    // Keyboard navigation still calls activateTab for arrow keys.
    expect(astro).toMatch(/ArrowRight/);
    expect(astro).toMatch(/ArrowLeft/);
  });

  it('the shared module is the single canonical implementation', () => {
    const lib = readText('web/src/lib/toggle-group.ts');
    expect(lib).toContain('export function setGroupActive(');
    expect(lib).toContain('export function deactivateGroup(');
    expect(lib).toContain("el.classList.remove('active');");
    expect(lib).toContain("clicked.classList.add('active');");
  });
});
