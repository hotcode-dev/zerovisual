---
type: 'Reference'
title: 'Core Architecture'
openwiki_generated: true
verified:
  - by: openwiki/0.6.0
    at: 2026-11-25T04:42:05.705Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c9b68c1ec65785fb8f874561
    resource: repo://src/cli/commands/design-qa.ts
  - id: openwiki-source-0181d768c7efe6c172eaed40
    resource: repo://src/cli/commands/regression.ts
  - id: openwiki-source-69f1465f9bd0baca2064728f
    resource: repo://src/cli/index.ts
  - id: openwiki-source-d3d638c0026b8fe6e9621201
    resource: repo://src/core/dom-extractor.ts
  - id: openwiki-source-456bd70f796d43364f64dac6
    resource: repo://src/core/heuristic-linter.ts
  - id: openwiki-source-1afa574ad18f7e63b9aa7c5a
    resource: repo://src/core/image-optimizer.ts
  - id: openwiki-source-c73b291419f20c4ef5f5d390
    resource: repo://src/core/provider-math.ts
  - id: openwiki-source-fcfa378919a67d3878b7c601
    resource: repo://src/core/schema.ts
  - id: openwiki-source-22b1ee49eff2753449fdd489
    resource: repo://src/reporter/fixture.ts
  - id: openwiki-source-a32c2dfada562f1cb536dd07
    resource: repo://src/reporter/playwright-reporter.ts
generated: { by: 'hermes', at: '2026-11-25T04:42:05.705Z' }
---

# Core Architecture

ZeroVisual's core is a **deterministic, zero-LLM layer**: pixel diff analysis, provider-aware image resizing, DOM context extraction, and rule-based design linting. No LLM API is called; only when a failure is detected does the pipeline hand an optimized, compact payload to an AI agent. All data crossing the agent boundary is Zod-validated (`src/core/schema.ts`) before it is written to disk.

## Module map

| Module                         | Role                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `src/core/schema.ts`           | Zod schemas + inferred types for every cross-boundary structure                 |
| `src/core/provider-math.ts`    | Dependency-free tile/patch/token math per VLM provider (browser-safe, no sharp) |
| `src/core/image-optimizer.ts`  | sharp-backed diff detection, crop + resize pipeline, WebP encoding              |
| `src/core/dom-extractor.ts`    | Browser-side DOM context capture and page-level heuristic audit                 |
| `src/core/heuristic-linter.ts` | 26 deterministic design-QA rules (contrast, spacing, AI-slop, render integrity) |
| `src/core/design-md-parser.ts` | DESIGN.md token extraction + tolerant DOM diffing                               |
| `src/core/penpot-parser.ts`    | Penpot SVG/JSON and W3C DTCG token parsing + DOM diffing                        |
| `src/core/schema-generator.ts` | Emits `output.schema.json` verdict schemas for the bundled agent skills         |

## Provider tile math

`PROVIDER_SPECS` in `provider-math.ts` is the single source of truth for per-provider tile dimensions, patch sizes, and token costs:

| Provider  | Tile (px) | Patch (px) | Tokens/patch | Base tokens | Low-token tile |
| --------- | --------- | ---------- | ------------ | ----------- | -------------- |
| openai    | 512×512   | 512        | 170          | 85          | —              |
| anthropic | 504×504   | 28         | 1            | —           | —              |
| qwen      | 504×504   | 28         | 1            | —           | —              |
| gemini    | 768×768   | 768        | 258          | —           | 384×384        |
| gemma     | 768×768   | 768        | 258          | —           | 384×384        |
| llama     | 560×560   | 560        | 324          | —           | —              |
| mistral   | 512×512   | 16         | 1            | —           | —              |
| deepseek  | 384×384   | 384        | 576          | —           | —              |
| local     | 448×448   | 28         | 1            | —           | custom         |

`getProviderDimensions(provider, lowTokenMode?, custom?)` resolves the tile max (local honors `customDimensions`; gemini/gemma halve in low-token mode), and `estimateVisionTokens` computes `(baseTokens ?? 0) + ceil(w/patch) * ceil(h/patch) * tokensPerPatch`. The module is intentionally dependency-free so the docs-site TokenCalculator can import it in the browser; it is re-exported through `image-optimizer.ts`.

## Diff detection and image optimization

`detectDiffBoundingBox(imageBuffer, { padding?, diffPixelMatcher? })` scans raw RGBA (via `sharp().ensureAlpha().raw()`) with a pluggable matcher — default flags red-diff (R≥190, G≤100, B≤120), magenta/rose, and high-saturation red-dominant pixels. It tracks min/max bounds, falls back to the full image when no diff pixels exist, applies clamped padding (default 32px), and returns the box plus `diffPixelCount`, `totalPixels`, and `diffPixelRatio` (capped at 1.0).

