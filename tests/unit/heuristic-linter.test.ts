import { describe, it, expect } from 'vitest';
import {
  parseColor,
  calculateContrastRatio,
  checkContrast,
  checkSpacingGrid,
  checkTapTarget,
  checkTypographyScale,
  lintElementHeuristics,
  lintPageLevelHeuristics,
  clusterViolationBoundingBoxes
} from '../../src/core/heuristic-linter.js';
import { parseDesignMd, diffDesignMdAgainstDom } from '../../src/core/design-md-parser.js';

describe('Deterministic UI Heuristic Linter', () => {
  describe('Color parsing and WCAG contrast', () => {
    it('should parse hex, rgb, rgba, and named colors', () => {
      expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
      expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
      expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('should calculate exact WCAG contrast ratios', () => {
      // Black on White is 21:1
      const black = { r: 0, g: 0, b: 0, a: 1 };
      const white = { r: 255, g: 255, b: 255, a: 1 };
      expect(calculateContrastRatio(black, white)).toBe(21);

      // White on White is 1:1
      expect(calculateContrastRatio(white, white)).toBe(1);
    });

    it('should detect failing contrast for low-contrast text', () => {
      // Light gray #9ca3af on white #ffffff is ~2.0:1, failing AA (4.5:1)
      const res = checkContrast('#9ca3af', '#ffffff', 14, 400);
      expect(res.valid).toBe(false);
      expect(res.ratio).toBeLessThan(4.5);
    });

    it('should pass large text when ratio is >= 3.0:1 even if < 4.5:1', () => {
      // Gray #888888 on white #ffffff is ~3.53:1 (fails 4.5:1 for normal text, but passes 3.0:1 for large text)
      const normalRes = checkContrast('#888888', '#ffffff', 16, 400);
      expect(normalRes.valid).toBe(false);

      const largeRes = checkContrast('#888888', '#ffffff', 24, 700);
      expect(largeRes.valid).toBe(true);
      expect(largeRes.isLargeText).toBe(true);
    });

    it('should blend transparent background over white default', () => {
      const res = checkContrast('#000000', 'transparent', 16, 400);
      expect(res.valid).toBe(true);
      expect(res.ratio).toBe(21);
    });
    it('should parse modern CSS colors: HSL, OKLCH, OKLab', () => {
      // Pure blue in HSL: hsl(240, 100%, 50%)
      const hsl = parseColor('hsl(240, 100%, 50%)');
      expect(hsl.r).toBe(0);
      expect(hsl.g).toBe(0);
      expect(hsl.b).toBe(255);
      expect(hsl.a).toBe(1);

      // OKLCH parsing
      const oklch = parseColor('oklch(0.6 0.2 140 / 0.8)');
      expect(oklch.r).toBeGreaterThan(0);
      expect(oklch.g).toBeGreaterThan(0);
      expect(oklch.a).toBe(0.8);

      // OKLab parsing
      const oklab = parseColor('oklab(0.7 0.1 -0.1)');
      expect(oklab.r).toBeGreaterThan(0);
      expect(oklab.b).toBeGreaterThan(0);
    });

    it('should support dark-mode canvas compositing for transparent backgrounds', () => {
      // White text on transparent background in a dark container (#0f172a)
      const darkCanvasRes = checkContrast('#ffffff', 'transparent', 16, 400, '#0f172a');
      expect(darkCanvasRes.valid).toBe(true);
      expect(darkCanvasRes.ratio).toBeGreaterThan(10);

      // Dark text on transparent background in a dark container (#0f172a) fails contrast
      const darkTextFail = checkContrast('#1e293b', 'transparent', 16, 400, '#0f172a');
      expect(darkTextFail.valid).toBe(false);
    });
  });

  describe('Spacing Grid (4px/8px rhythm)', () => {
    it('should allow 0px, 1px, 2px and multiples of 4px', () => {
      expect(checkSpacingGrid('0px').valid).toBe(true);
      expect(checkSpacingGrid('1px').valid).toBe(true);
      expect(checkSpacingGrid('2px').valid).toBe(true);
      expect(checkSpacingGrid('4px').valid).toBe(true);
      expect(checkSpacingGrid('8px').valid).toBe(true);
      expect(checkSpacingGrid('16px 24px').valid).toBe(true);
      expect(checkSpacingGrid('8px 0px 12px 16px').valid).toBe(true);
    });

    it('should flag off-grid values like 13px, 10px, 7px', () => {
      const res1 = checkSpacingGrid('13px');
      expect(res1.valid).toBe(false);
      expect(res1.invalidValues).toContain('13px');

      const res2 = checkSpacingGrid('8px 10px 16px 7px');
      expect(res2.valid).toBe(false);
      expect(res2.invalidValues).toEqual(['10px', '7px']);
    });
  });

  describe('Tap Target Sizing (44x44px on Mobile)', () => {
    it('should pass buttons >= 44x44px on mobile', () => {
      const res = checkTapTarget({ width: 48, height: 44 }, true);
      expect(res.valid).toBe(true);
    });

    it('should flag mobile touch targets smaller than 44x44px (e.g. 36x36px button)', () => {
      const res = checkTapTarget({ width: 36, height: 36 }, true);
      expect(res.valid).toBe(false);
      expect(res.expected).toBe('>= 44x44px');
      expect(res.actual).toBe('36x36px');
    });

    it('should ignore tap target constraint on desktop viewports', () => {
      const res = checkTapTarget({ width: 32, height: 28 }, false);
      expect(res.valid).toBe(true);
    });
  });

  describe('Typography Scale', () => {
    it('should pass body text with fontSize >= 16px and line-height >= 1.4', () => {
      const res = checkTypographyScale(16, 24, 'p'); // 24 / 16 = 1.5
      expect(res.valid).toBe(true);
      expect(res.violations).toHaveLength(0);
    });

    it('should flag body text with fontSize < 16px', () => {
      const res = checkTypographyScale(14, 20, 'p');
      expect(res.valid).toBe(false);
      expect(res.violations.some(v => v.actual.includes('14px'))).toBe(true);
    });

    it('should flag microcopy text < 12px as illegible across all elements', () => {
      const res = checkTypographyScale(10, 14, 'span');
      expect(res.valid).toBe(false);
      expect(res.violations.some(v => v.expected.includes('12px'))).toBe(true);
    });

    it('should flag body text with line-height < 1.4', () => {
      const res = checkTypographyScale(16, 18, 'p'); // 18 / 16 = 1.125
      expect(res.valid).toBe(false);
      expect(res.violations.some(v => v.rule === 'TYPOGRAPHY_SCALE')).toBe(true);
    });
  });

  describe('Accessibility, Focus Visible & Mobile Layout Overflow', () => {
    it('should flag missing image alt attribute', () => {
      const violations = lintElementHeuristics({
        selector: 'img.hero',
        tagName: 'img',
        computedStyles: {},
        accessibility: {}
      });

      expect(violations.some(v => v.rule === 'ACCESSIBILITY')).toBe(true);
    });

    it('should flag buttons without accessible name or text', () => {
      const violations = lintElementHeuristics({
        selector: 'button.icon-only',
        tagName: 'button',
        isInteractive: true,
        computedStyles: {},
        accessibility: { innerText: '' }
      });

      expect(violations.some(v => v.rule === 'ACCESSIBILITY')).toBe(true);
    });

    it('should flag interactive elements with outline: none and no box-shadow alternative', () => {
      const violations = lintElementHeuristics({
        selector: 'button.submit',
        tagName: 'button',
        isInteractive: true,
        computedStyles: {
          outline: 'none',
          boxShadow: 'none'
        }
      });

      expect(violations.some(v => v.rule === 'FOCUS_VISIBLE')).toBe(true);
    });

    it('should flag mobile layout horizontal overflow when element exceeds viewport width', () => {
      const violations = lintElementHeuristics({
        selector: 'div.wide-table',
        tagName: 'div',
        isMobileViewport: true,
        viewportWidth: 390,
        boundingBox: { x: 20, y: 100, width: 420, height: 200 },
        computedStyles: {}
      });

      const overflow = violations.find(v => v.rule === 'LAYOUT_OVERFLOW');
      expect(overflow).toBeDefined();
      expect(overflow?.actual).toContain('overflows by 50px');
    });
  });

  describe('lintElementHeuristics', () => {
    it('should aggregate all violations for a misconfigured mobile button', () => {
      const violations = lintElementHeuristics({
        selector: 'button.submit-btn',
        tagName: 'button',
        isInteractive: true,
        isMobileViewport: true,
        boundingBox: { width: 36, height: 36 },
        computedStyles: {
          color: '#9ca3af',
          backgroundColor: '#ffffff',
          fontSize: '12px',
          fontWeight: '400',
          lineHeight: '14px',
          margin: '13px',
          padding: '5px'
        }
      });

      const rules = violations.map(v => v.rule);
      expect(rules).toContain('CONTRAST');
      expect(rules).toContain('SPACING_GRID');
      expect(rules).toContain('TAP_TARGET');
    });
  });

  describe('Rendered AI-Slop & Visual Integrity Detectors (Impeccable Companion)', () => {
    it('should detect GRADIENT_TEXT and AI_SLOP_COLOR on purple gradient headings', () => {
      const violations = lintElementHeuristics({
        selector: 'h1.hero-title',
        tagName: 'h1',
        computedStyles: {
          backgroundImage: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
          backgroundClip: 'text',
          color: 'transparent',
          fontSize: '48px'
        },
        boundingBox: { x: 40, y: 80, width: 600, height: 64 }
      });

      const rules = violations.map(v => v.rule);
      expect(rules).toContain('GRADIENT_TEXT');
      expect(rules).toContain('AI_SLOP_COLOR');
      expect(violations.find(v => v.rule === 'GRADIENT_TEXT')?.suggestedCommand).toBe('/impeccable typeset');
      expect(violations.find(v => v.rule === 'AI_SLOP_COLOR')?.suggestedCommand).toBe('/impeccable colorize');
    });

    it('should exempt AI_SLOP_COLOR when DESIGN.md explicitly commits to a violet palette ("the brief wins")', () => {
      const designMd = parseDesignMd('# Design System\nPrimary Brand Color: `#8b5cf6` (Electric Violet)');
      expect(designMd.allowsVioletPalette).toBe(true);

      const violations = lintElementHeuristics({
        selector: 'div.hero-banner',
        tagName: 'div',
        designMd,
        computedStyles: {
          backgroundImage: 'linear-gradient(90deg, #8b5cf6, #6366f1)'
        }
      });

      expect(violations.some(v => v.rule === 'AI_SLOP_COLOR')).toBe(false);
    });

    it('should detect DARK_GLOW, SIDE_TAB_BORDER, and GRAY_ON_COLOR', () => {
      const violations = lintElementHeuristics({
        selector: 'div.ai-card',
        tagName: 'div',
        canvasBackground: '#090d16',
        accessibility: { innerText: 'AI Powered Feature' },
        computedStyles: {
          color: '#808080',
          backgroundColor: '#2563eb',
          boxShadow: '0px 0px 24px rgba(56, 189, 248, 0.6)',
          borderLeftWidth: '4px',
          borderTopWidth: '0px',
          borderRightWidth: '0px',
          borderBottomWidth: '0px',
          borderLeftColor: '#38bdf8'
        }
      });

      const rules = violations.map(v => v.rule);
      expect(rules).toContain('DARK_GLOW');
      expect(rules).toContain('SIDE_TAB_BORDER');
      expect(rules).toContain('GRAY_ON_COLOR');
      expect(violations.find(v => v.rule === 'DARK_GLOW')?.suggestedCommand).toBe('/impeccable quieter');
      expect(violations.find(v => v.rule === 'SIDE_TAB_BORDER')?.suggestedCommand).toBe('/impeccable distill');
    });

    it('should detect NESTED_CARDS, ICON_TILE_STACK, BANNED_EYEBROW, and EMOJI_ICON', () => {
      const violations = lintElementHeuristics({
        selector: 'div.inner-feature-card',
        tagName: 'div',
        computedStyles: {},
        accessibility: { innerText: '🚀' },
        signals: {
          isCard: true,
          isInsideCard: true,
          hasIconTileStack: true,
          isEyebrowAboveHeading: true,
          hasEmojiIcon: true
        }
      });

      const rules = violations.map(v => v.rule);
      expect(rules).toContain('NESTED_CARDS');
      expect(rules).toContain('ICON_TILE_STACK');
      expect(rules).toContain('BANNED_EYEBROW');
      expect(rules).toContain('EMOJI_ICON');
    });

    it('should detect HEADING_RHYTHM, LINE_LENGTH, and CRAMPED_PADDING', () => {
      const headingViolations = lintElementHeuristics({
        selector: 'h2.section-heading',
        tagName: 'h2',
        computedStyles: {
          fontSize: '28px',
          marginTop: '12px',
          marginBottom: '24px'
        }
      });
      expect(headingViolations.some(v => v.rule === 'HEADING_RHYTHM')).toBe(true);

      const longParagraphViolations = lintElementHeuristics({
        selector: 'p.wide-copy',
        tagName: 'p',
        viewportWidth: 1440,
        boundingBox: { x: 8, y: 200, width: 1100, height: 60 },
        accessibility: {
          innerText:
            'This is an extremely wide paragraph of body text that stretches across the entire 1100px desktop container without a 65ch-75ch max-width constraint.'
        },
        computedStyles: {
          fontSize: '16px',
          lineHeight: '24px',
          backgroundColor: '#f1f5f9',
          borderTopWidth: '1px',
          padding: '4px'
        }
      });

      const pRules = longParagraphViolations.map(v => v.rule);
      expect(pRules).toContain('LINE_LENGTH');
      expect(pRules).toContain('CRAMPED_PADDING');
    });

    it('should detect TEXT_OCCLUSION, CLIPPED_OVERFLOW, BROKEN_IMAGE, HIDDEN_AT_REST, and COLUMN_OVERFLOW', () => {
      const imgViolations = lintElementHeuristics({
        selector: 'img.avatar',
        tagName: 'img',
        computedStyles: {},
        accessibility: { alt: 'User avatar' },
        signals: {
          imageBroken: true,
          occludedBySelector: 'div.floating-badge',
          hasUnintendedTextOverflow: true,
          isHiddenAtRest: true,
          hasColumnOverflowImbalance: true
        }
      });

      const rules = imgViolations.map(v => v.rule);
      expect(rules).toContain('BROKEN_IMAGE');
      expect(rules).toContain('TEXT_OCCLUSION');
      expect(rules).toContain('CLIPPED_OVERFLOW');
      expect(rules).toContain('HIDDEN_AT_REST');
      expect(rules).toContain('COLUMN_OVERFLOW');
    });

    it('should honor data-impeccable-ignore and data-zerovisual-ignore rule waivers', () => {
      const violations = lintElementHeuristics({
        selector: 'h1.gradient-waived',
        tagName: 'h1',
        computedStyles: {
          backgroundImage: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
          backgroundClip: 'text',
          color: 'transparent'
        },
        signals: {
          ignoredRules: ['gradient-text', 'ai-color-palette']
        }
      });

      expect(violations).toHaveLength(0);
    });

    it('should detect FLAT_TYPE_HIERARCHY and DESIGN_SYSTEM_DRIFT at page level', () => {
      const designMd = parseDesignMd(`
# DESIGN.md
## Typography
- Heading Font: \`Instrument Serif\`
- Body Font: \`Plus Jakarta Sans\`
- Type Scale: 16px, 24px, 40px
## Palette
- Ink: #0f172a
- Surface: #f8fafc
## Radius
- Card radius: 12px
      `);

      const deltas = diffDesignMdAgainstDom(designMd, {
        'div.drifted-card': {
          fontFamily: 'Comic Sans MS, sans-serif',
          color: '#ff0055',
          borderRadius: '28px',
          fontSize: '19px'
        }
      });
      expect(deltas.length).toBeGreaterThanOrEqual(3);

      const pageViolations = lintPageLevelHeuristics(
        [
          {
            selector: 'h1.title',
            tagName: 'h1',
            computedStyles: { fontSize: '20px', fontFamily: 'Comic Sans MS' },
            boundingBox: { x: 20, y: 20, width: 300, height: 30 }
          },
          {
            selector: 'h2.subtitle',
            tagName: 'h2',
            computedStyles: { fontSize: '18px' },
            boundingBox: { x: 20, y: 60, width: 300, height: 26 }
          },
          {
            selector: 'p.body',
            tagName: 'p',
            computedStyles: { fontSize: '16px' },
            boundingBox: { x: 20, y: 100, width: 300, height: 24 }
          }
        ],
        { designMd, viewportName: 'Desktop' }
      );

      const rules = pageViolations.map(v => v.rule);
      expect(rules).toContain('FLAT_TYPE_HIERARCHY');
      expect(rules).toContain('DESIGN_SYSTEM_DRIFT');
    });

    it('should cluster nearby violation bounding boxes into padded crop regions', () => {
      const clusters = clusterViolationBoundingBoxes(
        [
          {
            rule: 'GRADIENT_TEXT',
            element: 'h1.hero',
            expected: 'solid',
            actual: 'gradient',
            severity: 'warning',
            suggestedCommand: '/impeccable typeset',
            boundingBox: { x: 100, y: 100, width: 200, height: 50 }
          },
          {
            rule: 'BANNED_EYEBROW',
            element: 'span.kicker',
            expected: 'none',
            actual: 'eyebrow',
            severity: 'warning',
            suggestedCommand: '/impeccable distill',
            boundingBox: { x: 100, y: 70, width: 120, height: 20 }
          },
          {
            rule: 'CONTRAST',
            element: 'footer p.copy',
            expected: '>= 4.5:1',
            actual: '2.1:1',
            severity: 'critical',
            suggestedCommand: '/impeccable colorize',
            boundingBox: { x: 100, y: 1800, width: 300, height: 30 }
          }
        ],
        { width: 1440, height: 2200 },
        { maxCrops: 4, padding: 32 }
      );

      // First two violations (y=70..150) merge into one cluster; footer violation (y=1800) is a separate cluster and sorted first (critical)
      expect(clusters).toHaveLength(2);
      expect(clusters[0]?.rules).toContain('CONTRAST');
      expect(clusters[1]?.rules).toEqual(expect.arrayContaining(['GRADIENT_TEXT', 'BANNED_EYEBROW']));
    });
  });
});
