import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TriagePayloadSchema, TargetProviderSchema, type TriagePayload } from '../core/schema.js';
import { runDesignQaCommand } from '../cli/commands/design-qa.js';

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
    'Returns the complete multi-viewport failure bundle (Base64 WebP diffs, AOM snapshot, computed styles) for a specific testId',
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

      return {
        content: [
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
        ]
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

        return {
          content: [
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
                    screenshotBase64: v.images.diffBase64
                  }))
                },
                null,
                2
              )
            }
          ]
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
