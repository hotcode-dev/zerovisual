import type { BoundingBox, HeuristicRule, HeuristicViolation, ViolationCategory, ViolationSeverity } from './schema.js';
import { diffDesignMdAgainstDom, rgbToHsl, type DesignMdSpec } from './design-md-parser.js';
import {
  parseColor,
  extractColorsFromCssValue,
  compositeColors,
  calculateRelativeLuminance,
  calculateContrastRatio
} from './color.js';

export {
  parseColor,
  hslToRgb,
  oklabToRgb,
  oklchToRgb,
  extractColorsFromCssValue,
  compositeColors,
  calculateRelativeLuminance,
  calculateContrastRatio,
  type RgbColor
} from './color.js';

export interface RuleMetadata {
  category: ViolationCategory;
  severity: ViolationSeverity;
  suggestedCommand: string;
  impeccableAliases: string[];
}

export const RULE_METADATA: Record<HeuristicRule, RuleMetadata> = {
  CONTRAST: {
    category: 'accessibility',
    severity: 'critical',
    suggestedCommand: '/impeccable colorize',
    impeccableAliases: ['low-contrast', 'contrast']
  },
  SPACING_GRID: {
    category: 'layout',
    severity: 'warning',
    suggestedCommand: '/impeccable layout',
    impeccableAliases: ['monotonous-spacing', 'spacing-grid']
  },
  TAP_TARGET: {
    category: 'accessibility',
    severity: 'critical',
    suggestedCommand: '/impeccable adapt',
    impeccableAliases: ['tap-target', 'touch-target']
  },
  TYPOGRAPHY_SCALE: {
    category: 'typography',
    severity: 'warning',
    suggestedCommand: '/impeccable typeset',
    impeccableAliases: ['tiny-text', 'undersized-ui-text', 'tight-leading']
  },
  ACCESSIBILITY: {
    category: 'accessibility',
    severity: 'critical',
    suggestedCommand: '/impeccable harden',
    impeccableAliases: ['a11y', 'accessibility', 'skipped-heading']
  },
  LAYOUT_OVERFLOW: {
    category: 'layout',
    severity: 'critical',
    suggestedCommand: '/impeccable adapt',
    impeccableAliases: ['layout-overflow', 'horizontal-scroll']
  },
  FOCUS_VISIBLE: {
    category: 'accessibility',
    severity: 'warning',
    suggestedCommand: '/impeccable polish',
    impeccableAliases: ['focus-visible']
  },
  AI_SLOP_COLOR: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable colorize',
    impeccableAliases: ['ai-color-palette', 'cream-palette']
  },
  GRADIENT_TEXT: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable typeset',
    impeccableAliases: ['gradient-text']
  },
  DARK_GLOW: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable quieter',
    impeccableAliases: ['dark-glow', 'radial-halo', 'radial-spotlight-glow', 'hard-offset-shadow']
  },
  SIDE_TAB_BORDER: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable distill',
    impeccableAliases: ['side-tab', 'border-accent-on-rounded']
  },
  GRAY_ON_COLOR: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable colorize',
    impeccableAliases: ['gray-on-color']
  },
  NESTED_CARDS: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable distill',
    impeccableAliases: ['nested-cards']
  },
  ICON_TILE_STACK: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable layout',
    impeccableAliases: ['icon-tile-stack']
  },
  BANNED_EYEBROW: {
    category: 'ai-slop',
    severity: 'warning',
    suggestedCommand: '/impeccable distill',
    impeccableAliases: ['numbered-section-labels', 'eyebrow', 'kicker']
  },
  EMOJI_ICON: {
    category: 'ai-slop',
    severity: 'advisory',
    suggestedCommand: '/impeccable polish',
    impeccableAliases: ['emoji-icon']
  },
  FLAT_TYPE_HIERARCHY: {
    category: 'typography',
    severity: 'warning',
    suggestedCommand: '/impeccable typeset',
    impeccableAliases: ['flat-type-hierarchy', 'oversized-h1']
  },
  HEADING_RHYTHM: {
    category: 'typography',
    severity: 'warning',
    suggestedCommand: '/impeccable layout',
    impeccableAliases: ['heading-rhythm']
  },
  LINE_LENGTH: {
    category: 'typography',
    severity: 'warning',
    suggestedCommand: '/impeccable typeset',
    impeccableAliases: ['line-length', 'body-text-viewport-edge']
  },
  CRAMPED_PADDING: {
    category: 'layout',
    severity: 'warning',
    suggestedCommand: '/impeccable layout',
    impeccableAliases: ['cramped-padding', 'edge-flush-cards']
  },
  TEXT_OCCLUSION: {
    category: 'render-integrity',
    severity: 'critical',
    suggestedCommand: '/impeccable layout',
    impeccableAliases: ['text-occlusion']
  },
  CLIPPED_OVERFLOW: {
    category: 'render-integrity',
    severity: 'warning',
    suggestedCommand: '/impeccable adapt',
    impeccableAliases: ['text-overflow', 'clipped-overflow-container']
  },
  BROKEN_IMAGE: {
    category: 'render-integrity',
    severity: 'critical',
    suggestedCommand: '/impeccable harden',
    impeccableAliases: ['broken-image']
  },
  HIDDEN_AT_REST: {
    category: 'render-integrity',
    severity: 'critical',
    suggestedCommand: '/impeccable harden',
    impeccableAliases: ['content-hidden-at-rest']
  },
  COLUMN_OVERFLOW: {
    category: 'render-integrity',
    severity: 'warning',
    suggestedCommand: '/impeccable layout',
    impeccableAliases: ['first-viewport-column-overflow']
  },
  DESIGN_SYSTEM_DRIFT: {
    category: 'design-system',
    severity: 'advisory',
    suggestedCommand: '/impeccable polish',
    impeccableAliases: ['design-system-font', 'design-system-color', 'design-system-radius', 'design-system-font-size']
  }
};

