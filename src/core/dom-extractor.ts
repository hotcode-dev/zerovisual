import type { Page } from '@playwright/test';
import type { BoundingBox, HeuristicViolation } from './schema.js';
import { lintElementHeuristics, lintPageLevelHeuristics, type LintElementInput } from './heuristic-linter.js';
import type { DesignMdSpec } from './design-md-parser.js';

export const ALLOWED_STYLE_PROPS = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'marginTop',
  'marginBottom',
  'padding',
  'gap',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'color',
  'backgroundColor',
  'backgroundImage',
  'backgroundClip',
  'webkitBackgroundClip',
  'webkitTextFillColor',
  'borderRadius',
  'borderColor',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'boxShadow',
  'textShadow',
  'outline',
  'outlineStyle',
  'outlineWidth'
] as const;

export interface DomContextResult {
  selector: string;
  ariaSnapshot: string;
  computedStyles: Record<string, string>;
  heuristicViolations: HeuristicViolation[];
  boundingBox?: BoundingBox;
}

export interface CaptureDomOptions {
  isMobileViewport?: boolean;
  viewportName?: string;
  designMd?: DesignMdSpec;
  ignoreRules?: string[];
}

/**
 * Browser-side background-fallback helpers, shared by `captureDomContext` and
 * `auditPageHeuristics`. Playwright serializes only the evaluate callback's
 * source, so shared helpers live here as plain-JS source and are instantiated
 * inside each callback via `new Function` — one source of truth for the
 * effective-background logic.
 */
const BROWSER_BG_HELPERS_JS = `function getEffectiveBg(element) {
  let cur = element;
  while (cur) {
    const bg = window.getComputedStyle(cur).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
    cur = cur.parentElement;
  }
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') return bodyBg;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)';
}
function applyEffectiveBgFallback(computed, element) {
  const effectiveBg = getEffectiveBg(element);
  const c = computed.backgroundColor;
  if (c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || !c) computed.backgroundColor = effectiveBg;
  return effectiveBg;
}`;

/**
 * Captures localized AOM ariaSnapshot and the allowed CSS computed styles,
 * plus deterministic UI heuristic violations for a target element or bounding box.
 */
