import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Regression guard for zf-hdz-1cadcc31 / zf-hdz-35160570 (Ponytail Rung 5 false-positive).
//
// @astrojs/markdown-remark has ZERO direct imports in web/, so dependency-bloat
// scanners flag it as removable. It is in fact REQUIRED: astro/starlight/mdx declare
// it only as an OPTIONAL peer (peerDependenciesMeta.optional=true), so npm does not
// auto-install it once the explicit devDependency is dropped. Because
// web/astro.config.mjs configures markdown.remarkPlugins + markdown.rehypePlugins
// (remark-math + rehype-katex), Astro's config validator
// (astro/dist/core/config/validate.js -> coerceLegacyMarkdownPlugins) throws at
// build time without the legacy processor. This test pins that requirement so a
// future "remove unused @astrojs/markdown-remark" task cannot silently break the
// docs build under Auto-Merge.
const readText = (rel: string): string => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');

describe('web @astrojs/markdown-remark guard (required despite zero direct imports)', () => {
  const pkg = JSON.parse(readText('web/package.json')) as { devDependencies: Record<string, string> };

  it('declares @astrojs/markdown-remark in web devDependencies', () => {
    const range = pkg.devDependencies['@astrojs/markdown-remark'];
    expect(
      range,
      [
        '@astrojs/markdown-remark is REQUIRED at web build time, not bloat.',
        'web/astro.config.mjs sets markdown.remarkPlugins/rehypePlugins, so Astro 7',
        'coerceLegacyMarkdownPlugins runtime-imports it even though it has zero direct',
        'imports in web/. This is a Ponytail Rung 5 false positive.',
        'DO NOT remove this devDependency: removing it breaks `cd web && npm run build`.',
        'Close any "remove unused @astrojs/markdown-remark" task as wontfix/invalid.',
        'See zf-hdz-35160570 / zf-hdz-1cadcc31.'
      ].join(' ')
    ).toMatch(/^\^?7\./);
  });

  it('is present in the lockfile so `npm install` actually fetches it', () => {
    const lock = JSON.parse(readText('web/package-lock.json')) as {
      packages: Record<string, { version?: string }>;
    };
    expect(lock.packages['node_modules/@astrojs/markdown-remark']?.version).toEqual(expect.any(String));
  });

  it('is required because the astro config wires up remark/rehype markdown plugins', () => {
    const config = readText('web/astro.config.mjs');
    expect(config).toMatch(/remarkPlugins:\s*\[\s*remarkMath/);
    expect(config).toMatch(/rehypePlugins:\s*\[\s*rehypeKatex/);
  });
});