/**
 * Checks whether a rule is waived by data-impeccable-ignore, data-zerovisual-ignore,
 * or .impeccable/config.json ignoreRules.
 */
export function isRuleIgnored(rule: HeuristicRule, ignoredRules?: string[]): boolean {
  if (!ignoredRules || ignoredRules.length === 0) return false;
  const meta = RULE_METADATA[rule];
  const normalizedSet = new Set(
    ignoredRules
      .flatMap(r => r.split(/[\s,]+/))
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (normalizedSet.has('*') || normalizedSet.has('all')) return true;
  if (normalizedSet.has(rule.toLowerCase()) || normalizedSet.has(rule.toLowerCase().replace(/_/g, '-'))) {
    return true;
  }
  for (const alias of meta.impeccableAliases) {
    if (normalizedSet.has(alias.toLowerCase())) return true;
  }
  return false;
}

function normalizeBoundingBox(box?: {
  x?: number;
  y?: number;
  width: number;
  height: number;
}): BoundingBox | undefined {
  if (!box || box.x === undefined || box.y === undefined) return undefined;
  if (box.width <= 0 || box.height <= 0) return undefined;
  return {
    x: Math.max(0, Math.round(box.x)),
    y: Math.max(0, Math.round(box.y)),
    width: Math.max(1, Math.round(box.width)),
    height: Math.max(1, Math.round(box.height))
  };
}

function createViolation(
  rule: HeuristicRule,
  element: string,
  expected: string,
  actual: string,
  boundingBox?: { x?: number; y?: number; width: number; height: number },
  viewport?: string
): HeuristicViolation {
  const meta = RULE_METADATA[rule];
  const normBox = normalizeBoundingBox(boundingBox);
  return {
    rule,
    element,
    expected,
    actual,
    category: meta.category,
    severity: meta.severity,
    suggestedCommand: meta.suggestedCommand,
    ...(normBox ? { boundingBox: normBox } : {}),
    ...(viewport ? { viewport } : {})
  };
}

export interface ContrastCheckResult {
  valid: boolean;
  ratio: number;
  threshold: number;
  isLargeText: boolean;
}

/**
 * Evaluates WCAG 2.1 AA text contrast compliance.
 */
export function checkContrast(
  fgColorStr: string,
  bgColorStr: string,
  fontSizePx = 16,
  fontWeight: number | string = 400,
  canvasBgColorStr = '#ffffff'
): ContrastCheckResult {
  const fg = parseColor(fgColorStr);
  let bg = parseColor(bgColorStr);
  const canvasBg = parseColor(canvasBgColorStr);

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
 */
export function checkSpacingGrid(cssValue: string): SpacingCheckResult {
  if (!cssValue || cssValue.trim() === '' || cssValue === 'auto' || cssValue === 'normal') {
    return { valid: true, invalidValues: [] };
  }

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
export function checkTypographyScale(fontSizePx: number, lineHeightPx: number, tagName = 'p'): TypographyCheckResult {
  const bodyTags = ['p', 'li', 'input', 'textarea', 'label'];
  const isBody = bodyTags.includes(tagName.toLowerCase());

  const violations: Array<{ rule: string; expected: string; actual: string }> = [];

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

export interface SlopAndRenderSignals {
  isCard?: boolean;
  isInsideCard?: boolean;
  hasIconTileStack?: boolean;
  isEyebrowAboveHeading?: boolean;
  hasEmojiIcon?: boolean;
  spaceAbovePx?: number;
  spaceBelowPx?: number;
  imageBroken?: boolean;
  hasUnintendedTextOverflow?: boolean;
  isHiddenAtRest?: boolean;
  occludedBySelector?: string;
  hasColumnOverflowImbalance?: boolean;
  ignoredRules?: string[];
}

export interface LintElementInput {
  selector: string;
  tagName: string;
  isInteractive?: boolean;
  isMobileViewport?: boolean;
  viewportName?: string;
  viewportWidth?: number;
  computedStyles: Record<string, string>;
  boundingBox?: { x?: number; y?: number; width: number; height: number };
  canvasBackground?: string;
  accessibility?: AccessibilityInfo;
  signals?: SlopAndRenderSignals;
  designMd?: DesignMdSpec;
}

/**
 * Suite 1: Surface & Color AI Slop Checks
 * Detects gradient text, AI purple/violet/cyan-on-dark gradients, glowing shadows/halos,
 * thick colored side-tab borders, and washed-out gray text on colored surfaces.
 */
export function checkSurfaceAndColorSlop(input: LintElementInput): HeuristicViolation[] {
  const violations: HeuristicViolation[] = [];
  const { selector, computedStyles, boundingBox, canvasBackground, designMd, viewportName, accessibility } = input;
  const bgImage = computedStyles.backgroundImage ?? '';
  const bgClip = (computedStyles.backgroundClip || computedStyles.webkitBackgroundClip || '').toLowerCase();
  const textFillColor = computedStyles.webkitTextFillColor ?? '';
  const color = computedStyles.color ?? '';
  const bgColor = computedStyles.backgroundColor ?? '';
  const boxShadow = computedStyles.boxShadow ?? '';
  const textShadow = computedStyles.textShadow ?? '';

  // 1a. Gradient Text (background-clip: text with gradient & transparent fill)
  const hasGradient = bgImage.includes('gradient(');
  const hasTransparentText =
    color === 'transparent' ||
    textFillColor === 'transparent' ||
    (color !== '' && (parseColor(color).a ?? 1) < 0.15) ||
    (textFillColor !== '' && (parseColor(textFillColor).a ?? 1) < 0.15);

  if (hasGradient && (bgClip === 'text' || hasTransparentText)) {
    violations.push(
      createViolation(
        'GRADIENT_TEXT',
        selector,
        'solid text color (emphasis from weight or scale, not gradient text)',
        `background-clip: text with ${bgImage.slice(0, 60)}`,
        boundingBox,
        viewportName
      )
    );
  }

  // 1b. AI Slop Color Palette (purple/violet/indigo gradients or cyan-on-dark neon tells)
  if (hasGradient && !designMd?.allowsVioletPalette) {
    const gradColors = extractColorsFromCssValue(bgImage);
    const hasVioletStop = gradColors.some(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b);
      return h >= 250 && h <= 315 && s >= 0.35 && l >= 0.15 && l <= 0.85;
    });
    if (hasVioletStop) {
      violations.push(
        createViolation(
          'AI_SLOP_COLOR',
          selector,
          'intentional brand palette (avoid generic AI purple/violet/indigo gradients)',
          `AI violet/purple gradient detected: ${bgImage.slice(0, 72)}`,
          boundingBox,
          viewportName
        )
      );
    }
  }

  // 1c. Dark Glow / Radial Spotlight Halo / Hard Offset Shadow
  const canvasRgb = parseColor(canvasBackground ?? (bgColor || '#ffffff'));
  const canvasLum = calculateRelativeLuminance(canvasRgb);

  if (boxShadow && boxShadow !== 'none') {
    const shadowColors = extractColorsFromCssValue(boxShadow);
    const pxTokens = (
      boxShadow.replace(/rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}/gi, '').match(/-?\d+(?:\.\d+)?px/g) ?? []
    ).map(t => Math.abs(parseFloat(t)));
    const offsetX = pxTokens[0] ?? 0;
    const offsetY = pxTokens[1] ?? 0;
    const blur = pxTokens[2] ?? 0;

    for (const sc of shadowColors) {
      const [, s] = rgbToHsl(sc.r, sc.g, sc.b);
      const alpha = sc.a ?? 1;
      // Chromatic zero-offset halo or colored glow on dark canvas
      if (alpha >= 0.15 && s >= 0.32 && blur >= 8 && ((offsetX <= 2 && offsetY <= 2) || canvasLum < 0.08)) {
        violations.push(
          createViolation(
            'DARK_GLOW',
            selector,
            'neutral elevation shadow with vertical offset (avoid chromatic glow halos)',
            `box-shadow: ${boxShadow.slice(0, 72)}`,
            boundingBox,
            viewportName
          )
        );
        break;
      }
    }

    // Hard offset shadow (>= 4px offset with 0px blur) when not neobrutalist in DESIGN.md
    if (!designMd?.allowsHardOffsetShadow && (offsetX >= 4 || offsetY >= 4) && blur === 0 && pxTokens.length >= 2) {
      violations.push(
        createViolation(
          'DARK_GLOW',
          selector,
          'soft blurred elevation shadow (unless DESIGN.md specifies neobrutalist hard-offset shadows)',
          `hard offset box-shadow: ${boxShadow.slice(0, 64)}`,
          boundingBox,
          viewportName
        )
      );
    }
  }

  if (textShadow && textShadow !== 'none') {
    const tsColors = extractColorsFromCssValue(textShadow);
    if (tsColors.some(c => rgbToHsl(c.r, c.g, c.b)[1] >= 0.35 && (c.a ?? 1) >= 0.2)) {
      violations.push(
        createViolation(
          'DARK_GLOW',
          selector,
          'clean typography without chromatic neon text-shadow glow',
          `text-shadow: ${textShadow.slice(0, 64)}`,
          boundingBox,
          viewportName
        )
      );
    }
  }

  if (bgImage.includes('radial-gradient(') && canvasLum < 0.12) {
    const radColors = extractColorsFromCssValue(bgImage);
    const hasChromaticHalo = radColors.some(c => rgbToHsl(c.r, c.g, c.b)[1] >= 0.35 && (c.a ?? 1) > 0.08);
    const hasTransparentFade = bgImage.includes('transparent') || radColors.some(c => (c.a ?? 1) < 0.05);
    if (hasChromaticHalo && hasTransparentFade) {
      violations.push(
        createViolation(
          'DARK_GLOW',
          selector,
          'solid or subtle material surface (avoid decorative radial-gradient spotlight halos)',
          `radial halo: ${bgImage.slice(0, 72)}`,
          boundingBox,
          viewportName
        )
      );
    }
  }

  // 1d. Side-Tab Accent Border & Thick Accent Border on Rounded Element
  const blW = parseFloat(computedStyles.borderLeftWidth ?? '0') || 0;
  const brW = parseFloat(computedStyles.borderRightWidth ?? '0') || 0;
  const btW = parseFloat(computedStyles.borderTopWidth ?? '0') || 0;
  const bbW = parseFloat(computedStyles.borderBottomWidth ?? '0') || 0;
  const radiusPx = parseFloat(computedStyles.borderRadius ?? '0') || 0;

  if ((blW >= 3 && btW <= 1 && bbW <= 1 && brW <= 1) || (brW >= 3 && btW <= 1 && bbW <= 1 && blW <= 1)) {
    const sideColorStr =
      blW >= 3
        ? (computedStyles.borderLeftColor ?? computedStyles.borderColor ?? '')
        : (computedStyles.borderRightColor ?? computedStyles.borderColor ?? '');
    violations.push(
      createViolation(
        'SIDE_TAB_BORDER',
        selector,
        'uniform subtle border or spacing hierarchy (avoid thick colored side-tab borders)',
        `side border ${Math.max(blW, brW)}px (${sideColorStr || 'accent'})`,
        boundingBox,
        viewportName
      )
    );
  } else if (radiusPx >= 8 && btW >= 2 && bbW >= 2 && blW >= 2 && brW >= 2) {
    const bColorStr = computedStyles.borderTopColor ?? computedStyles.borderColor ?? '';
    if (bColorStr) {
      const bc = parseColor(bColorStr);
      const [, s] = rgbToHsl(bc.r, bc.g, bc.b);
      if (s >= 0.4 && (bc.a ?? 1) >= 0.4) {
        violations.push(
          createViolation(
            'SIDE_TAB_BORDER',
            selector,
            'subtle neutral border (<= 1px) or borderless surface on rounded cards',
            `${btW}px saturated accent border (${bColorStr}) on ${radiusPx}px rounded element`,
            boundingBox,
            viewportName
          )
        );
      }
    }
  }

  // 1e. Gray Text on Colored Background
  const hasText = Boolean(accessibility?.innerText && accessibility.innerText.trim().length > 0);
  if (hasText && color && bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
    const fgRgb = parseColor(color);
    const bgRgb = parseColor(bgColor);
    if ((fgRgb.a ?? 1) >= 0.5 && (bgRgb.a ?? 1) >= 0.5) {
      const [, fgSat, fgLight] = rgbToHsl(fgRgb.r, fgRgb.g, fgRgb.b);
      const [, bgSat, bgLight] = rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b);
      const isAchromaticGrayFg = fgSat <= 0.1 && fgLight >= 0.25 && fgLight <= 0.78;
      const isSaturatedColoredBg = bgSat >= 0.3 && bgLight >= 0.15 && bgLight <= 0.88;
      if (isAchromaticGrayFg && isSaturatedColoredBg) {
        violations.push(
          createViolation(
            'GRAY_ON_COLOR',
            selector,
            'hue-tinted foreground or pure white/near-black contrast on colored surfaces (never neutral gray)',
            `gray text (${color}) on colored surface (${bgColor})`,
            boundingBox,
            viewportName
          )
        );
      }
    }
  }

  return violations;
}

