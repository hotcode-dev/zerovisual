import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createMcpServer } from '../../src/mcp/server.js';
import { writeSkillSchemas } from '../../src/core/schema-generator.js';
import type { TriagePayload } from '../../src/core/schema.js';

describe('ZeroVisual MCP Server Integration', () => {
  const testDir = path.resolve(process.cwd(), './test-results-mcp-test');
  const triageFile = path.join(testDir, 'test-results/triage-ready.json');

  const samplePayload: TriagePayload = {
    version: '1.0.0',
    mode: 'regression',
    targetProvider: 'anthropic',
    tileDimensions: { maxWidth: 504, maxHeight: 504 },
    timestamp: new Date().toISOString(),
    failures: [
      {
        testId: 'checkout-button-alignment',
        testTitle: 'Checkout > Button Alignment',
        filePath: 'tests/checkout.spec.ts',
        selector: 'button#checkout',
        viewports: [
          {
            project: 'Desktop Chrome',
            viewport: { width: 1440, height: 900 },
            diffPixelRatio: 0.05,
            boundingBox: { x: 100, y: 150, width: 200, height: 48 },
            ariaSnapshot: '- button "Checkout":\n  - text "Checkout"\n',
            computedStyles: {
              display: 'flex',
              backgroundColor: 'rgb(0, 102, 204)'
            },
            images: {
              diffBase64: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA='
            }
          },
          {
            project: 'Mobile Safari',
            viewport: { width: 390, height: 844 },
            diffPixelRatio: 0.09,
            boundingBox: { x: 20, y: 120, width: 350, height: 44 },
            ariaSnapshot: '- button "Checkout":\n  - text "Checkout"\n',
            computedStyles: {
              display: 'block',
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

  beforeEach(() => {
    fs.mkdirSync(path.dirname(triageFile), { recursive: true });
    fs.writeFileSync(triageFile, JSON.stringify(samplePayload, null, 2), 'utf-8');
    writeSkillSchemas(testDir);

    const regSkillSrc = path.resolve(process.cwd(), 'skills/zerovisual-regression/SKILL.md');
    const dqaSkillSrc = path.resolve(process.cwd(), 'skills/zerovisual-design-qa/SKILL.md');
    fs.copyFileSync(regSkillSrc, path.join(testDir, 'skills/zerovisual-regression/SKILL.md'));
    fs.copyFileSync(dqaSkillSrc, path.join(testDir, 'skills/zerovisual-design-qa/SKILL.md'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  async function setupClientAndServer() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({
      baseDir: testDir,
      triageFilePath: triageFile
    });
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    return { client, server };
  }

  it('should register all 3 required tools: list_visual_failures, get_visual_failure_bundle, audit_live_ui_design', async () => {
    const { client, server } = await setupClientAndServer();

    const toolsResponse = await client.listTools();
    const toolNames = toolsResponse.tools.map((t) => t.name);

    expect(toolNames).toContain('list_visual_failures');
    expect(toolNames).toContain('get_visual_failure_bundle');
    expect(toolNames).toContain('audit_live_ui_design');

    await client.close();
    await server.close();
  });

  it('tool: list_visual_failures should return failure summary across viewports', async () => {
    const { client, server } = await setupClientAndServer();

    const res = await client.callTool({
      name: 'list_visual_failures',
      arguments: {}
    });

    expect(res.content).toBeDefined();
    const content = (res.content as any[])[0];
    expect(content.type).toBe('text');

    const parsed = JSON.parse(content.text);
    expect(parsed.totalFailures).toBe(1);
    expect(parsed.targetProvider).toBe('anthropic');
    expect(parsed.failures[0].testId).toBe('checkout-button-alignment');
    expect(parsed.failures[0].viewports).toHaveLength(2);

    await client.close();
    await server.close();
  });

  it('tool: get_visual_failure_bundle should return full multi-viewport artifact for a testId', async () => {
    const { client, server } = await setupClientAndServer();

    const res = await client.callTool({
      name: 'get_visual_failure_bundle',
      arguments: { testId: 'checkout-button-alignment' }
    });

    const content = (res.content as any[])[0];
    const parsed = JSON.parse(content.text);

    expect(parsed.testId).toBe('checkout-button-alignment');
    expect(parsed.viewports).toHaveLength(2);
    expect(parsed.viewports[0].images.diffBase64).toMatch(/^data:image\/webp;base64,/);
    expect(parsed.viewports[1].images.diffBase64).toMatch(/^data:image\/webp;base64,/);

    await client.close();
    await server.close();
  });

  it('tool: get_visual_failure_bundle should return informative error on non-existent testId', async () => {
    const { client, server } = await setupClientAndServer();

    const res = await client.callTool({
      name: 'get_visual_failure_bundle',
      arguments: { testId: 'non-existent-test' }
    });

    const content = (res.content as any[])[0];
    expect(content.text).toContain('Error: No failure found matching testId "non-existent-test"');

    await client.close();
    await server.close();
  });

  it('should register both prompts: triage-regression and critique-ui-design and load isolated skills', async () => {
    const { client, server } = await setupClientAndServer();

    const promptsResponse = await client.listPrompts();
    const promptNames = promptsResponse.prompts.map((p) => p.name);

    expect(promptNames).toContain('triage-regression');
    expect(promptNames).toContain('critique-ui-design');

    // Test triage-regression prompt
    const regressionPrompt = await client.getPrompt({
      name: 'triage-regression',
      arguments: { testId: 'checkout-button-alignment' }
    });

    const regMsg = regressionPrompt.messages[0]?.content as any;
    expect(regMsg.text).toContain('ZeroVisual Visual Regression Triage Rubric');
    expect(regMsg.text).toContain('checkout-button-alignment');

    // Test critique-ui-design prompt
    const designPrompt = await client.getPrompt({
      name: 'critique-ui-design',
      arguments: { url: 'http://localhost:3000' }
    });

    const designMsg = designPrompt.messages[0]?.content as any;
    expect(designMsg.text).toContain('ZeroVisual UI Design QA Mentor Rubric');
    expect(designMsg.text).toContain('http://localhost:3000');

    await client.close();
    await server.close();
  });
});
