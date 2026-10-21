# Feature Specification: ZeroVisual Core Engine, CLI, MCP Server & Dual Agent Skills

- **Feature ID:** `001-zerovisual-core`
- **Status:** Approved for Implementation
- **Architecture:** Bring Your Own Agent (BYOA) Pre-Processor + Playwright Reporter + CLI + MCP Server
- **License Constraint:** 100% Open-Source Stack (MIT)

---

## 1. Overview & Problem Statement

Visual regression testing and automated UI design verification with Vision LLMs suffer from severe token waste, high latency, and vendor lock-in when raw full-HD screenshots and full DOM trees are sent across multiple responsive viewports. Furthermore, software engineers without formal design training lack deterministic, automated tooling to audit their live UI against objective design heuristics or open-source design tokens.

**ZeroVisual** is a local, zero-API-key pre-processing engine, Playwright Custom Reporter, CLI, and Model Context Protocol (MCP) server. It lets deterministic math (Playwright pixel-diffing and CSS/WCAG heuristic linting) execute first at zero token cost, and only packages cropped, model-tile-aligned WebP images alongside localized Accessibility Object Model (AOM) snapshots into a unified JSON payload when failures or design audits occur.

---

## 2. User Stories & Acceptance Scenarios

### US-1: Zero-Token Passing & Token-Optimized Visual Regression (`regression` mode)
**As a** QA or Full-Stack Engineer running Playwright visual tests across Desktop, Tablet, and Mobile viewports,  
**I want** failing visual diffs to be cropped, downscaled to my target Vision LLM's exact tile/patch grid, and grouped by test across all failing viewports into a single JSON file,  
**So that** my CI/CD agent or local IDE agent can triage responsive layout shifts in a single prompt using up to 90% fewer vision tokens.

* **Acceptance Criteria:**
  1. **GIVEN** a Playwright test suite configured with ZeroVisual, **WHEN** all `expect(page).toHaveScreenshot()` assertions pass, **THEN** the system SHALL terminate with zero image processing and zero JSON triage artifacts generated.
  2. **GIVEN** a failing `toHaveScreenshot()` assertion across `Desktop Chrome` (1920x1080) and `Mobile Safari` (375x667), **WHEN** the test run finishes, **THEN** the system SHALL group both viewport failures under a single `testId` entry inside `./test-results/triage-ready.json`.
  3. **GIVEN** a target provider configuration of `openai`, `anthropic`, `gemini`, or `local`, **WHEN** the image optimizer processes a failure diff, **THEN** the system SHALL resize the cropped diff region (`fit: 'inside'`, `withoutEnlargement: true`) to the exact target bounding box and encode it as Base64 WebP (`quality: 80`).

### US-2: Automated UI Design QA for Engineers (`design-qa` mode)
**As a** Software Engineer with zero formal UI/UX design skills building a web or mobile web app,  
**I want** a CLI command and MCP tool that audits my live URL against objective UI heuristics (8pt spacing grid, WCAG contrast, tap target sizing, typographic scale) and optional open-source Penpot design files,  
**So that** my coding agent can give me exact CSS/Tailwind fixes rather than vague aesthetic opinions.

* **Acceptance Criteria:**
  1. **GIVEN** a live local or staging URL, **WHEN** the user runs `npx zerovisual design-qa --url <url>`, **THEN** the system SHALL launch headless Playwright, evaluate computed CSS styles against the deterministic heuristic linter, capture a model-aligned viewport screenshot, and write `./test-results/design-qa-ready.json`.
  2. **GIVEN** a Penpot export file (SVG or JSON token bundle) passed via `--penpot <path>`, **WHEN** `zerovisual design-qa` executes, **THEN** the system SHALL compute deterministic token deltas (expected Penpot CSS property vs. actual browser `getComputedStyle` property) and include only mismatched nodes in the output payload.

### US-3: Local IDE Triage via MCP Server
**As a** Developer working inside an MCP-compatible AI IDE,  
**I want** to ask my agent to inspect failing visual tests or critique my current local UI via MCP tools and pre-packaged Skill rubrics,  
**So that** the agent automatically loads the right rubric (`visual-regression` vs `design-qa`) without instruction dilution.

* **Acceptance Criteria:**
  1. **GIVEN** the ZeroVisual MCP server running over `stdio`, **WHEN** an MCP client requests `list_visual_failures` or `get_visual_failure_bundle`, **THEN** the server SHALL validate inputs with Zod and return the corresponding multi-viewport artifact from `triage-ready.json`.
  2. **GIVEN** an MCP prompt request for `triage-regression` or `critique-ui-design`, **THEN** the server SHALL return the isolated system instructions and strict JSON output schema for that specific mode.

---

## 3. Functional Requirements (EARS Syntax)

