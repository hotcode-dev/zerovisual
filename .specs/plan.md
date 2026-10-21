# Implementation Plan: ZeroVisual (`001-zerovisual-core`)

## 1. Technical Stack & Tooling
- **Runtime & Language:** Node.js >= 20, TypeScript 5.x (`strict: true`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`).
- **Core Dependencies:**
  - `sharp`: High-speed image bounding-box extraction, cropping, resizing, and WebP Base64 encoding.
  - `zod` + `zod-to-json-schema`: Runtime validation and JSON schema generation.
  - `@modelcontextprotocol/sdk`: Official MCP server implementation over `stdio`.
  - `citty` (or `commander`): Modular CLI framework for `regression` and `design-qa` commands.
  - `fast-xml-parser`: Parsing open-source Penpot SVG files to extract design attributes.
- **Peer / Dev Dependencies:**
  - `@playwright/test`: Reporter API, headless browser automation, and `ariaSnapshot()` extraction.
  - `vitest`: Unit and integration testing framework.
  - `tsup`: Fast ESM/CJS bundler with `.d.ts` generation and CLI binary entry points.

---

## 2. Target Directory Structure

- `package.json`
- `tsconfig.json`
- `tsup.config.ts`
- `vitest.config.ts`
- `.specs/spec.md`
- `.specs/plan.md`
- `src/index.ts` (Public exports: Reporter, Fixtures, Schemas, Optimizer)
- `src/core/schema.ts` (Zod schemas for Config, Payload, and Skill Verdict outputs)
- `src/core/image-optimizer.ts` (Sharp diff bounding-box detector, cropper, and model-grid resizer)
- `src/core/dom-extractor.ts` (Playwright helper for scoped `ariaSnapshot` and filtered `getComputedStyle`)
- `src/core/heuristic-linter.ts` (Pure math functions for WCAG 2.1 contrast, 4px/8px spatial grid, tap targets, typography)
- `src/core/penpot-parser.ts` (Open-source Penpot SVG/JSON token parser and CSS delta comparator)
- `src/reporter/playwright-reporter.ts` (Playwright Custom Reporter grouping multi-viewport failures by `testId`)
- `src/cli/index.ts` (CLI entry binary `zerovisual`)
- `src/cli/commands/regression.ts` (`zerovisual regression` command implementation)
- `src/cli/commands/design-qa.ts` (`zerovisual design-qa` command implementation)
- `src/mcp/server.ts` (Stdio MCP Server exposing tools and isolated skill prompts)
- `skills/visual-regression/SKILL.md`
- `skills/visual-regression/output.schema.json`
- `skills/design-qa/SKILL.md`
- `skills/design-qa/output.schema.json`
- `tests/unit/image-optimizer.test.ts`
- `tests/unit/heuristic-linter.test.ts`
- `tests/unit/penpot-parser.test.ts`
- `tests/integration/reporter-aggregation.test.ts`
- `tests/integration/mcp-server.test.ts`

---

## 3. Phased Execution Tasks

### Phase 1: Project Scaffolding & Canonical Zod Schemas
- [x] **Task 1.1:** Initialize `package.json` with `"type": "module"`, `"bin": { "zerovisual": "./dist/cli/index.js", "zerovisual-mcp": "./dist/mcp/server.js" }`, scripts (`build`, `test`, `typecheck`), and install dependencies.
- [x] **Task 1.2:** Configure `tsconfig.json`, `tsup.config.ts`, and `vitest.config.ts`.
- [x] **Task 1.3:** Implement `src/core/schema.ts` defining:
  - `ZeroVisualConfigSchema` (`targetProvider`, `lowTokenMode`, `customDimensions`, `padding`, `outputDir`).
  - `ViewportArtifactSchema` and `TriagePayloadSchema`.
  - `RegressionVerdictSchema` and `DesignQaVerdictSchema`.
- [x] **Task 1.4:** Write unit tests in `tests/unit/schema.test.ts` verifying valid and invalid payload parsing.

### Phase 2: Model-Aware Image Pre-Processor (`sharp`)
- [x] **Task 2.1:** In `src/core/image-optimizer.ts`, implement `getProviderDimensions(provider, lowTokenMode, custom)` returning:
  - `openai` -> `{ maxWidth: 512, maxHeight: 512 }`
  - `anthropic` -> `{ maxWidth: 504, maxHeight: 504 }`
  - `gemini` -> `{ maxWidth: 384, maxHeight: 384 }` if `lowTokenMode` else `{ maxWidth: 768, maxHeight: 768 }`
  - `local` -> custom dimensions or `{ maxWidth: 448, maxHeight: 448 }`.
- [x] **Task 2.2:** Implement `detectDiffBoundingBox(diffImageBuffer, padding = 32)` using `sharp` raw pixel channels to scan non-matching/highlighted pixels in Playwright's `diff.png` and compute a clamped `{ left, top, width, height }` crop box.
- [x] **Task 2.3:** Implement `optimizeImageForProvider(imageBuffer, options)` that crops to the bounding box (if provided), resizes with `fit: 'inside'` and `withoutEnlargement: true`, encodes to `.webp({ quality: 80 })`, and returns the `data:image/webp;base64,...` string plus metadata.
- [x] **Task 2.4:** Write unit tests in `tests/unit/image-optimizer.test.ts` generating synthetic PNG buffers via `sharp` (e.g., 1920x1080 desktop and 375x812 mobile) and asserting exact output bounds for `openai`, `anthropic`, `gemini`, and `local` presets.

### Phase 3: Deterministic UI Heuristic Linter & Penpot Parser
- [x] **Task 3.1:** In `src/core/heuristic-linter.ts`, implement pure mathematical functions:
  - `calculateRelativeLuminance(rgb)` and `calculateContrastRatio(fgRgb, bgRgb)` per WCAG 2.1 formulas.
  - `checkSpacingGrid(cssValue)` verifying pixel values are `0`, `1`, `2`, or divisible by `4`.
  - `checkTapTarget(boundingBox, isMobileViewport)` verifying interactive elements are at least `44x44px`.
  - `checkTypographyScale(fontSizePx, lineHeightPx, tagName)` verifying body text is `>= 16px` and unitless line-height is `>= 1.4`.
- [x] **Task 3.2:** In `src/core/penpot-parser.ts`, implement `parsePenpotTokens(fileContent, format: 'svg' | 'json')` using `fast-xml-parser` to extract `fill`, `stroke`, `font-size`, `font-weight`, `rx` (border-radius), and layout dimensions from open-source Penpot exports, plus `diffPenpotAgainstDom(penpotNodes, domComputedStyles)`.
- [x] **Task 3.3:** Write unit tests in `tests/unit/heuristic-linter.test.ts` and `tests/unit/penpot-parser.test.ts` covering edge cases (transparent backgrounds, non-grid margins like `13px`, mobile buttons at `36x36px`, and SVG attribute extraction).

### Phase 4: Playwright DOM Extractor & Custom Multi-Viewport Reporter
- [x] **Task 4.1:** In `src/core/dom-extractor.ts`, create a Playwright helper `captureDomContext(page, selectorOrBox)` that extracts `locator.ariaSnapshot()` and runs `page.evaluate()` to collect the 14 allowed computed style properties (`display`, `position`, `width`, `height`, `margin`, `padding`, `gap`, `fontSize`, `fontWeight`, `lineHeight`, `color`, `backgroundColor`, `borderRadius`, `boxShadow`) and live heuristic violations.
- [x] **Task 4.2:** In `src/reporter/playwright-reporter.ts`, implement the Playwright `Reporter` class (`ZeroVisualReporter`):
  - In `onTestEnd(test, result)`: Return immediately if `result.status === 'passed'` (Zero-Token Law). If failed with `-diff.png` attachments, read the attachment buffer, run `detectDiffBoundingBox` and `optimizeImageForProvider`, and store the artifact in an in-memory `Map<string, FailureEntry>` keyed by normalized `test.titlePath().slice(1).join(' > ')` so Desktop, Tablet, and Mobile failures for the same test are grouped together.
  - In `onEnd()`: If the failure map is non-empty, validate the aggregated payload with `TriagePayloadSchema` and write `./test-results/triage-ready.json`.
- [x] **Task 4.3:** Write integration tests in `tests/integration/reporter-aggregation.test.ts` simulating a multi-project failure (`Desktop Chrome` + `Mobile Safari`) and asserting that a single grouped `testId` with two `viewports` entries is written to disk.

### Phase 5: Dual Agent Skills & Schemas (`skills/`)
- [x] **Task 5.1:** Generate `skills/visual-regression/output.schema.json` and `skills/design-qa/output.schema.json` programmatically from `src/core/schema.ts` using `zod-to-json-schema`.
- [x] **Task 5.2:** Author `skills/visual-regression/SKILL.md` with strict code-to-code triage instructions (cross-viewport correlation, semantic AOM checking, sub-pixel noise filtering).
- [x] **Task 5.3:** Author `skills/design-qa/SKILL.md` with UI/UX mentor instructions for engineers (browser-vs-canvas tolerance, 8pt spacing rhythm, visual hierarchy, WCAG contrast, and exact CSS/Tailwind replacement output).

### Phase 6: Dual-Command CLI (`zerovisual regression` & `zerovisual design-qa`)
- [x] **Task 6.1:** Implement `src/cli/commands/regression.ts` allowing standalone optimization of an existing Playwright `./test-results` directory (`npx zerovisual regression --provider anthropic --input ./test-results`).
- [x] **Task 6.2:** Implement `src/cli/commands/design-qa.ts` (`npx zerovisual design-qa --url http://localhost:3000 --penpot ./design.svg --provider openai`):
  - Launches headless Playwright across configured viewports (default: Desktop `1440x900` and Mobile `390x844`).
  - Runs `captureDomContext`, `heuristic-linter`, and optional `penpot-parser`.
  - Captures model-grid-resized WebP screenshots and writes `./test-results/design-qa-ready.json`.
- [x] **Task 6.3:** Wire both commands into `src/cli/index.ts` with `#!/usr/bin/env node`.

### Phase 7: Model Context Protocol (MCP) Server (`src/mcp/server.ts`)
- [x] **Task 7.1:** Build the stdio MCP server using `@modelcontextprotocol/sdk` registering 3 tools:
  - `list_visual_failures`: Lists all test failures and affected viewports from `./test-results/triage-ready.json`.
  - `get_visual_failure_bundle`: Returns the full multi-viewport artifact (including Base64 WebP image blocks and `ariaSnapshot` YAML) for a specific `testId`.
  - `audit_live_ui_design`: Accepts `{ url, penpotPath?, provider? }`, executes the `design-qa` pipeline on demand, and returns the heuristic violations, Penpot deltas, and optimized WebP screenshot.
- [x] **Task 7.2:** Register 2 MCP Prompts (`triage-regression` and `critique-ui-design`) that dynamically load the respective `SKILL.md` and `output.schema.json` files.
- [x] **Task 7.3:** Write `tests/integration/mcp-server.test.ts` verifying tool registration, prompt loading, and schema validation.