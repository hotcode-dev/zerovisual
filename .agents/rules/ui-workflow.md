# UI/UX Skill Routing

Never load all UI skills at once. Follow this 4-stage pipeline for frontend work:

1. **Scaffold & Visual Direction**
   - Load `Taste` when creating a new page, layout, or visual hierarchy.
   - Skip complex animations during this phase.

2. **Motion & Micro-Interactions**
   - Load `Emil Kowalski's Skills` only when implementing transitions, hover/active states, modals, drawers, or springs.

3. **Live Visual QA & Polish (CLI + Skills)**
   - Do NOT dump raw full-screen browser screenshots into context.
   - Load `zerovisual-design-qa` and run the ZeroVisual CLI against the local dev server (e.g., `npx zerovisual design-qa http://localhost:3000`).
   - Read the generated `design-qa-ready.json` and optimized screenshot output.
   - Fix all deterministic violations first (WCAG contrast, 4px/8px grid rhythm, 44px tap targets, mobile overflow).
   - Load `Impeccable` (`critique` / `polish`) and refine aesthetics using ZeroVisual's optimized screenshot and computed CSS.

4. **Pre-Ship & Regression Lock**
   - Load `Vercel Web Design Guidelines` for a final code-level pass (keyboard nav, focus traps, semantic HTML, form ergonomics).
   - Run Playwright visual tests and load `zerovisual-regression` to triage `./test-results/triage-ready.json` if any diffs fail.

## Conflict Priority
- Accessibility (ZeroVisual math + Vercel Guidelines) overrides aesthetics (Taste + Impeccable).
- Emil Kowalski's Skills override Taste on animation timing and easing.
