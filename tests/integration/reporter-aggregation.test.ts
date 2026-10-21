import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import type { TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { ZeroVisualReporter } from '../../src/reporter/playwright-reporter.js';
import { TriagePayloadSchema } from '../../src/core/schema.js';

describe('ZeroVisual Playwright Reporter Aggregation', () => {
  const testOutputDir = path.resolve(process.cwd(), './test-results-reporter-test');

  beforeEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  async function createSyntheticDiffPng(): Promise<Buffer> {
    const base = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

    const redDiff = await sharp({
      create: {
        width: 100,
        height: 50,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    return sharp(base)
      .composite([{ input: redDiff, left: 100, top: 150 }])
      .png()
      .toBuffer();
  }

  function createMockTestCase(titlePath: string[], projectName: string, viewport = { width: 1280, height: 720 }): TestCase {
    return {
      titlePath: () => titlePath,
      location: { file: 'tests/visual/checkout.spec.ts', line: 10, column: 1 },
      parent: {
        project: () => ({
          name: projectName,
          use: { viewport }
        })
      }
    } as unknown as TestCase;
  }

  function createMockTestResult(status: 'passed' | 'failed', diffBuffer?: Buffer): TestResult {
    return {
      status,
      attachments: diffBuffer
        ? [
            {
              name: 'checkout-diff.png',
              contentType: 'image/png',
              body: diffBuffer
            }
          ]
        : []
    } as unknown as TestResult;
  }

  it('Zero-Token Law: should do zero work and generate no output when tests pass', async () => {
    const reporter = new ZeroVisualReporter({ outputDir: testOutputDir });
    const mockTest = createMockTestCase(['spec.ts', 'Checkout', 'button visual test'], 'Desktop Chrome');
    const mockResult = createMockTestResult('passed');

    await reporter.onTestEnd(mockTest, mockResult);
    await reporter.onEnd({ status: 'passed' } as FullResult);

    expect(reporter.getAggregatedFailures().size).toBe(0);
    const outputFile = path.join(testOutputDir, 'triage-ready.json');
    expect(fs.existsSync(outputFile)).toBe(false);
  });

  it('should aggregate multi-viewport failures (Desktop Chrome + Mobile Safari) into a single testId', async () => {
    const reporter = new ZeroVisualReporter({
      outputDir: testOutputDir,
      targetProvider: 'anthropic'
    });

    const diffBuffer = await createSyntheticDiffPng();
    const commonTitlePath = ['checkout.spec.ts', 'Checkout Flow', 'Header and CTA alignment'];

    // 1. Desktop failure
    const desktopTest = createMockTestCase(commonTitlePath, 'Desktop Chrome', { width: 1920, height: 1080 });
    const desktopResult = createMockTestResult('failed', diffBuffer);
    await reporter.onTestEnd(desktopTest, desktopResult);

    // 2. Mobile failure for the same test
    const mobileTest = createMockTestCase(commonTitlePath, 'Mobile Safari', { width: 375, height: 667 });
    const mobileResult = createMockTestResult('failed', diffBuffer);
    await reporter.onTestEnd(mobileTest, mobileResult);

    // 3. Test run ends
    await reporter.onEnd({ status: 'failed' } as FullResult);

    const outputFile = path.join(testOutputDir, 'triage-ready.json');
    expect(fs.existsSync(outputFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    const validated = TriagePayloadSchema.parse(content);

    expect(validated.mode).toBe('regression');
    expect(validated.targetProvider).toBe('anthropic');
    expect(validated.tileDimensions).toEqual({ maxWidth: 504, maxHeight: 504 });
    expect(validated.failures).toHaveLength(1);

    const failure = validated.failures[0]!;
    expect(failure.testId).toBe('checkout-flow-header-and-cta-alignment');
    expect(failure.testTitle).toBe('Checkout Flow > Header and CTA alignment');
    expect(failure.viewports).toHaveLength(2);

    expect(failure.viewports[0]?.project).toBe('Desktop Chrome');
    expect(failure.viewports[0]?.viewport).toEqual({ width: 1920, height: 1080 });
    expect(failure.viewports[0]?.images.diffBase64).toMatch(/^data:image\/webp;base64,/);

    expect(failure.viewports[1]?.project).toBe('Mobile Safari');
    expect(failure.viewports[1]?.viewport).toEqual({ width: 375, height: 667 });
    expect(failure.viewports[1]?.images.diffBase64).toMatch(/^data:image\/webp;base64,/);
  });
});
