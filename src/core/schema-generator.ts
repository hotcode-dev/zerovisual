import fs from 'node:fs';
import path from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { RegressionVerdictSchema, DesignQaVerdictSchema } from './schema.js';

export function getRegressionJsonSchema(): object {
  return zodToJsonSchema(RegressionVerdictSchema, {
    name: 'RegressionVerdict',
    target: 'jsonSchema7'
  });
}

export function getDesignQaJsonSchema(): object {
  return zodToJsonSchema(DesignQaVerdictSchema, {
    name: 'DesignQaVerdict',
    target: 'jsonSchema7'
  });
}

export function writeSkillSchemas(baseDir = process.cwd()): void {
  const visualRegressionDir = path.resolve(baseDir, 'skills/zerovisual-regression');
  const designQaDir = path.resolve(baseDir, 'skills/zerovisual-design-qa');

  fs.mkdirSync(visualRegressionDir, { recursive: true });
  fs.mkdirSync(designQaDir, { recursive: true });

  fs.writeFileSync(
    path.join(visualRegressionDir, 'output.schema.json'),
    JSON.stringify(getRegressionJsonSchema(), null, 2),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(designQaDir, 'output.schema.json'),
    JSON.stringify(getDesignQaJsonSchema(), null, 2),
    'utf-8'
  );
}
