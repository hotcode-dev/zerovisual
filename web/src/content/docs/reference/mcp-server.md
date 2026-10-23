---
title: MCP Server Integration
description: Model Context Protocol (MCP) server guide for connecting ZeroVisual to Cursor, Claude Code, and Antigravity.
sidebar:
  order: 3
---

ZeroVisual includes a full **Model Context Protocol (MCP)** server running over `stdio`. This allows your AI coding IDE (Cursor, Claude Code, Windsurf, Antigravity) to proactively query visual failures, retrieve token-optimized screenshots, and audit live designs in your development workflow.

---

## 1. Quick Registration

### Claude Code
```bash
claude mcp add zerovisual -- npx -y zerovisual-mcp
```

### Universal Agent Registration (`add-mcp`)
```bash
npx -y add-mcp "npx -y zerovisual-mcp"
```

### Manual IDE Config (`.cursor/mcp.json` or `claude_desktop_config.json`)
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

---

## 2. Exposed MCP Tools

The MCP server exposes five high-performance tools:

### `list_visual_failures`
Scans the local test results directory for Playwright visual regression failures.
- **Inputs:** `triagePath` (optional string, defaults to `./test-results/triage-ready.json`).
- **Output:** JSON list of failed tests, normalized `testId`s, and affected viewports (e.g., Desktop Chrome, Mobile Safari).

### `get_visual_failure_bundle`
Generates a model-optimized payload for a specific `testId`, returning both structured JSON text and native MCP `ImageContent` blocks.
- **Inputs:**
  - `testId` (string, required): Normalized test identifier.
  - `triagePath` (string, optional).
- **Output:** Detailed JSON test bundle plus native MCP WebP image blocks so multimodal models (Claude, GPT-4o, Cursor) can directly view the visual failure diff.

### `audit_live_ui_design`
Spawns a headless browser, captures the DOM, executes heuristic mathematical audits (WCAG 2.1 AA contrast, 8pt spacing rhythm, touch targets, focus visibility, mobile overflow), and optionally diffs against Penpot or W3C DTCG design tokens.
- **Inputs:**
  - `url` (string, required): Live URL to audit.
  - `penpotPath` (string, optional): Path to local Penpot SVG/JSON or DTCG export.
  - `provider` (string, optional): Target provider for image optimization (`anthropic`, `openai`, `gemini`, `llama`, `mistral`, `deepseek`, `local`).
  - `lowTokenMode` (boolean, optional).

### `optimize_image`
Standalone optimizer for arbitrary screenshots or UI images, returning token/byte savings metrics and native MCP `ImageContent` for multimodal reasoning.
- **Inputs:**
  - `imagePath` or `imageBase64` (string).
  - `provider` (string, optional, defaults to `anthropic`).
  - `lowTokenMode` (boolean, optional).
  - `quality` (number, optional, defaults to 80).

### `estimate_token_cost`
Calculates estimated Vision LLM tokens for raw vs optimized image resolutions across model tile grids without needing to encode an image.
- **Inputs:**
  - `width` (number, required): Pixel width.
  - `height` (number, required): Pixel height.
  - `provider` (string, optional): Target provider.
  - `lowTokenMode` (boolean, optional).

---

## 3. Exposed MCP Prompts

ZeroVisual surfaces two interactive Prompts that bind the respective agent skills:

### `triage-regression`
Binds the forensic instructions of `skills/zerovisual-regression` and automatically invokes `get_visual_failure_bundle` for the chosen `testId`.

### `critique-ui-design`
Binds the design mentor instructions of `skills/zerovisual-design-qa` and triggers `audit_live_ui_design` against the specified local URL.