export async function captureDomContext(
  page: Page,
  targetSelectorOrBox?: string | BoundingBox,
  options: CaptureDomOptions = {}
): Promise<DomContextResult> {
  const isMobile = options.isMobileViewport ?? false;

  let targetSelector = 'body';
  let point: { x: number; y: number } | undefined;

  if (typeof targetSelectorOrBox === 'string') {
    targetSelector = targetSelectorOrBox;
  } else if (targetSelectorOrBox && typeof targetSelectorOrBox === 'object') {
    point = {
      x: targetSelectorOrBox.x + Math.max(1, Math.floor(targetSelectorOrBox.width / 2)),
      y: targetSelectorOrBox.y + Math.max(1, Math.floor(targetSelectorOrBox.height / 2))
    };
  }

  const evalResult = await page.evaluate(
    ({ selector, point, allowedProps, bgHelpers }) => {
      let el: Element | null = null;

      const { applyEffectiveBgFallback } = new Function(bgHelpers + '; return { applyEffectiveBgFallback }')();

      if (point) {
        el = document.elementFromPoint(point.x, point.y);
      }
      if (!el && selector) {
        try {
          el = document.querySelector(selector);
        } catch {
          el = null;
        }
      }
      if (!el) {
        el = document.body;
      }

      function getCssSelector(element: Element): string {
        if (element.id) return `#${element.id}`;
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'body' || tagName === 'html') return tagName;
        const classes = Array.from(element.classList).filter(c => !c.startsWith('ng-'));
        if (classes.length > 0) return `${tagName}.${classes.join('.')}`;
        return tagName;
      }

      const resolvedSelector = el ? getCssSelector(el) : 'body';
      const tagName = el ? el.tagName.toLowerCase() : 'body';
      const styles = el ? window.getComputedStyle(el) : null;

      const computed: Record<string, string> = {};
      if (styles) {
        for (const prop of allowedProps) {
          computed[prop] = styles[prop as any] || '';
        }
      }

      const effectiveBg = applyEffectiveBgFallback(computed, el);

      const rect = el ? el.getBoundingClientRect() : null;
      const boundingBox = rect
        ? {
            x: Math.max(0, Math.round(rect.x + window.scrollX)),
            y: Math.max(0, Math.round(rect.y + window.scrollY)),
            width: Math.max(1, Math.round(rect.width)),
            height: Math.max(1, Math.round(rect.height))
          }
        : undefined;

      const ariaLabel = el?.getAttribute('aria-label') || undefined;
      const ariaLabelledBy = el?.getAttribute('aria-labelledby') || undefined;
      const alt = el?.getAttribute('alt') || undefined;
      const innerText = el ? ((el as HTMLElement).innerText || el.textContent || '').trim() || undefined : undefined;
      const inputType = el ? (el as HTMLInputElement).type || undefined : undefined;
      let hasAssociatedLabel = false;
      if (el && ['input', 'select', 'textarea'].includes(tagName)) {
        if (el.id && document.querySelector(`label[for="${el.id}"]`)) hasAssociatedLabel = true;
        if (el.closest('label')) hasAssociatedLabel = true;
        if (ariaLabel || ariaLabelledBy) hasAssociatedLabel = true;
      }

      return {
        resolvedSelector,
        tagName,
        computedStyles: computed,
        boundingBox,
        viewportWidth: window.innerWidth,
        effectiveBg,
        accessibility: {
          role: el?.getAttribute('role') || undefined,
          ariaLabel,
          ariaLabelledBy,
          alt,
          innerText,
          inputType,
          hasAssociatedLabel
        }
      };
    },
    { selector: targetSelector, point, allowedProps: ALLOWED_STYLE_PROPS, bgHelpers: BROWSER_BG_HELPERS_JS }
  );

  let ariaSnapshot = '';
  try {
    const locator = page.locator(evalResult.resolvedSelector).first();
    if (typeof (locator as any).ariaSnapshot === 'function') {
      ariaSnapshot = await (locator as any).ariaSnapshot();
    } else {
      ariaSnapshot = `- ${evalResult.tagName} "${evalResult.resolvedSelector}"`;
    }
  } catch {
    try {
      if (typeof (page.locator('body') as any).ariaSnapshot === 'function') {
        ariaSnapshot = await (page.locator('body') as any).ariaSnapshot();
      }
    } catch {
      ariaSnapshot = `- ${evalResult.tagName} "${evalResult.resolvedSelector}"`;
    }
  }

  const heuristicViolations = lintElementHeuristics({
    selector: evalResult.resolvedSelector,
    tagName: evalResult.tagName,
    isMobileViewport: isMobile,
    viewportName: options.viewportName,
    viewportWidth: evalResult.viewportWidth,
    canvasBackground: evalResult.effectiveBg,
    computedStyles: evalResult.computedStyles,
    boundingBox: evalResult.boundingBox,
    accessibility: evalResult.accessibility,
    designMd: options.designMd,
    signals: options.ignoreRules ? { ignoredRules: options.ignoreRules } : undefined
  });

  return {
    selector: evalResult.resolvedSelector,
    ariaSnapshot: ariaSnapshot || `- ${evalResult.tagName}`,
    computedStyles: evalResult.computedStyles,
    heuristicViolations,
    boundingBox: evalResult.boundingBox
  };
}

export interface AuditPageOptions {
  isMobileViewport?: boolean;
  viewportName?: string;
  designMd?: DesignMdSpec;
  ignoreRules?: string[];
}

/**
 * Audits all interactive, text, container, and media elements on the page for design-qa mode,
 * including rendered AI-slop detection, visual integrity checks, and DESIGN.md drift.
 */
