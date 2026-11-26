import fs from 'node:fs';
import path from 'node:path';
import type { DesignMdDelta } from './schema.js';
import { parseColor, type RgbColor } from './color.js';

export interface DesignMdSpec {
  fonts: string[];
  colors: Array<{ raw: string; rgb: RgbColor }>;
  radiiPx: number[];
  fontSizesPx: number[];
  allowsVioletPalette: boolean;
  allowsHardOffsetShadow: boolean;
}

export interface ImpeccableProjectConfig {
  ignoreRules: string[];
  designSystemEnabled: boolean;
}

/**
 * Converts RGB (0-255) to HSL (h: 0-360, s: 0-1, l: 0-1).
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r1) {
    h = (g1 - b1) / d + (g1 < b1 ? 6 : 0);
  } else if (max === g1) {
    h = (b1 - r1) / d + 2;
  } else {
    h = (r1 - g1) / d + 4;
  }
  h *= 60;
  return [h, s, l];
}

const GENERIC_FONT_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  '-apple-system',
  'blinkmacsystemfont',
  'inherit',
  'initial',
  'unset'
]);

/**
 * Parses a DESIGN.md document (used by Impeccable) into structured design tokens
 * for deterministic rendered DOM drift checking and AI-slop exemption ("the brief wins").
 */
