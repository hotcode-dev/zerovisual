import fs from 'node:fs';
import path from 'node:path';
import { defineCommand } from 'citty';
import {
  TriagePayloadSchema,
  TargetProviderSchema,
  type TargetProvider,
  type FailureEntry,
  type ViewportArtifact,
  type TriagePayload
} from '../../core/schema.js';
import {
  detectDiffBoundingBox,
  optimizeImageForProvider,
  getProviderDimensions
} from '../../core/image-optimizer.js';

export interface RegressionOptions {
  inputDir?: string;
  outputDir?: string;
  provider?: TargetProvider;
  lowTokenMode?: boolean;
  padding?: number;
}

/**
 * Recursively discovers all Playwright diff image files (*-diff.png or diff.png) in a directory.
 */
function findDiffFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDiffFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('-diff.png') || entry.name.endsWith('diff.png'))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Infers viewport project name from directory structure or filename.
 */
function inferProjectName(filePath: string): string {
  const parts = filePath.split(path.sep);
  const dirName = parts[parts.length - 2] ?? '';
  if (/mobile/i.test(dirName)) return 'Mobile Safari';
  if (/desktop/i.test(dirName)) return 'Desktop Chrome';
  if (/tablet/i.test(dirName)) return 'Tablet iPad';
  if (/firefox/i.test(dirName)) return 'Desktop Firefox';
  if (/webkit/i.test(dirName)) return 'Desktop WebKit';
  return dirName || 'Default Viewport';
}

/**
 * Infers test title or testId from file path or directory.
 */
function inferTestId(filePath: string): { testId: string; testTitle: string } {
  const parts = filePath.split(path.sep);
  const dirName = parts[parts.length - 2] ?? 'test-failure';
  // Strip common project suffixes like -Desktop-Chrome, -Mobile-Safari, etc.
  const cleaned = dirName
    .replace(/-(?:Desktop|Mobile|Tablet)[a-zA-Z0-9_-]*/gi, '')
    .replace(/-(?:chromium|firefox|webkit)/gi, '');

  const testId = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'visual-test';

  const testTitle = cleaned
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return { testId, testTitle };
}

/**
 * Programmatic execution function for the visual regression pre-processor.
 */
export async function runRegressionCommand(options: RegressionOptions = {}): Promise<TriagePayload> {
  const inputDir = path.resolve(process.cwd(), options.inputDir ?? './test-results');
  const outputDir = path.resolve(process.cwd(), options.outputDir ?? inputDir);
  const provider = options.provider ?? 'openai';
  const lowTokenMode = options.lowTokenMode ?? false;
  const padding = options.padding ?? 32;

  const diffFiles = findDiffFiles(inputDir);

  if (diffFiles.length === 0) {
    console.log(`[ZeroVisual] No visual diff files (*-diff.png) found in ${inputDir}. Zero tokens consumed.`);
    const emptyPayload: TriagePayload = {
      version: '1.0.0',
      mode: 'regression',
      targetProvider: provider,
      tileDimensions: getProviderDimensions(provider, lowTokenMode),
      timestamp: new Date().toISOString(),
      failures: []
    };
    return emptyPayload;
  }

  const failureMap = new Map<string, FailureEntry>();

  for (const diffPath of diffFiles) {
    const diffBuffer = fs.readFileSync(diffPath);
    const diffDetection = await detectDiffBoundingBox(diffBuffer, padding);

    const optimizedDiff = await optimizeImageForProvider(diffBuffer, {
      provider,
      lowTokenMode,
      cropBox: diffDetection.boundingBox
    });

    // Check for companion -actual.png and -expected.png
    const dir = path.dirname(diffPath);
    const baseName = path.basename(diffPath).replace(/-diff\.png$/, '').replace(/diff\.png$/, '');

    let actualBase64: string | undefined;
    const actualPath = path.join(dir, `${baseName}-actual.png`);
    if (fs.existsSync(actualPath)) {
      const opt = await optimizeImageForProvider(fs.readFileSync(actualPath), {
        provider,
        lowTokenMode,
        cropBox: diffDetection.boundingBox
      });
      actualBase64 = opt.dataUri;
    }

    let expectedBase64: string | undefined;
    const expectedPath = path.join(dir, `${baseName}-expected.png`);
    if (fs.existsSync(expectedPath)) {
      const opt = await optimizeImageForProvider(fs.readFileSync(expectedPath), {
        provider,
        lowTokenMode,
        cropBox: diffDetection.boundingBox
      });
      expectedBase64 = opt.dataUri;
    }

    const { testId, testTitle } = inferTestId(diffPath);
    const projectName = inferProjectName(diffPath);

    const viewportArtifact: ViewportArtifact = {
      project: projectName,
      viewport: {
        width: optimizedDiff.width,
        height: optimizedDiff.height
      },
      diffPixelRatio: diffDetection.diffPixelRatio,
      boundingBox: diffDetection.boundingBox,
      ariaSnapshot: `- region "${testTitle}"`,
      computedStyles: {
        display: 'block'
      },
      images: {
        diffBase64: optimizedDiff.dataUri,
        actualBase64,
        expectedBase64
      }
    };

    const existing = failureMap.get(testId);
    if (existing) {
      existing.viewports.push(viewportArtifact);
    } else {
      failureMap.set(testId, {
        testId,
        testTitle,
        filePath: diffPath,
        selector: 'body',
        viewports: [viewportArtifact]
      });
    }
  }

  const payload: TriagePayload = {
    version: '1.0.0',
    mode: 'regression',
    targetProvider: provider,
    tileDimensions: getProviderDimensions(provider, lowTokenMode),
    timestamp: new Date().toISOString(),
    failures: Array.from(failureMap.values())
  };

  const validated = TriagePayloadSchema.parse(payload);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, 'triage-ready.json');
  fs.writeFileSync(outputFile, JSON.stringify(validated, null, 2), 'utf-8');

  console.log(
    `[ZeroVisual] Successfully processed ${diffFiles.length} diff(s) across ${failureMap.size} test(s). Wrote: ${outputFile}`
  );

  return validated;
}

export const regressionCommand = defineCommand({
  meta: {
    name: 'regression',
    description: 'Pre-process Playwright visual regression diffs into token-optimized triage payloads'
  },
  args: {
    input: {
      type: 'string',
      alias: 'i',
      default: './test-results',
      description: 'Path to directory containing Playwright test result attachments'
    },
    output: {
      type: 'string',
      alias: 'o',
      default: './test-results',
      description: 'Directory where triage-ready.json will be saved'
    },
    provider: {
      type: 'string',
      alias: 'p',
      default: 'openai',
      description: 'Target Vision LLM provider: openai | anthropic | gemini | local | qwen | gemma | llama | mistral | deepseek'
    },
    lowTokenMode: {
      type: 'boolean',
      default: false,
      description: 'Enable aggressive token reduction (e.g. 384x384 for Gemini)'
    },
    padding: {
      type: 'string',
      default: '32',
      description: 'Bounding box padding in pixels around detected diff region'
    }
  },
  async run({ args }) {
    const provider = TargetProviderSchema.parse(args.provider);
    await runRegressionCommand({
      inputDir: args.input,
      outputDir: args.output,
      provider,
      lowTokenMode: args.lowTokenMode,
      padding: parseInt(args.padding, 10) || 32
    });
  }
});
