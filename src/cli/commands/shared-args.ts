import { TargetProviderSchema } from '../../core/schema.js';

type BoolArg = { type: 'boolean'; default: boolean; description: string };
type StrArg = { type: 'string'; alias: 'p'; default: string; description: string };

/**
 * Shared citty arg definitions for the `--provider`, `--low-token-mode`, and
 * `--json` args used by design-qa, regression, optimize, and estimate.
 * `type` must stay a required literal (citty's optional `ArgDef` would make
 * `ParsedArgs` fall back to `string | boolean | string[]`), and the provider
 * list derives from `TargetProviderSchema` so one edit keeps all four
 * `--help` outputs in sync.
 */

const PROVIDER_LIST = TargetProviderSchema.options.join(' | ');

/** `--provider` arg; default varies per command (openai for design-qa/regression, anthropic for optimize/estimate). */
export function providerArg(defaultProvider: 'openai' | 'anthropic'): StrArg {
  return {
    type: 'string',
    alias: 'p',
    default: defaultProvider,
    description: `Target Vision LLM provider: ${PROVIDER_LIST}`
  };
}

/** `--low-token-mode` arg, identical for every command that accepts it. */
export const lowTokenModeArg: BoolArg = {
  type: 'boolean',
  default: false,
  description: 'Enable aggressive token reduction (e.g. 384x384 for Gemini)'
};

/** `--json` arg; shared shape, per-command description. */
export function jsonArg(description: string): BoolArg {
  return {
    type: 'boolean',
    default: false,
    description
  };
}