/**
 * Suite 2: Scaffold & Layout Structure AI Slop Checks
 * Detects nested cards, repeated icon-tile-above-heading templates, banned eyebrows/kickers,
 * and emoji characters used as UI icons.
 */
export function checkScaffoldAndStructureSlop(input: LintElementInput): HeuristicViolation[] {
  const violations: HeuristicViolation[] = [];
  const { selector, signals, boundingBox, viewportName, accessibility, tagName } = input;

  if (signals?.isCard && signals?.isInsideCard) {
    violations.push(
      createViolation(
        'NESTED_CARDS',
        selector,
        'flat container hierarchy using spacing, typography, or hairlines instead of cards inside cards',
        'card container (background/border/shadow/radius) nested inside an outer card container',
        boundingBox,
        viewportName
      )
    );
  }

  if (signals?.hasIconTileStack) {
    violations.push(
      createViolation(
        'ICON_TILE_STACK',
        selector,
        'distinctive section layout or inline icon pairing (avoid generic rounded icon-box stacked above heading cards)',
        'repeated card template with small rounded icon tile stacked above heading',
        boundingBox,
        viewportName
      )
    );
  }

  if (signals?.isEyebrowAboveHeading) {
    violations.push(
      createViolation(
        'BANNED_EYEBROW',
        selector,
        'let the section heading carry its own weight without a kicker, eyebrow pill, or 01/02/03 index prefix',
        `eyebrow/kicker label ("${(accessibility?.innerText ?? '').slice(0, 36)}") immediately above heading`,
        boundingBox,
        viewportName
      )
    );
  }

  const text = (accessibility?.innerText ?? '').trim();
  const emojiRegex = /^[\p{Extended_Pictographic}\u2600-\u27BF]+(?:\uFE0F|\u200D[\p{Extended_Pictographic}])*$/u;
  const isStandaloneEmojiIcon =
    signals?.hasEmojiIcon ||
    (['span', 'div', 'i', 'button'].includes(tagName.toLowerCase()) &&
      text.length >= 1 &&
      text.length <= 4 &&
      emojiRegex.test(text));

  if (isStandaloneEmojiIcon) {
    violations.push(
      createViolation(
        'EMOJI_ICON',
        selector,
        'authored SVG or consistent icon library in one stroke/weight (never raw Unicode emoji as UI icons)',
        `raw emoji glyph ("${text || 'emoji'}") used as icon`,
        boundingBox,
        viewportName
      )
    );
  }

  return violations;
}

