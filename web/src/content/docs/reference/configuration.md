---
title: Configuration & CLI Flags
description: Exhaustive reference for Playwright reporter options, CLI commands, and MCP parameters.
sidebar:
  order: 1
---

This page provides the complete parameter reference for ZeroVisual's Playwright Custom Reporter, CLI commands, and MCP tools.

---

## 1. Playwright Custom Reporter Options

Configure the reporter in `playwright.config.ts`:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['zerovisual/reporter', {
      targetProvider: 'anthropic',
      lowTokenMode: false,
      padding: 32,
      outputDir: './test-results',
      customDimensions: undefined
    }]
  ]
});
```

### Options Reference Table

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `targetProvider` | `'openai' \| 'anthropic' \| 'gemini' \| 'gemma' \| 'qwen' \| 'local'` | `'anthropic'` | Target Vision LLM provider. Selects the exact tile grid downscaling dimensions (e.g., 504px for Anthropic/Qwen, 512px for OpenAI, 768px for Gemma/Gemini). |
| `lowTokenMode` | `boolean` | `false` | When `true`, enables aggressive downscaling (e.g., reduces Gemma/Gemini from 768×768 to 384×384) to cut token consumption and latency in half. |
| `padding` | `number` | `32` | Number of context pixels added around all four edges of the diff bounding box. Clamped to image boundaries. |
| `outputDir` | `string` | `'./test-results'` | Directory where the generated `triage-ready.json` artifact bundle will be written upon test completion. |
| `customDimensions` | `{ width: number; height: number }` | `undefined` | Overrides the provider grid with explicit bounding box limits when using custom local or fine-tuned vision models. |

---

## 2. CLI: `zerovisual regression`

Triages and packages existing Playwright test results from disk without rerunning tests.

```bash
npx zerovisual regression [options]
```

### Command Flags

| Flag | Shorthand | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `--input` | `-i` | `string` | `'./test-results'` | Path to the directory containing Playwright test run output and failure diffs. |
| `--output` | `-o` | `string` | `'./test-results/triage-ready.json'` | Destination path for the generated triage JSON bundle. |
| `--provider` | `-p` | `string` | `'anthropic'` | Target vision provider (`openai`, `anthropic`, `gemini`, `gemma`, `qwen`, `local`). |
| `--lowTokenMode` | | `boolean` | `false` | Enable aggressive low-token mode (e.g. 384×384 for Gemma/Gemini). |
| `--padding` | | `number` | `32` | Context padding in pixels around the diff bounding box. |

---

## 3. CLI: `zerovisual design-qa`

Audits a live web page against objective UI/UX design heuristics (WCAG 2.1 contrast, 8pt spatial grid, tap target size, typography) and optional Penpot design tokens.

```bash
npx zerovisual design-qa [options]
```

### Command Flags

| Flag | Shorthand | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `--url` | `-u` | `string` | *Required* | The target URL to audit (e.g., `http://localhost:3000` or staging environment). |
| `--penpot` | | `string` | `undefined` | Optional path to an exported Penpot SVG artboard or JSON design token file. |
| `--output` | `-o` | `string` | `'./design-qa-ready.json'` | Destination file path for the design QA audit bundle. |
| `--provider` | `-p` | `string` | `'anthropic'` | Target vision provider (`openai`, `anthropic`, `gemini`, `gemma`, `qwen`, `local`). |
| `--lowTokenMode` | | `boolean` | `false` | Enable aggressive low-token downscaling for design screenshots. |

---

## 4. CLI: `zerovisual optimize` (or `zerovisual-optimize`)

Optimizes arbitrary screenshot images or directories of UI images to align with Vision LLM patch grids and downscales to WebP format.

```bash
npx zerovisual optimize <input-path> [options]
# Or using direct binary alias:
npx zerovisual-optimize <input-path> [options]
```

### Command Flags

| Flag | Shorthand | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `input` | *(Positional)* | `string` | *Required* | Path to an image file or directory of images to optimize. |
| `--output` | `-o` | `string` | `undefined` | Output path for the optimized WebP file or directory. Defaults to `<filename>.optimized.webp`. |
| `--provider` | `-p` | `string` | `'anthropic'` | Target vision provider (`openai`, `anthropic`, `gemini`, `gemma`, `qwen`, `local`). |
| `--lowTokenMode` | | `boolean` | `false` | Enable aggressive token downscaling (e.g. 384×384 for Gemma/Gemini). |
| `--quality` | `-q` | `number` | `80` | WebP compression quality (1-100). |
| `--json` | | `boolean` | `false` | Outputs JSON formatted statistics to stdout. |

---

## 5. MCP Server Tools & Prompts

When running `zerovisual-mcp` over stdio:

### Tools

| Tool Name | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `list_visual_failures` | `{ testResultsDir?: string }` | Array of test failures with `testId`, failing viewports, and paths. | Lists all visual failures discovered in the test results directory. |
| `get_visual_failure_bundle` | `{ testId: string; testResultsDir?: string; provider?: string }` | Complete payload: WebP Base64 images, AOM YAML snapshot, computed styles. | Returns the model-aligned triage bundle for a specific failing visual test. |
| `audit_live_ui_design` | `{ url: string; penpotPath?: string; provider?: string }` | Design QA bundle with heuristic issues and token diffs. | Audits a live URL using headless Playwright and heuristic math. |
| `optimize_image` | `{ imagePath?: string; imageBase64?: string; provider?: string; lowTokenMode?: boolean; quality?: number }` | WebP data URI, dimensions, and token/byte savings metrics. | Optimizes an arbitrary screenshot or image for Vision LLM tile grids on demand. |

### Prompts

| Prompt Name | Arguments | Description |
| :--- | :--- | :--- |
| `triage-regression` | `{ testId: string }` | Formats the regression bundle and binds `skills/zerovisual-regression` for forensic triage. |
| `critique-ui-design` | `{ url: string; penpotPath?: string }` | Formats the design audit bundle and binds `skills/zerovisual-design-qa` for UI/UX mentoring. |