`optimizeImageForProvider(buffer, { provider, lowTokenMode, customDimensions, cropBox, quality })` then: (1) crops to the clamped box if supplied, (2) resizes with `fit: 'inside'` and `withoutEnlargement: true` — **never upscales** — into the provider tile rectangle, (3) encodes WebP at quality 80 default, returning `dataUri`, `buffer`, final dimensions, and `tileDimensions`.

## DOM context extraction

- `captureDomContext(page, selectorOrBox?, options?)` — used by the fixture on a failing test. Resolves a CSS selector or the element at a `BoundingBox` center via `elementFromPoint`, then one `page.evaluate` reads 35 allowed computed-style properties, resolves the effective background by walking up the DOM, and collects accessibility attributes. Back in Node it attempts `locator.ariaSnapshot()` (synthetic `- <tag> "<selector>"` fallback) and runs `lintElementHeuristics` inline.
- `auditPageHeuristics(page, options?)` — full-page scan for design-qa. In-browser it selects up to **250 candidate elements** (all interactive elements; containers only if they have a visual surface or direct text) and computes per-element signals: card-ness, nested-card, icon-tile-above-heading, banned-eyebrow, heading-rhythm spacing, broken images, unintended text overflow, hidden-at-rest, column-overflow-imbalance. Per-element `data-impeccable-ignore` / `data-zerovisual-ignore` attributes and a global `ignoreRules` list are respected. Back in Node it runs per-element lint plus the two page-level rules that need the full element set: `FLAT_TYPE_HIERARCHY` and `DESIGN_SYSTEM_DRIFT`.

Browser-side helpers (`getEffectiveBg` / `applyEffectiveBgFallback`) are injected as a string and instantiated with `new Function`; under Playwright/CDP this bypasses page CSP. Heavy math (color, contrast) stays in Node.

## Heuristic design-QA linter

`HeuristicRuleSchema` defines **26 rules** in six categories — accessibility (CONTRAST, TAP_TARGET, ACCESSIBILITY, FOCUS_VISIBLE), layout (SPACING_GRID, LAYOUT_OVERFLOW, CRAMPED_PADDING), typography (TYPOGRAPHY_SCALE, FLAT_TYPE_HIERARCHY, HEADING_RHYTHM, LINE_LENGTH), ai-slop (AI_SLOP_COLOR, GRADIENT_TEXT, DARK_GLOW, SIDE_TAB_BORDER, GRAY_ON_COLOR, NESTED_CARDS, ICON_TILE_STACK, BANNED_EYEBROW, EMOJI_ICON), render-integrity (TEXT_OCCLUSION, CLIPPED_OVERFLOW, BROKEN_IMAGE, HIDDEN_AT_REST, COLUMN_OVERFLOW), and design-system (DESIGN_SYSTEM_DRIFT). `RULE_METADATA` pins each rule's category, severity, suggested `/impeccable` command, and waiver aliases.

`lintElementHeuristics` runs per element in fixed order: WCAG 2.1 contrast (4.5:1 normal, 3.0:1 large text, alpha-composited over canvas), 4px spacing-grid check (0/1/2px exempt), 44×44px tap targets on mobile, typography scale (≥12px, ≥16px body, line-height ≥1.4), focus visibility, mobile overflow, a11y attributes, then four slop/integrity suites (surface & color slop; scaffold/structure slop; typography & rhythm slop; rendered visual integrity). `parseColor` normalizes hex/rgb(a)/hsl(a)/oklch/oklab/named colors, falling back to black on parse failure.

Violations are waived when the rule or an alias appears in element/ancestor `data-*-ignore` attributes or in `.impeccable/config.json` → `detector.ignoreRules` (`*`/`all` waives everything; malformed config is ignored silently).

`clusterViolationBoundingBoxes` merges boxes intersecting within 96px (skipping boxes covering ≥90% of the viewport), sorts clusters by severity weight (critical 3 / warning 2 / advisory 1) then violation count, and returns up to `maxCrops` (default 4) with 32px context padding — used by the design-qa command to build 1-tile violation crops.

## Design-token diffing

- `parseDesignMd` extracts colors (all CSS syntaxes, deduped by RGB), font families, radius values, and font-size ramps, plus two exemption flags (`allowsVioletPalette`, `allowsHardOffsetShadow` for neobrutalist). Discovery order: `DESIGN.md`, `.impeccable/DESIGN.md`, `docs/DESIGN.md`. `diffDesignMdAgainstDom` matches tolerantly: font containment, EUCLIDEAN RGB distance ≤22, radius within 2px, font size within 1px.
- `parsePenpotTokens(content, 'svg'|'json'|'dtcg')` parses Penpot SVG exports (`fast-xml-parser`), Penpot JSON node bundles, or W3C DTCG `$value`/`$type` trees (token paths become CSS selectors). `diffPenpotAgainstDom` normalizes both sides (colors → `rgb()`, dimensions → rounded px, normal/bold → 400/700) and reports mismatches as `PenpotDelta[]`.

## CLI and Playwright surfaces

Both execution surfaces wrap the same core and emit the same Zod-validated `TriagePayload`.