/**
 * Suite 3: Typography Hierarchy & Spatial Rhythm Checks
 * Detects broken heading proximity (space above <= space below), excessive line length (> 75ch),
 * body text touching viewport edges, and cramped container padding.
 */
export function checkTypographyAndRhythmSlop(input: LintElementInput): HeuristicViolation[] {
  const violations: HeuristicViolation[] = [];
  const {
    selector,
    tagName,
    computedStyles,
    boundingBox,
    viewportWidth,
    isMobileViewport,
    viewportName,
    accessibility,
    signals
  } = input;
  const lowerTag = tagName.toLowerCase();
  const fontSizePx = parseFloat(computedStyles.fontSize ?? '16') || 16;

  // 3a. Heading Rhythm (space above a heading should exceed space below it)
  if (['h2', 'h3', 'h4'].includes(lowerTag)) {
    const spaceAbove =
      signals?.spaceAbovePx ?? (computedStyles.marginTop ? parseFloat(computedStyles.marginTop) : undefined);
    const spaceBelow =
      signals?.spaceBelowPx ?? (computedStyles.marginBottom ? parseFloat(computedStyles.marginBottom) : undefined);

    if (
      spaceAbove !== undefined &&
      spaceBelow !== undefined &&
      !Number.isNaN(spaceAbove) &&
      !Number.isNaN(spaceBelow) &&
      spaceBelow >= 8 &&
      spaceAbove > 0 &&
      spaceAbove <= spaceBelow
    ) {
      violations.push(
        createViolation(
          'HEADING_RHYTHM',
          selector,
          'space above heading > space below heading (binds heading to the content it introduces)',
          `space above (${Math.round(spaceAbove)}px) <= space below (${Math.round(spaceBelow)}px)`,
          boundingBox,
          viewportName
        )
      );
    }
  }

  // 3b. Line Length (> 75-80ch) & Body Text Touching Viewport Edge
  const textLen = (accessibility?.innerText ?? '').trim().length;
  if (['p', 'li'].includes(lowerTag) && boundingBox && boundingBox.width > 0) {
    // ~0.52em average character width => 80ch is ~41.6 * fontSizePx
    const maxMeasurePx = Math.round(fontSizePx * 42);
    if (textLen >= 90 && boundingBox.width > maxMeasurePx) {
      const approxCh = Math.round(boundingBox.width / (fontSizePx * 0.52));
      violations.push(
        createViolation(
          'LINE_LENGTH',
          selector,
          `65ch–75ch comfortable reading measure (<= ${maxMeasurePx}px at ${fontSizePx}px font)`,
          `~${approxCh}ch (${Math.round(boundingBox.width)}px wide)`,
          boundingBox,
          viewportName
        )
      );
    }

    if (viewportWidth && textLen >= 30 && boundingBox.x !== undefined) {
      const minEdgeInset = isMobileViewport ? 12 : 16;
      const leftInset = boundingBox.x;
      const rightInset = viewportWidth - (boundingBox.x + boundingBox.width);
      if ((leftInset >= 0 && leftInset < minEdgeInset) || (rightInset >= 0 && rightInset < minEdgeInset)) {
        violations.push(
          createViolation(
            'LINE_LENGTH',
            selector,
            `>= ${minEdgeInset}px horizontal viewport gutter padding`,
            `body text sits ${Math.max(0, Math.min(leftInset, rightInset))}px from viewport edge`,
            boundingBox,
            viewportName
          )
        );
      }
    }
  }

  // 3c. Cramped Padding inside bordered or colored containers with text
  const btW = parseFloat(computedStyles.borderTopWidth ?? '0') || 0;
  const blW = parseFloat(computedStyles.borderLeftWidth ?? '0') || 0;
  const hasVisibleBorder = btW >= 1 || blW >= 1;
  const hasVisibleSurface =
    hasVisibleBorder ||
    (Boolean(computedStyles.backgroundColor) &&
      computedStyles.backgroundColor !== 'transparent' &&
      computedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      computedStyles.backgroundColor !== input.canvasBackground);

  if (
    hasVisibleSurface &&
    textLen > 0 &&
    ['button', 'a', 'div', 'section', 'article', 'aside', 'p', 'li', 'span', 'h1', 'h2', 'h3', 'h4'].includes(lowerTag)
  ) {
    const padTokens = (computedStyles.padding ?? '').match(/\d+(?:\.\d+)?px/g)?.map(p => parseFloat(p)) ?? [];
    if (padTokens.length > 0) {
      const minPad = Math.min(...padTokens);
      if (minPad > 0 && minPad < 6 && fontSizePx >= 13) {
        violations.push(
          createViolation(
            'CRAMPED_PADDING',
            selector,
            'at least 8px–12px padding inside bordered or colored containers',
            `padding: ${computedStyles.padding} (min ${minPad}px)`,
            boundingBox,
            viewportName
          )
        );
      }
    }
  }

  return violations;
}

