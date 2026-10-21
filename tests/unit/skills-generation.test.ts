import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  getRegressionJsonSchema,
  getDesignQaJsonSchema,
  writeSkillSchemas
} from '../../src/core/schema-generator.js';

describe('Skill Output Schema Generation', () => {
  it('should generate valid JSON Schema for RegressionVerdict and DesignQaVerdict', () => {
    const reg = getRegressionJsonSchema() as any;
    expect(reg).toBeDefined();
    expect(reg.definitions?.RegressionVerdict?.properties?.verdict).toBeDefined();

    const dqa = getDesignQaJsonSchema() as any;
    expect(dqa).toBeDefined();
    expect(dqa.definitions?.DesignQaVerdict?.properties?.verdict).toBeDefined();
  });

  it('should write output.schema.json to skills directories', () => {
    writeSkillSchemas(process.cwd());

    const regFile = path.resolve(process.cwd(), 'skills/visual-regression/output.schema.json');
    const dqaFile = path.resolve(process.cwd(), 'skills/design-qa/output.schema.json');

    expect(fs.existsSync(regFile)).toBe(true);
    expect(fs.existsSync(dqaFile)).toBe(true);

    const regParsed = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
    const dqaParsed = JSON.parse(fs.readFileSync(dqaFile, 'utf-8'));

    expect(regParsed.$schema).toBeDefined();
    expect(dqaParsed.$schema).toBeDefined();
  });
});
