import { defineCommand, runMain } from 'citty';
import { regressionCommand } from './commands/regression.js';
import { designQaCommand } from './commands/design-qa.js';
import { optimizeCommand } from './commands/optimize.js';
import { estimateCommand } from './commands/estimate.js';

export const mainCommand = defineCommand({
  meta: {
    name: 'zerovisual',
    version: '0.2.0',
    description: 'Zero-API-key visual regression, UI design QA, and model-aware image optimizer'
  },
  subCommands: {
    regression: regressionCommand,
    'design-qa': designQaCommand,
    optimize: optimizeCommand,
    estimate: estimateCommand
  }
});

const isOptimizeDirect = process.argv[1]?.endsWith('zerovisual-optimize');
if (isOptimizeDirect) {
  runMain(optimizeCommand);
} else {
  runMain(mainCommand);
}
