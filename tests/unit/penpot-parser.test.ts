import { describe, it, expect } from 'vitest';
import {
  parsePenpotTokens,
  diffPenpotAgainstDom,
  type PenpotNodeToken
} from '../../src/core/penpot-parser.js';

describe('Penpot Token Parser & Delta Comparator', () => {
  const samplePenpotSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <g id="component-card">
        <rect id="cta-button" width="200" height="48" rx="8" fill="#0066cc" stroke="#003366" />
        <text id="cta-label" font-size="16" font-weight="700" fill="#ffffff">Get Started</text>
      </g>
    </svg>
  `;

  const samplePenpotJson = JSON.stringify({
    tokens: [
      {
        id: 'cta-button',
        selector: 'button#cta-button',
        properties: {
          'background-color': '#0066cc',
          'border-radius': '8px',
          height: '48px'
        }
      },
      {
        id: 'cta-label',
        selector: '#cta-label',
        properties: {
          'font-size': '16px',
          'font-weight': '700',
          color: '#ffffff'
        }
      }
    ]
  });

  describe('parsePenpotTokens', () => {
    it('should parse Penpot SVG elements, IDs, and style presentation attributes', () => {
      const nodes = parsePenpotTokens(samplePenpotSvg, 'svg');
      expect(nodes.length).toBeGreaterThanOrEqual(2);

      const button = nodes.find((n) => n.id === 'cta-button');
      expect(button).toBeDefined();
      expect(button?.properties.backgroundColor).toBe('#0066cc');
      expect(button?.properties.borderRadius).toBe('8px');
      expect(button?.properties.width).toBe('200px');
      expect(button?.properties.height).toBe('48px');

      const label = nodes.find((n) => n.id === 'cta-label');
      expect(label).toBeDefined();
      expect(label?.properties.fontSize).toBe('16px');
      expect(label?.properties.fontWeight).toBe('700');
    });

    it('should parse Penpot JSON design tokens', () => {
      const nodes = parsePenpotTokens(samplePenpotJson, 'json');
      expect(nodes).toHaveLength(2);

      const btn = nodes[0];
      expect(btn?.selector).toBe('button#cta-button');
      expect(btn?.properties.backgroundColor).toBe('#0066cc');
      expect(btn?.properties.borderRadius).toBe('8px');
    });
  });

  describe('diffPenpotAgainstDom', () => {
    it('should detect mismatch when DOM borderRadius or backgroundColor differs from Penpot', () => {
      const penpotNodes: PenpotNodeToken[] = [
        {
          id: 'cta-button',
          selector: '#cta-button',
          properties: {
            backgroundColor: '#0066cc',
            borderRadius: '8px'
          }
        }
      ];

      const domComputedStyles = {
        '#cta-button': {
          backgroundColor: 'rgb(0, 102, 204)', // Same as #0066cc
          borderRadius: '4px' // Mismatch: 4px vs 8px!
        }
      };

      const deltas = diffPenpotAgainstDom(penpotNodes, domComputedStyles);
      expect(deltas).toHaveLength(1);
      expect(deltas[0]?.property).toBe('borderRadius');
      expect(deltas[0]?.expectedPenpot).toBe('8px');
      expect(deltas[0]?.actualDom).toBe('4px');
    });

    it('should recognize equivalent colors (#0066cc and rgb(0, 102, 204)) as matching', () => {
      const penpotNodes: PenpotNodeToken[] = [
        {
          id: 'card',
          selector: '#card',
          properties: {
            backgroundColor: '#0066cc',
            color: '#ffffff'
          }
        }
      ];

      const domComputedStyles = {
        '#card': {
          backgroundColor: 'rgb(0, 102, 204)',
          color: 'rgb(255, 255, 255)'
        }
      };

      const deltas = diffPenpotAgainstDom(penpotNodes, domComputedStyles);
      expect(deltas).toHaveLength(0);
    });
  });
});
