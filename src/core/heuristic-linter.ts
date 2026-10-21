import type { HeuristicViolation } from './schema.js';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Parses CSS color strings (#hex, rgb, rgba, named) to RGBA.
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

  // rgb(...) or rgba(...) format
  const rgbMatch = str.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10);
    const g = parseInt(rgbMatch[2]!, 10);
    const b = parseInt(rgbMatch[3]!, 10);
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
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
 */
export function checkContrast(
  fgColorStr: string,
  bgColorStr: string,
  fontSizePx = 16,
  fontWeight: number | string = 400
): ContrastCheckResult {
  let fg = parseColor(fgColorStr);
  let bg = parseColor(bgColorStr);

  // If background is completely transparent, assume white background
  if ((bg.a ?? 1) === 0) {
    bg = { r: 255, g: 255, b: 255, a: 1 };
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

  if (!isBody) {
    return { valid: true, violations: [] };
  }

  const violations: Array<{ rule: string; expected: string; actual: string }> = [];

  if (fontSizePx < 16) {
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

  return {
    valid: violations.length === 0,
    violations
  };
}

export interface LintElementInput {
  selector: string;
  tagName: string;
  isInteractive?: boolean;
  isMobileViewport?: boolean;
  computedStyles: Record<string, string>;
  boundingBox?: { width: number; height: number };
}

/**
 * Runs all deterministic UI heuristic checks on an element and returns detected violations.
 */
export function lintElementHeuristics(input: LintElementInput): HeuristicViolation[] {
  const violations: HeuristicViolation[] = [];
  const { selector, tagName, isInteractive, isMobileViewport, boundingBox } = input;
  const computedStyles = input.computedStyles ?? {};

  // 1. Contrast check (if color and backgroundColor are present)
  const color = computedStyles.color;
  const bgColor = computedStyles.backgroundColor;
  const fontSizePx = parseFloat(computedStyles.fontSize ?? '16') || 16;
  const fontWeight = computedStyles.fontWeight ?? '400';

  if (color && bgColor) {
    const contrast = checkContrast(color, bgColor, fontSizePx, fontWeight);
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
    const tapRes = checkTapTarget(boundingBox, true);
    if (!tapRes.valid) {
      violations.push({
        rule: 'TAP_TARGET',
        element: selector,
        expected: tapRes.expected,
        actual: tapRes.actual
      });
    }
  }

  // 4. Typography scale check for body text
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

  return violations;
}
