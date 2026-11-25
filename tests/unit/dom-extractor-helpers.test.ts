import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BROWSER_BG_HELPERS_JS, captureDomContext, auditPageHeuristics } from '../../src/core/dom-extractor.js';

/**
 * The browser-side helpers live in `BROWSER_BG_HELPERS_JS` (a plain-JS string
 * instantiated via `new Function` inside each `page.evaluate` callback), so
 * these tests execute that exact source:
 *  - directly, with `window`/`document` passed as function parameters
 *    (sandboxed, no global state), for edge-case coverage of
 *    `rectToBBox` / `collectAccessibility`;
 *  - end-to-end, by running the real `captureDomContext` /
 *    `auditPageHeuristics` evaluate callbacks against a fake DOM, proving the
 *    refactored callbacks wire the shared helpers up correctly.
 */

type FakeRect = { x: number; y: number; width: number; height: number };

function makeEl(
  over: {
    tag?: string;
    id?: string;
    classes?: string[];
    attrs?: Record<string, string>;
    innerText?: string;
    textContent?: string;
    type?: string;
    styles?: Record<string, string>;
    rect?: FakeRect;
    parentElement?: any;
    closestLabel?: boolean;
  } = {}
): any {
  const tag = over.tag ?? 'div';
  const attrs = over.attrs ?? {};
  const rect: FakeRect = over.rect ?? { x: 0, y: 0, width: 100, height: 40 };
  return {
    tagName: tag.toUpperCase(),
    id: over.id ?? '',
    getAttribute: (name: string) => (name in attrs ? attrs[name] : null),
    classList: over.classes ?? [],
    innerText: over.innerText,
    textContent: over.textContent,
    type: over.type,
    styles: over.styles ?? {},
    parentElement: over.parentElement ?? null,
    children: [],
    childNodes: [],
    firstElementChild: null,
    previousElementSibling: null,
    nextElementSibling: null,
    clientWidth: 0,
    scrollWidth: 0,
    complete: true,
    naturalWidth: 100,
    closest: () => (over.closestLabel ? {} : null),
    contains: () => false,
    querySelector: () => null,
    getBoundingClientRect: () => ({
      ...rect,
      top: rect.y,
      bottom: rect.y + rect.height,
      left: rect.x,
      right: rect.x + rect.width
    })
  };
}

function makeFakeWindow(scrollX: number, scrollY: number): any {
  return {
    scrollX,
    scrollY,
    innerWidth: 1280,
    innerHeight: 800,
    getComputedStyle: (el: any) => el.styles,
    matchMedia: () => ({ matches: false })
  };
}

function makeFakeDocument(bodyEl: any, labelTargets: string[], allElements: any[] = []): any {
  return {
    body: bodyEl,
    querySelector: (sel: string) => {
      if (labelTargets.includes(sel)) return { tag: 'label' };
      if (sel.startsWith('#')) {
        const byId = allElements.find(e => e.id === sel.slice(1));
        if (byId) return byId;
      }
      const tag = sel.split(',')[0].trim();
      const byTag = allElements.find(e => e.tagName.toLowerCase() === tag);
      return byTag ?? null;
    },
    querySelectorAll: () => allElements,
    elementFromPoint: () => allElements[0] ?? null
  };
}

function instantiateHelpers(window: any, document: any): any {
  const factory = new Function(
    'window',
    'document',
    BROWSER_BG_HELPERS_JS + '; return { rectToBBox, collectAccessibility, getCssSelector }'
  );
  return factory(window, document);
}