/**
 * Suite 4: Rendered Visual Integrity & Overlap Checks
 * Detects text occlusion, clipped overflow containers, broken images, content hidden at rest,
 * and first-viewport column overflow imbalance.
 */
export function checkRenderedVisualIntegrity(input: LintElementInput): HeuristicViolation[] {
  const violations: HeuristicViolation[] = [];
  const { selector, tagName, signals, boundingBox, viewportName } = input;

  if (signals?.occludedBySelector) {
    violations.push(
      createViolation(
        'TEXT_OCCLUSION',
        selector,
        'text and interactive elements must render unobstructed by overlapping opaque layers',
        `occluded by overlapping element "${signals.occludedBySelector}"`,
        boundingBox,
        viewportName
      )
    );
  }

  if (signals?.hasUnintendedTextOverflow) {
    violations.push(
      createViolation(
        'CLIPPED_OVERFLOW',
        selector,
        'content fits container or wraps cleanly without unintended clipping',
        'content scrollWidth exceeds clientWidth inside clipping container',
        boundingBox,
        viewportName
      )
    );
  }

  if (tagName.toLowerCase() === 'img' && signals?.imageBroken) {
    violations.push(
      createViolation(
        'BROKEN_IMAGE',
        selector,
        'loaded raster/vector image with naturalWidth > 0 and valid src',
        'broken, unloaded, or 0px placeholder <img> element',
        boundingBox,
        viewportName
      )
    );
  }

  if (signals?.isHiddenAtRest) {
    violations.push(
      createViolation(
        'HIDDEN_AT_REST',
        selector,
        'content visible at rest (opacity > 0, visibility: visible) after page load',
        'content remains hidden at rest (opacity: 0 or visibility: hidden)',
        boundingBox,
        viewportName
      )
    );
  }

  if (signals?.hasColumnOverflowImbalance) {
    violations.push(
      createViolation(
        'COLUMN_OVERFLOW',
        selector,
        'balanced multi-column height in first viewport without leaving sibling column in dead space',
        'one column stretches far past the first viewport fold while sibling column fits above the fold',
        boundingBox,
        viewportName
      )
    );
  }

  return violations;
}

