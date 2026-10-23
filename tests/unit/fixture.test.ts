import { describe, it, expect, vi } from 'vitest';
import type { Page, TestInfo } from '@playwright/test';
import { attachZeroVisualContext } from '../../src/reporter/fixture.js';

describe('Playwright Real Context Fixture & Helper', () => {
  it('should return null when page is null or closed', async () => {
    const mockTestInfo = {
      attachments: []
    } as unknown as TestInfo;

    const nullResult = await attachZeroVisualContext(null as unknown as Page, mockTestInfo);
    expect(nullResult).toBeNull();

    const mockClosedPage = {
      isClosed: () => true
    } as unknown as Page;

    const closedResult = await attachZeroVisualContext(mockClosedPage, mockTestInfo);
    expect(closedResult).toBeNull();
    expect(mockTestInfo.attachments).toHaveLength(0);
  });

  it('should capture context and push zerovisual-context.json attachment on open page', async () => {
    const mockTestInfo = {
      project: { use: { isMobile: true } },
      attachments: []
    } as unknown as TestInfo;

    const mockPage = {
      isClosed: () => false,
      locator: vi.fn().mockReturnValue({
        ariaSnapshot: vi.fn().mockResolvedValue('- button "Submit Order"')
      }),
      evaluate: vi.fn().mockResolvedValue({
        resolvedSelector: 'button.primary',
        tagName: 'button',
        computedStyles: {
          display: 'block',
          color: 'rgb(255, 255, 255)',
          backgroundColor: 'rgb(0, 0, 0)'
        },
        boundingBox: { x: 10, y: 10, width: 100, height: 40 },
        viewportWidth: 1200,
        effectiveBg: 'rgb(0, 0, 0)',
        accessibility: {
          role: 'button',
          innerText: 'Submit Order'
        }
      })
    } as unknown as Page;

    const result = await attachZeroVisualContext(mockPage, mockTestInfo, 'button.primary');

    expect(result).not.toBeNull();
    expect(result?.selector).toBe('button.primary');
    expect(result?.ariaSnapshot).toBe('- button "Submit Order"');
    expect(result?.computedStyles.display).toBe('block');

    expect(mockTestInfo.attachments).toHaveLength(1);
    const attachment = mockTestInfo.attachments[0]!;
    expect(attachment.name).toBe('zerovisual-context.json');
    expect(attachment.contentType).toBe('application/json');

    const parsedJson = JSON.parse(attachment.body!.toString());
    expect(parsedJson.selector).toBe('button.primary');
    expect(parsedJson.ariaSnapshot).toBe('- button "Submit Order"');
  });

  it('should catch errors gracefully and return null when page evaluation fails', async () => {
    const mockTestInfo = {
      attachments: []
    } as unknown as TestInfo;

    const mockFaultyPage = {
      isClosed: () => false,
      locator: vi.fn().mockImplementation(() => {
        throw new Error('Target closed');
      })
    } as unknown as Page;

    const result = await attachZeroVisualContext(mockFaultyPage, mockTestInfo);
    expect(result).toBeNull();
    expect(mockTestInfo.attachments).toHaveLength(0);
  });
});
