---
title: Getting Started
description: Quickstart guide to install and configure ZeroVisual in your Playwright test suite, CLI, or AI coding IDE.
sidebar:
  order: 1
---

## Installation & Integration Matrix

ZeroVisual supports two seamless integration paths depending on your workflow:

| Workflow | Use Case | Installation Command | Dependencies Required |
| :--- | :--- | :--- | :--- |
| **🤖 AI Agent Mode** *(Zero Install)* | Cursor, Claude Code, Windsurf, Antigravity | `npx skills add hotcode-dev/zerovisual`<br>`claude mcp add zerovisual -- npx -y zerovisual-mcp` | **None** (runs on-demand via `npx` with zero project dependencies) |
| **🧪 Playwright & CI Mode** *(Project DevDep)* | Visual regression suites, CI/CD runners, local scripts | `npm install -D zerovisual @playwright/test sharp` | Node.js `>=20.0.0`, `@playwright/test` |

---

## 1. Install Agent Skills (`npx skills add`)

Equip your AI coding agent (Cursor, Claude Code, Windsurf, Antigravity) with ZeroVisual's isolated domain skills without modifying `package.json`:

```bash
# Install all ZeroVisual Agent Skills from the repository:
npx skills add hotcode-dev/zerovisual

# Or install individual skills as needed:
npx skills add hotcode-dev/zerovisual/skills/zerovisual-optimize
npx skills add hotcode-dev/zerovisual/skills/zerovisual-design-qa
npx skills add hotcode-dev/zerovisual/skills/zerovisual-regression
```

- **`skills/zerovisual-optimize`**: Teaches agents how and when to optimize user screenshots and UI images to eliminate Vision LLM token waste and network payload latency.
- **`skills/zerovisual-design-qa`**: Teaches agents objective UI/UX mentoring guidelines (8pt spatial grid rhythm, WCAG 2.1 contrast math, 44x44px touch targets, and exact CSS/Tailwind classes).
- **`skills/zerovisual-regression`**: Teaches agents strict code-to-code visual regression forensics (filtering font anti-aliasing noise, cross-viewport correlation, semantic AOM validation).

---

## 2. MCP Server Integration (Cursor, Claude Code, Antigravity)

Connect ZeroVisual directly to your AI IDE over `stdio` so your coding agent can inspect visual failures, optimize screenshots, and critique live UI on demand:

### Fast Setup via CLI:
```bash
# Claude Code:
claude mcp add zerovisual -- npx -y zerovisual-mcp

# Or via add-mcp across coding agents:
npx -y add-mcp "npx -y zerovisual-mcp"
```

### Manual Configuration:
Add the following to your `.cursor/mcp.json` or `claude_desktop_config.json`:

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

### Available MCP Tools:
- `optimize_image`: Optimizes arbitrary screenshots or images for Vision LLM tile grids and returns token savings and byte reductions.
- `audit_live_ui_design`: Launches headless Playwright against a local URL, runs deterministic heuristic linter + Penpot diff, and returns token-optimized design critiques.
- `list_visual_failures`: Lists all failed Playwright visual tests and affected viewports.
- `get_visual_failure_bundle`: Fetches resized WebP images, `ariaSnapshot` YAML, and computed styles for a specific `testId`.

---

## 3. Playwright Custom Reporter Setup

For automated test suites and CI/CD pipelines, install the project devDependencies:

```bash
npm install -D zerovisual @playwright/test sharp
```

Or using pnpm / yarn:

```bash
pnpm add -D zerovisual @playwright/test sharp
# or
yarn add -D zerovisual @playwright/test sharp
```

Add ZeroVisual as a custom reporter in your `playwright.config.ts`. Passing tests execute at standard speed with **zero AI token cost**; only failing visual assertions trigger the pre-processor:

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

## 4. Standalone CLI Usage

ZeroVisual ships with an executable binary `zerovisual` powered by `citty`.

### A. Optimize Screenshots & UI Images (`zerovisual optimize` / `zerovisual-optimize`)
Pre-process Retina screenshots (`Cmd + Shift + 4`) or folders of UI images to match the exact patch grids of your target Vision LLM:

```bash
# Optimize a single UI screenshot for Anthropic (504x504):
npx zerovisual optimize ./screenshot.png --provider anthropic

# Or use the direct alias:
npx zerovisual-optimize ./bug-report.png --provider openai

# Batch optimize a directory of UI screenshots:
npx zerovisual optimize ./screenshots-dir --provider gemini --low-token
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

### C. Triage Existing Visual Failures in CI (`zerovisual regression`)
Process an existing directory of Playwright test artifacts in CI/CD:

```bash
npx zerovisual regression \
  --input ./test-results \
  --provider anthropic \
  --output ./test-results/triage-ready.json
```