export async function auditPageHeuristics(
  page: Page,
  isMobileOrOptions: boolean | AuditPageOptions = false
): Promise<{
  heuristicViolations: HeuristicViolation[];
  computedStylesMap: Record<string, Record<string, string>>;
  elementsData: LintElementInput[];
}> {
  const opts: AuditPageOptions =
    typeof isMobileOrOptions === 'boolean' ? { isMobileViewport: isMobileOrOptions } : isMobileOrOptions;

  const isMobileViewport = opts.isMobileViewport ?? false;
  const viewportName = opts.viewportName;
  const globalIgnores = opts.ignoreRules ?? [];

  const rawEvaluated = await page.evaluate(
    ({ allowedProps, bgHelpers }) => {
      const { getEffectiveBg, applyEffectiveBgFallback } = new Function(
        bgHelpers + '; return { getEffectiveBg, applyEffectiveBgFallback }'
      )();
      const candidates = Array.from(
        document.querySelectorAll(
          'button, a, input, select, textarea, [role="button"], img, p, h1, h2, h3, h4, h5, h6, li, div, section, article, aside, header, footer, nav, span'
        )
      );

      function getCssSelector(el: Element): string {
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        if (el.classList.length > 0) return `${tag}.${Array.from(el.classList).slice(0, 2).join('.')}`;
        return tag;
      }

      function isCardElement(el: Element): boolean {
        const tag = el.tagName.toLowerCase();
        if (!['div', 'article', 'section', 'aside', 'li', 'a'].includes(tag)) return false;
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 48 || r.width > window.innerWidth * 0.96) return false;
        const radius = parseFloat(s.borderRadius || '0') || 0;
        const borderW = parseFloat(s.borderTopWidth || '0') || 0;
        const hasShadow = s.boxShadow && s.boxShadow !== 'none';
        const parentBg = el.parentElement ? getEffectiveBg(el.parentElement) : '';
        const ownBg = s.backgroundColor;
        const hasDistinctBg = ownBg && ownBg !== 'transparent' && ownBg !== 'rgba(0, 0, 0, 0)' && ownBg !== parentBg;
        return (radius >= 4 || borderW >= 1) && Boolean(hasDistinctBg || borderW >= 1 || hasShadow);
      }

      function collectIgnoredRules(el: Element): string[] {
        const rules: string[] = [];
        let cur: Element | null = el;
        while (cur) {
          const imp = cur.getAttribute('data-impeccable-ignore');
          const zv = cur.getAttribute('data-zerovisual-ignore');
          if (imp) rules.push(imp);
          if (zv) rules.push(zv);
          cur = cur.parentElement;
        }
        return rules;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const filtered = candidates.filter(el => {
        const tag = el.tagName.toLowerCase();
        if (
          ['button', 'a', 'input', 'select', 'textarea', 'img', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(
            tag
          )
        ) {
          return true;
        }
        const s = window.getComputedStyle(el);
        const hasVisualSurface =
          (s.backgroundImage && s.backgroundImage !== 'none') ||
          (s.boxShadow && s.boxShadow !== 'none') ||
          parseFloat(s.borderLeftWidth || '0') >= 2 ||
          parseFloat(s.borderTopWidth || '0') >= 1 ||
          s.overflow === 'hidden' ||
          s.overflowX === 'hidden' ||
          s.overflow === 'clip';
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent?.trim() ?? '')
          .join('');
        return hasVisualSurface || directText.length > 0;
      });

      return filtered.slice(0, 250).map(el => {
        const styles = window.getComputedStyle(el);
        const computed: Record<string, string> = {};
        for (const prop of allowedProps) {
          computed[prop] = styles[prop as any] || (styles as any).getPropertyValue?.(prop) || '';
        }

        const effectiveBg = applyEffectiveBgFallback(computed, el);

        const rect = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const ariaLabel = el.getAttribute('aria-label') || undefined;
        const ariaLabelledBy = el.getAttribute('aria-labelledby') || undefined;
        const alt = el.getAttribute('alt') || undefined;
        const innerText = ((el as HTMLElement).innerText || el.textContent || '').trim() || undefined;
        const inputType = (el as HTMLInputElement).type || undefined;
        let hasAssociatedLabel = false;
        if (['input', 'select', 'textarea'].includes(tag)) {
          if (el.id && document.querySelector(`label[for="${el.id}"]`)) hasAssociatedLabel = true;
          if (el.closest('label')) hasAssociatedLabel = true;
          if (ariaLabel || ariaLabelledBy) hasAssociatedLabel = true;
        }

        // Card & Nested Card detection
        const isCard = isCardElement(el);
        let isInsideCard = false;
        if (isCard) {
          let p = el.parentElement;
          while (p && p !== document.body) {
            if (isCardElement(p)) {
              isInsideCard = true;
              break;
            }
            p = p.parentElement;
          }
        }

        // Icon-tile stacked above heading inside a card
        let hasIconTileStack = false;
        if (isCard) {
          const headingChild = el.querySelector('h2, h3, h4');
          const firstElem = el.firstElementChild;
          if (headingChild && firstElem && firstElem !== headingChild && !firstElem.contains(headingChild)) {
            const iconRect = firstElem.getBoundingClientRect();
            const hRect = headingChild.getBoundingClientRect();
            const iconStyle = window.getComputedStyle(firstElem);
            const isSmallBox =
              iconRect.width >= 20 &&
              iconRect.width <= 72 &&
              iconRect.height >= 20 &&
              iconRect.height <= 72 &&
              (parseFloat(iconStyle.borderRadius || '0') >= 4 || firstElem.querySelector('svg, img') !== null);
            const isStackedAbove = iconRect.bottom <= hRect.top + 8 && Math.abs(iconRect.left - hRect.left) <= 60;
            if (isSmallBox && isStackedAbove) {
              hasIconTileStack = true;
            }
          }
        }

        // Banned eyebrow / kicker or 01/02/03 index pill directly above heading
        let isEyebrowAboveHeading = false;
        const nextSib = el.nextElementSibling;
        if (
          nextSib &&
          ['h1', 'h2', 'h3'].includes(nextSib.tagName.toLowerCase()) &&
          !['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) &&
          innerText &&
          innerText.length >= 2 &&
          innerText.length <= 42
        ) {
          const isNumericBadge = /^(?:0?[1-9]|[1-9]\d)(?:\s*[/.—-]\s*\d+|\s+[A-Za-z]+)?$/.test(innerText);
          const isUppercaseOrSmall =
            styles.textTransform === 'uppercase' ||
            (parseFloat(styles.fontSize || '16') <= 14 && parseFloat(styles.letterSpacing || '0') >= 0.5) ||
            parseFloat(styles.borderRadius || '0') >= 99;
          if (isNumericBadge || isUppercaseOrSmall) {
            isEyebrowAboveHeading = true;
          }
        }

        // Heading rhythm: actual rendered distance above vs below
        let spaceAbovePx: number | undefined;
        let spaceBelowPx: number | undefined;
        if (['h2', 'h3', 'h4'].includes(tag)) {
          const prev = el.previousElementSibling;
          const next = el.nextElementSibling;
          if (prev && next) {
            const prevRect = prev.getBoundingClientRect();
            const nextRect = next.getBoundingClientRect();
            if (rect.top >= prevRect.bottom && nextRect.top >= rect.bottom) {
              spaceAbovePx = Math.round(rect.top - prevRect.bottom);
              spaceBelowPx = Math.round(nextRect.top - rect.bottom);
            }
          }
        }

        // Broken image check
        let imageBroken = false;
        if (tag === 'img') {
          const imgEl = el as HTMLImageElement;
          const src = imgEl.getAttribute('src')?.trim() ?? '';
          if (!src || src === '#' || src.startsWith('about:blank') || (imgEl.complete && imgEl.naturalWidth === 0)) {
            imageBroken = true;
          }
        }

        // Unintended text overflow / clipped positioned child
        const isClipping =
          styles.overflow === 'hidden' ||
          styles.overflow === 'clip' ||
          styles.overflowX === 'hidden' ||
          styles.overflowX === 'clip';
        const htmlEl = el as HTMLElement;
        const hasUnintendedTextOverflow =
          isClipping &&
          styles.textOverflow !== 'ellipsis' &&
          htmlEl.clientWidth > 0 &&
          htmlEl.scrollWidth > htmlEl.clientWidth + 4 &&
          Boolean(innerText && innerText.length > 0);

        // Hidden at rest check
        const isHiddenAtRest =
          ['p', 'h1', 'h2', 'h3', 'section', 'article'].includes(tag) &&
          Boolean(innerText && innerText.length >= 40) &&
          (styles.opacity === '0' || styles.visibility === 'hidden');

        // First-viewport column overflow imbalance
        let hasColumnOverflowImbalance = false;
        if (
          rect.top >= 0 &&
          rect.top < viewportHeight * 0.6 &&
          (styles.display === 'grid' || styles.display === 'flex') &&
          el.children.length >= 2
        ) {
          const childRects = Array.from(el.children)
            .map(c => c.getBoundingClientRect())
            .filter(r => r.width >= 120 && r.height >= 40);
          if (childRects.length >= 2) {
            const first = childRects[0]!;
            const second = childRects[1]!;
            const isSideBySide = Math.abs(first.top - second.top) < 120 && Math.abs(first.left - second.left) >= 120;
            if (isSideBySide) {
              const tall = Math.max(first.height, second.height);
              const short = Math.min(first.height, second.height);
              if (tall > viewportHeight * 1.45 && short <= viewportHeight * 0.85 && tall >= short * 2.1) {
                hasColumnOverflowImbalance = true;
              }
            }
          }
        }

        return {
          selector: getCssSelector(el),
          tagName: tag,
          isInteractive:
            ['button', 'a', 'input', 'select', 'textarea'].includes(tag) || el.getAttribute('role') === 'button',
          computedStyles: computed,
          effectiveBg,
          viewportWidth,
          boundingBox: {
            x: Math.max(0, Math.round(rect.x + window.scrollX)),
            y: Math.max(0, Math.round(rect.y + window.scrollY)),
            width: Math.max(1, Math.round(rect.width)),
            height: Math.max(1, Math.round(rect.height))
          },
          accessibility: {
            role: el.getAttribute('role') || undefined,
            ariaLabel,
            ariaLabelledBy,
            alt,
            innerText,
            inputType,
            hasAssociatedLabel
          },
          signals: {
            isCard,
            isInsideCard,
            hasIconTileStack,
            isEyebrowAboveHeading,
            spaceAbovePx,
            spaceBelowPx,
            imageBroken,
            hasUnintendedTextOverflow,
            isHiddenAtRest,
            hasColumnOverflowImbalance,
            ignoredRules: collectIgnoredRules(el)
          }
        };
      });
    },
    { allowedProps: ALLOWED_STYLE_PROPS, bgHelpers: BROWSER_BG_HELPERS_JS }
  );

  const elementsList = Array.isArray(rawEvaluated) ? rawEvaluated : [];
  const allViolations: HeuristicViolation[] = [];
  const computedStylesMap: Record<string, Record<string, string>> = {};
  const lintInputs: LintElementInput[] = [];

  for (const item of elementsList) {
    computedStylesMap[item.selector] = item.computedStyles;
    const combinedIgnores = [...(item.signals?.ignoredRules ?? []), ...globalIgnores];

    const lintInput: LintElementInput = {
      selector: item.selector,
      tagName: item.tagName,
      isInteractive: item.isInteractive,
      isMobileViewport,
      viewportName,
      viewportWidth: item.viewportWidth,
      canvasBackground: item.effectiveBg,
      computedStyles: item.computedStyles,
      boundingBox: item.boundingBox,
      accessibility: item.accessibility,
      designMd: opts.designMd,
      signals: {
        ...(item.signals ?? {}),
        ignoredRules: combinedIgnores
      }
    };

    lintInputs.push(lintInput);
    const v = lintElementHeuristics(lintInput);
    allViolations.push(...v);
  }

  // Run page-level checks (FLAT_TYPE_HIERARCHY and DESIGN_SYSTEM_DRIFT)
  const pageViolations = lintPageLevelHeuristics(lintInputs, {
    designMd: opts.designMd,
    ignoreRules: globalIgnores,
    viewportName
  });
  allViolations.push(...pageViolations);

  return {
    heuristicViolations: allViolations,
    computedStylesMap,
    elementsData: lintInputs
  };
}
