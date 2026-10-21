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

The MCP server exposes three tools:

### `list_visual_failures`
Scans the local test results directory for Playwright visual regression failures.
- **Inputs:** `testResultsDir` (optional string, defaults to `./test-results`).
- **Output:** JSON list of failed tests, normalized `testId`s, and affected viewports (e.g., Desktop Chrome, Mobile Safari).

### `get_visual_failure_bundle`
Generates a model-optimized payload for a specific `testId`.
- **Inputs:**
  - `testId` (string, required): Normalized test identifier.
  - `testResultsDir` (string, optional).
  - `provider` (string, optional): Target provider (`openai`, `anthropic`, `gemini`, `local`).
- **Output:** Cropped WebP Base64 images for `diff`, `actual`, `expected`, along with the Playwright `ariaSnapshot` YAML and 14 layout CSS properties.

### `audit_live_ui_design`
Spawns a headless browser, captures the DOM, executes heuristic mathematical audits (WCAG contrast, 8pt spacing rhythm, touch targets), and optionally diffs against Penpot design tokens.
- **Inputs:**
  - `url` (string, required): Live URL to audit.
  - `penpotPath` (string, optional): Path to local Penpot SVG/JSON export.
  - `provider` (string, optional): Target provider for image optimization.

---

## 3. Exposed MCP Prompts

ZeroVisual surfaces two interactive Prompts that bind the respective agent skills:

### `triage-regression`
Binds the forensic instructions of `skills/zerovisual-regression` and automatically invokes `get_visual_failure_bundle` for the chosen `testId`.

### `critique-ui-design`
Binds the design mentor instructions of `skills/zerovisual-design-qa` and triggers `audit_live_ui_design` against the specified local URL.
