---
title: How It Works (Deep Dive)
description: A comprehensive architectural breakdown of the 10 core features powering ZeroVisual.
sidebar:
  order: 2
---

ZeroVisual is designed as an intelligent, token-optimizing firewall situated between your browser visual tests (or live web UI) and your Vision Large Language Models.

Instead of naively streaming high-resolution 4 MB PNG screenshots into an AI agent, ZeroVisual executes a two-stage pipeline: **Deterministic First, AI Second**.

---

## 1. Deterministic First, AI Second (The Zero-Token Law)

The fundamental law of ZeroVisual is: **Passing tests must consume zero AI tokens and incur zero image processing overhead.**

```
[Playwright Visual Test Run]
            │
      toHaveScreenshot()
            │
    ┌───────┴───────┐
    ▼               ▼
 [PASS]          [FAIL]
    │               │
 Native Exit     ZeroVisual Intercepts Failure
(0 AI Tokens)       ├── Detects Diff Bounding Box
                    ├── Model-Aware Grid Resizing (WebP q80)
                    ├── Scopes AOM (ariaSnapshot) + CSS
                    └── Emits ./test-results/triage-ready.json
```

- When Playwright's native pixel comparison passes within tolerance, ZeroVisual immediately yields control. No Sharp image processing, no file transformations, and no LLM API calls are executed.
- ZeroVisual only activates when Playwright reports an actual visual regression diff (`diff.png`, `actual.png`, `expected.png`) or when explicitly invoked for a live design audit.

---

## 2. Bounding Box Detection & 32px Clamped Context Padding

When a visual test fails, sending the full 1920×1080 canvas introduces visual noise and distracts the LLM from the subtle shift. ZeroVisual isolates the exact region of change:

1. **Pixel-Level Diff Scanning:** ZeroVisual scans the raw RGBA buffer of `diff.png` to find the exact bounding box `[minX, minY, maxX, maxY]` enclosing all changed pixels.
2. **Clamped Context Padding (Default: 32px):** An isolated 20×10px button diff lacks visual context (the model cannot tell where it sits in the navbar). ZeroVisual pads the bounding box by 32px in all directions:
   $$\text{minX} = \max(0, \text{box.minX} - 32)$$
   $$\text{minY} = \max(0, \text{box.minY} - 32)$$
   $$\text{maxX} = \min(\text{width}, \text{box.maxX} + 32)$$
   $$\text{maxY} = \min(\text{height}, \text{box.maxY} + 32)$$
3. **Synchronized Cropping:** The exact same padded bounding box is applied across all three artifact images: `actual.png`, `expected.png`, and `diff.png`.

---

## 3. Model-Aware Tile Grid Alignment & `withoutEnlargement`

Modern Vision LLMs do not perceive images as continuous pixel matrices. They partition incoming images into a grid of discrete visual tokens (patches or tiles).

| Provider | Tile / Patch Mechanics | Target Max Box |
| :--- | :--- | :--- |
| **OpenAI** (`gpt-4o`, `gpt-4o-mini`) | 512×512 pixel tiles + 85-token base overview | `512 × 512 px` |
| **Anthropic** (`claude-3-5-sonnet`, `claude-3-7-sonnet`) | 28×28 pixel patches (up to 18×18 patches in 1 tile) | `504 × 504 px` |
| **Google Gemini** (`gemini-2.0-flash`, `gemini-1.5-pro`) | 768×768 native tile (or 384×384 in low-token mode) | `768 × 768 px` / `384 × 384 px` |
| **Local VLMs** (Qwen-VL, Gemma, Llama-Vision) | Patch-based ViT grids (default 448×448) | `448 × 448 px` |

### Why `withoutEnlargement: true` is Critical

When Sharp resizes an image with `{ fit: 'inside', withoutEnlargement: true }`:
- **If the cropped diff is large (e.g., 1400×900):** Sharp scales it down to fit within the 512×512 or 504×504 box, ensuring it never spills over into multiple expensive vision tiles.
- **If the cropped diff is small (e.g., a 120×48 button):** Sharp **never enlarges** the image to 512×512.
  - *No Blurry Anti-Aliasing:* Upscaling 120px to 512px would blur crisp text and introduce artificial artifacts.
  - *Extreme Token Savings:* On Anthropic (28×28 patches), a 184×112 padded diff is tokenized into just `7 × 4 = 28 tokens`, compared to `18 × 18 = 324 tokens` for a full 504px tile, and `2,691 tokens` for the raw 1920×1080 canvas!

---

## 4. WebP Quality 80: Network Bytes vs. Vision Token Economics

There is a common misconception that lowering image quality reduces Vision LLM token usage. In reality:

