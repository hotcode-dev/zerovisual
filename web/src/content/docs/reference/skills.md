---
title: Agent Skills Reference
description: Specification and JSON schemas for ZeroVisual's isolated AI Agent Skills.
sidebar:
  order: 2
---

ZeroVisual adheres strictly to the **Separation of Concerns Law**: visual regression forensics and UI/UX design coaching require fundamentally different reasoning modes. Mixing them leads to prompt pollution and hallucinations.

ZeroVisual provides two isolated, strictly-typed Agent Skills installed via `npx skills add`.

---

## 1. `zerovisual-regression`

- **Location:** `skills/zerovisual-regression/SKILL.md`
- **Bundled Script:** `skills/zerovisual-regression/scripts/regression.mjs`
- **Output Schema:** `skills/zerovisual-regression/output.schema.json`
- **Role:** Forensic QA Triage Engineer

### Responsibilities
- Correlates multi-viewport failures to determine if an issue stems from responsive breakpoints, sub-pixel font anti-aliasing, or true layout regressions.
- Inspects the Playwright Accessibility Object Model (`ariaSnapshot`) to confirm whether semantics or interactions broke.
- Never suggests unsolicited design alterations or stylistic changes.

### Output JSON Format
```json
{
  "testId": "tests/checkout.spec.ts:checkout-modal",
  "verdict": "FAIL",
  "confidence": 0.95,
  "rootCause": "The submit button padding shifted from 12px to 24px, wrapping the button text into two lines on mobile viewport.",
  "affectedElements": ["button[data-testid='submit-checkout']"],
  "suggestedFix": "Restore button padding to '0.75rem 1rem' in CheckoutModal.tsx."
}
```

---

## 2. `zerovisual-design-qa`

- **Location:** `skills/zerovisual-design-qa/SKILL.md`
- **Bundled Script:** `skills/zerovisual-design-qa/scripts/design-qa.mjs`
- **Output Schema:** `skills/zerovisual-design-qa/output.schema.json`
- **Role:** UI/UX Engineering Mentor, Rendered Anti-Slop Auditor & Impeccable Companion

### Responsibilities
- Evaluates the live rendered web page across Desktop (`1440×900`) and Mobile (`390×844`) for visual hierarchy, rhythm, spacing, contrast, and rendered AI-slop patterns.
- Ingests 26 deterministic heuristic and anti-slop rules:
  - **Accessibility & Grid:** `CONTRAST`, `SPACING_GRID`, `TAP_TARGET`, `TYPOGRAPHY_SCALE`, `ACCESSIBILITY`, `LAYOUT_OVERFLOW`, `FOCUS_VISIBLE`.
  - **Surface & Color AI Slop:** `AI_SLOP_COLOR`, `GRADIENT_TEXT`, `DARK_GLOW`, `SIDE_TAB_BORDER`, `GRAY_ON_COLOR`.
  - **Scaffold & Layout Slop:** `NESTED_CARDS`, `ICON_TILE_STACK`, `BANNED_EYEBROW`, `EMOJI_ICON`.
  - **Typography & Spatial Rhythm:** `FLAT_TYPE_HIERARCHY`, `HEADING_RHYTHM`, `LINE_LENGTH`, `CRAMPED_PADDING`.
  - **Rendered Visual Integrity & Design Tokens:** `TEXT_OCCLUSION`, `CLIPPED_OVERFLOW`, `BROKEN_IMAGE`, `HIDDEN_AT_REST`, `COLUMN_OVERFLOW`, `DESIGN_SYSTEM_DRIFT`, `PENPOT_TOKEN`.
- Inspects both the 1-tile viewport overview and up to 4 clustered 1-tile `.webp` violation crops (`viewports[].violationCrops[].imagePath`) and maps each violation to its target `/impeccable` command (`suggestedCommand`).

### Output JSON Format
```json
{
  "url": "http://localhost:3000",
  "verdict": "needs_revision",
  "overallScore": 76,
  "violations": [
    {
      "rule": "GRADIENT_TEXT",
      "element": "h1.hero-title",
      "severity": "warning",
      "recommendation": "Replace decorative gradient text with solid ink color and let scale and weight carry emphasis.",
      "cssFix": "background: none; -webkit-text-fill-color: currentColor; color: var(--ink);",
      "suggestedCommand": "/impeccable typeset",
      "cropImagePath": "./test-results/artifacts/design-qa-http-localhost-3000-desktop-crop-1.webp"
    },
    {
      "rule": "CONTRAST",
      "element": "p.text-muted",
      "severity": "critical",
      "recommendation": "Contrast ratio of 2.8:1 fails WCAG 2.1 AA requirement of 4.5:1.",
      "cssFix": "color: #475569;",
      "suggestedCommand": "/impeccable colorize",
      "cropImagePath": "./test-results/artifacts/design-qa-http-localhost-3000-desktop-crop-2.webp"
    }
  ],
  "recommendations": [
    "Remove gradient text and purple glow halos on the hero section",
    "Increase secondary text contrast to at least 4.5:1"
  ],
  "suggestedImpeccableCommands": [
    "/impeccable typeset",
    "/impeccable colorize"
  ],
  "suggestedTailwindCss": "text-slate-900 dark:text-slate-50 p-6 rounded-xl"
}
```

---

## 3. `zerovisual-optimize`

- **Location:** `skills/zerovisual-optimize/SKILL.md`
- **Bundled Script:** `skills/zerovisual-optimize/scripts/optimize.mjs`
- **Role:** Vision Image Pre-Processing & Token Optimizer

### Responsibilities
- Identifies uncompressed screenshots (such as macOS high-DPI `2880×1800` captures or 4 MB PNG images) provided by the user.
- Pre-processes them with model-aware tile math before dispatching to Vision LLMs.
- Enforces downscaling to 504px (Anthropic), 512px (OpenAI), 768px/384px (Gemini), or 448px (Local), and compression to WebP (quality 80) to eliminate up to 90% vision tokens and 99% network payload.
- Invokes the bundled `scripts/optimize.mjs` script or `npx -y zerovisual optimize` CLI command.

