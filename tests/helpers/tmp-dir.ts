import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDirs: string[] = [];

/**
 * Create a unique temp directory under os.tmpdir() with the given prefix
 * (mkdtemp random suffix is appended) and record it for later cleanup.
 * Shared test helper — replaces per-file mkdtempSync/rmSync blocks.
 */
export function makeTmpDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/**
 * Remove every directory recorded by makeTmpDir (recursive, force) and
 * reset the registry. Idempotent — safe to call when nothing is recorded.
 */
export function cleanupTmpDirs(): void {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
}
