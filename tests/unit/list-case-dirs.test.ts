import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listCaseDirs } from '../../benchmark/provider.js';

describe('listCaseDirs (shared benchmark case-dir listing)', () => {
  const tmpDirs: string[] = [];
  const makeTmpDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zf-list-case-dirs-'));
    tmpDirs.push(dir);
    return dir;
  };

  afterAll(() => {
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns only subdirectories, sorted by name', () => {
    const dir = makeTmpDir();
    fs.mkdirSync(path.join(dir, 'case-c'));
    fs.mkdirSync(path.join(dir, 'case-a'));
    fs.mkdirSync(path.join(dir, 'case-b'));
    fs.writeFileSync(path.join(dir, 'stray-file.txt'), 'not a dir');
    expect(listCaseDirs(dir)).toEqual(['case-a', 'case-b', 'case-c']);
  });

  it('returns an empty array when there are no subdirectories', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'README.md'), 'no cases yet');
    expect(listCaseDirs(dir)).toEqual([]);
  });

  it('ignores empty directories that contain only files', () => {
    const dir = makeTmpDir();
    fs.mkdirSync(path.join(dir, 'case-x'));
    fs.writeFileSync(path.join(dir, 'case-x', 'metadata.json'), '{}');
    // case-x is still a directory; the helper lists directories only.
    expect(listCaseDirs(dir)).toEqual(['case-x']);
  });
});
