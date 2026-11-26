import { describe, it, expect } from 'vitest';
import { HEX_COLOR_RE, extractColorsFromCssValue, parseColor } from '../../src/core/color.js';
import { parseDesignMd } from '../../src/core/design-md-parser.js';

describe('HEX_COLOR_RE (shared hex token regex)', () => {
  it('is the single shared source for hex tokens', () => {
    // Pins the exact pattern so a future copy in another file would fail here.
    expect(HEX_COLOR_RE.source).toBe('#[0-9a-fA-F]{3,8}\\b');
    expect(HEX_COLOR_RE.global).toBe(true);
  });

  it('matches 3-4, 6, and 8 digit hex tokens (upper and lower case)', () => {
    expect('#abc'.match(HEX_COLOR_RE)).toEqual(['#abc']);
    expect('#abcd'.match(HEX_COLOR_RE)).toEqual(['#abcd']);
    expect('#aabbcc'.match(HEX_COLOR_RE)).toEqual(['#aabbcc']);
    expect('#aabbccdd'.match(HEX_COLOR_RE)).toEqual(['#aabbccdd']);
    expect('#ABCDEF'.match(HEX_COLOR_RE)).toEqual(['#ABCDEF']);
  });

  it('rejects too-short, too-long, and non-hex candidates', () => {
    expect('#12'.match(HEX_COLOR_RE)).toBeNull();
    // 9 hex digits: \b fails at every backtrack position, so nothing matches.
    expect('#123456789'.match(HEX_COLOR_RE)).toBeNull();
    expect('#12g456'.match(HEX_COLOR_RE)).toBeNull();
    // \b after the hex run must hold: embedded letters defeat the boundary.
    expect('x#abc123y'.match(HEX_COLOR_RE)).toBeNull();
  });

  it('finds multiple tokens in one string', () => {
    expect('#ff0000 #00ff00'.match(HEX_COLOR_RE)).toEqual(['#ff0000', '#00ff00']);
    expect('border:#123456;'.match(HEX_COLOR_RE)).toEqual(['#123456']);
    expect('color:#ff0000;'.match(HEX_COLOR_RE)).toEqual(['#ff0000']);
  });

  it('stays safe under repeated String.match with the shared /g object', () => {
    const cssVal = 'linear-gradient(90deg, #8b5cf6, #ec4899)';
    const first = cssVal.match(HEX_COLOR_RE) ?? [];
    const second = cssVal.match(HEX_COLOR_RE) ?? [];
    expect(first).toEqual(['#8b5cf6', '#ec4899']);
    expect(second).toEqual(first);
    expect(HEX_COLOR_RE.lastIndex).toBe(0);
  });
});

describe('extractColorsFromCssValue (hex branch via shared regex)', () => {
  it('extracts mixed hex/rgba/hsla/oklch/oklab tokens', () => {
    const colors = extractColorsFromCssValue(
      'linear-gradient(135deg, #111827 0%, rgba(59, 130, 246, 0.3) 50%, hsla(280, 60%, 50%, 0.5))'
    );
    expect(colors).toHaveLength(3);
    expect(colors[0]).toEqual({ r: 0x11, g: 0x18, b: 0x27, a: 1 });
  });

  it('returns [] for none/empty and is repeat-safe on the same input', () => {
    expect(extractColorsFromCssValue('none')).toEqual([]);
    expect(extractColorsFromCssValue('')).toEqual([]);
    const val = '#2563eb, rgba(9, 13, 22, 0.4)';
    expect(extractColorsFromCssValue(val)).toEqual(extractColorsFromCssValue(val));
  });
});

describe('parseDesignMd (hex branch via shared regex)', () => {
  it('extracts hex colors from markdown and dedupes by RGB', () => {
    const spec = parseDesignMd(
      '# Design System\nPrimary: `#8b5cf6` (Electric Violet)\nSecondary: `#8b5cf6`\nSurface: `#090d16`'
    );
    expect(spec.colors).toHaveLength(2);
    const primary = spec.colors.find(c => c.raw === '#8b5cf6');
    expect(primary?.rgb).toEqual(parseColor('#8b5cf6'));
    expect(primary?.rgb).toMatchObject({ r: 0x8b, g: 0x5c, b: 0xf6 });
  });

  it('matches the CSS-extractor output for the same hex tokens', () => {
    const md = parseDesignMd('Colors: `#ff6600` and `#00ccff`');
    const css = extractColorsFromCssValue('a #ff6600 b #00ccff c');
    expect(md.colors.map(c => c.rgb)).toEqual(css);
  });
});
