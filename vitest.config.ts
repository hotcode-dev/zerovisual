import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Root-only `npm ci` (the .zerofactory/precommit.sh gate) never populates
// web/node_modules, so when a root test imports a web/ source
// (tests/unit/toggle-group.test.ts -> web/src/lib/toggle-group.ts) vite:esbuild
// cannot resolve the nearest tsconfig for that file: web/tsconfig.json extends
// "astro/tsconfigs/strict", and astro is a web/-only devDependency. Passing
// tsconfigRaw as a *string* makes Vite skip per-file tsconfig resolution
// (tsconfck) entirely and use these options for every transformed file; we
// read the root tsconfig.json verbatim so the options stay in sync with
// `npm run typecheck` by construction.
const rootTsconfigRaw = readFileSync(fileURLToPath(new URL('./tsconfig.json', import.meta.url)), 'utf8');

export default defineConfig({
  esbuild: {
    tsconfigRaw: rootTsconfigRaw
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