1. **Vision Tokens Depend Solely on Pixel Dimensions ($W \times H$):**
   - Vision Transformers (ViTs) divide images into geometric patches (e.g., 28×28px).
   - A 504×504 image consumes 324 tokens whether it is saved as an uncompressed 2 MB PNG or an 18 KB WebP file!
2. **Network Bytes Impact IPC Latency, Memory, and Agent Snappiness:**
   - Visual regression artifacts are serialized into JSON as Base64 strings (+33% byte inflation).
   - A standard Playwright failure with 3 viewports produces 9 raw PNG screenshots ($\sim 36\text{ MB}$ raw $\to 48\text{ MB}$ Base64 string).
   - Injecting a 48 MB string over Node.js `stdio` or HTTP blocks the V8 event loop, freezes IDE coding agents (Cursor, Claude Code), and causes IPC timeouts.
   - ZeroVisual encodes images to **WebP at quality 80**, dropping image size from **4,000 KB to ~35 KB (99% reduction)** with zero perceptual loss to OCR or UI element detection.

---

## 5. Multi-Viewport Failure Aggregation (One Prompt for Desktop + Tablet + Mobile)

In responsive web design, a CSS layout regression rarely breaks in isolation—a broken container typically fails simultaneously on `Desktop Chrome`, `Tablet Safari`, and `Mobile iPhone 14`.

Traditional test runners dump three unrelated test failure records. An automated agent would triage them as three distinct bugs, invoking the LLM three times.

ZeroVisual normalizes test identifiers by stripping project and viewport suffixes:
```typescript
// Normalization logic:
"tests/checkout.spec.ts:checkout-modal [Desktop Chrome]" ──┐
"tests/checkout.spec.ts:checkout-modal [Mobile Safari]"   ──┼──► testId: "tests/checkout.spec.ts:checkout-modal"
"tests/checkout.spec.ts:checkout-modal [Tablet Chrome]"   ──┘
```

All failing viewports are combined into a single entry in `triage-ready.json`. Your AI agent inspects the cross-viewport correlation in **one single prompt**, immediately pinpointing the faulty CSS media query or flexbox container.

---

## 6. Scoped Semantic Context Extraction (AOM + CSS)

Vision alone is ambiguous: an AI agent cannot guess why an element shifted 8 pixels without reading the DOM. But dumping the entire HTML DOM (often 100,000+ characters) overwhelms the context window.

ZeroVisual extracts targeted, scoped semantic context:

1. **Accessibility Object Model (`ariaSnapshot`):** ZeroVisual uses Playwright's native `locator.ariaSnapshot()` to capture the hierarchical YAML accessibility tree of the failing component. This gives the model a concise, semantic map of landmarks, buttons, and headings with zero HTML tag bloat.
2. **14 Core Computed CSS Layout Properties:** ZeroVisual extracts only the 14 properties responsible for layout, typography, and contrast:
   `display`, `flexDirection`, `justifyContent`, `alignItems`, `padding`, `margin`, `gap`, `width`, `height`, `fontSize`, `fontWeight`, `lineHeight`, `color`, and `backgroundColor`.

---

## 7. Deterministic Design QA & Rendered Anti-Slop Linter

