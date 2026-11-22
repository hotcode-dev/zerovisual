---
name: ui
description: End-to-end UI build, motion, visual QA, and pre-ship polish. Use when building, styling, animating, or polishing UI in sequential phases.
---

# UI Build, Motion, Visual QA, and Pre-Ship Polish

Execute the user's UI request in 4 sequential phases. Do NOT load all skills upfront—load each skill only when entering its phase, and skip any phase that does not apply to the task.

### Phase 1: Build & Visual Direction
- Load `Taste` and implement the requested UI/layout.
- Focus on structure, hierarchy, typography, and spacing. Keep animations minimal here.

### Phase 2: Motion & Interactions
- Skip if the task has no interactive states, transitions, or overlays.
- Load `Emil Kowalski's Skills` and add purposeful transitions, hover/active states, and micro-interactions.

### Phase 3: Live Visual QA & Polish
- Ensure the local dev server is running.
- Load `zerovisual-design-qa` and run the ZeroVisual CLI against the affected route (e.g., `npx zerovisual design-qa <url>`).
- Read `design-qa-ready.json` and the optimized screenshot. Fix all deterministic violations first (WCAG contrast, 4px/8px grid rhythm, 44px tap targets, mobile overflow).
- Load `Impeccable` (`critique` / `polish`) and refine visual quality based on ZeroVisual's optimized screenshot and computed CSS.

### Phase 4: Pre-Ship Check
- Load `Vercel Web Design Guidelines` and do a final pass for keyboard navigation, focus traps, semantic HTML, and form ergonomics.
- If Playwright visual tests exist for this route, run them and use `zerovisual-regression` to triage any failures.

### Rules
- Accessibility (`ZeroVisual` math + `Vercel Guidelines`) always overrides aesthetics (`Taste` + `Impeccable`).
- `Emil Kowalski's Skills` overrides `Taste` on motion timing and easing.
- Do not dump raw full-screen screenshots into context; always use ZeroVisual's optimized output.
- At the end, summarize what was built, what ZeroVisual caught, and what was polished.
