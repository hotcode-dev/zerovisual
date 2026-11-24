import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { TargetProvider, TileDimensions, BoundingBox } from './schema.js';

export interface DiffDetectionResult {
  boundingBox: BoundingBox;
  diffPixelCount: number;
  totalPixels: number;
  diffPixelRatio: number;
}

export interface DetectDiffOptions {
  padding?: number;
  diffPixelMatcher?: (r: number, g: number, b: number, a: number) => boolean;
}

export interface OptimizeImageOptions {
  provider?: TargetProvider;
  lowTokenMode?: boolean;
  customDimensions?: TileDimensions;
  cropBox?: BoundingBox;
  quality?: number;
}

export interface OptimizedImageResult {
  dataUri: string;
  buffer: Buffer;
  width: number;
  height: number;
  format: 'webp';
  provider: TargetProvider;
  tileDimensions: TileDimensions;
}

/**
 * Single source of truth for per-provider tile/patch sizes and token costs.
 * tileWidth/tileHeight drive getProviderDimensions; patchSize/tokensPerPatch
 * (plus baseTokens) drive estimateVisionTokens. Providers that shrink their
 * tiles in lowTokenMode set lowTokenTileWidth/lowTokenTileHeight.
 */
interface ProviderSpec {
  tileWidth: number;
  tileHeight: number;
  lowTokenTileWidth?: number;
  lowTokenTileHeight?: number;
  patchSize: number;
  tokensPerPatch: number;
  baseTokens?: number;
}

export const PROVIDER_SPECS: Record<TargetProvider, ProviderSpec> = {
  openai: { tileWidth: 512, tileHeight: 512, patchSize: 512, tokensPerPatch: 170, baseTokens: 85 },
  anthropic: { tileWidth: 504, tileHeight: 504, patchSize: 28, tokensPerPatch: 1 },
  qwen: { tileWidth: 504, tileHeight: 504, patchSize: 28, tokensPerPatch: 1 },
  gemini: {
    tileWidth: 768,
    tileHeight: 768,
    lowTokenTileWidth: 384,
    lowTokenTileHeight: 384,
    patchSize: 768,
    tokensPerPatch: 258
  },
  gemma: {
    tileWidth: 768,
    tileHeight: 768,
    lowTokenTileWidth: 384,
    lowTokenTileHeight: 384,
    patchSize: 768,
    tokensPerPatch: 258
  },
  llama: { tileWidth: 560, tileHeight: 560, patchSize: 560, tokensPerPatch: 324 },
  mistral: { tileWidth: 512, tileHeight: 512, patchSize: 16, tokensPerPatch: 1 },
  deepseek: { tileWidth: 384, tileHeight: 384, patchSize: 384, tokensPerPatch: 576 },
  local: { tileWidth: 448, tileHeight: 448, patchSize: 28, tokensPerPatch: 1 }
};

/**
 * Returns model-aware maximum bounding-box tile dimensions.
 */
export function getProviderDimensions(
  provider: TargetProvider = 'openai',
  lowTokenMode = false,
  custom?: TileDimensions
): TileDimensions {
  const spec = PROVIDER_SPECS[provider];
  if (provider === 'local') {
    return custom ?? { maxWidth: spec.tileWidth, maxHeight: spec.tileHeight };
  }
  if (lowTokenMode && spec.lowTokenTileWidth != null) {
    return { maxWidth: spec.lowTokenTileWidth, maxHeight: spec.lowTokenTileHeight! };
  }
  return { maxWidth: spec.tileWidth, maxHeight: spec.tileHeight };
}

/**
 * Default pixel matcher for Playwright / pixelmatch diff images.
 * Detects red diff markers, magenta/rose markers, and high-saturation difference pixels.
 */
