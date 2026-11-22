---
title: Using ZeroVisual with Impeccable
description: Pair ZeroVisual's rendered anti-slop DOM math and clustered 1-tile WebP crops with Impeccable's frontend design craft for fast, zero-waste UI iteration.
sidebar:
  order: 5
---

**[Impeccable](https://impeccable.style/)** is a frontend design skill that gives AI coding agents creative direction, UX hierarchy, and targeted refinement commands (`polish`, `layout`, `typeset`, `colorize`, `distill`, `quieter`, `bolder`, `adapt`, `harden`, `audit`, `critique`).

**ZeroVisual** and **Impeccable** solve complementary halves of the frontend quality loop:

| Concern | ZeroVisual | Impeccable |
| :--- | :--- | :--- |
| **Strength** | **Rendered browser math, anti-slop detection & 1-tile visual crops** (WCAG 2.1 contrast, 4px/8px grid, 44px tap targets, rendered AI-slop detection, `DESIGN.md` drift, clustered 1-tile WebP violation crops) | **Subjective craft & design direction** (visual hierarchy, typography, color harmony, layout rhythm, UX copy, polish) |
| **Role in Loop** | Measures the live rendered DOM deterministically (0 tokens), crops both above- and below-the-fold defects into 1-tile `.webp` snapshots, and maps violations to `/impeccable` commands | Reads the findings + cropped `.webp` tiles and applies cohesive, production-grade UI fixes |

---

## 1. Install Both Agent Skills

Equip your coding agent (Cursor, Claude Code, Windsurf, or Antigravity) with both skills in two commands:

```bash
# Install ZeroVisual (visual regression, design-qa + rendered anti-slop, screenshot optimizer)
npx skills add hotcode-dev/zerovisual

# Install Impeccable (frontend design craft & refinement commands)
npx skills add pbakaus/impeccable
```

---

## 2. What ZeroVisual Catches for Impeccable in the Rendered Browser

When you run `npx zerovisual design-qa --url http://localhost:3000`, ZeroVisual launches headless Playwright across Desktop (`1440×900`) and Mobile (`390×844`), inspects up to 250 rendered DOM elements, and maps every violation to its target Impeccable command:

| Category | Deterministic Rendered Rules | Target Impeccable Command |
| :--- | :--- | :--- |
| **Surface & Color AI Slop** | `GRADIENT_TEXT`, `AI_SLOP_COLOR` (violet/indigo gradients), `DARK_GLOW` (chromatic glow halos & radial spotlights), `SIDE_TAB_BORDER` (thick colored left/right borders), `GRAY_ON_COLOR` | `/impeccable colorize`, `/impeccable quieter`, `/impeccable distill`, `/impeccable typeset` |
| **Scaffold & Layout Slop** | `NESTED_CARDS` (card-in-card), `ICON_TILE_STACK` (3-card icon-box above heading template), `BANNED_EYEBROW` (kicker pills & `01/02/03` badges), `EMOJI_ICON` | `/impeccable distill`, `/impeccable layout`, `/impeccable polish` |
| **Typography & Spatial Rhythm** | `FLAT_TYPE_HIERARCHY` (`<1.25×` scale or inverted headings), `HEADING_RHYTHM` (space above `<=` space below), `LINE_LENGTH` (`>75ch` or flush to viewport edge), `CRAMPED_PADDING`, `SPACING_GRID`, `TYPOGRAPHY_SCALE` | `/impeccable typeset`, `/impeccable layout` |
| **Rendered Visual Integrity & A11y** | `CONTRAST`, `TAP_TARGET` (`<44×44px` mobile), `LAYOUT_OVERFLOW`, `FOCUS_VISIBLE`, `ACCESSIBILITY`, `TEXT_OCCLUSION`, `CLIPPED_OVERFLOW`, `BROKEN_IMAGE`, `HIDDEN_AT_REST`, `COLUMN_OVERFLOW` | `/impeccable adapt`, `/impeccable harden`, `/impeccable layout`, `/impeccable polish` |
| **`DESIGN.md` & Token Drift** | `DESIGN_SYSTEM_DRIFT` (auto-discovers `DESIGN.md` fonts, palette colors, border-radius scale, and font-size ramp; honors `data-impeccable-ignore` & `.impeccable/config.json`) | `/impeccable polish` |

---

## 3. Workflow A: Audit → Crop → Refine → Verify Loop (`design-qa` + Impeccable)

Instead of squishing an entire long page into a single blurry thumbnail—or burning 8,000+ vision tokens on raw full-page Retina PNGs—ZeroVisual outputs:
1. **1-Tile Viewport Overview** (`<testId>-desktop.webp`, `<testId>-mobile.webp`).
2. **Up to 4 Clustered 1-Tile Violation Crops per Viewport** (`<testId>-desktop-crop-1.webp`, etc.) so below-the-fold defects and small UI components render at crisp 1:1 patch fidelity.

```text
[1. ZeroVisual design-qa (0 AI Tokens for Math)]
   Audits live DOM + AI Slop + DESIGN.md + Overview & Clustered Violation .webp Crops
        │
        ▼
[2. Impeccable (suggestedImpeccableCommands: layout / typeset / colorize / distill / polish)]
   Inspects crisp 1-tile violation crops, eliminates AI slop & upgrades visual hierarchy
        │
        ▼
[3. Re-run ZeroVisual design-qa]
   Confirms 0 violations & visually verifies at < 300 vision tokens per tile
```

### Step 1: Run ZeroVisual Design QA against your local dev server

```bash
npx zerovisual design-qa \
  --url http://localhost:3000 \
  --provider anthropic \
  --json
```

### Step 2: Prompt your agent with Impeccable + ZeroVisual output

```text
Run `npx zerovisual design-qa --url http://localhost:3000 --provider anthropic --json`
and inspect `./test-results/design-qa-ready.json`, the viewport overview `.webp` tiles,
and each clustered violation crop in `viewports[].violationCrops`.

Follow `suggestedImpeccableCommands` using the `impeccable` skill (`distill`, `colorize`,
`typeset`, `layout`, `adapt`, `polish`) to:
1. Fix every deterministic accessibility, layout, and render-integrity violation.
2. Eliminate all rendered AI slop (gradient text, violet gradients, glowing halos,
   side-tab borders, nested cards, icon-tile stacks, and eyebrow badges) while
   honoring `DESIGN.md`.
3. Re-run `zerovisual design-qa` once after batching your edits to confirm all checks pass.
```

---

## 4. Workflow B: Token-Efficient Visual Checks During Redesigns (`optimize` + Impeccable)

Use `zerovisual optimize` before feeding screenshots into an Impeccable `critique` or `polish` pass:

```bash
# Optimize Desktop & Mobile captures to exact Anthropic 504x504 tiles (~80-90% fewer tokens)
npx zerovisual optimize ./screenshots --provider anthropic
```

---

## 5. Workflow C: Regression Guardrail After Impeccable Polish (`regression` + Playwright)

Run your Playwright visual suite with `zerovisual/reporter` configured after a broad Impeccable refinement (`distill`, `layout`, or `typeset`) to catch collateral breakpoint regressions at 0 tokens for passing tests.
