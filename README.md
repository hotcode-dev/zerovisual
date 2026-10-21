# ZeroVisual 👁️⚡️

**Zero-waste, zero-API-key visual regression and automated UI design QA pre-processor for AI Agents.**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![100% Open Source](https://img.shields.io/badge/Stack-100%25%20Open%20Source-orange.svg)](#)

**ZeroVisual** is a local pre-processing engine, Playwright Custom Reporter, CLI, and Model Context Protocol (MCP) server. It acts as a token-optimizing firewall between your browser tests/UI and your Vision LLMs—reducing vision token consumption by up to **90%** without requiring a single LLM API key.

---

## 🎯 What Is This For?

ZeroVisual solves two major pain points in modern software engineering:

### 1. For QA & Full-Stack Engineers: Automated Visual Regression (`regression` mode)
Standard Playwright `toHaveScreenshot()` pixel-diffing is fast and free, but fails on harmless sub-pixel font anti-aliasing or minor OS rendering shifts. Conversely, sending raw `1920x1080` screenshots across Desktop, Tablet, and Mobile viewports to a Vision LLM to triage failures will burn through your token budget and slow CI/CD to a crawl.
* **The ZeroVisual Solution:** Let Playwright's deterministic pixel math run first for free. Only when a test fails does ZeroVisual intercept the diff, crop it to the exact failure bounding box, downscale it to your target LLM's exact vision tile grid, extract the localized Accessibility Tree (`ariaSnapshot`), and group all failing viewports into a single `triage-ready.json` bundle.

### 2. For Engineers With Zero Design Skills: Automated Design QA (`design-qa` mode)
If you are a developer building a web or mobile app without a dedicated designer—or trying to match an open-source **Penpot** design file—guessing spacing, contrast, and visual hierarchy in CSS is frustrating.
* **The ZeroVisual Solution:** Point `zerovisual design-qa` at your localhost URL (and optional Penpot SVG/JSON export). ZeroVisual runs deterministic math checks on your live DOM (verifying WCAG 2.1 contrast ratios, `4px`/`8px` spatial grid rhythm, `44x44px` mobile tap targets, and typographic scales) and packages the violations alongside a token-optimized screenshot so your coding agent can give you exact CSS/Tailwind fixes.

---

## ✨ Key Features

* 🔑 **Bring Your Own Agent (Zero API Keys):** ZeroVisual never calls OpenAI, Anthropic, or Google APIs directly. It runs 100% locally and outputs structured JSON payloads (`triage-ready.json` / `design-qa-ready.json`) or serves them over **MCP** to Cursor, Claude Code, Windsurf, Antigravity, or your custom CI/CD agent.
* 📐 **Model-Aware Vision Grid Resizing:** Dynamically crops and downscales images using `sharp` (`fit: 'inside'`, `withoutEnlargement: true`, WebP `quality: 80`) to fit the exact vision patch/tile mechanics of your target model:
  * **OpenAI (`openai`):** `512x512` (fits inside a single 512px tile).
  * **Anthropic (`anthropic`):** `504x504` (aligns to an exact 18×18 grid of 28×28px patches).
  * **Google Gemini (`gemini`):** `768x768` (single standard tile) or `384x384` (`lowTokenMode`).
  * **Local VLMs (`local`):** `448x448` default or custom dimensions for local models (Qwen-VL, Gemma, etc.).
* 📱 **Multi-Viewport Aggregation:** When a responsive layout breaks across Desktop, Tablet, and Mobile simultaneously, ZeroVisual groups all failing viewports under a single `testId`. Your AI agent diagnoses the responsive breakpoint bug in **one prompt** instead of three separate API calls.
* 🌳 **Scoped Semantic Context (AOM + CSS):** Extracts only the failing element's Playwright `ariaSnapshot()` YAML and 14 core layout CSS properties (`padding`, `gap`, `fontSize`, `color`, etc.) instead of dumping the entire raw HTML DOM.
* 🎨 **100% Open-Source Design QA (Penpot + Heuristic Linter):** Built-in mathematical linter for contrast, spacing grids, and tap targets, plus native SVG/JSON token diffing for **Penpot**—zero proprietary Figma lock-in.
* 🧠 **Dual Isolated Agent Skills:** Ships with two separate, strictly-typed Agent Skills (`visual-regression` and `design-qa`) so your LLM never suffers from instruction dilution.

---

## ⚙️ How It Works (The Two-Stage Architecture)

```text
[Stage 1: Deterministic Engine (0 Tokens)]
Playwright Pixel Diff / CSS Heuristic Math / Penpot Token Diff
       │
       ├──► PASS ──► Workflow Ends Immediately (0 AI Tokens Used)
       │
       └──► FAIL / AUDIT ──► Triggers ZeroVisual Pre-Processor
                                    │
[Stage 2: ZeroVisual Optimizer]     ▼
  1. Detects diff bounding box + 32px context padding
  2. Resizes & encodes to WebP based on Model Tile Grid (512px / 504px / 768px)
  3. Scopes Accessibility Tree (ariaSnapshot) & Computed CSS
  4. Aggregates Desktop + Tablet + Mobile viewports by testId
                                    │
                                    ▼
              Outputs ./test-results/triage-ready.json
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
   [Local IDE via MCP]                             [CI/CD Pipeline CLI]
Cursor / Claude Code / Antigravity               GitHub Actions / GitLab CI
queries ZeroVisual MCP Server + Skill          reads JSON & posts PR Verdict
```

---

## 📦 Prerequisites & Installation

### Prerequisites
* **Node.js:** `v20.0.0` or higher
* **Playwright:** `@playwright/test` (`v1.49.0+` recommended for `ariaSnapshot` support)

### Install via npm / pnpm / yarn

```bash
npm install -D zerovisual @playwright/test sharp
```

---

## 🚀 Usage Guide

### 1. Playwright Custom Reporter (Automated Visual Regression)

Add ZeroVisual to your `playwright.config.ts`. Passing tests run at native speed with zero overhead; failing visual tests automatically generate `./test-results/triage-ready.json`.

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
      padding: 32,                 // Context pixels around the diff bounding box
      outputDir: './test-results'
    }]
  ],
});
```

### 2. CLI Commands (`regression` & `design-qa`)

ZeroVisual provides two separate CLI commands so regression testing and UI design auditing never collide:

#### Mode A: Process Visual Regressions (`zerovisual regression`)
Run standalone optimization on an existing Playwright `test-results` directory in CI/CD:

```bash
npx zerovisual regression \
  --input ./test-results \
  --provider openai \
  --output ./test-results/triage-ready.json
