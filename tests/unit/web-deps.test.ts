import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const webPkgPath = resolve(__dirname, '../../web/package.json');

describe('web/package.json dependency declarations', () => {
  it('declares playwright in devDependencies', () => {
    const pkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'));
    expect(pkg.devDependencies).toHaveProperty('playwright');
    const range = pkg.devDependencies.playwright;
    // Must be a valid semver range starting with ^ or ~
    expect(range).toMatch(/^[\^~]\d+\.\d+\.\d+/);
  });

  it('declares a playwright range compatible with the root @playwright/test', () => {
    const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'));
    const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
    const webRange = webPkg.devDependencies.playwright;
    const rootRange = rootPkg.devDependencies['@playwright/test'];
    // Both should target the same major version
    const webMajor = webRange.match(/^[\^~](\d+)\./)?.[1];
    const rootMajor = rootRange.match(/^[\^~](\d+)\./)?.[1];
    expect(webMajor).toBe(rootMajor);
    expect(webMajor).toBe('1');
  });
});