### 3.1 Model-Aware Image Pre-Processor (`FR-IMG`)
* **FR-IMG-01:** **WHEN** a visual failure occurs, **THE SYSTEM SHALL** calculate the minimal bounding box enclosing all differing pixels from `diff.png` and apply a configurable context padding (default: `32px`, clamped to image boundaries) before resizing.
* **FR-IMG-02:** **WHERE** `targetProvider` is set in configuration, **THE SYSTEM SHALL** enforce the following maximum bounding-box dimensions during `sharp` downscaling:
  * `openai`: `512x512` (fits 1 OpenAI vision tile).
  * `anthropic`: `504x504` (aligns to an exact 18x18 grid of 28x28px patches).
  * `gemini`: `768x768` (standard single tile) or `384x384` when `lowTokenMode: true`.
  * `local`: Custom `{ maxWidth, maxHeight }` (defaulting to `448x448` for local VLMs like Qwen-VL / Gemma).
* **FR-IMG-03:** **WHEN** encoding processed images for JSON output, **THE SYSTEM SHALL** output Base64-encoded WebP data URIs (`data:image/webp;base64,...`).

### 3.2 Semantic DOM & AOM Extraction (`FR-DOM`)
* **FR-DOM-01:** **WHEN** capturing failure context in Playwright, **THE SYSTEM SHALL** extract the localized Accessibility Object Model (AOM) YAML snapshot (`locator.ariaSnapshot()`) scoped strictly to the failing locator or the deepest DOM element intersecting the diff bounding box, plus 1 parent level.
* **FR-DOM-02:** **WHEN** capturing computed styles on a target element, **THE SYSTEM SHALL** extract only layout and visual tokens (`display`, `position`, `width`, `height`, `margin`, `padding`, `gap`, `fontSize`, `fontWeight`, `lineHeight`, `color`, `backgroundColor`, `borderRadius`, `boxShadow`) to prevent JSON bloat.

### 3.3 Deterministic UI Heuristic Linter (`FR-LINT`)
* **FR-LINT-01:** **WHEN** executing in `design-qa` mode, **THE SYSTEM SHALL** deterministically flag the following violations in the live DOM before AI handoff:
  * `CONTRAST`: Text elements failing WCAG 2.1 AA contrast ratios (less than `4.5:1` for normal text, less than `3.0:1` for large text `>= 18pt` or `>= 14pt bold`).
  * `SPACING_GRID`: Padding, margin, or flex/grid `gap` pixel values that do not adhere to a `4px`/`8px` spatial scale (allowing `0px`, `1px`, `2px` borders, and multiples of `4px`).
  * `TAP_TARGET`: Interactive elements (`button`, `a`, `input`, `[role="button"]`) with rendered bounding boxes smaller than `44x44px` on mobile/tablet viewports.
  * `TYPOGRAPHY_SCALE`: Body paragraph text (`p`, `li`, `input`) rendered at less than `16px` or with unitless line-height less than `1.4`.
* **FR-LINT-02:** **WHERE** a Penpot SVG/JSON file is provided via `--penpot`, **THE SYSTEM SHALL** parse the open-source SVG/CSS attributes and output a deterministic property diff against the live DOM's computed styles.

### 3.4 Separation of Skills & Rubrics (`FR-SKILL`)
* **FR-SKILL-01:** **THE SYSTEM SHALL** package two strictly isolated Agent Skills (`skills/visual-regression/SKILL.md` and `skills/design-qa/SKILL.md`), each paired with a distinct JSON Schema (`output.schema.json`) to prevent prompt instruction dilution.

---

## 4. Canonical Data Contracts

### 4.1 Output Payload Structure (`triage-ready.json` & `design-qa-ready.json`)

| Field Path | Type | Description |
| :--- | :--- | :--- |
| `version` | `"1.0.0"` | Schema version literal |
| `mode` | `"regression" \| "design-qa"` | Execution pipeline mode |
| `targetProvider` | `"openai" \| "anthropic" \| "gemini" \| "local"` | Target VLM grid preset |
| `tileDimensions` | `{ maxWidth: number, maxHeight: number }` | Enforced bounding box dimensions |
| `timestamp` | `string (ISO-8601)` | Generation timestamp |
| `failures[].testId` | `string` | Normalized test or audit identifier |
| `failures[].testTitle` | `string` | Full Playwright test title path or audited URL |
| `failures[].filePath` | `string` | Spec file path or URL |
| `failures[].selector` | `string` | Target DOM locator |
| `failures[].viewports[].project` | `string` | Playwright project/viewport name |
| `failures[].viewports[].viewport` | `{ width: number, height: number }` | Viewport pixel dimensions |
| `failures[].viewports[].diffPixelRatio` | `number` | Ratio of mismatched pixels (`0.0` - `1.0`) |
| `failures[].viewports[].boundingBox` | `{ x, y, width, height }` | Cropped diff region coordinates |
| `failures[].viewports[].ariaSnapshot` | `string` | Scoped YAML AOM snapshot |
| `failures[].viewports[].computedStyles` | `Record<string, string>` | Filtered CSS properties of target node |
| `failures[].viewports[].images.diffBase64` | `string` | Base64 WebP data URI resized to model tile grid |
| `failures[].designContext.heuristicViolations` | `Array<{ rule, element, expected, actual }>` | Deterministic UI linter findings (`design-qa` mode) |
| `failures[].designContext.penpotDeltas` | `Array<{ selector, property, expectedPenpot, actualDom }>` | Open-source Penpot token deltas (`design-qa` mode) |