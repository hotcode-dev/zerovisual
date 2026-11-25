import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { defineCommand } from 'citty';
import { providerArg, lowTokenModeArg, jsonArg } from './shared-args.js';
import type { Browser } from '@playwright/test';
import {
  TriagePayloadSchema,
  TargetProviderSchema,
  type TargetProvider,
  type TriagePayload,
  type ViewportArtifact,
  type ViolationCropArtifact,
  type HeuristicViolation,
  type PenpotDelta,
  type DesignMdDelta
} from '../../core/schema.js';
import { optimizeImageForProvider, getProviderDimensions } from '../../core/image-optimizer.js';
import { captureDomContext, auditPageHeuristics } from '../../core/dom-extractor.js';
import { parsePenpotTokens, diffPenpotAgainstDom } from '../../core/penpot-parser.js';
import {
  loadDesignMdFromWorkspace,
  loadImpeccableConfig,
  diffDesignMdAgainstDom
} from '../../core/design-md-parser.js';
import { clusterViolationBoundingBoxes } from '../../core/heuristic-linter.js';

export interface DesignQaOptions {
  url: string;
  penpotPath?: string;
  designMdPath?: string;
  maxCrops?: number;
  outputDir?: string;
  provider?: TargetProvider;
  lowTokenMode?: boolean;
  json?: boolean;
  browserInstance?: Browser; // Allows passing mock or existing browser in tests
}

export const DEFAULT_DESIGN_VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900, isMobile: false },
  { name: 'Mobile', width: 390, height: 844, isMobile: true }
];

