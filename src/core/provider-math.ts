import type { TargetProvider, TileDimensions } from './schema.js';

// Re-exported so browser consumers (the docs-site calculator) can pull the
// provider type from this one dependency-free module without reaching into
// schema.js themselves.
export type { TargetProvider, TileDimensions };

/**
 * Pure per-provider tile/patch math, extracted from image-optimizer.ts so the
 * docs-site calculator can reuse the exact same numbers without importing the
 * sharp-backed optimizer. This module is intentionally dependency-free (no
 * sharp/fs/path — only type-only imports from schema.js), so it is
 * browser-safe.
 *
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
 * Shared default provider for the public tile/token APIs
 * (`getProviderDimensions` and `estimateVisionTokens`).
 */
export const DEFAULT_TARGET_PROVIDER: TargetProvider = 'anthropic';

/**
 * Returns model-aware maximum bounding-box tile dimensions.
 * Defaults to `DEFAULT_TARGET_PROVIDER` ('anthropic') when no provider is given.
 */
export function getProviderDimensions(
  provider: TargetProvider = DEFAULT_TARGET_PROVIDER,
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
 * Shrinks an image into the provider tile's bounding box (no enlargement),
 * matching the `fit: 'inside', withoutEnlargement` behavior sharp applies in
 * optimizeImageForProvider.
 */
export function fitToTile(width: number, height: number, tileDims: TileDimensions): { width: number; height: number } {
  const scale = Math.min(1, tileDims.maxWidth / width, tileDims.maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/**
 * Calculates estimated Vision LLM token consumption for a given pixel resolution.
 * Defaults to `DEFAULT_TARGET_PROVIDER` ('anthropic') when no provider is given.
 */
export function estimateVisionTokens(
  width: number,
  height: number,
  provider: TargetProvider = DEFAULT_TARGET_PROVIDER,
  lowTokenMode = false
): number {
  if (width <= 0 || height <= 0) return 0;

  const spec = PROVIDER_SPECS[provider];
  const patchSize = lowTokenMode && spec.lowTokenTileWidth != null ? spec.lowTokenTileWidth : spec.patchSize;
  const tilesW = Math.ceil(width / patchSize);
  const tilesH = Math.ceil(height / patchSize);
  return (spec.baseTokens ?? 0) + tilesW * tilesH * spec.tokensPerPatch;
}

/**
 * Percentage reduction from `before` to `after`, rounded to one decimal and
 * clamped at 0 (e.g. before=100, after=42.5 -> 57.5). Returns 0 when `before`
 * is not positive.
 */
export function percentSavings(before: number, after: number): number {
  return before > 0 ? Math.max(0, Number((((before - after) / before) * 100).toFixed(1))) : 0;
}

/**
 * One-decimal display string for the percent savings from `before` to `after`
 * (e.g. "57.5"). Returns the `zero` fallback string when `before` is not
 * positive. `percentSavings` already clamps at 0, so the default `'0.0'` is
 * byte-identical to the legacy unguarded `percentSavings(b, a).toFixed(1)`
 * spelling; pass `'0'` to preserve legacy guarded call sites spelled that way.
 */
export function savingsPct(before: number, after: number, zero = '0.0'): string {
  return before > 0 ? percentSavings(before, after).toFixed(1) : zero;
}
