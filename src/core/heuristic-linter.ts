import type { HeuristicViolation } from './schema.js';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Converts HSL to sRGB.
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255)
  ];
}

/**
 * Converts OKLab to sRGB.
 */
export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767434036 * l - 3.3077115913 * m + 0.2309699291 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const toSrgb = (c: number): number => {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  return [
    Math.round(toSrgb(rLin) * 255),
    Math.round(toSrgb(gLin) * 255),
    Math.round(toSrgb(bLin) * 255)
  ];
}

/**
 * Converts OKLCH to sRGB.
 */
export function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  return oklabToRgb(L, a, b);
}

/**
 * Parses CSS color strings (#hex, rgb/rgba, hsl/hsla, oklch, oklab, named) to RGBA.
 */
export function parseColor(colorStr: string): RgbColor {
  const str = colorStr.trim().toLowerCase();

  if (str === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (str === 'white') {
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  if (str === 'black') {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  // Hex format: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      const a = hex.length === 4 ? parseInt(hex[3]! + hex[3]!, 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgb(...) or rgba(...) format (handles comma or space-separated syntax)
  const rgbMatch = str.match(/^rgba?\s*\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10);
    const g = parseInt(rgbMatch[2]!, 10);
    const b = parseInt(rgbMatch[3]!, 10);
    let a = 1;
    if (rgbMatch[4] !== undefined) {
      a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4]);
    }
    return { r, g, b, a };
  }

  // hsl(...) or hsla(...) format
  const hslMatch = str.match(/^hsla?\s*\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]!);
    const s = parseFloat(hslMatch[2]!) / 100;
    const l = parseFloat(hslMatch[3]!) / 100;
    let a = 1;
    if (hslMatch[4] !== undefined) {
      a = hslMatch[4].endsWith('%') ? parseFloat(hslMatch[4]) / 100 : parseFloat(hslMatch[4]);
    }
    const [r, g, b] = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  // oklch(...) format: oklch(L C H [/ a])
  const oklchMatch = str.match(/^oklch\s*\(\s*([\d.]+%?)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:deg)?(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (oklchMatch) {
    let L = parseFloat(oklchMatch[1]!);
    if (oklchMatch[1]!.endsWith('%')) L /= 100;
    const C = parseFloat(oklchMatch[2]!);
    const H = parseFloat(oklchMatch[3]!);
    let a = 1;
    if (oklchMatch[4] !== undefined) {
      a = oklchMatch[4].endsWith('%') ? parseFloat(oklchMatch[4]) / 100 : parseFloat(oklchMatch[4]);
    }
    const [r, g, b] = oklchToRgb(L, C, H);
    return { r, g, b, a };
  }

  // oklab(...) format: oklab(L a b [/ alpha])
  const oklabMatch = str.match(/^oklab\s*\(\s*([\d.]+%?)[\s,]+([-\d.]+)[\s,]+([-\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (oklabMatch) {
    let L = parseFloat(oklabMatch[1]!);
    if (oklabMatch[1]!.endsWith('%')) L /= 100;
    const aVal = parseFloat(oklabMatch[2]!);
    const bVal = parseFloat(oklabMatch[3]!);
    let a = 1;
    if (oklabMatch[4] !== undefined) {
      a = oklabMatch[4].endsWith('%') ? parseFloat(oklabMatch[4]) / 100 : parseFloat(oklabMatch[4]);
    }
    const [r, g, b] = oklabToRgb(L, aVal, bVal);
    return { r, g, b, a };
  }

  // Fallback to black
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Composites foreground with alpha over a background color (defaulting to white).
 */
export function compositeColors(fg: RgbColor, bg: RgbColor = { r: 255, g: 255, b: 255, a: 1 }): RgbColor {
  const fgAlpha = fg.a ?? 1;
  if (fgAlpha >= 1) return fg;
  if (fgAlpha <= 0) return bg;

  const bgAlpha = bg.a ?? 1;
  const outAlpha = fgAlpha + bgAlpha * (1 - fgAlpha);

  const r = Math.round((fg.r * fgAlpha + bg.r * bgAlpha * (1 - fgAlpha)) / outAlpha);
  const g = Math.round((fg.g * fgAlpha + bg.g * bgAlpha * (1 - fgAlpha)) / outAlpha);
  const b = Math.round((fg.b * fgAlpha + bg.b * bgAlpha * (1 - fgAlpha)) / outAlpha);

  return { r, g, b, a: outAlpha };
}

/**
 * Calculates relative luminance for an sRGB color per WCAG 2.1 specs.
 */
export function calculateRelativeLuminance(color: RgbColor): number {
  const normalize = (val: number): number => {
    const c = val / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const R = normalize(color.r);
  const G = normalize(color.g);
  const B = normalize(color.b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates contrast ratio between two colors per WCAG 2.1 specs (range 1:1 to 21:1).
 */
export function calculateContrastRatio(fg: RgbColor, bg: RgbColor): number {
  const effectiveFg = compositeColors(fg, bg);
  const l1 = calculateRelativeLuminance(effectiveFg);
  const l2 = calculateRelativeLuminance(bg);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}

export interface ContrastCheckResult {
  valid: boolean;
  ratio: number;
  threshold: number;
  isLargeText: boolean;
}

/**
 * Evaluates WCAG 2.1 AA text contrast compliance.
 * Normal text requires >= 4.5:1.
 * Large text (>= 24px, or >= 18.66px with bold weight >= 700) requires >= 3.0:1.
 * Transparent/alpha backgrounds are composited over canvasBgColorStr (default white or dark theme).
 */
export function checkContrast(
  fgColorStr: string,
  bgColorStr: string,
  fontSizePx = 16,
  fontWeight: number | string = 400,
  canvasBgColorStr = '#ffffff'
): ContrastCheckResult {
  let fg = parseColor(fgColorStr);
  let bg = parseColor(bgColorStr);
  const canvasBg = parseColor(canvasBgColorStr);

  // If background has alpha < 1 or is transparent, composite over canvas background
  if ((bg.a ?? 1) < 1) {
    bg = compositeColors(bg, canvasBg);
  }

  const isBold =
    fontWeight === 'bold' ||
    fontWeight === 'bolder' ||
    (typeof fontWeight === 'number' && fontWeight >= 700) ||
    (typeof fontWeight === 'string' && parseInt(fontWeight, 10) >= 700);

  const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && isBold);
  const threshold = isLargeText ? 3.0 : 4.5;

  const ratio = calculateContrastRatio(fg, bg);
  const valid = ratio >= threshold;

  return {
    valid,
    ratio,
    threshold,
    isLargeText
  };
}

export interface SpacingCheckResult {
  valid: boolean;
  invalidValues: string[];
}

/**
 * Checks whether margin, padding, or gap adhere to a 4px/8px spatial scale.
 * Valid: 0px, 1px, 2px, or multiples of 4px.
 */
export function checkSpacingGrid(cssValue: string): SpacingCheckResult {
  if (!cssValue || cssValue.trim() === '' || cssValue === 'auto' || cssValue === 'normal') {
    return { valid: true, invalidValues: [] };
  }

  // Match all px tokens like "13px", "0px", "-4px", "16.5px"
  const tokens = cssValue.match(/-?\d+(?:\.\d+)?px/g) ?? [];
  const invalidValues: string[] = [];

  for (const token of tokens) {
    const num = Math.abs(parseFloat(token));
    const isSpecialAllowed = num === 0 || num === 1 || num === 2;
    const isMultipleOf4 = Math.abs(num % 4) < 0.01;

    if (!isSpecialAllowed && !isMultipleOf4) {
      invalidValues.push(token);
    }
  }

  return {
    valid: invalidValues.length === 0,
    invalidValues
  };
}

export interface TapTargetCheckResult {
  valid: boolean;
  width: number;
  height: number;
  expected: string;
  actual: string;
}

/**
 * Verifies interactive elements meet minimum 44x44px touch target on mobile/tablet viewports.
 */
export function checkTapTarget(
  boundingBox: { width: number; height: number },
  isMobileViewport = true
): TapTargetCheckResult {
  const { width, height } = boundingBox;
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);

  if (!isMobileViewport) {
    return {
      valid: true,
      width,
      height,
      expected: 'N/A (desktop)',
      actual: `${roundedWidth}x${roundedHeight}px`
    };
  }

  const valid = roundedWidth >= 44 && roundedHeight >= 44;

  return {
    valid,
    width,
    height,
    expected: '>= 44x44px',
    actual: `${roundedWidth}x${roundedHeight}px`
  };
}

export interface TypographyCheckResult {
  valid: boolean;
  violations: Array<{ rule: string; expected: string; actual: string }>;
}

/**
 * Verifies body text readability:
 * - font-size >= 16px
 * - unitless line-height >= 1.4
 */
export function checkTypographyScale(
  fontSizePx: number,
  lineHeightPx: number,
  tagName = 'p'
): TypographyCheckResult {
  const bodyTags = ['p', 'li', 'input', 'textarea', 'label'];
  const isBody = bodyTags.includes(tagName.toLowerCase());

  const violations: Array<{ rule: string; expected: string; actual: string }> = [];

  // Minimum legible text rule across all elements
  if (fontSizePx > 0 && fontSizePx < 12) {
    violations.push({
      rule: 'TYPOGRAPHY_SCALE',
      expected: '>= 12px (minimum legible text)',
      actual: `${fontSizePx}px`
    });
  }

  if (isBody) {
    if (fontSizePx < 16 && fontSizePx >= 12) {
      violations.push({
        rule: 'TYPOGRAPHY_SCALE',
        expected: '>= 16px',
        actual: `${fontSizePx}px`
      });
    }

    if (fontSizePx > 0 && lineHeightPx > 0) {
      const ratio = lineHeightPx / fontSizePx;
      // Allow slight float tolerance e.g. 1.399
      if (ratio < 1.395) {
        violations.push({
          rule: 'TYPOGRAPHY_SCALE',
          expected: 'line-height >= 1.4 (unitless ratio)',
          actual: `line-height ratio ${ratio.toFixed(2)} (${lineHeightPx}px / ${fontSizePx}px)`
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

export interface AccessibilityInfo {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  alt?: string;
  innerText?: string;
  inputType?: string;
  hasAssociatedLabel?: boolean;
}

export interface LintElementInput {
  selector: string;
  tagName: string;
  isInteractive?: boolean;
  isMobileViewport?: boolean;
  viewportWidth?: number;
  computedStyles: Record<string, string>;
  boundingBox?: { x?: number; y?: number; width: number; height: number };
  canvasBackground?: string;
  accessibility?: AccessibilityInfo;
}

/**
 * Runs all deterministic UI heuristic checks on an element and returns detected violations.
 */
export function lintElementHeuristics(input: LintElementInput): HeuristicViolation[] {
  const violations: HeuristicViolation[] = [];
  const { selector, tagName, isInteractive, isMobileViewport, viewportWidth, boundingBox, canvasBackground, accessibility } = input;
  const computedStyles = input.computedStyles ?? {};

  // 1. Contrast check (if color and backgroundColor are present)
  const color = computedStyles.color;
  const bgColor = computedStyles.backgroundColor;
  const fontSizePx = parseFloat(computedStyles.fontSize ?? '16') || 16;
  const fontWeight = computedStyles.fontWeight ?? '400';

  if (color && bgColor) {
    const contrast = checkContrast(color, bgColor, fontSizePx, fontWeight, canvasBackground ?? '#ffffff');
    if (!contrast.valid) {
      violations.push({
        rule: 'CONTRAST',
        element: selector,
        expected: `>= ${contrast.threshold}:1 (${contrast.isLargeText ? 'large text' : 'normal text'})`,
        actual: `${contrast.ratio}:1`
      });
    }
  }

  // 2. Spacing grid checks
  const spacingProps = ['margin', 'padding', 'gap'];
  for (const prop of spacingProps) {
    const val = computedStyles[prop];
    if (val) {
      const res = checkSpacingGrid(val);
      if (!res.valid) {
        violations.push({
          rule: 'SPACING_GRID',
          element: selector,
          expected: 'multiples of 4px/8px (or 0px, 1px, 2px)',
          actual: `${prop}: ${val} (off-grid: ${res.invalidValues.join(', ')})`
        });
      }
    }
  }

  // 3. Tap target check for interactive elements on mobile
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
  const isTargetInteractive =
    isInteractive ||
    interactiveTags.includes(tagName.toLowerCase()) ||
    computedStyles.cursor === 'pointer';

  if (isTargetInteractive && isMobileViewport && boundingBox) {
    const tapRes = checkTapTarget({ width: boundingBox.width, height: boundingBox.height }, true);
    if (!tapRes.valid) {
      violations.push({
        rule: 'TAP_TARGET',
        element: selector,
        expected: tapRes.expected,
        actual: tapRes.actual
      });
    }
  }

  // 4. Typography scale check for body text and legible microcopy
  const lineHeightVal = computedStyles.lineHeight;
  let lineHeightPx = 0;
  if (lineHeightVal && lineHeightVal !== 'normal') {
    lineHeightPx = parseFloat(lineHeightVal) || 0;
  }
  const typoRes = checkTypographyScale(fontSizePx, lineHeightPx, tagName);
  for (const v of typoRes.violations) {
    violations.push({
      rule: 'TYPOGRAPHY_SCALE',
      element: selector,
      expected: v.expected,
      actual: v.actual
    });
  }

  // 5. Focus visibility check on interactive elements
  if (isTargetInteractive) {
    const outlineStyle = computedStyles.outlineStyle;
    const outlineWidth = computedStyles.outlineWidth;
    const outline = computedStyles.outline;
    const boxShadow = computedStyles.boxShadow;

    const removesOutline =
      outlineStyle === 'none' ||
      outlineWidth === '0px' ||
      outline === 'none' ||
      outline === '0';

    const hasBoxShadowAlternative =
      boxShadow &&
      boxShadow !== 'none' &&
      boxShadow !== 'rgba(0, 0, 0, 0)' &&
      boxShadow.trim() !== '';

    if (removesOutline && !hasBoxShadowAlternative) {
      violations.push({
        rule: 'FOCUS_VISIBLE',
        element: selector,
        expected: 'visible focus ring indicator (outline or box-shadow)',
        actual: 'outline removed without box-shadow ring alternative'
      });
    }
  }

  // 6. Mobile layout overflow check
  if (isMobileViewport && viewportWidth && boundingBox) {
    const elemRight = (boundingBox.x ?? 0) + boundingBox.width;
    if (elemRight > viewportWidth + 2) {
      violations.push({
        rule: 'LAYOUT_OVERFLOW',
        element: selector,
        expected: `<= ${viewportWidth}px (fits mobile viewport without horizontal scroll)`,
        actual: `${Math.round(elemRight)}px (overflows by ${Math.round(elemRight - viewportWidth)}px)`
      });
    }
  }

  // 7. Lighthouse Web Accessibility Checks
  if (accessibility) {
    const { alt, ariaLabel, ariaLabelledBy, innerText, inputType, hasAssociatedLabel } = accessibility;
    const lowerTag = tagName.toLowerCase();

    // Image alt attribute
    if (lowerTag === 'img' && !alt && !ariaLabel && !ariaLabelledBy) {
      violations.push({
        rule: 'ACCESSIBILITY',
        element: selector,
        expected: 'img element must have an alt attribute or aria-label',
        actual: 'missing alt text description'
      });
    }

    // Button accessible name
    if ((lowerTag === 'button' || accessibility.role === 'button') && !innerText && !ariaLabel && !ariaLabelledBy) {
      violations.push({
        rule: 'ACCESSIBILITY',
        element: selector,
        expected: 'button must have discernible text content or aria-label',
        actual: 'button has no accessible name'
      });
    }

    // Form inputs accessible label
    const formInputTags = ['input', 'select', 'textarea'];
    const nonLabeledTypes = ['hidden', 'submit', 'reset', 'button', 'image'];
    if (
      formInputTags.includes(lowerTag) &&
      !nonLabeledTypes.includes(inputType ?? '') &&
      !hasAssociatedLabel &&
      !ariaLabel &&
      !ariaLabelledBy
    ) {
      violations.push({
        rule: 'ACCESSIBILITY',
        element: selector,
        expected: 'form control must have an associated <label> or aria-label',
        actual: 'unlabeled form element'
      });
    }

    // Link accessible text
    if (lowerTag === 'a' && !innerText && !ariaLabel && !ariaLabelledBy) {
      violations.push({
        rule: 'ACCESSIBILITY',
        element: selector,
        expected: 'anchor link must have discernible text or aria-label',
        actual: 'empty link with no accessible text'
      });
    }
  }

  return violations;
}
