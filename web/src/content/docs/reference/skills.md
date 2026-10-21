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
- **Output Schema:** `skills/zerovisual-design-qa/output.schema.json`
- **Role:** UI/UX Engineering Mentor

### Responsibilities
- Evaluates the web page for visual hierarchy, rhythm, spacing, and contrast.
- Ingests deterministic heuristic violations (WCAG 2.1 contrast ratios $< 4.5:1$, broken 8pt grid scale, $<44\text{px}$ touch targets).
- Provides actionable, drop-in CSS and Tailwind class replacements so engineers without dedicated design teams can ship clean interfaces.

### Output JSON Format
```json
{
  "url": "http://localhost:3000",
  "overallScore": 82,
  "summary": "Clean layout hierarchy with two contrast violations in subtle secondary labels and an inconsistent 13px card padding.",
  "critique": [
    {
      "category": "contrast",
      "severity": "high",
      "elementSelector": ".text-muted",
      "issue": "Contrast ratio of 2.8:1 fails WCAG 2.1 AA requirement of 4.5:1.",
      "recommendation": "Change text color from #94a3b8 to #475569 or use Tailwind 'text-slate-600'."
    },
    {
      "category": "spacing",
      "severity": "medium",
      "elementSelector": ".card-container",
      "issue": "Padding of 13px breaks the 8pt / 4px spatial grid rhythm.",
      "recommendation": "Use 16px padding ('p-4' in Tailwind or 'padding: 1rem')."
    }
  ]
}
```
