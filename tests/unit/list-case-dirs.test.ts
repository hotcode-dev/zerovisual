import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { listCaseDirs } from '../../benchmark/provider.js';
import { makeTmpDir, cleanupTmpDirs } from '../helpers/tmp-dir.js';

describe('listCaseDirs (shared benchmark case-dir listing)', () => {
  afterAll(cleanupTmpDirs);

  it('returns only subdirectories, sorted by name', () => {
    const dir = makeTmpDir('zf-list-case-dirs-');
    fs.mkdirSync(path.join(dir, 'case-c'));
    fs.mkdirSync(path.join(dir, 'case-a'));
    fs.mkdirSync(path.join(dir, 'case-b'));
    fs.writeFileSync(path.join(dir, 'stray-file.txt'), 'not a dir');
    expect(listCaseDirs(dir)).toEqual(['case-a', 'case-b', 'case-c']);
  });

  it('returns an empty array when there are no subdirectories', () => {
    const dir = makeTmpDir('zf-list-case-dirs-');
    fs.writeFileSync(path.join(dir, 'README.md'), 'no cases yet');
    expect(listCaseDirs(dir)).toEqual([]);
  });

  it('ignores empty directories that contain only files', () => {
    const dir = makeTmpDir('zf-list-case-dirs-');
    fs.mkdirSync(path.join(dir, 'case-x'));
    fs.writeFileSync(path.join(dir, 'case-x', 'metadata.json'), '{}');
    // case-x is still a directory; the helper lists directories only.
    expect(listCaseDirs(dir)).toEqual(['case-x']);
  });
});