/**
 * Runs all deterministic UI heuristic checks (accessibility, 8pt grid, tap targets,
 * typography scale, and rendered AI-slop & visual integrity checks) on an element.
 */
export function lintElementHeuristics(input: LintElementInput): HeuristicViolation[] {
  const rawViolations: HeuristicViolation[] = [];
  const {
    selector,
    tagName,
    isInteractive,
    isMobileViewport,
    viewportName,
    viewportWidth,
    boundingBox,
    canvasBackground,
    accessibility,
    signals
  } = input;
  const computedStyles = input.computedStyles ?? {};

  // 1. Contrast check (if color and backgroundColor are present)
  const color = computedStyles.color;
  const bgColor = computedStyles.backgroundColor;
  const fontSizePx = parseFloat(computedStyles.fontSize ?? '16') || 16;
  const fontWeight = computedStyles.fontWeight ?? '400';

  if (color && bgColor) {
    const contrast = checkContrast(color, bgColor, fontSizePx, fontWeight, canvasBackground ?? '#ffffff');
    if (!contrast.valid) {
      rawViolations.push(
        createViolation(
          'CONTRAST',
          selector,
          `>= ${contrast.threshold}:1 (${contrast.isLargeText ? 'large text' : 'normal text'})`,
          `${contrast.ratio}:1`,
          boundingBox,
          viewportName
        )
      );
    }
  }

  // 2. Spacing grid checks
  const spacingProps = ['margin', 'padding', 'gap'];
  for (const prop of spacingProps) {
    const val = computedStyles[prop];
    if (val) {
      const res = checkSpacingGrid(val);
      if (!res.valid) {
        rawViolations.push(
          createViolation(
            'SPACING_GRID',
            selector,
            'multiples of 4px/8px (or 0px, 1px, 2px)',
            `${prop}: ${val} (off-grid: ${res.invalidValues.join(', ')})`,
            boundingBox,
            viewportName
          )
        );
      }
    }
  }

  // 3. Tap target check for interactive elements on mobile
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
  const isTargetInteractive =
    isInteractive || interactiveTags.includes(tagName.toLowerCase()) || computedStyles.cursor === 'pointer';

  if (isTargetInteractive && isMobileViewport && boundingBox) {
    const tapRes = checkTapTarget({ width: boundingBox.width, height: boundingBox.height }, true);
    if (!tapRes.valid) {
      rawViolations.push(
        createViolation('TAP_TARGET', selector, tapRes.expected, tapRes.actual, boundingBox, viewportName)
      );
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
    rawViolations.push(createViolation('TYPOGRAPHY_SCALE', selector, v.expected, v.actual, boundingBox, viewportName));
  }

  // 5. Focus visibility check on interactive elements
  if (isTargetInteractive) {
    const outlineStyle = computedStyles.outlineStyle;
    const outlineWidth = computedStyles.outlineWidth;
    const outline = computedStyles.outline;
    const boxShadow = computedStyles.boxShadow;

    const removesOutline = outlineStyle === 'none' || outlineWidth === '0px' || outline === 'none' || outline === '0';

    const hasBoxShadowAlternative =
      boxShadow && boxShadow !== 'none' && boxShadow !== 'rgba(0, 0, 0, 0)' && boxShadow.trim() !== '';

    if (removesOutline && !hasBoxShadowAlternative) {
      rawViolations.push(
        createViolation(
          'FOCUS_VISIBLE',
          selector,
          'visible focus ring indicator (outline or box-shadow)',
          'outline removed without box-shadow ring alternative',
          boundingBox,
          viewportName
        )
      );
    }
  }

  // 6. Mobile layout overflow check
  if (isMobileViewport && viewportWidth && boundingBox) {
    const elemRight = (boundingBox.x ?? 0) + boundingBox.width;
    if (elemRight > viewportWidth + 2) {
      rawViolations.push(
        createViolation(
          'LAYOUT_OVERFLOW',
          selector,
          `<= ${viewportWidth}px (fits mobile viewport without horizontal scroll)`,
          `${Math.round(elemRight)}px (overflows by ${Math.round(elemRight - viewportWidth)}px)`,
          boundingBox,
          viewportName
        )
      );
    }
  }

  // 7. Lighthouse Web Accessibility Checks
  if (accessibility) {
    const { alt, ariaLabel, ariaLabelledBy, innerText, inputType, hasAssociatedLabel } = accessibility;
    const lowerTag = tagName.toLowerCase();

    if (lowerTag === 'img' && !alt && !ariaLabel && !ariaLabelledBy) {
      rawViolations.push(
        createViolation(
          'ACCESSIBILITY',
          selector,
          'img element must have an alt attribute or aria-label',
          'missing alt text description',
          boundingBox,
          viewportName
        )
      );
    }

    if ((lowerTag === 'button' || accessibility.role === 'button') && !innerText && !ariaLabel && !ariaLabelledBy) {
      rawViolations.push(
        createViolation(
          'ACCESSIBILITY',
          selector,
          'button must have discernible text content or aria-label',
          'button has no accessible name',
          boundingBox,
          viewportName
        )
      );
    }

    const formInputTags = ['input', 'select', 'textarea'];
    const nonLabeledTypes = ['hidden', 'submit', 'reset', 'button', 'image'];
    if (
      formInputTags.includes(lowerTag) &&
      !nonLabeledTypes.includes(inputType ?? '') &&
      !hasAssociatedLabel &&
      !ariaLabel &&
      !ariaLabelledBy
    ) {
      rawViolations.push(
        createViolation(
          'ACCESSIBILITY',
          selector,
          'form control must have an associated <label> or aria-label',
          'unlabeled form element',
          boundingBox,
          viewportName
        )
      );
    }

    if (lowerTag === 'a' && !innerText && !ariaLabel && !ariaLabelledBy) {
      rawViolations.push(
        createViolation(
          'ACCESSIBILITY',
          selector,
          'anchor link must have discernible text or aria-label',
          'empty link with no accessible text',
          boundingBox,
          viewportName
        )
      );
    }
  }

  // 8. Surface & Color AI Slop Checks
  rawViolations.push(...checkSurfaceAndColorSlop(input));

  // 9. Scaffold & Structure AI Slop Checks
  rawViolations.push(...checkScaffoldAndStructureSlop(input));

  // 10. Typography Hierarchy & Spatial Rhythm Checks
  rawViolations.push(...checkTypographyAndRhythmSlop(input));

  // 11. Rendered Visual Integrity & Overlap Checks
  rawViolations.push(...checkRenderedVisualIntegrity(input));

  // Filter out waived rules (data-impeccable-ignore / data-zerovisual-ignore / .impeccable/config.json)
  return rawViolations.filter(v => !isRuleIgnored(v.rule, signals?.ignoredRules));
}

/**
 * Evaluates page-wide rules across all collected elements on a viewport:
 * - FLAT_TYPE_HIERARCHY (dominant heading and body sizes separated by < 1.25x at every step, or inverted headings)
 * - DESIGN_SYSTEM_DRIFT (when a DESIGN.md spec is present)
 */
export function lintPageLevelHeuristics(
  elements: LintElementInput[],
  options: {
    designMd?: DesignMdSpec;
    ignoreRules?: string[];
    viewportName?: string;
  } = {}
): HeuristicViolation[] {
  const violations: HeuristicViolation[] = [];
  const { designMd, ignoreRules, viewportName } = options;

  // 1. Flat or Inverted Type Hierarchy
  if (!isRuleIgnored('FLAT_TYPE_HIERARCHY', ignoreRules)) {
    const roleSizes = new Map<string, { size: number; selector: string; box?: BoundingBox }>();
    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      if (['h1', 'h2', 'h3', 'p'].includes(tag)) {
        const size = parseFloat(el.computedStyles?.fontSize ?? '0') || 0;
        if (size > 0) {
          const current = roleSizes.get(tag);
          if (!current || size > current.size) {
            roleSizes.set(tag, {
              size,
              selector: el.selector,
              box: normalizeBoundingBox(el.boundingBox)
            });
          }
        }
      }
    }

    const h1 = roleSizes.get('h1');
    const h2 = roleSizes.get('h2');
    const h3 = roleSizes.get('h3');
    const p = roleSizes.get('p');

    // Check inverted hierarchy (e.g. h2 > h1 or h3 > h2)
    if (h1 && h2 && h2.size > h1.size + 0.5) {
      violations.push(
        createViolation(
          'FLAT_TYPE_HIERARCHY',
          h2.selector,
          `h1 (${h1.size}px) >= h2 (${h2.size}px) hierarchical type scale`,
          `inverted heading scale: h2 (${h2.size}px) is larger than h1 (${h1.size}px)`,
          h2.box,
          viewportName
        )
      );
    } else if (h2 && h3 && h3.size > h2.size + 0.5) {
      violations.push(
        createViolation(
          'FLAT_TYPE_HIERARCHY',
          h3.selector,
          `h2 (${h2.size}px) >= h3 (${h3.size}px) hierarchical type scale`,
          `inverted heading scale: h3 (${h3.size}px) is larger than h2 (${h2.size}px)`,
          h3.box,
          viewportName
        )
      );
    } else {
      // Check flat hierarchy across available roles
      const ordered = [h1, h2, h3, p].filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (ordered.length >= 2) {
        let maxStepRatio = 0;
        for (let i = 0; i < ordered.length - 1; i++) {
          const upper = ordered[i]!;
          const lower = ordered[i + 1]!;
          if (lower.size > 0) {
            const ratio = upper.size / lower.size;
            if (ratio > maxStepRatio) maxStepRatio = ratio;
          }
        }
        if (maxStepRatio > 0 && maxStepRatio < 1.25) {
          const lead = ordered[0]!;
          const summary = ordered.map(r => `${r.size}px`).join(' -> ');
          violations.push(
            createViolation(
              'FLAT_TYPE_HIERARCHY',
              lead.selector,
              'at least one >= 1.25x typographic scale jump between heading and body roles',
              `flat size steps (${summary}, max step ${maxStepRatio.toFixed(2)}x < 1.25x)`,
              lead.box,
              viewportName
            )
          );
        }
      }
    }
  }

  // 2. DESIGN.md Drift Checks
  if (designMd && !isRuleIgnored('DESIGN_SYSTEM_DRIFT', ignoreRules)) {
    const stylesMap: Record<string, Record<string, string>> = {};
    const boxMap = new Map<string, BoundingBox | undefined>();
    for (const el of elements) {
      if (isRuleIgnored('DESIGN_SYSTEM_DRIFT', el.signals?.ignoredRules)) continue;
      stylesMap[el.selector] = el.computedStyles;
      boxMap.set(el.selector, normalizeBoundingBox(el.boundingBox));
    }

    const deltas = diffDesignMdAgainstDom(designMd, stylesMap);
    for (const d of deltas) {
      violations.push(
        createViolation(
          'DESIGN_SYSTEM_DRIFT',
          d.selector,
          `DESIGN.md ${d.property}: ${d.expectedDesignMd}`,
          `${d.property}: ${d.actualDom}`,
          boxMap.get(d.selector),
          viewportName
        )
      );
    }
  }

  return violations;
}

