import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import {
  ZeroVisualConfigSchema,
  TriagePayloadSchema,
  createTriagePayload,
  type ZeroVisualConfig,
  type FailureEntry,
  type ViewportArtifact
} from '../core/schema.js';
import {
  detectDiffBoundingBox,
  optimizeImageForProvider,
  optimizeAndWriteCompanionImage,
  getProviderDimensions
} from '../core/image-optimizer.js';
import { slugify } from '../core/slug.js';

export function normalizeTestId(titlePath: string[]): string {
  const full = titlePath.slice(1).join(' > ');
  return slugify(full) || 'test-failure';
}

export class ZeroVisualReporter implements Reporter {
  private config: ZeroVisualConfig;
  private failureMap = new Map<string, FailureEntry>();

  constructor(options: Partial<ZeroVisualConfig> = {}) {
    this.config = ZeroVisualConfigSchema.parse(options);
  }

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    // Zero-Token Law: Passing tests consume zero AI tokens and perform zero transformations
    if (result.status === 'passed') {
      return;
    }

    // Look for visual diff attachments
    const diffAttachment = result.attachments.find(
      att => att.name.endsWith('-diff.png') || att.name.endsWith('diff.png')
    );

    if (!diffAttachment) {
      return;
    }

    let diffBuffer: Buffer | null = null;
    if (diffAttachment.body) {
      diffBuffer = diffAttachment.body;
    } else if (diffAttachment.path && fs.existsSync(diffAttachment.path)) {
      diffBuffer = fs.readFileSync(diffAttachment.path);
    }

    if (!diffBuffer) {
      return;
    }

    // Detect diff bounding box and crop
    const diffDetection = await detectDiffBoundingBox(diffBuffer, this.config.padding);

    // Optimize diff image to model-aware tile grid WebP
    const optimizedDiff = await optimizeImageForProvider(diffBuffer, {
      provider: this.config.targetProvider,
      lowTokenMode: this.config.lowTokenMode,
      customDimensions: this.config.customDimensions,
      cropBox: diffDetection.boundingBox
    });

    // Determine project / viewport details
    const project = test.parent?.project()?.name ?? 'Default Viewport';
    const projectViewport = (test.parent?.project()?.use as any)?.viewport;
    const viewport = projectViewport
      ? { width: projectViewport.width, height: projectViewport.height }
      : { width: optimizedDiff.width, height: optimizedDiff.height };

    const titlePath = test.titlePath();
    const fullTitle = titlePath.slice(1).join(' > ');
    const testId = normalizeTestId(titlePath);
    const safeProject = slugify(project);

    const outDir = path.resolve(process.cwd(), this.config.outputDir);
    const artifactsDir = path.join(outDir, 'artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });

    const diffImagePath = path.join(artifactsDir, `${testId}-${safeProject}-diff.webp`);
    fs.writeFileSync(diffImagePath, optimizedDiff.buffer);

    // Check for optional actual and expected companion images
    const companionImages: Partial<Record<'actual' | 'expected', { base64: string; path: string }>> = {};
    for (const suffix of ['actual', 'expected'] as const) {
      const attachment = result.attachments.find(
        att => att.name.endsWith(`-${suffix}.png`) || att.name.endsWith(`${suffix}.png`)
      );
      if (!attachment) continue;
      const buf = attachment.body ?? (attachment.path ? fs.readFileSync(attachment.path) : null);
      if (!buf) continue;
      const companion = await optimizeAndWriteCompanionImage(buf, {
        artifactsDir,
        baseName: `${testId}-${safeProject}`,
        suffix,
        provider: this.config.targetProvider,
        lowTokenMode: this.config.lowTokenMode,
        customDimensions: this.config.customDimensions,
        cropBox: diffDetection.boundingBox
      });
      companionImages[suffix] = { base64: companion.dataUri, path: companion.imagePath };
    }

    // Check for optional authentic DOM context captured by ZeroVisual fixture
    let realAriaSnapshot: string | undefined;
    let realComputedStyles: Record<string, string> | undefined;
    let realSelector: string | undefined;
    let realHeuristics: any[] | undefined;

    const contextAttachment = result.attachments.find(
      att => att.name === 'zerovisual-context.json' || att.name.includes('zerovisual-context')
    );
    if (contextAttachment) {
      try {
        let contentStr = '';
        if (contextAttachment.body) {
          contentStr = contextAttachment.body.toString('utf-8');
        } else if (contextAttachment.path && fs.existsSync(contextAttachment.path)) {
          contentStr = fs.readFileSync(contextAttachment.path, 'utf-8');
        }
        if (contentStr) {
          const parsed = JSON.parse(contentStr);
          realAriaSnapshot = parsed.ariaSnapshot;
          realComputedStyles = parsed.computedStyles;
          realSelector = parsed.selector;
          realHeuristics = parsed.heuristicViolations;
        }
      } catch {
        // Fall back gracefully to synthesized representation
      }
    }

    const viewportArtifact: ViewportArtifact = {
      project,
      viewport,
      diffPixelRatio: diffDetection.diffPixelRatio,
      boundingBox: diffDetection.boundingBox,
      ariaSnapshot: realAriaSnapshot || `- region "${fullTitle}"`,
      computedStyles: realComputedStyles || {
        display: 'block'
      },
      images: {
        diffBase64: optimizedDiff.dataUri,
        actualBase64: companionImages.actual?.base64,
        expectedBase64: companionImages.expected?.base64,
        diffImagePath,
        actualImagePath: companionImages.actual?.path,
        expectedImagePath: companionImages.expected?.path
      }
    };

    // Group multi-viewport failures under single testId
    const existing = this.failureMap.get(testId);
    if (existing) {
      existing.viewports.push(viewportArtifact);
      if (realHeuristics && realHeuristics.length > 0) {
        if (!existing.designContext) {
          existing.designContext = { heuristicViolations: [], penpotDeltas: [] };
        }
        existing.designContext.heuristicViolations.push(...realHeuristics);
      }
    } else {
      this.failureMap.set(testId, {
        testId,
        testTitle: fullTitle,
        filePath: test.location?.file ?? 'unknown.spec.ts',
        selector: realSelector || 'body',
        viewports: [viewportArtifact],
        designContext:
          realHeuristics && realHeuristics.length > 0
            ? { heuristicViolations: realHeuristics, penpotDeltas: [] }
            : undefined
      });
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.failureMap.size === 0) {
      return;
    }

    const tileDims = getProviderDimensions(
      this.config.targetProvider,
      this.config.lowTokenMode,
      this.config.customDimensions
    );

    const payload = createTriagePayload(
      'regression',
      this.config.targetProvider,
      tileDims,
      Array.from(this.failureMap.values())
    );

    // Validate payload against canonical schema
    const validated = TriagePayloadSchema.parse(payload);

    const outDir = path.resolve(process.cwd(), this.config.outputDir);
    fs.mkdirSync(outDir, { recursive: true });

    const targetFile = path.join(outDir, 'triage-ready.json');
    fs.writeFileSync(targetFile, JSON.stringify(validated, null, 2), 'utf-8');
  }

  // Helper method for testing or programmatic inspection
  getAggregatedFailures(): Map<string, FailureEntry> {
    return this.failureMap;
  }
}
