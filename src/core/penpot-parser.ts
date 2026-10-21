import { XMLParser } from 'fast-xml-parser';
import type { PenpotDelta } from './schema.js';
import { parseColor } from './heuristic-linter.js';

export interface PenpotNodeToken {
  id?: string;
  selector: string;
  tagName?: string;
  properties: Record<string, string>;
}

/**
 * Normalizes CSS property names to camelCase.
 */
function normalizePropName(prop: string): string {
  const map: Record<string, string> = {
    'background-color': 'backgroundColor',
    'border-radius': 'borderRadius',
    'font-size': 'fontSize',
    'font-weight': 'fontWeight',
    'line-height': 'lineHeight',
    'box-shadow': 'boxShadow',
    fill: 'backgroundColor'
  };
  return map[prop.toLowerCase()] ?? prop;
}

/**
 * Normalizes CSS property values for deterministic comparison.
 */
function normalizePropValue(prop: string, val: string): string {
  if (!val) return '';
  const trimmed = val.trim().toLowerCase();

  // Color normalization: if prop is a color, compare as rgb string
  if (prop === 'backgroundColor' || prop === 'color' || prop === 'fill' || prop === 'stroke') {
    const c = parseColor(trimmed);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  // Dimension normalization: append px if purely numeric
  if (['fontSize', 'width', 'height', 'borderRadius', 'rx'].includes(prop)) {
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return `${Math.round(parseFloat(trimmed))}px`;
    }
    if (trimmed.endsWith('px')) {
      return `${Math.round(parseFloat(trimmed))}px`;
    }
  }

  // Font-weight normalization
  if (prop === 'fontWeight') {
    if (trimmed === 'normal') return '400';
    if (trimmed === 'bold') return '700';
  }

  return trimmed;
}

/**
 * Parses open-source Penpot SVG export files to extract element properties and tokens.
 */
export function parsePenpotSvg(svgContent: string): PenpotNodeToken[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true
  });

  const parsed = parser.parse(svgContent);
  const nodes: PenpotNodeToken[] = [];

  function walk(node: any, tagName = 'svg') {
    if (!node || typeof node !== 'object') return;

    // Check if this node represents an SVG shape/element
    const id = node['@_id'];
    const className = node['@_class'];
    const name = node['@_name'] || node['@_data-name'];

    const properties: Record<string, string> = {};

    // Extract SVG presentation attributes
    if (node['@_fill'] && node['@_fill'] !== 'none') {
      properties['backgroundColor'] = node['@_fill'];
    }
    if (node['@_stroke']) {
      properties['borderColor'] = node['@_stroke'];
    }
    if (node['@_rx']) {
      properties['borderRadius'] = `${node['@_rx']}px`;
    }
    if (node['@_font-size'] || node['@_fontSize']) {
      properties['fontSize'] = `${node['@_font-size'] || node['@_fontSize']}px`;
    }
    if (node['@_font-weight'] || node['@_fontWeight']) {
      properties['fontWeight'] = String(node['@_font-weight'] || node['@_fontWeight']);
    }
    if (node['@_width']) {
      properties['width'] = `${node['@_width']}px`;
    }
    if (node['@_height']) {
      properties['height'] = `${node['@_height']}px`;
    }

    // Parse inline style attribute if present
    if (node['@_style'] && typeof node['@_style'] === 'string') {
      const declarations = node['@_style'].split(';');
      for (const decl of declarations) {
        const [k, v] = decl.split(':').map((s) => s.trim());
        if (k && v) {
          properties[normalizePropName(k)] = v;
        }
      }
    }

    if (Object.keys(properties).length > 0 && (id || className || name)) {
      let selector = '';
      if (id) {
        selector = `#${id}`;
      } else if (className) {
        selector = `.${String(className).trim().split(/\s+/).join('.')}`;
      } else if (name) {
        selector = `[data-name="${name}"]`;
      } else {
        selector = tagName;
      }

      nodes.push({
        id: id ? String(id) : undefined,
        selector,
        tagName,
        properties
      });
    }

    // Recurse children
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_')) continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          walk(item, key);
        }
      } else if (typeof child === 'object') {
        walk(child, key);
      }
    }
  }

  walk(parsed);
  return nodes;
}

/**
 * Parses Penpot JSON design tokens / exported node bundles.
 */
export function parsePenpotJson(jsonContent: string): PenpotNodeToken[] {
  const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
  const nodes: PenpotNodeToken[] = [];

  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data.nodes)
      ? data.nodes
      : Array.isArray(data.tokens)
        ? data.tokens
        : [data];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;

    const selector = item.selector || (item.id ? `#${item.id}` : item.name ? `.${item.name}` : '*');
    const rawProps = item.properties || item.tokens || item.styles || item;
    const properties: Record<string, string> = {};

    for (const [k, v] of Object.entries(rawProps)) {
      if (['id', 'name', 'selector', 'tagName', 'properties', 'tokens', 'styles', 'nodes'].includes(k)) {
        continue;
      }
      if (typeof v === 'string' || typeof v === 'number') {
        properties[normalizePropName(k)] = String(v);
      }
    }

    if (Object.keys(properties).length > 0) {
      nodes.push({
        id: item.id ? String(item.id) : undefined,
        selector,
        properties
      });
    }
  }

  return nodes;
}

/**
 * Main parser entry point supporting both Penpot SVG exports and JSON token exports.
 */
export function parsePenpotTokens(fileContent: string, format: 'svg' | 'json'): PenpotNodeToken[] {
  if (format === 'svg') {
    return parsePenpotSvg(fileContent);
  }
  return parsePenpotJson(fileContent);
}

/**
 * Compares Penpot design tokens against live DOM computed styles and returns mismatched properties.
 */
export function diffPenpotAgainstDom(
  penpotNodes: PenpotNodeToken[],
  domComputedStyles: Record<string, Record<string, string>>
): PenpotDelta[] {
  const deltas: PenpotDelta[] = [];

  for (const pNode of penpotNodes) {
    // Find matching DOM computed styles entry
    let domStyles: Record<string, string> | undefined = domComputedStyles[pNode.selector];

    // Fallback: match without leading '#' or '.'
    if (!domStyles && pNode.id) {
      domStyles = domComputedStyles[pNode.id] || domComputedStyles[`#${pNode.id}`];
    }
    if (!domStyles) {
      const stripped = pNode.selector.replace(/^[#.]/, '');
      domStyles = domComputedStyles[stripped];
    }

    if (!domStyles) continue;

    for (const [prop, expectedRaw] of Object.entries(pNode.properties)) {
      const normalizedProp = normalizePropName(prop);
      const actualRaw = domStyles[normalizedProp] || domStyles[prop];

      if (!actualRaw) continue;

      const normExpected = normalizePropValue(normalizedProp, expectedRaw);
      const normActual = normalizePropValue(normalizedProp, actualRaw);

      if (normExpected !== normActual) {
        deltas.push({
          selector: pNode.selector,
          property: normalizedProp,
          expectedPenpot: expectedRaw,
          actualDom: actualRaw
        });
      }
    }
  }

  return deltas;
}