- **CLI wiring** (`src/cli/index.ts`): a citty app whose root registers `regression`, `design-qa`, `optimize`, `estimate`. Both bins (`zerovisual`, `zerovisual-optimize`) point at `dist/cli/index.js`; when launched as `zerovisual-optimize`, `runMain` executes `optimizeCommand` directly, skipping the subcommand layer. Every command parses `--provider` through `TargetProviderSchema` and shares `--provider`/`--lowTokenMode`/`--json`; each also exposes a programmatic `run*Command` entry point used by tests and skills.
- **`regression`**: recursively finds `*-diff.png`/`diff.png` under `--input` (default `./test-results`); empty result prints "Zero tokens consumed" and writes nothing. Per file: detect diff box → crop/resize to the provider tile grid → WebP under `<output>/artifacts/<testId>-<project>-diff.webp`, with optional `-actual`/`-expected` companions embedded. `testId` and `project` are inferred from the result-directory name (viewports of one test collapse into one `FailureEntry.viewports[]`). Because there is no live page, the artifact carries a synthesized placeholder `ariaSnapshot` and `computedStyles: { display: 'block' }`.
- **`design-qa`**: audits a required `--url` at two fixed viewports (Desktop 1440×900, Mobile 390×844). Loads `.impeccable/config.json`; when `designSystemEnabled`, auto-discovers DESIGN.md unless `--designMd` overrides; `--penpot` accepts an SVG or JSON token export. It launches its own headless Chromium unless a `browserInstance` is injected (the test seam); a self-launched browser is always closed in `finally`, an injected one never. Per viewport it runs `auditPageHeuristics` + `captureDomContext` + a 1-tile above-the-fold WebP, plus up to `maxCrops` clustered violation crops when violations carry boxes. Output: one `FailureEntry` (`testId: design-qa-<url-slug>`) with all violations in `designContext`, written to `design-qa-ready.json`.
- **`optimize`**: file or directory input (.png/.jpg/.jpeg/.webp/.bmp), skips `.optimized.` names for idempotent re-runs, defaults to provider `anthropic` and quality 80; single-file + explicit `--output` writes to that exact path, everything else writes `<name>.optimized.webp` beside the input, reporting byte/token savings.
- **`estimate`**: pure synchronous calculator — validates `--width`/`--height` as positive integers, reports original vs tile-constrained token counts and savings percent, no I/O.

**Playwright reporter** (`ZeroVisualReporter`): config parsed by `ZeroVisualConfigSchema`. `onTestEnd` enforces the **Zero-Token Law** — passing tests return immediately; failing tests without a `*-diff.png`/`diff.png` attachment are skipped (non-visual failures are out of scope). Per failure it runs the same crop/resize/WebP pipeline, merges real DOM context from an optional `zerovisual-context.json` attachment (silent placeholder fallback), groups failures across projects by `normalizeTestId(titlePath)` into single `FailureEntry` viewports, and in `onEnd` validates the whole payload before writing `triage-ready.json`. `getAggregatedFailures()` exposes the internal map for tests.

**Fixture** (`src/reporter/fixture.ts`): extends Playwright's `test` with an auto fixture that, after the test body, calls `captureDomContext` and attaches `zerovisual-context.json` only when the test failed or timed out and the page is still open. `attachZeroVisualContext(page, testInfo, targetLocatorOrSelector?)` is the explicit variant and returns `null` instead of throwing on capture errors. `expect` is re-exported so specs can switch from `@playwright/test` to `zerovisual` in one import. `isMobileViewport` comes from the project's `use.isMobile`.

## End-to-end failure flow

```
Playwright test fails → toHaveScreenshot() writes -diff.png
  → ZeroVisualReporter.onTestEnd: crop diff bbox, resize to provider tiles, write WebPs
  → (specs using zerovisual's test fixture) zerovisual-context.json attached
  → reporter merges real ariaSnapshot/computedStyles/violations when present
  → group by testId across viewports/projects
  → onEnd: TriagePayloadSchema.parse → triage-ready.json for the AI agent
```

## Invariants and gotchas

- **Zero-Token Law**: passing tests produce zero work; the reporter and CLI short-circuit them entirely.
- **No upscaling**: `withoutEnlargement: true` keeps small diffs small; `fit: 'inside'` preserves aspect ratio within the tile.
- **Schema validation is terminal**: every payload is `.parse()`d at its exit point (regression CLI, reporter `onEnd`, design-qa command) — a shape drift fails fast rather than writing a corrupt artifact.
- **CLI regression placeholders**: only the reporter path can carry real DOM context and heuristic violations; the standalone CLI always emits synthesized placeholders.
- **Default providers differ by command**: `estimate`/`optimize` default to `anthropic`; `regression`/`design-qa` default to `openai` — do not "unify" without checking intent.
- **Artifact naming** is `<testId>-<safeProject>-{diff,actual,expected}.webp`; downstream tooling relies on the kebab-case slugs.
