import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import {
  ZeroVisualConfigSchema,
  TriagePayloadSchema,
  type ZeroVisualConfig,
  type FailureEntry,
  type ViewportArtifact,
  type TriagePayload
} from '../core/schema.js';
import {
  detectDiffBoundingBox,
  optimizeImageForProvider,
  getProviderDimensions
} from '../core/image-optimizer.js';

export function normalizeTestId(titlePath: string[]): string {
  const full = titlePath.slice(1).join(' > ');
  const normalized = full
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'test-failure';
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
      (att) => att.name.endsWith('-diff.png') || att.name.endsWith('diff.png')
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

    // Check for optional actual and expected images
    let actualBase64: string | undefined;
    const actualAttachment = result.attachments.find(
      (att) => att.name.endsWith('-actual.png') || att.name.endsWith('actual.png')
    );
    if (actualAttachment) {
      const actualBuf = actualAttachment.body ?? (actualAttachment.path ? fs.readFileSync(actualAttachment.path) : null);
      if (actualBuf) {
        const opt = await optimizeImageForProvider(actualBuf, {
          provider: this.config.targetProvider,
          lowTokenMode: this.config.lowTokenMode,
          customDimensions: this.config.customDimensions,
          cropBox: diffDetection.boundingBox
        });
        actualBase64 = opt.dataUri;
      }
    }

    let expectedBase64: string | undefined;
    const expectedAttachment = result.attachments.find(
      (att) => att.name.endsWith('-expected.png') || att.name.endsWith('expected.png')
    );
    if (expectedAttachment) {
      const expectedBuf = expectedAttachment.body ?? (expectedAttachment.path ? fs.readFileSync(expectedAttachment.path) : null);
      if (expectedBuf) {
        const opt = await optimizeImageForProvider(expectedBuf, {
          provider: this.config.targetProvider,
          lowTokenMode: this.config.lowTokenMode,
          customDimensions: this.config.customDimensions,
          cropBox: diffDetection.boundingBox
        });
        expectedBase64 = opt.dataUri;
      }
    }

    // Determine project / viewport details
    const project = test.parent?.project()?.name ?? 'Default Viewport';
    const projectViewport = (test.parent?.project()?.use as any)?.viewport;
    const viewport = projectViewport
      ? { width: projectViewport.width, height: projectViewport.height }
      : { width: optimizedDiff.width, height: optimizedDiff.height };

    const titlePath = test.titlePath();
    const fullTitle = titlePath.slice(1).join(' > ');
    const testId = normalizeTestId(titlePath);

    const viewportArtifact: ViewportArtifact = {
      project,
      viewport,
      diffPixelRatio: diffDetection.diffPixelRatio,
      boundingBox: diffDetection.boundingBox,
      ariaSnapshot: `- region "${fullTitle}"`,
      computedStyles: {
        display: 'block'
      },
      images: {
        diffBase64: optimizedDiff.dataUri,
        actualBase64,
        expectedBase64
      }
    };

    // Group multi-viewport failures under single testId
    const existing = this.failureMap.get(testId);
    if (existing) {
      existing.viewports.push(viewportArtifact);
    } else {
      this.failureMap.set(testId, {
        testId,
        testTitle: fullTitle,
        filePath: test.location?.file ?? 'unknown.spec.ts',
        selector: 'body',
        viewports: [viewportArtifact]
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

    const payload: TriagePayload = {
      version: '1.0.0',
      mode: 'regression',
      targetProvider: this.config.targetProvider,
      tileDimensions: tileDims,
      timestamp: new Date().toISOString(),
      failures: Array.from(this.failureMap.values())
    };

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

export default ZeroVisualReporter;
