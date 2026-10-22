import fs from 'node:fs';
import path from 'node:path';
import { defineCommand } from 'citty';
import type { Browser } from '@playwright/test';
import {
  TriagePayloadSchema,
  TargetProviderSchema,
  type TargetProvider,
  type TriagePayload,
  type ViewportArtifact,
  type HeuristicViolation,
  type PenpotDelta
} from '../../core/schema.js';
import {
  optimizeImageForProvider,
  getProviderDimensions
} from '../../core/image-optimizer.js';
import { captureDomContext, auditPageHeuristics } from '../../core/dom-extractor.js';
import { parsePenpotTokens, diffPenpotAgainstDom } from '../../core/penpot-parser.js';

export interface DesignQaOptions {
  url: string;
  penpotPath?: string;
  outputDir?: string;
  provider?: TargetProvider;
  lowTokenMode?: boolean;
  browserInstance?: Browser; // Allows passing mock or existing browser in tests
}

export const DEFAULT_DESIGN_VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900, isMobile: false },
  { name: 'Mobile', width: 390, height: 844, isMobile: true }
];

export async function runDesignQaCommand(options: DesignQaOptions): Promise<TriagePayload> {
  const { url, penpotPath } = options;
  if (!url) {
    throw new Error('Missing required option: --url <url>');
  }

  const outputDir = path.resolve(process.cwd(), options.outputDir ?? './test-results');
  const provider = options.provider ?? 'openai';
  const lowTokenMode = options.lowTokenMode ?? false;

  let browser = options.browserInstance;
  let ownBrowser = false;

  if (!browser) {
    let chromium: (typeof import('@playwright/test'))['chromium'];
    try {
      const pw = await import('@playwright/test');
      chromium = pw.chromium;
    } catch {
      throw new Error(
        '[@playwright/test is required to run design-qa]. Please install it via: npm install --save-dev @playwright/test'
      );
    }
    browser = await chromium.launch({ headless: true });
    ownBrowser = true;
  }

  const viewportsArtifacts: ViewportArtifact[] = [];
  const aggregatedViolations: HeuristicViolation[] = [];
  const combinedDomStyles: Record<string, Record<string, string>> = {};

  try {
    for (const vp of DEFAULT_DESIGN_VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile
      });

      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      } catch {
        // Fallback or retry on domcontentloaded
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (e: any) {
          console.warn(`[ZeroVisual] Navigation warning for ${vp.name}: ${e?.message ?? e}`);
        }
      }

      // Collect DOM heuristics and computed styles
      const { heuristicViolations, computedStylesMap } = await auditPageHeuristics(page, vp.isMobile);
      aggregatedViolations.push(...heuristicViolations);
      Object.assign(combinedDomStyles, computedStylesMap);

      // Scoped DOM context
      const domContext = await captureDomContext(page, 'body', { isMobileViewport: vp.isMobile });

      // Capture screenshot and downscale to model-tile grid WebP
      const rawScreenshot = await page.screenshot({ fullPage: false });
      const optimized = await optimizeImageForProvider(rawScreenshot, {
        provider,
        lowTokenMode
      });

      viewportsArtifacts.push({
        project: vp.name,
        viewport: { width: vp.width, height: vp.height },
        diffPixelRatio: 0,
        boundingBox: {
          x: 0,
          y: 0,
          width: vp.width,
          height: vp.height
        },
        ariaSnapshot: domContext.ariaSnapshot,
        computedStyles: domContext.computedStyles,
        images: {
          diffBase64: optimized.dataUri
        }
      });

      await page.close();
    }
  } finally {
    if (ownBrowser && browser) {
      await browser.close();
    }
  }

  // Handle optional Penpot tokens comparison
  const penpotDeltas: PenpotDelta[] = [];
  if (penpotPath && fs.existsSync(penpotPath)) {
    const content = fs.readFileSync(penpotPath, 'utf-8');
    const isSvg = penpotPath.endsWith('.svg') || content.trim().startsWith('<svg');
    const tokens = parsePenpotTokens(content, isSvg ? 'svg' : 'json');
    const deltas = diffPenpotAgainstDom(tokens, combinedDomStyles);
    penpotDeltas.push(...deltas);
  }

  const payload: TriagePayload = {
    version: '1.0.0',
    mode: 'design-qa',
    targetProvider: provider,
    tileDimensions: getProviderDimensions(provider, lowTokenMode),
    timestamp: new Date().toISOString(),
    failures: [
      {
        testId: `design-qa-${url.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
        testTitle: `UI Design QA Audit for ${url}`,
        filePath: url,
        selector: 'body',
        viewports: viewportsArtifacts,
        designContext: {
          heuristicViolations: aggregatedViolations,
          penpotDeltas
        }
      }
    ]
  };

  const validated = TriagePayloadSchema.parse(payload);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, 'design-qa-ready.json');
  fs.writeFileSync(outputFile, JSON.stringify(validated, null, 2), 'utf-8');

  console.log(
    `[ZeroVisual] Design QA audit complete for ${url}. Violations: ${aggregatedViolations.length}, Penpot deltas: ${penpotDeltas.length}. Wrote: ${outputFile}`
  );

  return validated;
}

export const designQaCommand = defineCommand({
  meta: {
    name: 'design-qa',
    description: 'Audit a live URL against deterministic UI heuristics and Penpot design tokens'
  },
  args: {
    url: {
      type: 'string',
      alias: 'u',
      required: true,
      description: 'Live local or staging URL to audit (e.g. http://localhost:3000)'
    },
    penpot: {
      type: 'string',
      description: 'Path to Penpot SVG or JSON token export'
    },
    output: {
      type: 'string',
      alias: 'o',
      default: './test-results',
      description: 'Directory where design-qa-ready.json will be saved'
    },
    provider: {
      type: 'string',
      alias: 'p',
      default: 'openai',
      description: 'Target Vision LLM provider: openai | anthropic | gemini | local'
    },
    lowTokenMode: {
      type: 'boolean',
      default: false,
      description: 'Enable aggressive token reduction (e.g. 384x384 for Gemini)'
    }
  },
  async run({ args }) {
    const provider = TargetProviderSchema.parse(args.provider);
    await runDesignQaCommand({
      url: args.url,
      penpotPath: args.penpot,
      outputDir: args.output,
      provider,
      lowTokenMode: args.lowTokenMode
    });
  }
});