describe('BROWSER_BG_HELPERS_JS: rectToBBox', () => {
  it('clamps negative document-space coordinates to 0', () => {
    const { rectToBBox } = instantiateHelpers(makeFakeWindow(5, 1), {});
    // viewport-space rect at (-3, -2) with scroll (5, 1) -> document-space (-(-2)?), i.e. x = -3 + 5 = 2, y = -2 + 1 = -1
    expect(rectToBBox({ x: -3, y: -2, width: 10, height: 10 })).toEqual({ x: 2, y: 0, width: 10, height: 10 });
  });

  it('rounds fractional coordinates and enforces a 1px minimum size', () => {
    const { rectToBBox } = instantiateHelpers(makeFakeWindow(0, 0), {});
    expect(rectToBBox({ x: 1.6, y: 3.4, width: 101.6, height: 40.4 })).toEqual({
      x: 2,
      y: 3,
      width: 102,
      height: 40
    });
    // sub-pixel / zero sizes clamp to 1
    expect(rectToBBox({ x: 0, y: 0, width: 0.2, height: 0 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('adds full scroll offsets for off-screen content', () => {
    const { rectToBBox } = instantiateHelpers(makeFakeWindow(500, 250), {});
    expect(rectToBBox({ x: 10, y: 20, width: 300, height: 150 })).toEqual({
      x: 510,
      y: 270,
      width: 300,
      height: 150
    });
  });
});

describe('BROWSER_BG_HELPERS_JS: collectAccessibility', () => {
  it('returns undefined fields and no associated label for a bare div', () => {
    const { collectAccessibility } = instantiateHelpers(makeFakeWindow(0, 0), { querySelector: () => null });
    const el = makeEl({ innerText: '  hello  ' });
    expect(collectAccessibility(el, 'div')).toEqual({
      role: undefined,
      ariaLabel: undefined,
      ariaLabelledBy: undefined,
      alt: undefined,
      innerText: 'hello',
      inputType: undefined,
      hasAssociatedLabel: false
    });
  });

  it('captures role, aria attributes, and alt without a label association for non-form tags', () => {
    const { collectAccessibility } = instantiateHelpers(makeFakeWindow(0, 0), { querySelector: () => null });
    const el = makeEl({ attrs: { role: 'tab', 'aria-label': 'Tab 1', alt: 'pic' } });
    const result = collectAccessibility(el, 'img');
    expect(result.role).toBe('tab');
    expect(result.ariaLabel).toBe('Tab 1');
    expect(result.alt).toBe('pic');
    expect(result.hasAssociatedLabel).toBe(false);
  });

  it('flags hasAssociatedLabel when a label[for] matches the input id', () => {
    const doc = makeFakeDocument(makeEl({}), ['label[for="email"]']);
    const { collectAccessibility } = instantiateHelpers(makeFakeWindow(0, 0), doc);
    const el = makeEl({ tag: 'input', id: 'email', type: 'text' });
    expect(collectAccessibility(el, 'input').hasAssociatedLabel).toBe(true);
  });

  it('flags hasAssociatedLabel when the element is wrapped in a label', () => {
    const { collectAccessibility } = instantiateHelpers(makeFakeWindow(0, 0), { querySelector: () => null });
    const el = makeEl({ tag: 'textarea', id: '', closestLabel: true });
    const result = collectAccessibility(el, 'textarea');
    expect(result.hasAssociatedLabel).toBe(true);
    expect(result.inputType).toBeUndefined();
  });

  it('flags hasAssociatedLabel via aria-label/aria-labelledby on form controls', () => {
    const { collectAccessibility } = instantiateHelpers(makeFakeWindow(0, 0), { querySelector: () => null });
    expect(
      collectAccessibility(makeEl({ tag: 'select', attrs: { 'aria-labelledby': 'name-label' } }), 'select')
        .hasAssociatedLabel
    ).toBe(true);
    expect(
      collectAccessibility(makeEl({ tag: 'input', attrs: { 'aria-label': 'First name' } }), 'input').hasAssociatedLabel
    ).toBe(true);
  });

  it('keeps hasAssociatedLabel false for a form control with no association at all', () => {
    const { collectAccessibility } = instantiateHelpers(makeFakeWindow(0, 0), { querySelector: () => null });
    const el = makeEl({ tag: 'input', id: '', type: 'email' });
    const result = collectAccessibility(el, 'input');
    expect(result.hasAssociatedLabel).toBe(false);
    expect(result.inputType).toBe('email');
  });

  it('prefers innerText over textContent and drops whitespace-only text', () => {
    const { collectAccessibility } = instantiateHelpers(makeFakeWindow(0, 0), { querySelector: () => null });
    expect(collectAccessibility(makeEl({ innerText: 'A', textContent: 'B' }), 'p').innerText).toBe('A');
    // innerText missing/empty -> textContent fallback; whitespace-only -> undefined
    expect(collectAccessibility(makeEl({ innerText: undefined, textContent: '  ' }), 'p').innerText).toBeUndefined();
  });
});

describe('BROWSER_BG_HELPERS_JS: getCssSelector', () => {
  // Exact flag combos used at the call sites:
  const captureOpts = { skipNgClasses: true, maxClasses: Infinity, specialCaseBodyHtml: true };
  const auditOpts = { skipNgClasses: false, maxClasses: 2, specialCaseBodyHtml: false };

  it('prefers the element id over any classes under both flag combos', () => {
    const { getCssSelector } = instantiateHelpers(makeFakeWindow(0, 0), {});
    const el = makeEl({ id: 'hero', classes: ['a', 'b'] });
    expect(getCssSelector(el, captureOpts)).toBe('#hero');
    expect(getCssSelector(el, auditOpts)).toBe('#hero');
  });

  it('captureDomContext combo: returns the bare tag for body/html even when they carry classes', () => {
    const { getCssSelector } = instantiateHelpers(makeFakeWindow(0, 0), {});
    expect(getCssSelector(makeEl({ tag: 'body', classes: ['dark', 'x'] }), captureOpts)).toBe('body');
    expect(getCssSelector(makeEl({ tag: 'html', classes: ['lang-x'] }), captureOpts)).toBe('html');
  });

  it('captureDomContext combo: keeps every non-ng- class and drops ng- classes', () => {
    const { getCssSelector } = instantiateHelpers(makeFakeWindow(0, 0), {});
    // all classes retained (no 2-class slice at maxClasses: Infinity)
    expect(getCssSelector(makeEl({ classes: ['a', 'b', 'c'] }), captureOpts)).toBe('div.a.b.c');
    // ng- classes filtered out, remaining classes kept
    expect(getCssSelector(makeEl({ classes: ['ng-xyz', 'card', 'ng-core'] }), captureOpts)).toBe('div.card');
    // all classes are ng- -> bare tag
    expect(getCssSelector(makeEl({ classes: ['ng-a', 'ng-b'] }), captureOpts)).toBe('div');
    // no classes at all -> bare tag
    expect(getCssSelector(makeEl({}), captureOpts)).toBe('div');
  });

  it('auditPageHeuristics combo: slices to the first two classes without any ng- filtering', () => {
    const { getCssSelector } = instantiateHelpers(makeFakeWindow(0, 0), {});
    expect(getCssSelector(makeEl({ classes: ['alpha', 'beta', 'gamma'] }), auditOpts)).toBe('div.alpha.beta');
    // ng- classes are NOT filtered in audit mode
    expect(getCssSelector(makeEl({ classes: ['ng-x', 'ng-y', 'ng-z'] }), auditOpts)).toBe('div.ng-x.ng-y');
    expect(getCssSelector(makeEl({ classes: ['solo'] }), auditOpts)).toBe('div.solo');
    expect(getCssSelector(makeEl({}), auditOpts)).toBe('div');
  });

  it('auditPageHeuristics combo: does NOT special-case body/html, classes are kept', () => {
    const { getCssSelector } = instantiateHelpers(makeFakeWindow(0, 0), {});
    expect(getCssSelector(makeEl({ tag: 'body', classes: ['dark', 'x'] }), auditOpts)).toBe('body.dark.x');
    expect(getCssSelector(makeEl({ tag: 'html', classes: ['a'] }), auditOpts)).toBe('html.a');
  });

  it('omits the classes suffix when no class survives filtering/slicing', () => {
    const { getCssSelector } = instantiateHelpers(makeFakeWindow(0, 0), {});
    expect(getCssSelector(makeEl({ tag: 'span', classes: ['ng-only'] }), captureOpts)).toBe('span');
    // maxClasses: 0 means "no slicing" (falsy guard) — full class list is kept
    expect(getCssSelector(makeEl({ classes: ['a', 'b'] }), { skipNgClasses: false, maxClasses: 0 })).toBe('div.a.b');
  });
});

describe('captureDomContext wires shared helpers through the evaluate callback', () => {
  let rawEvalResult: any;

  const fakePage = (): any => ({
    evaluate: async (fn: any, args: any) => {
      rawEvalResult = fn(args);
      return rawEvalResult;
    },
    locator: () => ({ first: () => ({ ariaSnapshot: async () => '- fake aria snapshot' }) })
  });

  beforeAll(() => {
    (globalThis as any).window = makeFakeWindow(5, 1);
  });

  afterAll(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
  });

  it('returns a clamped bounding box and the collected accessibility object for a selector target', async () => {
    const body = makeEl({ styles: { backgroundColor: 'rgb(10, 20, 30)' } });
    const input = makeEl({
      tag: 'input',
      id: 'email',
      type: 'text',
      attrs: { role: 'textbox', 'aria-label': 'Email address' },
      rect: { x: -3.6, y: 2.7, width: 101.4, height: 40.6 },
      parentElement: body
    });
    (globalThis as any).document = makeFakeDocument(body, [], [input]);

    const result = await captureDomContext(fakePage() as any, '#email');

    expect(result.selector).toBe('#email');
    // x: round(-3.6 + 5) = 1, y: round(2.7 + 1) = 4, w: round(101.4) = 101, h: round(40.6) = 41
    expect(result.boundingBox).toEqual({ x: 1, y: 4, width: 101, height: 41 });
    expect(rawEvalResult.accessibility).toEqual({
      role: 'textbox',
      ariaLabel: 'Email address',
      ariaLabelledBy: undefined,
      alt: undefined,
      innerText: undefined,
      inputType: 'text',
      hasAssociatedLabel: true
    });
    expect(result.heuristicViolations).toEqual([]);
  });

  it('resolves a point target via elementFromPoint and clamps its bounding box', async () => {
    const body = makeEl({ styles: { backgroundColor: 'rgb(10, 20, 30)' } });
    const button = makeEl({
      tag: 'button',
      id: 'cta',
      attrs: { role: 'button' },
      innerText: 'Click',
      styles: { backgroundColor: 'rgb(1, 2, 3)' },
      rect: { x: 0, y: 0, width: 200, height: 50 }
    });
    (globalThis as any).document = makeFakeDocument(body, [], [button]);

    const result = await captureDomContext(fakePage() as any, { x: 10, y: 10, width: 40, height: 40 });

    expect(result.selector).toBe('#cta');
    expect(result.boundingBox).toEqual({ x: 5, y: 1, width: 200, height: 50 });
    expect(rawEvalResult.accessibility).toEqual({
      role: 'button',
      ariaLabel: undefined,
      ariaLabelledBy: undefined,
      alt: undefined,
      innerText: 'Click',
      inputType: undefined,
      hasAssociatedLabel: false
    });
  });

  it('builds the shared-helper CSS selector for classed elements (ng- filtered, all classes kept)', async () => {
    const body = makeEl({ styles: { backgroundColor: 'rgb(10, 20, 30)' } });
    const div = makeEl({ tag: 'div', classes: ['a', 'b', 'ng-c', 'd'], parentElement: body });
    (globalThis as any).document = makeFakeDocument(body, [], [div]);

    const result = await captureDomContext(fakePage() as any, 'div');

    expect(result.selector).toBe('div.a.b.d');
  });
});

describe('auditPageHeuristics wires shared helpers through the evaluate callback', () => {
  beforeAll(() => {
    (globalThis as any).window = makeFakeWindow(5, 1);
  });

  afterAll(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
  });

  it('emits clamped bounding boxes and accessibility data for every audited element', async () => {
    const body = makeEl({ styles: { backgroundColor: 'rgb(10, 20, 30)' } });
    const para = makeEl({ tag: 'p', innerText: 'Short text', rect: { x: 1.2, y: 2.8, width: 300.6, height: 24.4 } });
    const input = makeEl({
      tag: 'input',
      id: 'name',
      type: 'email',
      closestLabel: true,
      rect: { x: 0, y: 0, width: 200, height: 32 }
    });
    const img = makeEl({
      tag: 'img',
      attrs: { alt: 'Logo', src: 'https://example.com/logo.png' },
      rect: { x: -10, y: -10, width: 0.2, height: 0 }
    });
    const document = makeFakeDocument(body, [], [para, input, img]);
    (globalThis as any).document = document;

    const result = await auditPageHeuristics(
      {
        evaluate: async (fn: any, args: any) => fn(args),
        locator: () => ({ first: () => ({ ariaSnapshot: async () => 'snap' }) })
      } as any,
      {}
    );

    expect(result.elementsData).toHaveLength(3);
    expect(result.computedStylesMap).toEqual(
      expect.objectContaining({ p: expect.any(Object), '#name': expect.any(Object), img: expect.any(Object) })
    );

    const [pData, inputData, imgData] = result.elementsData;
    // x: round(1.2 + 5) = 6, y: round(2.8 + 1) = 4, w: round(300.6) = 301, h: round(24.4) = 24
    expect(pData.boundingBox).toEqual({ x: 6, y: 4, width: 301, height: 24 });
    expect(pData.accessibility).toEqual({
      role: undefined,
      ariaLabel: undefined,
      ariaLabelledBy: undefined,
      alt: undefined,
      innerText: 'Short text',
      inputType: undefined,
      hasAssociatedLabel: false
    });

    // sub-pixel 0.2x0 rect clamps to a 1x1 box; negative document-space origin clamps to 0,0
    expect(inputData.accessibility?.inputType).toBe('email');
    expect(inputData.accessibility?.hasAssociatedLabel).toBe(true);
    expect(imgData.boundingBox).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(imgData.accessibility).toEqual({
      role: undefined,
      ariaLabel: undefined,
      ariaLabelledBy: undefined,
      alt: 'Logo',
      innerText: undefined,
      inputType: undefined,
      hasAssociatedLabel: false
    });

    expect(result.heuristicViolations).toEqual(expect.arrayContaining([]));
  });

  it('builds the shared-helper CSS selector for audited elements (first two classes, no ng- filter)', async () => {
    const body = makeEl({ styles: { backgroundColor: 'rgb(10, 20, 30)' } });
    const box = makeEl({
      tag: 'div',
      classes: ['alpha', 'beta', 'gamma', 'ng-h'],
      styles: { overflow: 'hidden' }
    });
    (globalThis as any).document = makeFakeDocument(body, [], [box]);

    const result = await auditPageHeuristics(
      {
        evaluate: async (fn: any, args: any) => fn(args),
        locator: () => ({ first: () => ({ ariaSnapshot: async () => 'snap' }) })
      } as any,
      {}
    );

    expect(result.elementsData).toHaveLength(1);
    expect(result.elementsData[0].selector).toBe('div.alpha.beta');
  });
});
