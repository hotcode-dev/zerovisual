import { z } from 'zod';

export const TargetProviderSchema = z.enum([
  'openai',
  'anthropic',
  'gemini',
  'local',
  'qwen',
  'gemma',
  'llama',
  'mistral',
  'deepseek'
]);
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

export const ZeroVisualConfigSchema = z.object({
  targetProvider: TargetProviderSchema.default('openai'),
  lowTokenMode: z.boolean().default(false),
  customDimensions: TileDimensionsSchema.optional(),
  padding: z.number().int().nonnegative().default(32),
  outputDir: z.string().default('./test-results')
});
export type ZeroVisualConfig = z.infer<typeof ZeroVisualConfigSchema>;

export const ViewportImagesSchema = z.object({
  diffBase64: z.string().startsWith('data:image/webp;base64,'),
  actualBase64: z.string().startsWith('data:image/webp;base64,').optional(),
  expectedBase64: z.string().startsWith('data:image/webp;base64,').optional(),
  diffImagePath: z.string().optional(),
  actualImagePath: z.string().optional(),
  expectedImagePath: z.string().optional()
});

export const ViolationCropArtifactSchema = z.object({
  id: z.string(),
  boundingBox: BoundingBoxSchema,
  rules: z.array(z.string()),
  elements: z.array(z.string()),
  suggestedCommands: z.array(z.string()),
  imagePath: z.string(),
  imageBase64: z.string().startsWith('data:image/webp;base64,').optional()
});
export type ViolationCropArtifact = z.infer<typeof ViolationCropArtifactSchema>;

export const ViewportArtifactSchema = z.object({
  project: z.string(),
  viewport: ViewportDimensionsSchema,
  diffPixelRatio: z.number().min(0).max(1),
  boundingBox: BoundingBoxSchema,
  ariaSnapshot: z.string(),
  computedStyles: z.record(z.string(), z.string()),
  images: ViewportImagesSchema,
  violationCrops: z.array(ViolationCropArtifactSchema).optional()
});
export type ViewportArtifact = z.infer<typeof ViewportArtifactSchema>;

export const HeuristicRuleSchema = z.enum([
  'CONTRAST',
  'SPACING_GRID',
  'TAP_TARGET',
  'TYPOGRAPHY_SCALE',
  'ACCESSIBILITY',
  'LAYOUT_OVERFLOW',
  'FOCUS_VISIBLE',
  'AI_SLOP_COLOR',
  'GRADIENT_TEXT',
  'DARK_GLOW',
  'SIDE_TAB_BORDER',
  'GRAY_ON_COLOR',
  'NESTED_CARDS',
  'ICON_TILE_STACK',
  'BANNED_EYEBROW',
  'EMOJI_ICON',
  'FLAT_TYPE_HIERARCHY',
  'HEADING_RHYTHM',
  'LINE_LENGTH',
  'CRAMPED_PADDING',
  'TEXT_OCCLUSION',
  'CLIPPED_OVERFLOW',
  'BROKEN_IMAGE',
  'HIDDEN_AT_REST',
  'COLUMN_OVERFLOW',
  'DESIGN_SYSTEM_DRIFT'
]);
export type HeuristicRule = z.infer<typeof HeuristicRuleSchema>;

export const ViolationCategorySchema = z.enum([
  'accessibility',
  'layout',
  'typography',
  'ai-slop',
  'render-integrity',
  'design-system'
]);
export type ViolationCategory = z.infer<typeof ViolationCategorySchema>;

export const ViolationSeveritySchema = z.enum(['critical', 'warning', 'advisory']);
export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

export const HeuristicViolationSchema = z.object({
  rule: HeuristicRuleSchema,
  element: z.string(),
  expected: z.string(),
  actual: z.string(),
  category: ViolationCategorySchema.optional(),
  severity: ViolationSeveritySchema.optional(),
  suggestedCommand: z.string().optional(),
  boundingBox: BoundingBoxSchema.optional(),
  cropImagePath: z.string().optional(),
  viewport: z.string().optional()
});
export type HeuristicViolation = z.infer<typeof HeuristicViolationSchema>;

export const PenpotDeltaSchema = z.object({
  selector: z.string(),
  property: z.string(),
  expectedPenpot: z.string(),
  actualDom: z.string()
});
export type PenpotDelta = z.infer<typeof PenpotDeltaSchema>;

export const DesignMdDeltaSchema = z.object({
  selector: z.string(),
  property: z.enum(['fontFamily', 'color', 'backgroundColor', 'borderRadius', 'fontSize']),
  expectedDesignMd: z.string(),
  actualDom: z.string()
});
export type DesignMdDelta = z.infer<typeof DesignMdDeltaSchema>;

export const DesignContextSchema = z.object({
  heuristicViolations: z.array(HeuristicViolationSchema).default([]),
  penpotDeltas: z.array(PenpotDeltaSchema).default([]),
  designMdDeltas: z.array(DesignMdDeltaSchema).optional()
});

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
  rule: z.enum([...HeuristicRuleSchema.options, 'PENPOT_TOKEN']),
  element: z.string(),
  severity: z.enum(['critical', 'warning', 'info', 'advisory']),
  recommendation: z.string(),
  cssFix: z.string(),
  suggestedCommand: z.string().optional(),
  cropImagePath: z.string().optional()
});

export const DesignQaVerdictSchema = z.object({
  url: z.string(),
  verdict: z.enum(['approved', 'needs_revision']),
  overallScore: z.number().min(0).max(100),
  violations: z.array(DesignQaViolationVerdictSchema),
  recommendations: z.array(z.string()),
  suggestedImpeccableCommands: z.array(z.string()).optional(),
  suggestedTailwindCss: z.string().optional()
});
export type DesignQaVerdict = z.infer<typeof DesignQaVerdictSchema>;