export interface ViolationCluster {
  id: string;
  boundingBox: BoundingBox;
  rules: HeuristicRule[];
  elements: string[];
  suggestedCommands: string[];
  violationIndices: number[];
}

const SEVERITY_WEIGHT: Record<ViolationSeverity, number> = {
  critical: 3,
  warning: 2,
  advisory: 1
};

/**
 * Clusters spatial violation bounding boxes within `mergeDistancePx` of each other,
 * applies context padding clamped to image bounds, and returns up to `maxCrops` clusters
 * prioritized by severity and violation density.
 */
export function clusterViolationBoundingBoxes(
  violations: HeuristicViolation[],
  imageDimensions: { width: number; height: number },
  options: {
    maxCrops?: number;
    padding?: number;
    mergeDistancePx?: number;
  } = {}
): ViolationCluster[] {
  const maxCrops = options.maxCrops ?? 4;
  const padding = options.padding ?? 32;
  const mergeDistance = options.mergeDistancePx ?? 96;
  const imgW = Math.max(1, imageDimensions.width);
  const imgH = Math.max(1, imageDimensions.height);

  interface RawCluster {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    rules: Set<HeuristicRule>;
    elements: Set<string>;
    commands: Set<string>;
    indices: number[];
    maxSeverityWeight: number;
  }

  const clusters: RawCluster[] = [];

  for (let i = 0; i < violations.length; i++) {
    const v = violations[i]!;
    const box = v.boundingBox;
    if (!box || box.width <= 0 || box.height <= 0) continue;

    // Ignore full-body boxes that cover >= 90% of the entire viewport
    if (box.width >= imgW * 0.9 && box.height >= imgH * 0.9) continue;

    const bx1 = Math.max(0, box.x);
    const by1 = Math.max(0, box.y);
    const bx2 = Math.min(imgW, box.x + box.width);
    const by2 = Math.min(imgH, box.y + box.height);
    if (bx2 <= bx1 || by2 <= by1) continue;

    const sevWeight = SEVERITY_WEIGHT[v.severity ?? RULE_METADATA[v.rule].severity];
    const cmd = v.suggestedCommand ?? RULE_METADATA[v.rule].suggestedCommand;

    // Find an existing cluster within mergeDistance
    let merged = false;
    for (const c of clusters) {
      const overlapsHoriz = bx1 <= c.maxX + mergeDistance && bx2 >= c.minX - mergeDistance;
      const overlapsVert = by1 <= c.maxY + mergeDistance && by2 >= c.minY - mergeDistance;
      if (overlapsHoriz && overlapsVert) {
        c.minX = Math.min(c.minX, bx1);
        c.minY = Math.min(c.minY, by1);
        c.maxX = Math.max(c.maxX, bx2);
        c.maxY = Math.max(c.maxY, by2);
        c.rules.add(v.rule);
        c.elements.add(v.element);
        c.commands.add(cmd);
        c.indices.push(i);
        c.maxSeverityWeight = Math.max(c.maxSeverityWeight, sevWeight);
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        minX: bx1,
        minY: by1,
        maxX: bx2,
        maxY: by2,
        rules: new Set([v.rule]),
        elements: new Set([v.element]),
        commands: new Set([cmd]),
        indices: [i],
        maxSeverityWeight: sevWeight
      });
    }
  }

  // Sort by highest severity first, then by number of violations in the cluster
  clusters.sort((a, b) => {
    if (b.maxSeverityWeight !== a.maxSeverityWeight) {
      return b.maxSeverityWeight - a.maxSeverityWeight;
    }
    return b.indices.length - a.indices.length;
  });

  return clusters.slice(0, maxCrops).map((c, idx) => {
    const x = Math.max(0, Math.round(c.minX - padding));
    const y = Math.max(0, Math.round(c.minY - padding));
    const right = Math.min(imgW, Math.round(c.maxX + padding));
    const bottom = Math.min(imgH, Math.round(c.maxY + padding));
    return {
      id: `crop-${idx + 1}`,
      boundingBox: {
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y)
      },
      rules: Array.from(c.rules),
      elements: Array.from(c.elements),
      suggestedCommands: Array.from(c.commands),
      violationIndices: c.indices
    };
  });
}