export function parseDesignMd(markdownContent: string): DesignMdSpec {
  const fonts = new Set<string>();
  const colors: Array<{ raw: string; rgb: RgbColor }> = [];
  const seenColorKeys = new Set<string>();
  const radiiPx = new Set<number>();
  const fontSizesPx = new Set<number>();

  // 1. Extract hex, rgb/rgba, hsl/hsla, oklch/oklab colors
  const colorMatches = [
    ...(markdownContent.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
    ...(markdownContent.match(/rgba?\(\s*\d+[\s,]+\d+[\s,]+\d+(?:[\s,/]+[\d.]+%?)?\s*\)/gi) ?? []),
    ...(markdownContent.match(/hsla?\(\s*[\d.]+(?:deg)?[\s,]+[\d.]+%[\s,]+[\d.]+%(?:[\s,/]+[\d.]+%?)?\s*\)/gi) ?? []),
    ...(markdownContent.match(/oklch\(\s*[\d.]+%?[\s,]+[\d.]+[\s,]+[\d.]+(?:deg)?(?:[\s,/]+[\d.]+%?)?\s*\)/gi) ?? []),
    ...(markdownContent.match(/oklab\(\s*[\d.]+%?[\s,]+[-\d.]+[\s,]+[-\d.]+(?:[\s,/]+[\d.]+%?)?\s*\)/gi) ?? [])
  ];

  for (const raw of colorMatches) {
    const rgb = parseColor(raw);
    const key = `${rgb.r},${rgb.g},${rgb.b}`;
    if (!seenColorKeys.has(key)) {
      seenColorKeys.add(key);
      colors.push({ raw, rgb });
    }
  }

  // 2. Extract font families from explicit font declarations or Typography sections
  const fontPatterns = [
    /(?:font(?:-family)?|typeface|heading(?:\s+font)?|body(?:\s+font)?|mono(?:space)?(?:\s+font)?|display(?:\s+font)?)\s*[:=-]\s*[`'"]?([A-Za-z0-9\s_-]+?)[`'"]?(?:[,|\n\r)]|$)/gi,
    /--font-[a-z0-9-]+\s*:\s*['"]?([A-Za-z0-9\s_-]+?)['"]?(?:[,;|\n\r]|$)/gi
  ];

  for (const regex of fontPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(markdownContent)) !== null) {
      const candidate = (match[1] ?? '').trim().replace(/^['"`]+|['"`]+$/g, '');
      if (
        candidate.length >= 2 &&
        candidate.length <= 40 &&
        !GENERIC_FONT_FAMILIES.has(candidate.toLowerCase()) &&
        !/^\d/.test(candidate)
      ) {
        fonts.add(candidate);
      }
    }
  }

  // Also scan lines inside a Typography section for backticked or bold font names
  const typoSectionMatch = markdownContent.match(
    /#{1,4}\s*(?:Typography|Type\s+System|Fonts?)[\s\S]*?(?=\n#{1,3}\s|$)/i
  );
  if (typoSectionMatch) {
    const section = typoSectionMatch[0];
    const tokenMatches = section.matchAll(/(?:`([^`]+)`|\*\*([^*]+)\*\*)/g);
    for (const m of tokenMatches) {
      const token =
        (m[1] || m[2] || '')
          .trim()
          .split(',')[0]
          ?.trim()
          .replace(/^['"]+|['"]+$/g, '') ?? '';
      if (
        token &&
        /^[A-Z][A-Za-z0-9\s-]{1,32}$/.test(token) &&
        !GENERIC_FONT_FAMILIES.has(token.toLowerCase()) &&
        !/^(Heading|Body|Display|Mono|Scale|Size|Weight|Line|Tracking|Ratio|Font|Primary|Secondary)\b/i.test(token)
      ) {
        fonts.add(token);
      }
    }
  }

  // 3. Extract border-radius tokens (from radius lines or Radius section)
  const lines = markdownContent.split(/\r?\n/);
  let inRadiusSection = false;
  let inTypoSection = false;

  for (const line of lines) {
    if (/^#{1,4}\s/i.test(line)) {
      inRadiusSection = /radius|radii|corner|shape|rounding/i.test(line);
      inTypoSection = /typography|type|font|scale/i.test(line);
    }

    const isRadiusLine = inRadiusSection || /radius|rounded|corner/i.test(line);
    const isFontSizeLine = inTypoSection || /font-size|type\s+scale|size\s+ramp|text-/i.test(line);

    if (isRadiusLine) {
      for (const pxMatch of line.matchAll(/\b(\d+(?:\.\d+)?)px\b/gi)) {
        const val = Math.round(parseFloat(pxMatch[1]!));
        if (val >= 0 && val <= 9999) radiiPx.add(val);
      }
      for (const remMatch of line.matchAll(/\b(\d+(?:\.\d+)?)rem\b/gi)) {
        const val = Math.round(parseFloat(remMatch[1]!) * 16);
        if (val >= 0 && val <= 9999) radiiPx.add(val);
      }
    }

    if (isFontSizeLine && !/radius|border|padding|margin|gap/i.test(line)) {
      for (const pxMatch of line.matchAll(/\b(\d+(?:\.\d+)?)px\b/gi)) {
        const val = Math.round(parseFloat(pxMatch[1]!));
        if (val >= 8 && val <= 160) fontSizesPx.add(val);
      }
      for (const remMatch of line.matchAll(/\b(\d+(?:\.\d+)?)rem\b/gi)) {
        const val = Math.round(parseFloat(remMatch[1]!) * 16);
        if (val >= 8 && val <= 160) fontSizesPx.add(val);
      }
    }
  }

  // 4. Determine whether DESIGN.md intentionally commits to a violet/purple palette or hard-offset shadow
  let allowsVioletPalette = /violet|purple|indigo|lavender/i.test(markdownContent);
  for (const c of colors) {
    const [h, s, l] = rgbToHsl(c.rgb.r, c.rgb.g, c.rgb.b);
    if (h >= 250 && h <= 315 && s >= 0.25 && l >= 0.15 && l <= 0.85) {
      allowsVioletPalette = true;
      break;
    }
  }

  const allowsHardOffsetShadow = /neobrutalis|brutalis|hard[- ]offset|(?:\d+px\s+\d+px\s+0(?:px)?\b)/i.test(
    markdownContent
  );

  return {
    fonts: Array.from(fonts),
    colors,
    radiiPx: Array.from(radiiPx).sort((a, b) => a - b),
    fontSizesPx: Array.from(fontSizesPx).sort((a, b) => a - b),
    allowsVioletPalette,
    allowsHardOffsetShadow
  };
}

/**
 * Auto-discovers DESIGN.md in the project directory (or uses an explicit path).
 */
export function loadDesignMdFromWorkspace(cwd = process.cwd(), explicitPath?: string): DesignMdSpec | undefined {
  const candidates = explicitPath
    ? [path.resolve(cwd, explicitPath)]
    : [path.resolve(cwd, 'DESIGN.md'), path.resolve(cwd, '.impeccable/DESIGN.md'), path.resolve(cwd, 'docs/DESIGN.md')];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return parseDesignMd(content);
      } catch {
        // Ignore read error
      }
    }
  }
  return undefined;
}

/**
 * Loads .impeccable/config.json and .impeccable/config.local.json detector ignore settings.
 */
export function loadImpeccableConfig(cwd = process.cwd()): ImpeccableProjectConfig {
  const configFiles = [
    path.resolve(cwd, '.impeccable/config.json'),
    path.resolve(cwd, '.impeccable/config.local.json')
  ];

  const ignoreRules = new Set<string>();
  let designSystemEnabled = true;

  for (const file of configFiles) {
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const detector = parsed?.detector ?? parsed ?? {};
      if (Array.isArray(detector.ignoreRules)) {
        for (const r of detector.ignoreRules) ignoreRules.add(String(r));
      }
      if (typeof detector?.designSystem?.enabled === 'boolean') {
        designSystemEnabled = detector.designSystem.enabled;
      }
    } catch {
      // Ignore malformed config
    }
  }

  return {
    ignoreRules: Array.from(ignoreRules),
    designSystemEnabled
  };
}

function colorDistance(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Compares live DOM computed styles against a parsed DESIGN.md specification.
 */
export function diffDesignMdAgainstDom(
  designMd: DesignMdSpec,
  domComputedStyles: Record<string, Record<string, string>>
): DesignMdDelta[] {
  const deltas: DesignMdDelta[] = [];

  for (const [selector, styles] of Object.entries(domComputedStyles)) {
    if (!styles) continue;

    // 1. Font family check
    if (designMd.fonts.length > 0 && styles.fontFamily) {
      const usedFamilies = styles.fontFamily
        .split(',')
        .map(f => f.trim().replace(/^['"]+|['"]+$/g, ''))
        .filter(f => f && !GENERIC_FONT_FAMILIES.has(f.toLowerCase()));

      if (usedFamilies.length > 0) {
        const primaryFont = usedFamilies[0]!;
        const matchesDeclared = designMd.fonts.some(
          declared =>
            declared.toLowerCase() === primaryFont.toLowerCase() ||
            primaryFont.toLowerCase().includes(declared.toLowerCase()) ||
            declared.toLowerCase().includes(primaryFont.toLowerCase())
        );

        if (!matchesDeclared) {
          deltas.push({
            selector,
            property: 'fontFamily',
            expectedDesignMd: designMd.fonts.join(' | '),
            actualDom: primaryFont
          });
        }
      }
    }

    // 2. Color palette check (foreground and background)
    if (designMd.colors.length > 0) {
      for (const prop of ['color', 'backgroundColor'] as const) {
        const rawColor = styles[prop];
        if (!rawColor || rawColor === 'transparent' || rawColor === 'rgba(0, 0, 0, 0)') continue;
        const parsed = parseColor(rawColor);
        if ((parsed.a ?? 1) === 0) continue;

        // Allow pure black/white neutrals unless strict
        const isPureNeutral =
          (parsed.r === 255 && parsed.g === 255 && parsed.b === 255) ||
          (parsed.r === 0 && parsed.g === 0 && parsed.b === 0);
        if (isPureNeutral) continue;

        const matchesColor = designMd.colors.some(c => colorDistance(c.rgb, parsed) <= 22);
        if (!matchesColor) {
          deltas.push({
            selector,
            property: prop,
            expectedDesignMd: designMd.colors
              .map(c => c.raw)
              .slice(0, 8)
              .join(', '),
            actualDom: rawColor
          });
        }
      }
    }

    // 3. Border radius check
    if (designMd.radiiPx.length > 0 && styles.borderRadius) {
      const radiusPx = Math.round(parseFloat(styles.borderRadius) || 0);
      if (radiusPx > 0 && radiusPx < 999) {
        const matchesRadius = designMd.radiiPx.some(r => Math.abs(r - radiusPx) <= 2);
        if (!matchesRadius) {
          deltas.push({
            selector,
            property: 'borderRadius',
            expectedDesignMd: designMd.radiiPx.map(r => `${r}px`).join(' | '),
            actualDom: `${radiusPx}px`
          });
        }
      }
    }

    // 4. Font size ramp check
    if (designMd.fontSizesPx.length > 0 && styles.fontSize) {
      const fontSizePx = Math.round(parseFloat(styles.fontSize) || 0);
      if (fontSizePx > 0) {
        const matchesSize = designMd.fontSizesPx.some(s => Math.abs(s - fontSizePx) <= 1);
        if (!matchesSize) {
          deltas.push({
            selector,
            property: 'fontSize',
            expectedDesignMd: designMd.fontSizesPx.map(s => `${s}px`).join(' | '),
            actualDom: `${fontSizePx}px`
          });
        }
      }
    }
  }

  return deltas;
}
