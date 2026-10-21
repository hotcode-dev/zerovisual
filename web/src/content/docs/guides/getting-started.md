---
title: Getting Started
description: Quickstart guide to install and configure ZeroVisual in your Playwright test suite, CLI, or AI coding IDE.
sidebar:
  order: 1
---

## Prerequisites

- **Node.js:** `v20.0.0` or higher
- **Playwright:** `@playwright/test` (`v1.49.0+` recommended for native `ariaSnapshot` support)

---

## 1. Installation

Install ZeroVisual and its peer dependencies in your web application repository:

```bash
npm install -D zerovisual @playwright/test sharp
```

Or using pnpm / yarn:

```bash
pnpm add -D zerovisual @playwright/test sharp
# or
yarn add -D zerovisual @playwright/test sharp
```

---

## 2. Playwright Reporter Setup

Add ZeroVisual as a custom reporter in your `playwright.config.ts`. Passing tests execute at standard speed with **zero token cost**. Only failing visual assertions trigger the pre-processor:

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
  ],
  reporter: [
    ['list'],
    ['zerovisual/reporter', {
      targetProvider: 'anthropic', // 'openai' | 'anthropic' | 'gemini' | 'local'
      padding: 32,                 // Context pixels around diff bounding box
      outputDir: './test-results'  // Output folder for triage-ready.json
    }]
  ],
});
```

When a visual test like `expect(page).toHaveScreenshot()` fails, ZeroVisual generates:
`./test-results/triage-ready.json`.

---

## 3. Standalone CLI Usage

ZeroVisual ships with an executable binary `zerovisual` powered by `citty`.

### A. Triage Existing Visual Failures (`zerovisual regression`)
Process an existing directory of Playwright test artifacts in CI/CD:

```bash
npx zerovisual regression \
  --input ./test-results \
  --provider anthropic \
  --output ./test-results/triage-ready.json
```

### B. Audit Live Web UI for Engineers (`zerovisual design-qa`)
Run an automated design audit against your local dev server without needing any design files:

```bash
# Standalone engineer design heuristic audit
npx zerovisual design-qa \
  --url http://localhost:3000 \
  --provider anthropic

# Audit against an open-source Penpot design export
npx zerovisual design-qa \
  --url http://localhost:3000/checkout \
  --penpot ./designs/checkout.svg \
  --provider gemini \
  --low-token
```

---

## 4. Install Agent Skills (`npx skills add`)

ZeroVisual comes with two specialized Agent Skills that you can install directly into your workspace:

```bash
# Install both skills into your project:
npx skills add hotcode-dev/zerovisual

# Or install individually:
npx skills add hotcode-dev/zerovisual/skills/zerovisual-regression
npx skills add hotcode-dev/zerovisual/skills/zerovisual-design-qa
```

- **`zerovisual-regression`:** Teaches AI agents strict visual regression forensics (ignoring font anti-aliasing noise, correlating multi-viewport failures).
- **`zerovisual-design-qa`:** Teaches AI agents design mentor guidelines (8pt grid rhythm, WCAG contrast ratios, touch targets, and exact Tailwind/CSS classes).

---

## 5. MCP Server Integration (Cursor, Claude Code, Antigravity)

Connect ZeroVisual directly to your AI IDE over stdio:

### Fast Setup via CLI:
```bash
# Claude Code:
claude mcp add zerovisual -- npx -y zerovisual-mcp

# Or via add-mcp:
npx -y add-mcp "npx -y zerovisual-mcp"
```

### Manual Configuration:
Add to `.cursor/mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zerovisual": {
      "command": "npx",
      "args": ["-y", "zerovisual-mcp"],
      "env": {
        "ZEROVISUAL_PROVIDER": "anthropic"
      }
    }
  }
}
```
