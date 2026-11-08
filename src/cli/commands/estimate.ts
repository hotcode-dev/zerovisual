import { defineCommand } from 'citty';
import { TargetProviderSchema, type TargetProvider, type TileDimensions } from '../../core/schema.js';
import { getProviderDimensions, estimateVisionTokens } from '../../core/image-optimizer.js';

export interface EstimateOptions {
  width: number;
  height: number;
  provider?: TargetProvider;
  lowTokenMode?: boolean;
  json?: boolean;
}

export interface EstimateSummary {
  provider: TargetProvider;
  originalResolution: string;
  originalTokens: number;
  tileDimensions: TileDimensions;
  optimizedResolution: string;
  optimizedTokens: number;
  tokenSavingsPercent: string;
}

/**
 * Programmatic execution for Vision LLM token cost estimation.
 */
export function runEstimateCommand(options: EstimateOptions): EstimateSummary {
  const provider = options.provider ?? 'anthropic';
  const lowTokenMode = options.lowTokenMode ?? false;
  const { width, height } = options;

  const tileDims = getProviderDimensions(provider, lowTokenMode);
  const rawTokens = estimateVisionTokens(width, height, provider, lowTokenMode);

  const scale = Math.min(1, Math.min(tileDims.maxWidth / width, tileDims.maxHeight / height));
  const optWidth = Math.max(1, Math.round(width * scale));
  const optHeight = Math.max(1, Math.round(height * scale));
  const optTokens = estimateVisionTokens(optWidth, optHeight, provider, lowTokenMode);
  const savingsPct = rawTokens > 0 ? Number((((rawTokens - optTokens) / rawTokens) * 100).toFixed(1)) : 0;

  const summary: EstimateSummary = {
    provider,
    originalResolution: `${width}x${height}`,
    originalTokens: rawTokens,
    tileDimensions: tileDims,
    optimizedResolution: `${optWidth}x${optHeight}`,
    optimizedTokens: optTokens,
    tokenSavingsPercent: `${savingsPct}%`
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\n📐 [ZeroVisual] Token Cost Estimate for ${provider.toUpperCase()}:`);
    console.log(`   Original Resolution:  ${summary.originalResolution} (${summary.originalTokens} tokens)`);
    console.log(`   Optimized Resolution: ${summary.optimizedResolution} (${summary.optimizedTokens} tokens)`);
    console.log(`   Vision Token Savings: ${summary.tokenSavingsPercent}`);
  }

  return summary;
}

export const estimateCommand = defineCommand({
  meta: {
    name: 'estimate',
    description: 'Calculate estimated Vision LLM tokens for raw vs optimized image resolutions across model tile grids'
  },
  args: {
    width: {
      type: 'string',
      alias: 'w',
      required: true,
      description: 'Image pixel width (e.g. 1920)'
    },
    height: {
      type: 'string',
      alias: 'h',
      required: true,
      description: 'Image pixel height (e.g. 1080)'
    },
    provider: {
      type: 'string',
      alias: 'p',
      default: 'anthropic',
      description: 'Target Vision LLM provider: anthropic | openai | gemini | local | qwen | gemma | llama | mistral | deepseek'
    },
    lowTokenMode: {
      type: 'boolean',
      default: false,
      description: 'Enable aggressive token reduction (e.g. 384x384 for Gemini)'
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'Output JSON estimate summary to stdout'
    }
  },
  run({ args }) {
    const provider = TargetProviderSchema.parse(args.provider);
    const width = parseInt(args.width, 10);
    const height = parseInt(args.height, 10);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error('[ZeroVisual] --width and --height must be positive integers');
    }
    runEstimateCommand({
      width,
      height,
      provider,
      lowTokenMode: args.lowTokenMode,
      json: args.json
    });
  }
});

