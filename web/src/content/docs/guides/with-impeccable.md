---
title: Using ZeroVisual with Impeccable
description: Pair ZeroVisual's deterministic math and token-optimized screenshots with Impeccable's frontend design craft for fast, zero-waste UI iteration.
sidebar:
  order: 5
---

**[Impeccable](https://impeccable.style/)** is a frontend design skill that gives AI coding agents creative direction, UX hierarchy, and targeted refinement commands (`polish`, `layout`, `typeset`, `colorize`, `adapt`, `harden`, `audit`, `critique`).

**ZeroVisual** and **Impeccable** solve complementary halves of the frontend quality loop:

| Concern | ZeroVisual | Impeccable |
| :--- | :--- | :--- |
| **Strength** | **Objective math & token efficiency** (WCAG 2.1 contrast, 4px/8px grid, 44px tap targets, mobile overflow, 1-tile WebP screenshots) | **Subjective craft & design direction** (visual hierarchy, typography, color harmony, layout rhythm, UX copy, polish) |
| **Role in Loop** | Measures the rendered DOM deterministically (0 tokens) and compresses screenshots by up to **85–90%** | Reads the findings + optimized screenshots and applies cohesive, production-grade UI fixes |

---

## 1. Install Both Agent Skills

Equip your coding agent (Cursor, Claude Code, Windsurf, or Antigravity) with both skills in two commands:

```bash
# Install ZeroVisual (visual regression, design-qa, screenshot optimizer)
npx skills add hotcode-dev/zerovisual

# Install Impeccable (frontend design craft & refinement commands)
npx skills add pbakaus/impeccable
```

---

## 2. Workflow A: Audit → Refine → Verify Loop (`design-qa` + Impeccable)

Instead of asking a Vision LLM to "eyeball" contrast ratios or pixel spacing from a 4 MB Retina screenshot, let ZeroVisual run deterministic math first, then hand the structured violations and model-aligned `.webp` screenshot to Impeccable.

```text
[1. ZeroVisual design-qa (0 AI Tokens for Math)]
   Captures live DOM + WCAG contrast + 8pt grid + tap targets + 1-tile .webp
        │
        ▼
[2. Impeccable (polish / layout / adapt / harden)]
   Fixes exact mathematical violations AND upgrades hierarchy, typography & craft
        │
        ▼
[3. Re-run ZeroVisual design-qa]
   Confirms 0 heuristic violations & visually verifies at < 300 vision tokens
```

### Step 1: Run ZeroVisual Design QA against your local dev server

```bash
npx zerovisual design-qa \
  --url http://localhost:3000 \
  --provider anthropic \
  --json
```

This writes `./test-results/design-qa-ready.json` (containing `heuristicViolations`, `ariaSnapshot`, and `computedStyles`) plus a single-tile `.webp` screenshot in `./test-results/artifacts/`.

### Step 2: Prompt your agent with Impeccable + ZeroVisual output

Paste this directly into Cursor, Claude Code, or Antigravity:

```text
Run `npx zerovisual design-qa --url http://localhost:3000 --provider anthropic --json`
and inspect the resulting `./test-results/design-qa-ready.json` and its optimized
`.webp` artifact.

Then use the `impeccable` skill (`polish` and `layout`) to:
1. Fix every deterministic ZeroVisual violation (WCAG contrast, 4px/8px spacing drift,
   < 44px mobile tap targets, focus visibility, and mobile horizontal overflow).
2. Elevate the overall visual hierarchy, typography, and spacing rhythm so the page
   feels cohesive rather than merely "passing a linter."
3. Re-run `zerovisual design-qa` once after batching your edits to confirm all checks pass.
```

---

## 3. Workflow B: Token-Efficient Visual Checks During Redesigns (`optimize` + Impeccable)

Impeccable's workflow encourages verifying your rendered UI at real shipping sizes (`Desktop` + `Mobile`) and batching fixes. When iterating with commands like `/impeccable bolder`, `/impeccable typeset`, `/impeccable colorize`, or `/impeccable adapt`, raw screenshots can consume **1,600+ vision tokens each** and bloat your chat context.

Use `zerovisual optimize` before feeding screenshots into an Impeccable critique or polish pass:

```bash
# Optimize Desktop & Mobile captures to exact Anthropic 504x504 tiles (~80-90% fewer tokens)
npx zerovisual optimize ./screenshots --provider anthropic
```

Then ask your agent:

```text
Inspect the optimized `.webp` screenshots from ZeroVisual and run an `impeccable`
`critique` followed by `adapt` for mobile. Focus on visual hierarchy, readable
line lengths, and touch-friendly controls.
```

---

## 4. Workflow C: Regression Guardrail After Impeccable Polish (`regression` + Playwright)

When you run a broad Impeccable refinement (`distill`, `layout`, or `typeset`) across shared components or CSS tokens, it's easy to accidentally shift an adjacent route or break a mobile breakpoint.

Run your Playwright visual suite with `zerovisual/reporter` configured:

```bash
npx playwright test
```

* **Passing routes:** 0 AI tokens spent.
* **Unexpected shifts:** ZeroVisual crops only the regressed bounding box + 32px padding, bundles Desktop/Tablet/Mobile under one `testId` in `./test-results/triage-ready.json`, and lets your agent fix the collateral regression without re-sending entire pages.

```text
Check `./test-results/triage-ready.json` from ZeroVisual. For any unintended visual
regression caused by our recent Impeccable polish pass, fix the CSS scoping so the
intended redesign stays intact while restoring the regressed routes.
```

---

## Quick Command Pairing Cheat Sheet

| Goal | ZeroVisual Command | Impeccable Command |
| :--- | :--- | :--- |
| **Fix accessibility & polish UI** | `zerovisual design-qa --url http://localhost:3000` | `audit` → `polish` |
| **Fix mobile overflow & tiny buttons** | `zerovisual design-qa --url http://localhost:3000` | `adapt` → `layout` |
| **Critique a screenshot cheaply** | `zerovisual optimize ./shot.png --provider anthropic` | `critique` |
| **Verify no collateral breaks after redesign** | `npx playwright test` (with `zerovisual/reporter`) | `harden` / `polish` |
