import type { Page } from '@playwright/test';
import type { BoundingBox, HeuristicViolation } from './schema.js';
import { lintElementHeuristics } from './heuristic-linter.js';

export const ALLOWED_STYLE_PROPS = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'padding',
  'gap',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'color',
  'backgroundColor',
  'borderRadius',
  'boxShadow',
  'outline',
  'outlineStyle',
  'outlineWidth'
] as const;

export type AllowedStyleProp = (typeof ALLOWED_STYLE_PROPS)[number];

export interface DomContextResult {
  selector: string;
  ariaSnapshot: string;
  computedStyles: Record<string, string>;
  heuristicViolations: HeuristicViolation[];
  boundingBox?: BoundingBox;
}

export interface CaptureDomOptions {
  isMobileViewport?: boolean;
}

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

  // Resolve target selector or element point
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

  // Evaluate element in browser context
  const evalResult = await page.evaluate(
    ({ selector, point, allowedProps }) => {
      let el: Element | null = null;

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

      // Generate a unique selector for the resolved element
      function getCssSelector(element: Element): string {
        if (element.id) return `#${element.id}`;
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'body' || tagName === 'html') return tagName;
        const classes = Array.from(element.classList).filter((c) => !c.startsWith('ng-'));
        if (classes.length > 0) return `${tagName}.${classes.join('.')}`;
        return tagName;
      }

      function getEffectiveBg(element: Element | null): string {
        let cur = element;
        while (cur) {
          const bg = window.getComputedStyle(cur).backgroundColor;
          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
            return bg;
          }
          cur = cur.parentElement;
        }
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') {
          return bodyBg;
        }
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)';
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

      const effectiveBg = getEffectiveBg(el);
      if (computed.backgroundColor === 'transparent' || computed.backgroundColor === 'rgba(0, 0, 0, 0)' || !computed.backgroundColor) {
        computed.backgroundColor = effectiveBg;
      }

      const rect = el ? el.getBoundingClientRect() : null;
      const boundingBox = rect
        ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
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
    { selector: targetSelector, point, allowedProps: ALLOWED_STYLE_PROPS }
  );

  // Extract ariaSnapshot using Playwright's locator API
  let ariaSnapshot = '';
  try {
    const locator = page.locator(evalResult.resolvedSelector).first();
    if (typeof (locator as any).ariaSnapshot === 'function') {
      ariaSnapshot = await (locator as any).ariaSnapshot();
    } else {
      ariaSnapshot = `- ${evalResult.tagName} "${evalResult.resolvedSelector}"`;
    }
  } catch {
    // If scoped locator fails, try body or provide basic representation
    try {
      if (typeof (page.locator('body') as any).ariaSnapshot === 'function') {
        ariaSnapshot = await (page.locator('body') as any).ariaSnapshot();
      }
    } catch {
      ariaSnapshot = `- ${evalResult.tagName} "${evalResult.resolvedSelector}"`;
    }
  }

  // Run deterministic heuristic linting on the target element
  const heuristicViolations = lintElementHeuristics({
    selector: evalResult.resolvedSelector,
    tagName: evalResult.tagName,
    isMobileViewport: isMobile,
    viewportWidth: evalResult.viewportWidth,
    canvasBackground: evalResult.effectiveBg,
    computedStyles: evalResult.computedStyles,
    boundingBox: evalResult.boundingBox,
    accessibility: evalResult.accessibility
  });

  return {
    selector: evalResult.resolvedSelector,
    ariaSnapshot: ariaSnapshot || `- ${evalResult.tagName}`,
    computedStyles: evalResult.computedStyles,
    heuristicViolations,
    boundingBox: evalResult.boundingBox
  };
}

/**
 * Audits all interactive, text, and visual elements on the page for design-qa mode.
 */
export async function auditPageHeuristics(
  page: Page,
  isMobileViewport = false
): Promise<{
  heuristicViolations: HeuristicViolation[];
  computedStylesMap: Record<string, Record<string, string>>;
}> {
  const elementsData = await page.evaluate(
    ({ allowedProps }) => {
      const candidates = Array.from(
        document.querySelectorAll(
          'button, a, input, select, textarea, [role="button"], img, p, h1, h2, h3, h4, h5, h6, li'
        )
      );

      function getCssSelector(el: Element): string {
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        if (el.classList.length > 0) return `${tag}.${Array.from(el.classList).slice(0, 2).join('.')}`;
        return tag;
      }

      function getEffectiveBg(element: Element | null): string {
        let cur = element;
        while (cur) {
          const bg = window.getComputedStyle(cur).backgroundColor;
          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
            return bg;
          }
          cur = cur.parentElement;
        }
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') {
          return bodyBg;
        }
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)';
      }

      const viewportWidth = window.innerWidth;

      return candidates.slice(0, 75).map((el) => {
        const styles = window.getComputedStyle(el);
        const computed: Record<string, string> = {};
        for (const prop of allowedProps) {
          computed[prop] = styles[prop as any] || '';
        }

        const effectiveBg = getEffectiveBg(el);
        if (computed.backgroundColor === 'transparent' || computed.backgroundColor === 'rgba(0, 0, 0, 0)' || !computed.backgroundColor) {
          computed.backgroundColor = effectiveBg;
        }

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

        return {
          selector: getCssSelector(el),
          tagName: tag,
          isInteractive: ['button', 'a', 'input', 'select', 'textarea'].includes(tag) || el.getAttribute('role') === 'button',
          computedStyles: computed,
          effectiveBg,
          viewportWidth,
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
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
          }
        };
      });
    },
    { allowedProps: ALLOWED_STYLE_PROPS }
  );

  const allViolations: HeuristicViolation[] = [];
  const computedStylesMap: Record<string, Record<string, string>> = {};

  for (const item of elementsData) {
    computedStylesMap[item.selector] = item.computedStyles;
    const v = lintElementHeuristics({
      selector: item.selector,
      tagName: item.tagName,
      isInteractive: item.isInteractive,
      isMobileViewport,
      viewportWidth: item.viewportWidth,
      canvasBackground: item.effectiveBg,
      computedStyles: item.computedStyles,
      boundingBox: item.boundingBox,
      accessibility: item.accessibility
    });
    allViolations.push(...v);
  }

  return {
    heuristicViolations: allViolations,
    computedStylesMap
  };
}
