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

## 7. Deterministic Design QA Heuristic Linter

In `design-qa` mode, ZeroVisual runs a rigorous mathematical linter on your live DOM before engaging AI:

- **WCAG 2.1 AA Contrast Ratio:** Calculates relative luminance using the official W3C formula:
  $$L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
  $$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
  Flags any normal text with contrast $< 4.5:1$ and large text $< 3:1$.
- **8pt / 4px Spatial Grid Rhythm:** Checks whether element margins, paddings, and layout gaps adhere to multiples of 4px or 8px.
- **Mobile Tap Target Compliance:** Validates that interactive buttons, links, and form inputs meet the minimum 44×44px physical touch target requirement.
- **Typographic Scale Hierarchy:** Audits font sizes and line heights against balanced typographic progressions.

---

## 8. Open-Source Penpot SVG & Design Token Diffing

Proprietary design tools like Figma lock developer teams into paid subscription APIs. ZeroVisual natively supports **Penpot**, the leading open-source design tool:

1. ZeroVisual parses exported Penpot SVG artboards and design token JSON files using `fast-xml-parser`.
2. It extracts SVG presentation attributes: `fill`, `stroke`, `font-family`, `font-size`, `font-weight`, `rx`, and geometry.
3. It performs a deterministic mathematical diff against the live computed CSS styles of matching DOM elements.
4. Token discrepancies (e.g., `#6366f1` intended in Penpot vs. `#4f46e5` rendered in DOM) are listed directly in the `design-qa-ready.json` payload.

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

## 10. Model Context Protocol (MCP) Server

ZeroVisual runs an official stdio MCP server (`zerovisual-mcp`), allowing Cursor, Claude Code, Windsurf, and Antigravity to interact natively:

- **Tools:**
  - `list_visual_failures`: Discovers all failing visual tests in the current project workspace.
  - `get_visual_failure_bundle`: Retrieves the model-aligned WebP images, AOM YAML snapshot, and computed styles for a given `testId`.
  - `audit_live_ui_design`: Spawns headless Playwright against a local URL, runs the deterministic heuristic linter and Penpot diff, and returns an optimized critique payload.
- **Prompts:**
  - `triage-regression`: Formats the regression bundle into a forensic triage prompt with strict schema enforcement.
  - `critique-ui-design`: Formats the design QA bundle into a structured UI/UX audit prompt.
