import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/core/slug.js';

describe('slugify', () => {
  it('lowercases the output', () => {
    expect(slugify('MySite')).toBe('mysite');
  });

  it('collapses consecutive non-alphanumeric characters into a single dash', () => {
    expect(slugify('Hello,  World!')).toBe('hello-world');
    expect(slugify('a___b')).toBe('a-b');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
    expect(slugify('- -')).toBe('');
  });

  it('preserves digits and letters, collapsing the separator between them', () => {
    expect(slugify('v2.0')).toBe('v2-0');
    expect(slugify('API_2.0 v1')).toBe('api-2-0-v1');
  });

  it('lowercases mixed-case URL input (design-qa testId consistency)', () => {
    // Previously design-qa.ts preserved case: https-MySite-com-Page
    expect(slugify('https://MySite.com/Page')).toBe('https-mysite-com-page');
  });

  it('returns an empty string for empty or all-punctuation input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!! ???')).toBe('');
  });

  it('trims the padding that partial variants used to leave behind', () => {
    // " My Project " -> previously "-my-project-" in artifact names
    expect(slugify(' My Project ')).toBe('my-project');
  });
});
