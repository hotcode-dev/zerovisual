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
export interface ProviderSpec {
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