export async function runDesignQaCommand(options: DesignQaOptions): Promise<TriagePayload> {
  const { url, penpotPath, designMdPath } = options;
  if (!url) {
    throw new Error('Missing required option: --url <url>');
  }

  const outputDir = path.resolve(process.cwd(), options.outputDir ?? './test-results');
  const artifactsDir = path.join(outputDir, 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  const testId = `design-qa-${url.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
  const provider = options.provider ?? 'openai';
  const lowTokenMode = options.lowTokenMode ?? false;
  const maxCrops = options.maxCrops ?? 4;

  // Load Impeccable project config (.impeccable/config.json) and DESIGN.md if present
  const impeccableConfig = loadImpeccableConfig(process.cwd());
  const designMd = impeccableConfig.designSystemEnabled
    ? loadDesignMdFromWorkspace(process.cwd(), designMdPath)
    : undefined;

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
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (e: any) {
          console.warn(`[ZeroVisual] Navigation warning for ${vp.name}: ${e?.message ?? e}`);
        }
      }

      // Collect DOM heuristics, rendered AI-slop rules, and computed styles
      const { heuristicViolations, computedStylesMap } = await auditPageHeuristics(page, {
        isMobileViewport: vp.isMobile,
        viewportName: vp.name,
        designMd,
        ignoreRules: impeccableConfig.ignoreRules
      });
      Object.assign(combinedDomStyles, computedStylesMap);

      // Scoped DOM context
      const domContext = await captureDomContext(page, 'body', {
        isMobileViewport: vp.isMobile,
        viewportName: vp.name,
        designMd,
        ignoreRules: impeccableConfig.ignoreRules
      });

      // Capture above-the-fold viewport screenshot and downscale to 1-tile WebP
      const rawScreenshot = await page.screenshot({ fullPage: false });
      const optimized = await optimizeImageForProvider(rawScreenshot, {
        provider,
        lowTokenMode
      });

      const safeVpName = vp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const diffImagePath = path.join(artifactsDir, `${testId}-${safeVpName}.webp`);
      fs.writeFileSync(diffImagePath, optimized.buffer);

      // Capture full-page buffer to generate clustered 1-tile violation crops (including below-the-fold)
      const violationCrops: ViolationCropArtifact[] = [];
      if (maxCrops > 0 && heuristicViolations.some(v => v.boundingBox)) {
        let fullPageBuffer = rawScreenshot;
        try {
          fullPageBuffer = await page.screenshot({ fullPage: true });
        } catch {
          fullPageBuffer = rawScreenshot;
        }

        const meta = await sharp(fullPageBuffer).metadata();
        const fullW = meta.width ?? vp.width;
        const fullH = meta.height ?? vp.height;

        const clusters = clusterViolationBoundingBoxes(
          heuristicViolations,
          { width: fullW, height: fullH },
          { maxCrops, padding: 32 }
        );

        for (const cluster of clusters) {
          const croppedOpt = await optimizeImageForProvider(fullPageBuffer, {
            provider,
            lowTokenMode,
            cropBox: cluster.boundingBox
          });
          const cropFilePath = path.join(artifactsDir, `${testId}-${safeVpName}-${cluster.id}.webp`);
          fs.writeFileSync(cropFilePath, croppedOpt.buffer);

          for (const vIdx of cluster.violationIndices) {
            if (heuristicViolations[vIdx]) {
              heuristicViolations[vIdx]!.cropImagePath = cropFilePath;
            }
          }

          violationCrops.push({
            id: cluster.id,
            boundingBox: cluster.boundingBox,
            rules: cluster.rules,
            elements: cluster.elements,
            suggestedCommands: cluster.suggestedCommands,
            imagePath: cropFilePath,
            imageBase64: croppedOpt.dataUri
          });
        }
      }

      aggregatedViolations.push(...heuristicViolations);

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
          diffBase64: optimized.dataUri,
          diffImagePath
        },
        ...(violationCrops.length > 0 ? { violationCrops } : {})
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

  // Handle optional DESIGN.md comparison deltas
  const designMdDeltas: DesignMdDelta[] = designMd ? diffDesignMdAgainstDom(designMd, combinedDomStyles) : [];

  const payload: TriagePayload = {
    version: '1.0.0',
    mode: 'design-qa',
    targetProvider: provider,
    tileDimensions: getProviderDimensions(provider, lowTokenMode),
    timestamp: new Date().toISOString(),
    failures: [
      {
        testId,
        testTitle: `UI Design QA Audit for ${url}`,
        filePath: url,
        selector: 'body',
        viewports: viewportsArtifacts,
        designContext: {
          heuristicViolations: aggregatedViolations,
          penpotDeltas,
          ...(designMdDeltas.length > 0 ? { designMdDeltas } : {})
        }
      }
    ]
  };

  const validated = TriagePayloadSchema.parse(payload);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, 'design-qa-ready.json');
  fs.writeFileSync(outputFile, JSON.stringify(validated, null, 2), 'utf-8');

  const suggestedImpeccableCommands = Array.from(
    new Set(aggregatedViolations.map(v => v.suggestedCommand).filter((cmd): cmd is string => Boolean(cmd)))
  );

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: 'success',
          url,
          outputFile,
          targetProvider: provider,
          tileDimensions: validated.tileDimensions,
          heuristicViolationsCount: aggregatedViolations.length,
          penpotDeltasCount: penpotDeltas.length,
          designMdDeltasCount: designMdDeltas.length,
          suggestedImpeccableCommands,
          heuristicViolations: aggregatedViolations,
          penpotDeltas,
          ...(designMdDeltas.length > 0 ? { designMdDeltas } : {}),
          viewports: viewportsArtifacts.map(v => ({
            project: v.project,
            viewport: v.viewport,
            ariaSnapshot: v.ariaSnapshot,
            computedStyles: v.computedStyles,
            diffImagePath: v.images.diffImagePath,
            violationCrops: (v.violationCrops ?? []).map(c => ({
              id: c.id,
              boundingBox: c.boundingBox,
              rules: c.rules,
              elements: c.elements,
              suggestedCommands: c.suggestedCommands,
              imagePath: c.imagePath
            }))
          }))
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `[ZeroVisual] Design QA audit complete for ${url}. Violations: ${aggregatedViolations.length}, Penpot deltas: ${penpotDeltas.length}, DESIGN.md deltas: ${designMdDeltas.length}. Wrote: ${outputFile}`
    );
  }

  return validated;
}

export const designQaCommand = defineCommand({
  meta: {
    name: 'design-qa',
    description:
      'Audit a live URL against deterministic UI heuristics, rendered AI-slop detectors, DESIGN.md, and Penpot tokens'
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
    designMd: {
      type: 'string',
      description: 'Path to DESIGN.md file (auto-discovered in workspace if omitted)'
    },
    maxCrops: {
      type: 'string',
      default: '4',
      description: 'Maximum clustered 1-tile WebP violation crops per viewport (default: 4)'
    },
    output: {
      type: 'string',
      alias: 'o',
      default: './test-results',
      description: 'Directory where design-qa-ready.json will be saved'
    },
    provider: providerArg('openai'),
    lowTokenMode: lowTokenModeArg,
    json: jsonArg('Output concise JSON audit summary (with WebP file paths) to stdout')
  },
  async run({ args }) {
    const provider = TargetProviderSchema.parse(args.provider);
    const maxCrops = parseInt(String(args.maxCrops ?? '4'), 10);
    await runDesignQaCommand({
      url: args.url,
      penpotPath: args.penpot,
      designMdPath: args.designMd,
      maxCrops: Number.isNaN(maxCrops) ? 4 : maxCrops,
      outputDir: args.output,
      provider,
      lowTokenMode: args.lowTokenMode,
      json: args.json
    });
  }
});
