export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Converts HSL to sRGB.
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

/**
 * Converts OKLab to sRGB.
 */
export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767434036 * l - 3.3077115913 * m + 0.2309699291 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toSrgb = (c: number): number => {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  return [Math.round(toSrgb(rLin) * 255), Math.round(toSrgb(gLin) * 255), Math.round(toSrgb(bLin) * 255)];
}

/**
 * Converts OKLCH to sRGB.
 */
export function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  return oklabToRgb(L, a, b);
}

/**
 * Parses CSS color strings (#hex, rgb/rgba, hsl/hsla, oklch, oklab, named) to RGBA.
 */
export function parseColor(colorStr: string): RgbColor {
  const str = colorStr.trim().toLowerCase();

  if (str === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (str === 'white') {
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  if (str === 'black') {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  // Hex format: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      const a = hex.length === 4 ? parseInt(hex[3]! + hex[3]!, 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgb(...) or rgba(...) format (handles comma or space-separated syntax)
  const rgbMatch = str.match(/^rgba?\s*\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10);
    const g = parseInt(rgbMatch[2]!, 10);
    const b = parseInt(rgbMatch[3]!, 10);
    let a = 1;
    if (rgbMatch[4] !== undefined) {
      a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4]);
    }
    return { r, g, b, a };
  }

  // hsl(...) or hsla(...) format
  const hslMatch = str.match(
    /^hsla?\s*\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]!);
    const s = parseFloat(hslMatch[2]!) / 100;
    const l = parseFloat(hslMatch[3]!) / 100;
    let a = 1;
    if (hslMatch[4] !== undefined) {
      a = hslMatch[4].endsWith('%') ? parseFloat(hslMatch[4]) / 100 : parseFloat(hslMatch[4]);
    }
    const [r, g, b] = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  // oklch(...) format: oklch(L C H [/ a])
  const oklchMatch = str.match(
    /^oklch\s*\(\s*([\d.]+%?)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:deg)?(?:[\s,/]+([\d.]+%?))?\s*\)$/
  );
  if (oklchMatch) {
    let L = parseFloat(oklchMatch[1]!);
    if (oklchMatch[1]!.endsWith('%')) L /= 100;
    const C = parseFloat(oklchMatch[2]!);
    const H = parseFloat(oklchMatch[3]!);
    let a = 1;
    if (oklchMatch[4] !== undefined) {
      a = oklchMatch[4].endsWith('%') ? parseFloat(oklchMatch[4]) / 100 : parseFloat(oklchMatch[4]);
    }
    const [r, g, b] = oklchToRgb(L, C, H);
    return { r, g, b, a };
  }

  // oklab(...) format: oklab(L a b [/ alpha])
  const oklabMatch = str.match(/^oklab\s*\(\s*([\d.]+%?)[\s,]+([-\d.]+)[\s,]+([-\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (oklabMatch) {
    let L = parseFloat(oklabMatch[1]!);
    if (oklabMatch[1]!.endsWith('%')) L /= 100;
    const aVal = parseFloat(oklabMatch[2]!);
    const bVal = parseFloat(oklabMatch[3]!);
    let a = 1;
    if (oklabMatch[4] !== undefined) {
      a = oklabMatch[4].endsWith('%') ? parseFloat(oklabMatch[4]) / 100 : parseFloat(oklabMatch[4]);
    }
    const [r, g, b] = oklabToRgb(L, aVal, bVal);
    return { r, g, b, a };
  }

  // Fallback to black
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Matches 3-8 digit hex color tokens (#abc, #aabbcc, #aabbccdd, …).
 * Shared by every CSS/markdown color-token extractor (String.match with /g
 * always restarts at index 0, so one shared regex object is safe).
 */
export const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

/**
 * Extracts all color tokens from a CSS value string (e.g. gradients or box-shadows).
 */
export function extractColorsFromCssValue(cssVal: string): RgbColor[] {
  if (!cssVal || cssVal === 'none') return [];
  const matches = [
    ...(cssVal.match(HEX_COLOR_RE) ?? []),
    ...(cssVal.match(/rgba?\([^)]+\)/gi) ?? []),
    ...(cssVal.match(/hsla?\([^)]+\)/gi) ?? []),
    ...(cssVal.match(/oklch\([^)]+\)/gi) ?? []),
    ...(cssVal.match(/oklab\([^)]+\)/gi) ?? [])
  ];
  return matches.map(m => parseColor(m));
}

/**
 * Composites foreground with alpha over a background color (defaulting to white).
 */
export function compositeColors(fg: RgbColor, bg: RgbColor = { r: 255, g: 255, b: 255, a: 1 }): RgbColor {
  const fgAlpha = fg.a ?? 1;
  if (fgAlpha >= 1) return fg;
  if (fgAlpha <= 0) return bg;

  const bgAlpha = bg.a ?? 1;
  const outAlpha = fgAlpha + bgAlpha * (1 - fgAlpha);

  const r = Math.round((fg.r * fgAlpha + bg.r * bgAlpha * (1 - fgAlpha)) / outAlpha);
  const g = Math.round((fg.g * fgAlpha + bg.g * bgAlpha * (1 - fgAlpha)) / outAlpha);
  const b = Math.round((fg.b * fgAlpha + bg.b * bgAlpha * (1 - fgAlpha)) / outAlpha);

  return { r, g, b, a: outAlpha };
}

/**
 * Calculates relative luminance for an sRGB color per WCAG 2.1 specs.
 */
export function calculateRelativeLuminance(color: RgbColor): number {
  const normalize = (val: number): number => {
    const c = val / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const R = normalize(color.r);
  const G = normalize(color.g);
  const B = normalize(color.b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates contrast ratio between two colors per WCAG 2.1 specs (range 1:1 to 21:1).
 */
export function calculateContrastRatio(fg: RgbColor, bg: RgbColor): number {
  const effectiveFg = compositeColors(fg, bg);
  const l1 = calculateRelativeLuminance(effectiveFg);
  const l2 = calculateRelativeLuminance(bg);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}
