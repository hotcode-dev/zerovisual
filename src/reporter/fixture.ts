import { test as base, type Page, type TestInfo, type Locator } from '@playwright/test';
import { captureDomContext, type DomContextResult } from '../core/dom-extractor.js';

export interface ZeroVisualFixtureOptions {
  autoCaptureAom?: boolean;
}

/**
 * Custom Playwright test runner pre-configured with the ZeroVisual Real-Context auto-fixture.
 * Automatically captures authentic AOM ariaSnapshots, computed styles, and heuristic violations
 * when a test fails, attaching 'zerovisual-context.json' to the test results.
 */
export const test = base.extend<{ zerovisual: void }>({
  zerovisual: [
    async ({ page }, use, testInfo) => {
      // Execute the test body
      await use();

      // If test failed or timed out, capture authentic DOM context while page is still open
      const isFailed = testInfo.status !== 'passed' && testInfo.status !== 'skipped';
      if (isFailed && page && !page.isClosed()) {
        try {
          const context = await captureDomContext(page, 'body', {
            isMobileViewport: (testInfo.project?.use as any)?.isMobile ?? false
          });

          testInfo.attachments.push({
            name: 'zerovisual-context.json',
            contentType: 'application/json',
            body: Buffer.from(JSON.stringify(context, null, 2))
          });
        } catch {
          // Graceful fallback if page was already destroyed
        }
      }
    },
    { auto: true }
  ]
});

/**
 * Explicit helper to capture and attach ZeroVisual DOM context for a specific locator or selector.
 */
export async function attachZeroVisualContext(
  page: Page,
  testInfo: TestInfo,
  targetLocatorOrSelector?: string | Locator
): Promise<DomContextResult | null> {
  if (!page || page.isClosed()) return null;

  try {
    let selector = 'body';
    if (typeof targetLocatorOrSelector === 'string') {
      selector = targetLocatorOrSelector;
    }

    const context = await captureDomContext(page, selector, {
      isMobileViewport: (testInfo.project?.use as any)?.isMobile ?? false
    });

    testInfo.attachments.push({
      name: 'zerovisual-context.json',
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify(context, null, 2))
    });

    return context;
  } catch {
    return null;
  }
}

export { expect } from '@playwright/test';
export default test;
