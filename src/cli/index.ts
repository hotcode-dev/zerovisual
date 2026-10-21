import { defineCommand, runMain } from 'citty';
import { regressionCommand } from './commands/regression.js';
import { designQaCommand } from './commands/design-qa.js';

export const mainCommand = defineCommand({
  meta: {
    name: 'zerovisual',
    version: '0.1.0',
    description: 'Zero-API-key visual regression and automated UI design QA pre-processor'
  },
  subCommands: {
    regression: regressionCommand,
    'design-qa': designQaCommand
  }
});

runMain(mainCommand);