```

#### Mode B: Audit Live UI Design for Engineers (`zerovisual design-qa`)
Audit a live local or staging URL against objective UI/UX heuristics (8pt spacing grid, WCAG contrast, tap target size, font scale) and optional open-source **Penpot** design exports:

```bash
# Standalone Engineer UI Audit (No design file needed!)
npx zerovisual design-qa \
  --url http://localhost:3000 \
  --provider gemini \
  --low-token

# Compare Live UI against an Open-Source Penpot Export
npx zerovisual design-qa \
  --url http://localhost:3000/checkout \
  --penpot ./designs/checkout-artboard.svg \
  --provider anthropic
```

---

### 3. MCP Server Integration (Cursor, Claude Code, Antigravity)

Connect ZeroVisual directly to your AI IDE over `stdio` so your coding agent can inspect visual failures and critique your UI on demand.

Add the following to your `.cursor/mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zerovisual": {
      "command": "npx",
      "args": ["zerovisual-mcp"],
      "env": {
        "ZEROVISUAL_PROVIDER": "anthropic"
      }
    }
  }
}
```

#### Available MCP Tools
* `list_visual_failures`: Lists all failed Playwright visual tests and affected viewports.
* `get_visual_failure_bundle`: Fetches the resized WebP images, `ariaSnapshot` YAML, and computed styles for a specific `testId`.
* `audit_live_ui_design`: Launches headless Playwright against a local URL, runs the deterministic heuristic linter + Penpot diff, and returns a token-optimized design critique bundle.

#### Available MCP Prompts (Skills)
* `triage-regression`: Loads `skills/visual-regression/SKILL.md` and enforces strict pass/fail JSON triage.
* `critique-ui-design`: Loads `skills/design-qa/SKILL.md` and outputs actionable CSS/Tailwind improvements.

---

## 📊 Model Vision Grid Reference

| Provider Setting | Target Max Bounding Box | Vision Grid Mechanics | Approx. Token Cost per Diff |
| :--- | :--- | :--- | :--- |
| `openai` | `512 × 512 px` | Fits inside 1 standard OpenAI `512px` tile | ~85 – 255 tokens |
| `anthropic` | `504 × 504 px` | Exact `18 × 18` grid of `28×28 px` patches | ~324 tokens |
| `gemini` | `768 × 768 px` | Fits 1 native Gemini tile | ~258 tokens |
| `gemini` (`lowTokenMode`) | `384 × 384 px` | Sub-384px single base tile optimization | ~258 tokens (ultra-fast) |
| `local` | `448 × 448 px` (configurable) | Optimized for local VLMs (`28px` / `14px` patch ViTs) | Local compute |

---

## 🤝 Contributing & License

Contributions, issues, and feature requests are welcome! ZeroVisual is built on a 100% open-source stack and is licensed under the **Apache License 2.0**—giving you full permissive freedom alongside explicit patent and trademark protection. See the `LICENSE` file for details.
