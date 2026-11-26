import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTmpDir, cleanupTmpDirs } from '../helpers/tmp-dir.js';

describe('tmp-dir helper (shared test fixture)', () => {
  afterEach(cleanupTmpDirs);

  it('creates a directory under os.tmpdir() with the given prefix', () => {
    const dir = makeTmpDir('zv-helper-test-');
    expect(dir.startsWith(path.join(os.tmpdir(), 'zv-helper-test-'))).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it('produces distinct directories on repeated calls', () => {
    const a = makeTmpDir('zv-helper-test-');
    const b = makeTmpDir('zv-helper-test-');
    expect(a).not.toBe(b);
    expect(fs.existsSync(a)).toBe(true);
    expect(fs.existsSync(b)).toBe(true);
  });

  it('cleanupTmpDirs removes recorded directories and is idempotent when empty', () => {
    const dir = makeTmpDir('zv-helper-test-');
    cleanupTmpDirs();
    expect(fs.existsSync(dir)).toBe(false);
    // Second call with nothing recorded must be a safe no-op.
    expect(() => cleanupTmpDirs()).not.toThrow();
  });

  it('cleanupTmpDirs removes nested contents recursively', () => {
    const dir = makeTmpDir('zv-helper-test-');
    fs.mkdirSync(`${dir}/nested/dir`, { recursive: true });
    fs.writeFileSync(`${dir}/nested/dir/file.txt`, 'data');
    cleanupTmpDirs();
    expect(fs.existsSync(dir)).toBe(false);
  });
});
