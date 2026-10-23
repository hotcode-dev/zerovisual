import fs from 'node:fs';
import path from 'node:path';
import { defineCommand } from 'citty';
import { TargetProviderSchema, type TargetProvider } from '../../core/schema.js';
import {
  optimizeImageStandalone,
  type ImageOptimizationStats,
  type OptimizedImageResult
} from '../../core/image-optimizer.js';

export interface OptimizeOptions {
  input: string;
  output?: string;
  provider?: TargetProvider;
  lowTokenMode?: boolean;
  quality?: number;
  json?: boolean;
}

export interface OptimizationSummary {
  file: string;
  outputPath: string;
  stats: ImageOptimizationStats;
}

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);

/**
 * Finds all image files in a path (or returns the single file).
 */
function getImageFiles(targetPath: string): string[] {
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext) ? [targetPath] : [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...getImageFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext) && !entry.name.includes('.optimized.')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Programmatic execution for image optimization.
 */
export async function runOptimizeCommand(options: OptimizeOptions): Promise<OptimizationSummary[]> {
  const inputPath = path.resolve(process.cwd(), options.input);
  const provider = options.provider ?? 'anthropic';
  const lowTokenMode = options.lowTokenMode ?? false;
  const quality = options.quality ?? 80;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`[ZeroVisual] Input path does not exist: ${inputPath}`);
  }

  const files = getImageFiles(inputPath);
  if (files.length === 0) {
    console.log(`[ZeroVisual] No supported image files (.png, .jpg, .webp) found at ${inputPath}`);
    return [];
  }

  const summaries: OptimizationSummary[] = [];

  for (const filePath of files) {
    const buffer = fs.readFileSync(filePath);
    const { result, stats } = await optimizeImageStandalone(buffer, {
      provider,
      lowTokenMode,
      quality
    });

    let outPath: string;
    if (options.output) {
      const resolvedOutput = path.resolve(process.cwd(), options.output);
      if (files.length === 1 && !fs.existsSync(resolvedOutput)) {
        outPath = resolvedOutput.endsWith('.webp') ? resolvedOutput : `${resolvedOutput}.webp`;
      } else {
        const parsed = path.parse(filePath);
        outPath = path.join(resolvedOutput, `${parsed.name}.optimized.webp`);
      }
    } else {
      const parsed = path.parse(filePath);
      outPath = path.join(parsed.dir, `${parsed.name}.optimized.webp`);
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, result.buffer);

    summaries.push({
      file: filePath,
      outputPath: outPath,
      stats
    });
  }

  if (options.json) {
    console.log(JSON.stringify(summaries, null, 2));
  } else {
    console.log(`\n⚡️ [ZeroVisual] Optimized ${summaries.length} image(s) for ${provider.toUpperCase()}:`);
    for (const s of summaries) {
      const origKb = Math.round(s.stats.originalBytes / 1024);
      const optKb = Math.round(s.stats.optimizedBytes / 1024);
      console.log(`\n  📄 ${path.basename(s.file)} ➔ ${path.basename(s.outputPath)}`);
      console.log(`     Resolution: ${s.stats.originalWidth}×${s.stats.originalHeight} ➔ ${s.stats.optimizedWidth}×${s.stats.optimizedHeight}`);
      console.log(`     Vision Tokens: ${s.stats.originalTokens} ➔ ${s.stats.optimizedTokens} (${s.stats.tokenSavingsPercent}% saved)`);
      console.log(`     Payload Size:  ${origKb} KB ➔ ${optKb} KB (${s.stats.byteSavingsPercent}% reduced)`);
    }
  }

  return summaries;
}

export const optimizeCommand = defineCommand({
  meta: {
    name: 'optimize',
    description: 'Optimize screenshots or UI images for Vision LLM token grids (OpenAI, Anthropic, Gemini, Local)'
  },
  args: {
    input: {
      type: 'positional',
      required: true,
      description: 'Image file or directory of images to optimize'
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output file or directory path for optimized WebP image(s)'
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
    quality: {
      type: 'string',
      alias: 'q',
      default: '80',
      description: 'WebP compression quality (default: 80)'
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'Output JSON statistics to stdout'
    }
  },
  async run({ args }) {
    const provider = TargetProviderSchema.parse(args.provider);
    await runOptimizeCommand({
      input: args.input,
      output: args.output,
      provider,
      lowTokenMode: args.lowTokenMode,
      quality: parseInt(args.quality, 10) || 80,
      json: args.json
    });
  }
});
