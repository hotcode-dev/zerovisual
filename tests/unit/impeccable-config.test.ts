import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadImpeccableConfig } from '../../src/core/design-md-parser.js';
import { makeTmpDir, cleanupTmpDirs } from '../helpers/tmp-dir.js';

describe('loadImpeccableConfig', () => {
  const writeConfig = (dir: string, filename: string, obj: unknown) => {
    fs.mkdirSync(path.join(dir, '.impeccable'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.impeccable', filename), JSON.stringify(obj), 'utf-8');
  };

  afterAll(cleanupTmpDirs);

  it('returns defaults when no config files exist', () => {
    const dir = makeTmpDir('zv-impeccable-config-');
    const config = loadImpeccableConfig(dir);
    expect(config.ignoreRules).toEqual([]);
    expect(config.designSystemEnabled).toBe(true);
  });

  it('parses detector.ignoreRules from config.json', () => {
    const dir = makeTmpDir('zv-impeccable-config-');
    writeConfig(dir, 'config.json', { detector: { ignoreRules: ['contrast', 'spacing'] } });
    const config = loadImpeccableConfig(dir);
    expect(config.ignoreRules).toEqual(['contrast', 'spacing']);
  });

  it('strips legacy ignoreFiles and ignoreValues keys without error', () => {
    const dir = makeTmpDir('zv-impeccable-config-');
    writeConfig(dir, 'config.json', {
      detector: {
        ignoreRules: ['contrast'],
        ignoreFiles: ['*.min.js', 'vendor/*'],
        ignoreValues: ['#fff', 'rgb(0,0,0)']
      }
    });
    const config = loadImpeccableConfig(dir);
    // Legacy keys must not appear on the returned object
    expect('ignoreFiles' in config).toBe(false);
    expect('ignoreValues' in config).toBe(false);
    // Active fields still parse correctly
    expect(config.ignoreRules).toEqual(['contrast']);
    expect(config.designSystemEnabled).toBe(true);
  });

  it('honors designSystem.enabled override', () => {
    const dir = makeTmpDir('zv-impeccable-config-');
    writeConfig(dir, 'config.json', { detector: { designSystem: { enabled: false } } });
    const config = loadImpeccableConfig(dir);
    expect(config.designSystemEnabled).toBe(false);
  });

  it('merges ignoreRules across config.json and config.local.json', () => {
    const dir = makeTmpDir('zv-impeccable-config-');
    writeConfig(dir, 'config.json', { detector: { ignoreRules: ['contrast'] } });
    writeConfig(dir, 'config.local.json', { detector: { ignoreRules: ['spacing'] } });
    const config = loadImpeccableConfig(dir);
    expect(config.ignoreRules).toContain('contrast');
    expect(config.ignoreRules).toContain('spacing');
  });

  it('ignores malformed JSON without throwing', () => {
    const dir = makeTmpDir('zv-impeccable-config-');
    fs.mkdirSync(path.join(dir, '.impeccable'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.impeccable', 'config.json'), '{ not valid json', 'utf-8');
    const config = loadImpeccableConfig(dir);
    expect(config.ignoreRules).toEqual([]);
    expect(config.designSystemEnabled).toBe(true);
  });

  it('handles top-level (non-detector) config shape', () => {
    const dir = makeTmpDir('zv-impeccable-config-');
    writeConfig(dir, 'config.json', { ignoreRules: ['tap-target'] });
    const config = loadImpeccableConfig(dir);
    expect(config.ignoreRules).toEqual(['tap-target']);
  });
});
