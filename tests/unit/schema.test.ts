import { describe, it, expect } from 'vitest';
import {
  ZeroVisualConfigSchema,
  TriagePayloadSchema,
  RegressionVerdictSchema,
  DesignQaVerdictSchema,
  type TriagePayload
} from '../../src/core/schema.js';

describe('ZeroVisual Canonical Schemas', () => {
  describe('ZeroVisualConfigSchema', () => {
    it('should parse valid default config', () => {
      const parsed = ZeroVisualConfigSchema.parse({});
      expect(parsed.targetProvider).toBe('openai');
      expect(parsed.lowTokenMode).toBe(false);
      expect(parsed.padding).toBe(32);
      expect(parsed.outputDir).toBe('./test-results');
      expect(parsed.viewports).toHaveLength(2);
      expect(parsed.viewports[0]?.name).toBe('Desktop');
      expect(parsed.viewports[1]?.name).toBe('Mobile');
    });

    it('should accept custom provider and dimensions', () => {
      const parsed = ZeroVisualConfigSchema.parse({
        targetProvider: 'anthropic',
        lowTokenMode: true,
        customDimensions: { maxWidth: 504, maxHeight: 504 },
        padding: 48,
        outputDir: './custom-output'
      });
      expect(parsed.targetProvider).toBe('anthropic');
      expect(parsed.lowTokenMode).toBe(true);
      expect(parsed.customDimensions).toEqual({ maxWidth: 504, maxHeight: 504 });
      expect(parsed.padding).toBe(48);
    });

    it('should reject invalid provider', () => {
      expect(() => {
        ZeroVisualConfigSchema.parse({
          targetProvider: 'invalid-provider'
        });
      }).toThrow();
    });

    it('should reject negative padding', () => {
      expect(() => {
        ZeroVisualConfigSchema.parse({
          padding: -10
        });
      }).toThrow();
    });
  });

  describe('TriagePayloadSchema', () => {
    const validPayload: TriagePayload = {
      version: '1.0.0',
      mode: 'regression',
      targetProvider: 'openai',
      tileDimensions: { maxWidth: 512, maxHeight: 512 },
      timestamp: new Date().toISOString(),
      failures: [
        {
          testId: 'homepage-checkout-button',
          testTitle: 'Homepage > Checkout > button visual state',
          filePath: 'tests/visual/home.spec.ts',
          selector: 'button#checkout',
          viewports: [
            {
              project: 'Desktop Chrome',
              viewport: { width: 1920, height: 1080 },
              diffPixelRatio: 0.045,
              boundingBox: { x: 100, y: 200, width: 300, height: 80 },
              ariaSnapshot: '- button "Checkout":\n  - text "Checkout"\n',
              computedStyles: {
                display: 'flex',
                color: 'rgb(255, 255, 255)',
                backgroundColor: 'rgb(0, 102, 204)'
              },
              images: {
                diffBase64: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA='
              }
            },
            {
              project: 'Mobile Safari',
              viewport: { width: 375, height: 667 },
              diffPixelRatio: 0.082,
              boundingBox: { x: 20, y: 150, width: 335, height: 48 },
              ariaSnapshot: '- button "Checkout":\n  - text "Checkout"\n',
              computedStyles: {
                display: 'block',
                color: 'rgb(255, 255, 255)',
                backgroundColor: 'rgb(0, 102, 204)'
              },
              images: {
                diffBase64: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA='
              }
            }
          ]
        }
      ]
    };

    it('should parse valid regression multi-viewport payload', () => {
      const parsed = TriagePayloadSchema.parse(validPayload);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.failures[0]?.viewports).toHaveLength(2);
    });

    it('should parse valid design-qa payload with heuristic violations and penpot deltas', () => {
      const designQaPayload: TriagePayload = {
        ...validPayload,
        mode: 'design-qa',
        failures: [
          {
            ...validPayload.failures[0]!,
            designContext: {
              heuristicViolations: [
                {
                  rule: 'CONTRAST',
                  element: 'button#checkout',
                  expected: '>= 4.5:1',
                  actual: '2.8:1'
                },
                {
                  rule: 'SPACING_GRID',
                  element: 'button#checkout',
                  expected: 'multiple of 4px/8px',
                  actual: 'padding: 13px 17px'
                }
              ],
              penpotDeltas: [
                {
                  selector: 'button#checkout',
                  property: 'border-radius',
                  expectedPenpot: '8px',
                  actualDom: '4px'
                }
              ]
            }
          }
        ]
      };
      const parsed = TriagePayloadSchema.parse(designQaPayload);
      expect(parsed.mode).toBe('design-qa');
      expect(parsed.failures[0]?.designContext?.heuristicViolations).toHaveLength(2);
      expect(parsed.failures[0]?.designContext?.penpotDeltas).toHaveLength(1);
    });

    it('should reject non-webp base64 URI', () => {
      const invalid = JSON.parse(JSON.stringify(validPayload));
      invalid.failures[0].viewports[0].images.diffBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(() => TriagePayloadSchema.parse(invalid)).toThrow();
    });

    it('should reject diffPixelRatio greater than 1', () => {
      const invalid = JSON.parse(JSON.stringify(validPayload));
      invalid.failures[0].viewports[0].diffPixelRatio = 1.5;
      expect(() => TriagePayloadSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid timestamp', () => {
      const invalid = JSON.parse(JSON.stringify(validPayload));
      invalid.timestamp = 'not-a-timestamp';
      expect(() => TriagePayloadSchema.parse(invalid)).toThrow();
    });

    it('should reject empty viewports array', () => {
      const invalid = JSON.parse(JSON.stringify(validPayload));
      invalid.failures[0].viewports = [];
      expect(() => TriagePayloadSchema.parse(invalid)).toThrow();
    });
  });

  describe('RegressionVerdictSchema', () => {
    it('should parse valid regression verdict', () => {
      const verdict = {
        testId: 'homepage-checkout-button',
        verdict: 'bug',
        rootCause: 'Button padding broke responsive layout on mobile safari',
        affectedComponents: ['CheckoutButton', 'HeroContainer'],
        suggestedFix: 'Change padding from 13px to 16px and use w-full on mobile',
        crossViewportSummary: 'Desktop shifted by 2px; Mobile wrapped onto two lines',
        confidence: 0.95
      };
      const parsed = RegressionVerdictSchema.parse(verdict);
      expect(parsed.verdict).toBe('bug');
      expect(parsed.confidence).toBe(0.95);
    });

    it('should reject invalid verdict string', () => {
      expect(() => {
        RegressionVerdictSchema.parse({
          testId: 'test-1',
          verdict: 'not_sure',
          rootCause: 'unknown',
          affectedComponents: [],
          suggestedFix: '',
          crossViewportSummary: '',
          confidence: 0.5
        });
      }).toThrow();
    });
  });

  describe('DesignQaVerdictSchema', () => {
    it('should parse valid design-qa verdict', () => {
      const verdict = {
        url: 'http://localhost:3000',
        verdict: 'needs_revision',
        overallScore: 78,
        violations: [
          {
            rule: 'CONTRAST',
            element: 'p.subtext',
            severity: 'critical',
            recommendation: 'Increase text color contrast to at least 4.5:1',
            cssFix: 'color: #374151;'
          }
        ],
        recommendations: ['Use 8pt grid for card paddings', 'Fix contrast on subtext'],
        suggestedTailwindCss: 'text-gray-700 p-4 rounded-lg'
      };
      const parsed = DesignQaVerdictSchema.parse(verdict);
      expect(parsed.verdict).toBe('needs_revision');
      expect(parsed.overallScore).toBe(78);
    });
  });
});
