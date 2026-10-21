import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts'
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    shims: true,
    target: 'node20'
  },
  {
    entry: {
      'cli/index': 'src/cli/index.ts',
      'mcp/server': 'src/mcp/server.ts'
    },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    shims: true,
    target: 'node20',
    banner: {
      js: '#!/usr/bin/env node'
    }
  }
]);
