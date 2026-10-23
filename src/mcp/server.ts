import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TriagePayloadSchema, TargetProviderSchema, type TriagePayload } from '../core/schema.js';
import { runDesignQaCommand } from '../cli/commands/design-qa.js';
import {
  optimizeImageStandalone,
  getProviderDimensions,
  estimateVisionTokens
} from '../core/image-optimizer.js';

export interface McpServerOptions {
  baseDir?: string;
  triageFilePath?: string;
}

/**
 * Creates and configures the ZeroVisual MCP server with tools and prompts.
 */
export function createMcpServer(options: McpServerOptions = {}): McpServer {
  const baseDir = options.baseDir ?? process.cwd();
  const defaultTriagePath = options.triageFilePath ?? path.join(baseDir, 'test-results/triage-ready.json');

  const server = new McpServer({
    name: 'zerovisual',
    version: '0.1.0'
  });

  // Helper to read and validate triage payload
  function readTriagePayload(customPath?: string): TriagePayload | null {
    const targetPath = customPath ? path.resolve(baseDir, customPath) : defaultTriagePath;
    if (!fs.existsSync(targetPath)) return null;

    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      return TriagePayloadSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------
  // Tool 1: list_visual_failures
  // -------------------------------------------------------------
  server.tool(
    'list_visual_failures',
    'Lists all visual regression failures and affected responsive viewports from triage-ready.json',
    {
      triagePath: z.string().optional().describe('Optional custom path to triage-ready.json')
    },
    async ({ triagePath }) => {
      const payload = readTriagePayload(triagePath);

      if (!payload || payload.failures.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'ZeroVisual: No visual failures found in triage payload. Zero tokens needed.'
            }
          ]
        };
      }

      const summary = payload.failures.map((f) => ({
        testId: f.testId,
        testTitle: f.testTitle,
        filePath: f.filePath,
        viewports: f.viewports.map((v) => ({
          project: v.project,
          dimensions: `${v.viewport.width}x${v.viewport.height}`,
          diffPixelRatio: v.diffPixelRatio,
          boundingBox: v.boundingBox
        }))
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                mode: payload.mode,
                totalFailures: payload.failures.length,
                targetProvider: payload.targetProvider,
                tileDimensions: payload.tileDimensions,
                failures: summary
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // -------------------------------------------------------------
  // Tool 2: get_visual_failure_bundle
  // -------------------------------------------------------------
  server.tool(
    'get_visual_failure_bundle',
    'Returns the complete multi-viewport failure bundle with native MCP ImageContent blocks for each viewport diff',
    {
      testId: z.string().describe('Normalized test identifier'),
      triagePath: z.string().optional().describe('Optional custom path to triage-ready.json')
    },
    async ({ testId, triagePath }) => {
      const payload = readTriagePayload(triagePath);

      if (!payload) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: triage-ready.json not found at ${triagePath ?? defaultTriagePath}`
            }
          ]
        };
      }

      const failure = payload.failures.find((f) => f.testId === testId);

      if (!failure) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: No failure found matching testId "${testId}". Available testIds: ${payload.failures.map((f) => f.testId).join(', ')}`
            }
          ]
        };
      }

      const contentBlocks: any[] = [
        {
          type: 'text',
          text: JSON.stringify(
            {
              testId: failure.testId,
              testTitle: failure.testTitle,
              filePath: failure.filePath,
              selector: failure.selector,
              tileDimensions: payload.tileDimensions,
              viewports: failure.viewports,
              designContext: failure.designContext
            },
            null,
            2
          )
        }
      ];

      // Attach native MCP ImageContent block for each viewport diff
      for (const vp of failure.viewports) {
        if (vp.images.diffBase64) {
          const rawBase64 = vp.images.diffBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          contentBlocks.push({
            type: 'image',
            data: rawBase64,
            mimeType: 'image/webp'
          });
        }
      }

      return {
        content: contentBlocks
      };
    }
  );

  // -------------------------------------------------------------
  // Tool 3: audit_live_ui_design
  // -------------------------------------------------------------
  server.tool(
    'audit_live_ui_design',
    'Executes an on-demand UI Design QA audit for a live URL, evaluating deterministic heuristics, Penpot deltas, and model-tile WebP screenshots',
    {
      url: z.string().describe('Live web URL to audit (e.g. http://localhost:3000)'),
      penpotPath: z.string().optional().describe('Optional path to Penpot SVG or JSON file'),
      provider: TargetProviderSchema.optional().describe('Target VLM tile grid preset'),
      lowTokenMode: z.boolean().optional().describe('Enable aggressive token reduction')
    },
    async ({ url, penpotPath, provider, lowTokenMode }) => {
      try {
        const payload = await runDesignQaCommand({
          url,
          penpotPath,
          provider,
          lowTokenMode,
          outputDir: path.join(baseDir, 'test-results')
        });

        const audit = payload.failures[0];

        const contentBlocks: any[] = [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'success',
                url,
                heuristicViolationsCount: audit?.designContext?.heuristicViolations.length ?? 0,
                penpotDeltasCount: audit?.designContext?.penpotDeltas.length ?? 0,
                heuristicViolations: audit?.designContext?.heuristicViolations,
                penpotDeltas: audit?.designContext?.penpotDeltas,
                viewports: audit?.viewports.map((v) => ({
                  project: v.project,
                  viewport: v.viewport,
                  diffPixelRatio: v.diffPixelRatio
                }))
              },
              null,
              2
            )
          }
        ];

        // Attach native MCP ImageContent blocks for captured viewports
        if (audit) {
          for (const vp of audit.viewports) {
            if (vp.images.diffBase64) {
              const rawBase64 = vp.images.diffBase64.replace(/^data:image\/[a-z]+;base64,/, '');
              contentBlocks.push({
                type: 'image',
                data: rawBase64,
                mimeType: 'image/webp'
              });
            }
          }
        }

        return {
          content: contentBlocks
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error during UI Design QA audit: ${err?.message ?? err}`
            }
          ]
        };
      }
    }
  );

  // -------------------------------------------------------------
  // Tool 4: optimize_image
  // -------------------------------------------------------------
  server.tool(
    'optimize_image',
    'Optimizes an arbitrary screenshot or UI image file for Vision LLM token grids and returns native MCP ImageContent plus token savings stats',
    {
      imagePath: z.string().optional().describe('Local file path to the image to optimize'),
      imageBase64: z.string().optional().describe('Base64-encoded image string to optimize'),
      provider: TargetProviderSchema.optional().describe('Target Vision LLM provider (default: anthropic)'),
      lowTokenMode: z
        .boolean()
        .optional()
        .describe('Enable aggressive token reduction (e.g. 384x384 for Gemini)'),
      quality: z.number().optional().describe('WebP compression quality (default: 80)')
    },
    async ({ imagePath, imageBase64, provider, lowTokenMode, quality }) => {
      try {
        let inputBuffer: Buffer;
        let sourceName = 'base64-image';

        if (imagePath) {
          const resolved = path.resolve(baseDir, imagePath);
          if (!fs.existsSync(resolved)) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Image file not found at ${resolved}`
                }
              ]
            };
          }
          inputBuffer = fs.readFileSync(resolved);
          sourceName = path.basename(resolved);
        } else if (imageBase64) {
          const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          inputBuffer = Buffer.from(cleanBase64, 'base64');
        } else {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Must provide either imagePath or imageBase64'
              }
            ]
          };
        }

        const { result, stats } = await optimizeImageStandalone(inputBuffer, {
          provider: provider ?? 'anthropic',
          lowTokenMode: lowTokenMode ?? false,
          quality: quality ?? 80
        });

        const rawBase64 = result.dataUri.replace(/^data:image\/[a-z]+;base64,/, '');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  source: sourceName,
                  provider: result.provider,
                  format: result.format,
                  dataUri: result.dataUri,
                  width: result.width,
                  height: result.height,
                  stats: {
                    originalResolution: `${stats.originalWidth}x${stats.originalHeight}`,
                    optimizedResolution: `${stats.optimizedWidth}x${stats.optimizedHeight}`,
                    originalTokens: stats.originalTokens,
                    optimizedTokens: stats.optimizedTokens,
                    tokenSavingsPercent: `${stats.tokenSavingsPercent}%`,
                    originalBytes: stats.originalBytes,
                    optimizedBytes: stats.optimizedBytes,
                    byteSavingsPercent: `${stats.byteSavingsPercent}%`
                  }
                },
                null,
                2
              )
            },
            {
              type: 'image',
              data: rawBase64,
              mimeType: 'image/webp'
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error optimizing image: ${err?.message ?? err}`
            }
          ]
        };
      }
    }
  );

  // -------------------------------------------------------------
  // Tool 5: estimate_token_cost
  // -------------------------------------------------------------
  server.tool(
    'estimate_token_cost',
    'Calculates estimated Vision LLM tokens for raw vs optimized image resolutions across providers',
    {
      width: z.number().int().positive().describe('Image pixel width'),
      height: z.number().int().positive().describe('Image pixel height'),
      provider: TargetProviderSchema.optional().describe('Target VLM provider (default: anthropic)'),
      lowTokenMode: z.boolean().optional().describe('Enable aggressive token reduction')
    },
    async ({ width, height, provider = 'anthropic', lowTokenMode = false }) => {
      const tileDims = getProviderDimensions(provider, lowTokenMode);
      const rawTokens = estimateVisionTokens(width, height, provider, lowTokenMode);

      const scale = Math.min(1, Math.min(tileDims.maxWidth / width, tileDims.maxHeight / height));
      const optWidth = Math.max(1, Math.round(width * scale));
      const optHeight = Math.max(1, Math.round(height * scale));
      const optTokens = estimateVisionTokens(optWidth, optHeight, provider, lowTokenMode);
      const savingsPct = rawTokens > 0 ? Number((((rawTokens - optTokens) / rawTokens) * 100).toFixed(1)) : 0;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                provider,
                originalResolution: `${width}x${height}`,
                originalTokens: rawTokens,
                tileDimensions: tileDims,
                optimizedResolution: `${optWidth}x${optHeight}`,
                optimizedTokens: optTokens,
                tokenSavingsPercent: `${savingsPct}%`
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // -------------------------------------------------------------
  // Prompt 1: triage-regression
  // -------------------------------------------------------------
  server.prompt(
    'triage-regression',
    'Loads the strict visual regression triage skill instructions and output JSON schema for triaging failures',
    {
      testId: z.string().optional().describe('Optional testId to preload failure context')
    },
    async ({ testId }) => {
      let skillPath = path.resolve(baseDir, 'skills/zerovisual-regression/SKILL.md');
      let schemaPath = path.resolve(baseDir, 'skills/zerovisual-regression/output.schema.json');

      if (!fs.existsSync(skillPath)) {
        skillPath = path.resolve(baseDir, 'skills/visual-regression/SKILL.md');
        schemaPath = path.resolve(baseDir, 'skills/visual-regression/output.schema.json');
      }

      const skillContent = fs.existsSync(skillPath)
        ? fs.readFileSync(skillPath, 'utf-8')
        : 'Perform strict code-to-code visual regression triage.';

      const schemaContent = fs.existsSync(schemaPath)
        ? fs.readFileSync(schemaPath, 'utf-8')
        : '{}';

      let failureContext = '';
      if (testId) {
        const payload = readTriagePayload();
        const failure = payload?.failures.find((f) => f.testId === testId);
        if (failure) {
          failureContext = `\n\n## Target Failure Bundle:\n${JSON.stringify(failure, null, 2)}`;
        }
      }

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `# ZeroVisual Visual Regression Triage Rubric\n\n${skillContent}\n\n## Strict JSON Output Schema:\n\`\`\`json\n${schemaContent}\n\`\`\`${failureContext}`
            }
          }
        ]
      };
    }
  );

  // -------------------------------------------------------------
  // Prompt 2: critique-ui-design
  // -------------------------------------------------------------
  server.prompt(
    'critique-ui-design',
    'Loads the UI/UX mentor guidelines, 8pt spatial grid rubric, WCAG contrast rules, and output schema',
    {
      url: z.string().optional().describe('Optional audited URL')
    },
    async ({ url }) => {
      let skillPath = path.resolve(baseDir, 'skills/zerovisual-design-qa/SKILL.md');
      let schemaPath = path.resolve(baseDir, 'skills/zerovisual-design-qa/output.schema.json');

      if (!fs.existsSync(skillPath)) {
        skillPath = path.resolve(baseDir, 'skills/design-qa/SKILL.md');
        schemaPath = path.resolve(baseDir, 'skills/design-qa/output.schema.json');
      }

      const skillContent = fs.existsSync(skillPath)
        ? fs.readFileSync(skillPath, 'utf-8')
        : 'Perform objective UI/UX design QA against 8pt grid and WCAG heuristics.';

      const schemaContent = fs.existsSync(schemaPath)
        ? fs.readFileSync(schemaPath, 'utf-8')
        : '{}';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `# ZeroVisual UI Design QA Mentor Rubric\n\nTarget URL: ${url ?? 'Live App'}\n\n${skillContent}\n\n## Strict JSON Output Schema:\n\`\`\`json\n${schemaContent}\n\`\`\``
            }
          }
        ]
      };
    }
  );

  return server;
}

// Auto-start when executed as stdio binary
async function main() {
  const isDirectRun =
    process.argv[1]?.endsWith('mcp/server.js') ||
    process.argv[1]?.endsWith('mcp/server.ts') ||
    process.argv[1]?.endsWith('zerovisual-mcp');

  if (isDirectRun) {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});

export default createMcpServer;
