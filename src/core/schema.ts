import { z } from 'zod';

export const TargetProviderSchema = z.enum(['openai', 'anthropic', 'gemini', 'local', 'qwen', 'gemma']);
export type TargetProvider = z.infer<typeof TargetProviderSchema>;

export const TileDimensionsSchema = z.object({
  maxWidth: z.number().int().positive(),
  maxHeight: z.number().int().positive()
});
export type TileDimensions = z.infer<typeof TileDimensionsSchema>;

export const BoundingBoxSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const ViewportDimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
export type ViewportDimensions = z.infer<typeof ViewportDimensionsSchema>;

export const ViewportConfigSchema = z.object({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
export type ViewportConfig = z.infer<typeof ViewportConfigSchema>;

export const ZeroVisualConfigSchema = z.object({
  targetProvider: TargetProviderSchema.default('openai'),
  lowTokenMode: z.boolean().default(false),
  customDimensions: TileDimensionsSchema.optional(),
  padding: z.number().int().nonnegative().default(32),
  outputDir: z.string().default('./test-results'),
  viewports: z.array(ViewportConfigSchema).default([
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 390, height: 844 }
  ])
});
export type ZeroVisualConfig = z.infer<typeof ZeroVisualConfigSchema>;

export const ViewportImagesSchema = z.object({
  diffBase64: z.string().startsWith('data:image/webp;base64,'),
  actualBase64: z.string().startsWith('data:image/webp;base64,').optional(),
  expectedBase64: z.string().startsWith('data:image/webp;base64,').optional()
});
export type ViewportImages = z.infer<typeof ViewportImagesSchema>;

export const ViewportArtifactSchema = z.object({
  project: z.string(),
  viewport: ViewportDimensionsSchema,
  diffPixelRatio: z.number().min(0).max(1),
  boundingBox: BoundingBoxSchema,
  ariaSnapshot: z.string(),
  computedStyles: z.record(z.string(), z.string()),
  images: ViewportImagesSchema
});
export type ViewportArtifact = z.infer<typeof ViewportArtifactSchema>;

export const HeuristicViolationSchema = z.object({
  rule: z.enum(['CONTRAST', 'SPACING_GRID', 'TAP_TARGET', 'TYPOGRAPHY_SCALE']),
  element: z.string(),
  expected: z.string(),
  actual: z.string()
});
export type HeuristicViolation = z.infer<typeof HeuristicViolationSchema>;

export const PenpotDeltaSchema = z.object({
  selector: z.string(),
  property: z.string(),
  expectedPenpot: z.string(),
  actualDom: z.string()
});
export type PenpotDelta = z.infer<typeof PenpotDeltaSchema>;

export const DesignContextSchema = z.object({
  heuristicViolations: z.array(HeuristicViolationSchema).default([]),
  penpotDeltas: z.array(PenpotDeltaSchema).default([])
});
export type DesignContext = z.infer<typeof DesignContextSchema>;

export const FailureEntrySchema = z.object({
  testId: z.string(),
  testTitle: z.string(),
  filePath: z.string(),
  selector: z.string().default('body'),
  viewports: z.array(ViewportArtifactSchema).min(1),
  designContext: DesignContextSchema.optional()
});
export type FailureEntry = z.infer<typeof FailureEntrySchema>;

export const PipelineModeSchema = z.enum(['regression', 'design-qa']);
export type PipelineMode = z.infer<typeof PipelineModeSchema>;

export const TriagePayloadSchema = z.object({
  version: z.literal('1.0.0'),
  mode: PipelineModeSchema,
  targetProvider: TargetProviderSchema,
  tileDimensions: TileDimensionsSchema,
  timestamp: z.string().datetime(),
  failures: z.array(FailureEntrySchema)
});
export type TriagePayload = z.infer<typeof TriagePayloadSchema>;

export const RegressionVerdictSchema = z.object({
  testId: z.string(),
  verdict: z.enum(['bug', 'intentional_change', 'flaky_subpixel_noise']),
  rootCause: z.string(),
  affectedComponents: z.array(z.string()),
  suggestedFix: z.string(),
  crossViewportSummary: z.string(),
  confidence: z.number().min(0).max(1)
});
export type RegressionVerdict = z.infer<typeof RegressionVerdictSchema>;

export const DesignQaViolationVerdictSchema = z.object({
  rule: z.enum(['CONTRAST', 'SPACING_GRID', 'TAP_TARGET', 'TYPOGRAPHY_SCALE', 'PENPOT_TOKEN']),
  element: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
  recommendation: z.string(),
  cssFix: z.string()
});
export type DesignQaViolationVerdict = z.infer<typeof DesignQaViolationVerdictSchema>;

export const DesignQaVerdictSchema = z.object({
  url: z.string(),
  verdict: z.enum(['approved', 'needs_revision']),
  overallScore: z.number().min(0).max(100),
  violations: z.array(DesignQaViolationVerdictSchema),
  recommendations: z.array(z.string()),
  suggestedTailwindCss: z.string().optional()
});
export type DesignQaVerdict = z.infer<typeof DesignQaVerdictSchema>;