export function defaultDiffPixelMatcher(r: number, g: number, b: number, a: number): boolean {
  if (a === 0) return false;
  // Standard red diff (e.g. pixelmatch red or #f43f5e)
  const isRedDiff = r >= 190 && g <= 100 && b <= 120;
  // Standard magenta / pink / rose diff (e.g. Playwright magenta #ff00ff, #ff007f, #e11d48)
  const isMagentaDiff = r >= 190 && g <= 100 && b >= 100;
  // General high-saturation red-dominant diff
  const isHighSatRed = r >= 180 && r - g >= 80 && r - b >= 60;
  return isRedDiff || isMagentaDiff || isHighSatRed;
}

/**
 * Scans a diff image buffer using sharp raw pixel channels,
 * detecting the bounding box of differing pixels and applying clamped padding.
 */
export async function detectDiffBoundingBox(
  imageInput: Buffer | string,
  options: DetectDiffOptions | number = {}
): Promise<DiffDetectionResult> {
  const opts: DetectDiffOptions = typeof options === 'number' ? { padding: options } : options;
  const padding = opts.padding ?? 32;
  const matcher = opts.diffPixelMatcher ?? defaultDiffPixelMatcher;

  const image = sharp(imageInput);
  const metadata = await image.metadata();

  const imgWidth = metadata.width ?? 0;
  const imgHeight = metadata.height ?? 0;

  if (imgWidth === 0 || imgHeight === 0) {
    return {
      boundingBox: { x: 0, y: 0, width: 1, height: 1 },
      diffPixelCount: 0,
      totalPixels: 0,
      diffPixelRatio: 0
    };
  }

  // Ensure raw RGBA channel extraction
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  let minX = imgWidth;
  let minY = imgHeight;
  let maxX = -1;
  let maxY = -1;
  let diffPixelCount = 0;
  const totalPixels = imgWidth * imgHeight;

  for (let y = 0; y < imgHeight; y++) {
    const rowOffset = y * imgWidth * channels;
    for (let x = 0; x < imgWidth; x++) {
      const idx = rowOffset + x * channels;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      const a = data[idx + 3]!;

      if (matcher(r, g, b, a)) {
        diffPixelCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If no diff pixels were identified by matcher, check if there's any non-grayscale variation
  // or fallback to full image
  if (diffPixelCount === 0) {
    return {
      boundingBox: { x: 0, y: 0, width: imgWidth, height: imgHeight },
      diffPixelCount: 0,
      totalPixels,
      diffPixelRatio: 0
    };
  }

  const clampedX = Math.max(0, minX - padding);
  const clampedY = Math.max(0, minY - padding);
  const clampedWidth = Math.min(imgWidth, maxX + padding + 1) - clampedX;
  const clampedHeight = Math.min(imgHeight, maxY + padding + 1) - clampedY;

  return {
    boundingBox: {
      x: Math.round(clampedX),
      y: Math.round(clampedY),
      width: Math.max(1, Math.round(clampedWidth)),
      height: Math.max(1, Math.round(clampedHeight))
    },
    diffPixelCount,
    totalPixels,
    diffPixelRatio: Math.min(1, Number((diffPixelCount / totalPixels).toFixed(6)))
  };
}

/**
 * Crops (if cropBox provided), downscales with model-tile math,
 * and encodes to WebP Base64 data URI.
 */
export async function optimizeImageForProvider(
  imageInput: Buffer | string,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  const provider = options.provider ?? 'openai';
  const tileDims = getProviderDimensions(provider, options.lowTokenMode, options.customDimensions);
  const quality = options.quality ?? 80;

  let pipeline = sharp(imageInput);
  const metadata = await pipeline.metadata();
  const origWidth = metadata.width ?? 1;
  const origHeight = metadata.height ?? 1;

  if (options.cropBox) {
    const box = options.cropBox;
    // Clamp crop region strictly inside source image boundaries
    const left = Math.max(0, Math.min(box.x, origWidth - 1));
    const top = Math.max(0, Math.min(box.y, origHeight - 1));
    const width = Math.max(1, Math.min(box.width, origWidth - left));
    const height = Math.max(1, Math.min(box.height, origHeight - top));

    pipeline = pipeline.extract({ left, top, width, height });
  }

  pipeline = pipeline.resize({
    width: tileDims.maxWidth,
    height: tileDims.maxHeight,
    fit: 'inside',
    withoutEnlargement: true
  });

  pipeline = pipeline.webp({ quality });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const dataUri = `data:image/webp;base64,${data.toString('base64')}`;

  return {
    dataUri,
    buffer: data,
    width: info.width,
    height: info.height,
    format: 'webp',
    provider,
    tileDimensions: tileDims
  };
}

export interface CompanionImageOptions extends OptimizeImageOptions {
  artifactsDir: string;
  /** The `${testId}-${safeProject}` prefix used to name the artifact. */
  baseName: string;
  suffix: 'actual' | 'expected';
}

/**
 * Shared companion-image (actual/expected) pipeline: optimizes the source
 * buffer and writes the WebP artifact to `${baseName}-${suffix}.webp`
 * under `artifactsDir`.
 */
export async function optimizeAndWriteCompanionImage(
  source: Buffer,
  opts: CompanionImageOptions
): Promise<{ dataUri: string; imagePath: string }> {
  const optimized = await optimizeImageForProvider(source, opts);
  const imagePath = path.join(opts.artifactsDir, `${opts.baseName}-${opts.suffix}.webp`);
  fs.writeFileSync(imagePath, optimized.buffer);
  return { dataUri: optimized.dataUri, imagePath };
}

/**
 * Calculates estimated Vision LLM token consumption for a given pixel resolution.
 */
export function estimateVisionTokens(
  width: number,
  height: number,
  provider: TargetProvider = 'anthropic',
  lowTokenMode = false
): number {
  if (width <= 0 || height <= 0) return 0;

  const spec = PROVIDER_SPECS[provider];
  const patchSize = lowTokenMode && spec.lowTokenTileWidth != null ? spec.lowTokenTileWidth : spec.patchSize;
  const tilesW = Math.ceil(width / patchSize);
  const tilesH = Math.ceil(height / patchSize);
  return (spec.baseTokens ?? 0) + tilesW * tilesH * spec.tokensPerPatch;
}

export interface ImageOptimizationStats {
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  originalTokens: number;
  optimizedWidth: number;
  optimizedHeight: number;
  optimizedBytes: number;
  optimizedTokens: number;
  tokenSavingsPercent: number;
  byteSavingsPercent: number;
}

/**
 * Standalone optimizer for arbitrary screenshots or UI images,
 * returning the optimized WebP buffer alongside token and byte efficiency stats.
 */
export async function optimizeImageStandalone(
  imageInput: Buffer | string,
  options: OptimizeImageOptions = {}
): Promise<{
  result: OptimizedImageResult;
  stats: ImageOptimizationStats;
}> {
  const provider = options.provider ?? 'anthropic';
  const lowTokenMode = options.lowTokenMode ?? false;

  const metadata = await sharp(imageInput).metadata();
  const origWidth = metadata.width ?? 1;
  const origHeight = metadata.height ?? 1;
  const origBytes = metadata.size ?? (Buffer.isBuffer(imageInput) ? imageInput.length : 0);

  const result = await optimizeImageForProvider(imageInput, options);

  const origTokens = estimateVisionTokens(origWidth, origHeight, provider, lowTokenMode);
  const optTokens = estimateVisionTokens(result.width, result.height, provider, lowTokenMode);

  const tokenSavingsPercent =
    origTokens > 0 ? Math.max(0, Number((((origTokens - optTokens) / origTokens) * 100).toFixed(1))) : 0;

  const byteSavingsPercent =
    origBytes > 0 ? Math.max(0, Number((((origBytes - result.buffer.length) / origBytes) * 100).toFixed(1))) : 0;

  return {
    result,
    stats: {
      originalWidth: origWidth,
      originalHeight: origHeight,
      originalBytes: origBytes,
      originalTokens: origTokens,
      optimizedWidth: result.width,
      optimizedHeight: result.height,
      optimizedBytes: result.buffer.length,
      optimizedTokens: optTokens,
      tokenSavingsPercent,
      byteSavingsPercent
    }
  };
}