In `design-qa` mode, ZeroVisual evaluates up to 250 rendered DOM elements per viewport across 26 deterministic rules before engaging AI—and routes every finding to its corresponding **[Impeccable](https://impeccable.style/)** command:

- **WCAG 2.1 AA Contrast Ratio (`CONTRAST`):** Calculates relative luminance (including OKLCH/OKLab/HSL and dark-mode canvas traversal) using the official W3C formula:
  $$L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
  $$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
  Flags normal text $< 4.5:1$ and large text $< 3:1$ ($\to$ `/impeccable colorize`).
- **Surface & Color AI Slop (`GRADIENT_TEXT`, `AI_SLOP_COLOR`, `DARK_GLOW`, `SIDE_TAB_BORDER`, `GRAY_ON_COLOR`):**
  Flags decorative `background-clip: text` gradients, unapproved purple/violet/indigo gradients, zero-offset chromatic glow shadows and radial spotlight halos, thick colored side-tab borders (`border-left > 1px`), and washed-out neutral gray text on saturated colored surfaces ($\to$ `/impeccable colorize`, `/impeccable quieter`, `/impeccable distill`, `/impeccable typeset`).
- **Scaffold & Layout Structure Slop (`NESTED_CARDS`, `ICON_TILE_STACK`, `BANNED_EYEBROW`, `EMOJI_ICON`):**
  Detects cards nested inside cards, repeated "small rounded icon box stacked above heading" card templates, kicker/eyebrow pills or `01/02/03` numeric badges above headings, and raw Unicode emoji used as UI icons ($\to$ `/impeccable distill`, `/impeccable layout`, `/impeccable polish`).
- **Typography Hierarchy & Spatial Rhythm (`FLAT_TYPE_HIERARCHY`, `HEADING_RHYTHM`, `LINE_LENGTH`, `CRAMPED_PADDING`, `SPACING_GRID`, `TYPOGRAPHY_SCALE`):**
  Audits heading-to-body scale progression ($\ge 1.25\times$ step, no inverted headings), verifies space above a heading exceeds space below it, enforces `65ch–75ch` reading measure and horizontal viewport gutters, checks for cramped container padding, and validates `4px`/`8px` grid rhythm ($\to$ `/impeccable typeset`, `/impeccable layout`).
- **Rendered Visual Integrity & Accessibility (`TAP_TARGET`, `FOCUS_VISIBLE`, `ACCESSIBILITY`, `LAYOUT_OVERFLOW`, `TEXT_OCCLUSION`, `CLIPPED_OVERFLOW`, `BROKEN_IMAGE`, `HIDDEN_AT_REST`, `COLUMN_OVERFLOW`):**
  Detects overlapping occluded text, unintended clipping (`scrollWidth > clientWidth` inside `overflow: hidden`), unloaded/0px `<img>` tags, content left at `opacity: 0` at rest, first-viewport column height imbalance, and mobile touch targets $< 44\times44\text{px}$ ($\to$ `/impeccable adapt`, `/impeccable harden`, `/impeccable layout`).
- **Clustered 1-Tile Violation Crops (`violationCrops`):**
  In addition to the 1-tile above-the-fold overview, ZeroVisual spatially clusters nearby violation bounding boxes (including below-the-fold defects), crops up to 4 clean regions (+32px context padding) from the full-page render, and encodes each as a model-aligned 1-tile `.webp` artifact.

---

## 8. Native `DESIGN.md` Drift Checking ("The Brief Wins") & Open-Source Penpot Diffing

ZeroVisual supports both **[Impeccable](https://impeccable.style/) `DESIGN.md`** specifications and open-source **Penpot / W3C DTCG** design tokens:

1. **Auto-Discovered `DESIGN.md` (`DESIGN_SYSTEM_DRIFT`):**
   - Extracts declared font families, palette colors (hex, rgb, hsl, oklch), border-radius scales, and font-size ramps from `DESIGN.md`.
   - **"The Brief Wins":** If `DESIGN.md` explicitly commits to a violet/purple brand color or neobrutalist hard-offset shadows, ZeroVisual automatically exempts those tokens from AI-slop rules while flagging rendered DOM elements whose computed font, color, radius, or type size drifts outside `DESIGN.md`.
   - **Shared Waivers:** Honors `data-impeccable-ignore`, `data-zerovisual-ignore`, and `.impeccable/config.json` (`detector.ignoreRules`).
2. **Open-Source Penpot SVG & W3C DTCG Token Diffing:**
   - Parses exported Penpot SVG artboards, Penpot JSON bundles, and W3C DTCG (`$value`, `$type`) files to compute deterministic property deltas (`penpotDeltas`) against live DOM `getComputedStyle` values.

---

## 9. Dual Isolated Agent Skills

To prevent instruction dilution and prompt pollution, ZeroVisual maintains two strictly isolated Agent Skills:

- **`skills/zerovisual-regression`:**
  - Role: Strict, forensic QA triage engineer.
  - Output: Typed JSON matching `output.schema.json` (`verdict: "PASS" | "FAIL" | "ACCEPT_INTENTIONAL"`, `confidence`, `rootCause`, `affectedElements`).
  - Rules: Never suggests speculative redesigns; only determines if visual change is a regression or intentional update.
- **`skills/zerovisual-design-qa`:**
  - Role: Expert UI/UX engineering mentor.
  - Output: Typed JSON critique with actionable, copy-paste CSS and Tailwind classes to fix spacing rhythm, contrast, and alignment.

---

## 10. Bundled Skill Scripts (`skills/*/scripts/*.mjs`)

Instead of requiring users to configure IDE-specific MCP servers or maintain background `stdio` processes, ZeroVisual packages executable runner scripts directly inside each skill directory:

- **`skills/zerovisual-optimize/scripts/optimize.mjs`**: Optimizes screenshots to `.optimized.webp` and computes token/byte savings.
- **`skills/zerovisual-design-qa/scripts/design-qa.mjs`**: Launches headless Playwright against a live URL, evaluates deterministic heuristics + Penpot tokens, and saves `.webp` viewport screenshots to `./test-results/artifacts/`.
- **`skills/zerovisual-regression/scripts/regression.mjs`**: Crops and downscales Playwright diff images to `./test-results/artifacts/*.webp` and emits `./test-results/triage-ready.json`.

Each script automatically resolves a local installation of `zerovisual` if present, or falls back to `npx --yes zerovisual` on demand—giving users a **1-command installation** (`npx skills add hotcode-dev/zerovisual`) with zero idle context overhead.
