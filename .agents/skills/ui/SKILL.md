---
name: ui
description: End-to-end UI build, rendered anti-slop visual QA, and Impeccable polish. Use when building, styling, auditing, or polishing UI in sequential phases.
---

# UI Build, Rendered Anti-Slop Visual QA, and Impeccable Polish

Execute the user's UI request in sequential phases using **ZeroVisual** (deterministic rendered DOM math, anti-slop detection, and 1-tile WebP crops) paired with **Impeccable** (visual direction, hierarchy, and craft refinement). Do NOT load all skills upfront—load each skill only when entering its phase.

### Phase 1: Visual Direction & Build
- Load `Impeccable` (`init` / `shape` / `new-work`) and read `PRODUCT.md` and `DESIGN.md` if present.
- Implement the requested UI/layout with strong visual hierarchy, authentic typography, purposeful spacing rhythm, and clean interactive states.

### Phase 2: Live Rendered Visual QA & Anti-Slop Triage
- Ensure the local dev server is running.
- Load `zerovisual-design-qa` and run the ZeroVisual CLI against the live route:
  ```bash
  npx zerovisual design-qa --url <url> --provider anthropic --json
  ```
- Read `./test-results/design-qa-ready.json`, the viewport overview `.webp` tiles, and the clustered 1-tile violation crops (`viewports[].violationCrops[].imagePath`).
- Fix all deterministic ZeroVisual violations first:
  1. **Accessibility & Render Integrity:** `CONTRAST`, `TAP_TARGET` (44×44px mobile), `LAYOUT_OVERFLOW`, `FOCUS_VISIBLE`, `TEXT_OCCLUSION`, `CLIPPED_OVERFLOW`, `BROKEN_IMAGE`, `HIDDEN_AT_REST`, `COLUMN_OVERFLOW`.
  2. **Rendered AI Slop:** `GRADIENT_TEXT`, `AI_SLOP_COLOR`, `DARK_GLOW`, `SIDE_TAB_BORDER`, `GRAY_ON_COLOR`, `NESTED_CARDS`, `ICON_TILE_STACK`, `BANNED_EYEBROW`, `EMOJI_ICON`.
  3. **Typography, Grid & `DESIGN.md` Drift:** `FLAT_TYPE_HIERARCHY`, `HEADING_RHYTHM`, `LINE_LENGTH`, `CRAMPED_PADDING`, `SPACING_GRID`, `TYPOGRAPHY_SCALE`, `DESIGN_SYSTEM_DRIFT`.

### Phase 3: Impeccable Craft Refinement & Pre-Ship Verification
- Follow `suggestedImpeccableCommands` from ZeroVisual's output (e.g., `/impeccable layout`, `/impeccable typeset`, `/impeccable colorize`, `/impeccable distill`, `/impeccable quieter`, `/impeccable adapt`, `/impeccable polish`) to elevate overall visual craft based on the optimized `.webp` tiles and computed CSS.
- Re-run `npx zerovisual design-qa --url <url> --provider anthropic --json` once after batching edits to verify 0 unintended violations remain.
- If Playwright visual regression tests exist for the route, run them and use `zerovisual-regression` to triage any collateral diffs.

### Rules
- Accessibility and rendered visual integrity (`ZeroVisual` deterministic checks) always hold the floor.
- Respect `DESIGN.md` ("the brief wins") and `data-impeccable-ignore` / `data-zerovisual-ignore` waivers for intentional brand choices.
- Never dump raw full-screen Retina PNG screenshots into context; always inspect ZeroVisual's model-aligned `.webp` overview and clustered violation crop tiles.
- At the end, summarize what was built, which rendered AI-slop or layout issues ZeroVisual caught, and how Impeccable polished the final UI.
