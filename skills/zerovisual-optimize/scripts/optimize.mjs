#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawArgs = process.argv.slice(2);
const subcommand = rawArgs[0] === 'estimate' ? 'estimate' : 'optimize';
const forwardArgs = rawArgs[0] === 'estimate' || rawArgs[0] === 'optimize' ? rawArgs.slice(1) : rawArgs;

const candidatePaths = [
  path.resolve(__dirname, '../../../dist/cli/index.js'),
  path.resolve(process.cwd(), 'dist/cli/index.js'),
  path.resolve(process.cwd(), 'node_modules/zerovisual/dist/cli/index.js')
];

const localCli = candidatePaths.find(p => fs.existsSync(p));

if (localCli) {
  const res = spawnSync(process.execPath, [localCli, subcommand, ...forwardArgs], {
    stdio: 'inherit'
  });
  process.exit(res.status ?? 0);
} else {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const res = spawnSync(npxCmd, ['--yes', 'zerovisual', subcommand, ...forwardArgs], {
    stdio: 'inherit'
  });
  process.exit(res.status ?? 0);
}
