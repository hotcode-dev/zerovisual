# 📊 ZeroVisual Empirical Benchmark Report

> **Model Evaluated:** `RadixArk/Qwen3.8-27B-NVFP4` via SGLang (`https://192.168.1.114:8001/v1`)
> **Date:** 2026-10-23T19:44:57.983Z
> **Total Test Cases:** 11

## 🌟 Executive Summary

| Core Metric | Without ZeroVisual (Raw) | With ZeroVisual (Optimized) | Empirical Improvement |
| :--- | :--- | :--- | :--- |
| **Total Tokens Consumed** | **25,748 tokens** | **18,105 tokens** | **-29.7% Token Reduction** |
| **Vision Image Tokens (ViT)** | **8,756 tokens** | **1,304 tokens** | **-85.1% Vision Token Savings** |
| **Network Payload Transfer** | **638.9 KB** | **71.8 KB** | **-88.8% Payload Bandwidth Reduction** |
| **Average Roundtrip Latency** | **67421 ms** | **66437 ms** | **1% Faster** |
| **Average Triage Accuracy** | **59.1%** | **68.2%** | **+9.1% Accuracy** |

## 📋 Per-Case Benchmark Breakdown

| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wikipedia Portal Search Bar Shift** | Raw Viewport | 1280×800 | 24.6 KB | 1795 | 1000 | 25677 ms | 65% |
| | **ZeroVisual** | **504×389** | **6.0 KB** | **2378** | **192** | **100717 ms** | **65%** |
| **GitHub Pull Request Merge Card Regression** | Raw Viewport | 1280×800 | 27.1 KB | 1563 | 1000 | 16821 ms | 65% |
| | **ZeroVisual** | **504×92** | **3.3 KB** | **1505** | **76** | **59078 ms** | **65%** |
| **SaaS Pricing Card Contrast Violation** | Raw Viewport | 1280×800 | 34.3 KB | 3164 | 1000 | 99768 ms | 65% |
| | **ZeroVisual** | **274×103** | **0.6 KB** | **1118** | **70** | **43175 ms** | **65%** |
| **E-Commerce Checkout Total & Button Collision** | Raw Viewport | 1280×800 | 22.4 KB | 2116 | 1000 | 45910 ms | 100% |
| | **ZeroVisual** | **504×328** | **7.0 KB** | **685** | **160** | **14351 ms** | **100%** |
| **Dashboard KPI Metric Overflow and Clipping** | Raw Viewport | 1280×800 | 32.8 KB | 2600 | 1000 | 73636 ms | 65% |
| | **ZeroVisual** | **504×66** | **3.4 KB** | **2255** | **69** | **97888 ms** | **65%** |
| **Mobile Safari Navigation Drawer Overflow** | Raw Viewport | 390×664 | 5.5 KB | 2438 | 252 | 109465 ms | 100% |
| | **ZeroVisual** | **194×121** | **1.4 KB** | **2090** | **77** | **95035 ms** | **100%** |
| **Real-World Wikipedia Portal (Desktop 1280×800) Search Bar Shift** | Raw Viewport | 1280×800 | 122.3 KB | 2182 | 1000 | 55048 ms | 65% |
| | **ZeroVisual** | **504×145** | **5.9 KB** | **1986** | **80** | **86828 ms** | **65%** |
| **Real-World Wikipedia Portal (Mobile 390×844) Language Switcher Displacement** | Raw Viewport | 390×664 | 48.9 KB | 2438 | 252 | 88572 ms | 0% |
| | **ZeroVisual** | **370×133** | **1.5 KB** | **2256** | **70** | **98694 ms** | **65%** |
| **Real-World Hacker News (Desktop 1280×800) Header Navigation Collapse** | Raw Viewport | 1280×800 | 154.2 KB | 3186 | 1000 | 99120 ms | 65% |
| | **ZeroVisual** | **504×354** | **18.0 KB** | **738** | **176** | **16055 ms** | **30%** |
| **Real-World GitHub Pricing (Desktop 1280×800) CTA Button Z-Index Collision** | Raw Viewport | 1280×800 | 111.9 KB | 1828 | 1000 | 28131 ms | 30% |
| | **ZeroVisual** | **498×504** | **20.1 KB** | **1208** | **256** | **37394 ms** | **65%** |
| **Real-World MDN Web Docs (Mobile 390×844) Search Contrast Failure** | Raw Viewport | 390×664 | 55.1 KB | 2438 | 252 | 99486 ms | 30% |
| | **ZeroVisual** | **390×168** | **4.7 KB** | **1886** | **78** | **81588 ms** | **65%** |

---

## 🔬 Deep-Dive Case Details & Model Responses

### Case 1: Wikipedia Portal Search Bar Shift (`01-wikipedia-search-offset`)

- **Category:** Layout Shift / Component Offset
- **Without ZeroVisual Tokens:** 1795 (Image: 1000) | Latency: 25677ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **2378** (Image: **192**) | Latency: 100717ms | Accuracy: 65%
- **Savings:** **-32.5% total tokens**, **80.8% vision image tokens**, **75.6% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> But the task wants a single clear defect. Let me think about what a visual regression diff would flag: the expected screenshot has a solid circular logo (or no oval), the actual has a dashed oval. The most "CSS/layout" root cause they'd expect: a broken image element showing its border, OR an erroneous `outline`/`border` on a container.
> 
> I'll go with: Affected element = the Wikipedia logo image (central circular graphic). Defect = image failed to load, rendering as a dashed ellipse with alt text (language links) instead of the logo; also the shape is an ellipse not a circle (aspect ratio wrong). Root cause = missing/failed <img> src (or background-image) so the browser shows the element's box with a dashed border and the alt text; the element's width/height + border-radius:50% produce the oval. Fix = restore the image source / set proper aspect-ratio and remove the dashed border; ensure alt text is appropriate.
> 
> Hmm, but the language links text being the alt is really bugging me. Let me consider that the language links are SUPPOSED to be plain text in that area, and the dashed oval is an erroneous border+border-radius applied to the language-links container (e.g., a `.lang-links` div that got `border:1px dashed #ccc; border-radius:50%;` by mistake, or a

### Case 2: GitHub Pull Request Merge Card Regression (`02-github-pr-merge`)

- **Category:** Button Layout Shift / Sizing
- **Without ZeroVisual Tokens:** 1563 (Image: 1000) | Latency: 16821ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **1505** (Image: **76**) | Latency: 59078ms | Accuracy: 65%
- **Savings:** **3.7% total tokens**, **92.4% vision image tokens**, **87.7% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element:** Primary action button — `Merge pull request` (orange CTA on the right).
> 
> **2. Visual Defect:** Stray / malformed focus ring. The button is rendered with a **dashed outline + offset** around its perimeter instead of the clean solid edge (or solid focus ring) present in the baseline. This is the only delta; text, spacing, and the green status line are correct.
> 
> **3. Probable Root Cause:** The button is in a `:focus` state during capture (auto‑focus or keyboard nav in the test harness) and the focus indicator is styled with `outline-style: dashed` (or a global `outline: dashed` rule is leaking onto the button). Design systems expect a solid ring, so the dashed style fails the pixel diff.
> 
> **4. Suggested Fix:** Replace the dashed outline with a solid offset ring and gate it behind `:focus-visible` so it only appears on keyboard focus:
> 
> ```css
> .btn-primary {
>   outline: none;
> }
> .btn-primary:focus-visible {
>   /* solid ring, not dashed */
>   box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.45);
>   /* or: outline: 2px solid #fff; outline-offset: 2px; */
> }
> ```
> 
> If the ring should never show in the default (mouse) state, also ensure the test blurs the element before the snapshot, or scope the ring to `:focus-visible` only.

### Case 3: SaaS Pricing Card Contrast Violation (`03-saas-pricing-contrast`)

- **Category:** Accessibility / Color Contrast Failure
- **Without ZeroVisual Tokens:** 3164 (Image: 1000) | Latency: 99768ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **1118** (Image: **70**) | Latency: 43175ms | Accuracy: 65%
- **Savings:** **64.7% total tokens**, **93.0% vision image tokens**, **98.4% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> `Get Pro` CTA button (label text + button surface).
> 
> **2. Nature of the Visual Defect**
> Contrast violation / washed‑out label. The "Get Pro" text is a light gray that is nearly the same luminance as the pale blue‑gray button fill, making the label barely legible. The whole control also reads as faded/disabled.
> 
> **3. Probable Root Cause**
> The button's text color (or an inherited theme token / `opacity`) resolves to a low‑contrast value against the light background. Likely one of:
> - `color` set to a light gray (e.g. `#9aa3ad`) on a light fill (`#d8e0ea`).
> - An `opacity` / `alpha` applied to the button or label.
> - A CSS variable (e.g. `--btn-text`) that should be dark/white is undefined and falling back to a light value.
> 
> **4. Suggested Fix**
> Increase label contrast and remove any unintended fade:
> 
> ```css
> .btn-get-pro {
>   background: #4f46e5;        /* or keep light fill but darken text */
>   color: #ffffff;             /* ≥ 4.5:1 contrast */
>   opacity: 1;                 /* ensure no fade */
> }
> /* If keeping the light fill, use a dark label instead: */
> .btn-get-pro--light {
>   background: #d8e0ea;
>   color: #1f2937;             /* dark text on light bg */
> }
> ```
> 
> Verify with a contrast checker (target ≥ 4.5:1 for normal text) and confirm the disabled state is not being applied to the enabled variant.

### Case 4: E-Commerce Checkout Total & Button Collision (`04-ecommerce-checkout-collision`)

- **Category:** Layout Collision / Margin Collapse
- **Without ZeroVisual Tokens:** 2116 (Image: 1000) | Latency: 45910ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **685** (Image: **160**) | Latency: 14351ms | Accuracy: 100%
- **Savings:** **67.6% total tokens**, **84.0% vision image tokens**, **68.8% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name**
> "Pay Now" Button (Green CTA at the bottom of the Order Summary card)
> 
> **2. Nature of the Visual Defect**
> Text overlap / Collision. The centered text ("Pay $53.41 Now") is overlapping with the right-aligned text ("$53.41").
> 
> **3. Probable Root Cause in CSS or layout**
> Insufficient horizontal padding on the button container, or a lack of spacing (e.g., `gap` or `margin`) between the text elements inside the button. The button width may also be constrained too tightly.
> 
> **4. Suggested Fix or code snippet**
> Add horizontal padding to the button and ensure proper spacing between the text elements using Flexbox.
> 
> ```css
> .pay-button {
>   display: flex;
>   justify-content: space-between;
>   align-items: center;
>   padding: 12px 24px; /* Increase horizontal padding */
>   gap: 16px; /* Add space between elements */
> }
> ```

### Case 5: Dashboard KPI Metric Overflow and Clipping (`05-dashboard-stat-overflow`)

- **Category:** Text Overflow / Component Clipping
- **Without ZeroVisual Tokens:** 2600 (Image: 1000) | Latency: 73636ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **2255** (Image: **69**) | Latency: 97888ms | Accuracy: 65%
- **Savings:** **13.3% total tokens**, **93.1% vision image tokens**, **89.7% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> The metric value node inside the **"ACTIVE AGENTS"** KPI card — the `12,450` figure (`.kpi-card__value` / `.metric-value`).
> 
> **2. Nature of the Visual Defect**
> Color / semantic‑contrast inconsistency. The value is rendered in **danger‑red/pink** (`≈ #ff4d6d`) while the three sibling cards (`94.2%`, `34 KB`, `$0.0002`) render in neutral white. This directly contradicts the card's own trend line, which is a **positive green** `↑ 34% this week`. A red value + green "up" indicator is a broken visual state (reads as "alerting" when the metric is healthy). No padding, margin, overlap, or baseline shift is present — the card geometry matches the others.
> 
> **3. Probable Root Cause**
> A conditional/semantic class or CSS variable is mis‑applied to this one card's value, overriding the neutral token. Most likely one of:
> - A JS‑driven status class (e.g. `data-status="alert"` → `.metric-value--danger`) that fired on the wrong metric or on a stale threshold.
> - A leftover `:hover` / `.is-active` / `.selected` state leaking into the snapshot.
> - A theme token `--metric-value-color` resolving to the error color for this instance instead of `--text-primary`.
> 
> **4. Suggested Fix**
> Decouple the value color from the trend color: the value should always use the neutral token; only the delta line carries semantic color.
> 
> ```css
> /* Value is always neutral — never semantic */
> .kpi-card__value {
>   color: var(--text-primary);   /* white */
>   font-weight: 700;
> }
> 
> /* Semantic color lives ONLY on the trend indicator */
> .kpi-card__delta--up   { color: var(--success); }  /* green */
> .kpi-card__delta--down { color: var(--danger);  }  /* red   */
> 
> /* Remove the stray danger binding on the value */
> .kpi-card__value--danger { color: var(--text-primary); } /* or delete the

### Case 6: Mobile Safari Navigation Drawer Overflow (`06-mobile-nav-overflow`)

- **Category:** Mobile Responsive / Viewport Overflow
- **Without ZeroVisual Tokens:** 2438 (Image: 252) | Latency: 109465ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **2090** (Image: **77**) | Latency: 95035ms | Accuracy: 100%
- **Savings:** **14.3% total tokens**, **69.4% vision image tokens**, **73.6% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> Header hamburger/menu button (top‑right red square) — the menu icon inside it.
> 
> **2. Nature of the Visual Defect**
> Vertical alignment shift: the three‑bar icon is not centered in the button; it is biased toward the top, leaving extra empty space at the bottom. The bar spacing also looks uneven (gap between bar 1–2 ≠ gap between bar 2–3).
> 
> **3. Probable Root Cause**
> The button's flex container is not centering its child (likely `align-items` defaulting to `stretch`/`flex-start`, or the icon carrying a `line-height`/`vertical-align`/margin offset). Secondary possibility: the SVG's `viewBox` or stroke `y`‑coordinates are off, producing uneven bar spacing.
> 
> **4. Suggested Fix**
> ```css
> .menu-btn {
>   display: flex;
>   align-items: center;      /* vertical centering */
>   justify-content: center;  /* horizontal centering */
>   padding: 0;               /* or symmetric padding */
> }
> .menu-btn svg {
>   display: block;
>   margin: 0;
>   line-height: 0;           /* kill inline‑box baseline gap */
> }
> ```
> If the bars themselves remain uneven after centering, correct the icon asset: ensure equal `y` offsets / `stroke` spacing in the SVG (e.g. lines at `y=6, 12, 18` in a `24×24` viewBox) rather than relying on text‑based rendering.
> 
> *Note:* The two list cards ("Mobile Dashboard View", "Real‑Time QA Stream") appear consistent in padding/border; the diff is localized to the header button icon.

### Case 7: Real-World Wikipedia Portal (Desktop 1280×800) Search Bar Shift (`07-real-wikipedia-desktop`)

- **Category:** Real Website / Layout Shift
- **Without ZeroVisual Tokens:** 2182 (Image: 1000) | Latency: 55048ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **1986** (Image: **80**) | Latency: 86828ms | Accuracy: 65%
- **Savings:** **9.0% total tokens**, **92.0% vision image tokens**, **95.2% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> Search bar — the language‑selector text input (`EN ▾`) and the magenta search/submit button.
> 
> **2. Nature of the Visual Defect**
> Element overlap / width overflow. The input's blue right border is visible *behind/past* the magenta button, i.e. the input box extends under the button instead of stopping at its left edge. The button is rendered on top of the input's right side rather than sitting beside it.
> 
> **3. Probable Root Cause**
> The input is set to `width: 100%` of the container while the button is `position: absolute` on top of it, with no space reserved for the button (missing `padding-right` / `gap`). So the input's box overlaps the button's footprint.
> 
> **4. Suggested Fix**
> Either reserve space for the button on the input, or (preferred) lay the two out as flex siblings so they can't overlap:
> 
> ```css
> /* Option A – flex (recommended) */
> .search {
>   display: flex;
>   gap: 0;            /* button flush to input */
> }
> .search input {
>   flex: 1 1 auto;
>   min-width: 0;      /* prevents overflow */
>   width: auto;       /* drop width:100% */
> }
> .search button {
>   flex: 0 0 auto;
> }
> 
> /* Option B – keep absolute button, but clear it */
> .search input {
>   width: 100%;
>   padding-right: 48px; /* = button width */
> }
> ```
> 
> Re‑run the visual test after the change; the diff box around the search component should clear once the input's right edge no longer extends under the button.

### Case 8: Real-World Wikipedia Portal (Mobile 390×844) Language Switcher Displacement (`08-real-wikipedia-mobile`)

- **Category:** Real Website / Mobile Regression
- **Without ZeroVisual Tokens:** 2438 (Image: 252) | Latency: 88572ms | Accuracy: 0%
- **With ZeroVisual Tokens:** **2256** (Image: **70**) | Latency: 98694ms | Accuracy: 65%
- **Savings:** **7.5% total tokens**, **72.2% vision image tokens**, **96.9% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> Let me look one more time at the faint element. The text "Read Wikipedia in your language" is light gray, the globe icon light gray, chevron light gray. This is uniform low opacity. This is exactly what you'd see if an element has `opacity: 0.4` or if it's a `:disabled`/`:placeholder` style. In a regression, this is a clear diff.
> 
> The stat text is dark and crisp, normal. The label "hase" being on its own line might just be the design (number big, label small below). Many stat blocks do that. So I'll consider the stat fine.
> 
> Thus primary = language selector contrast/opacity.

### Case 9: Real-World Hacker News (Desktop 1280×800) Header Navigation Collapse (`09-real-hackernews-desktop`)

- **Category:** Real Website / Flex & Font Collapse
- **Without ZeroVisual Tokens:** 3186 (Image: 1000) | Latency: 99120ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **738** (Image: **176**) | Latency: 16055ms | Accuracy: 30%
- **Savings:** **76.8% total tokens**, **82.4% vision image tokens**, **88.4% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name:**
> Top banner / Header / Featured article card (the large red block).
> 
> **2. Nature of the Visual Defect:**
> Severe contrast violation / Invisible text. The text and content within the red block are completely obscured by the background color.
> 
> **3. Probable Root Cause in CSS or layout:**
> The text color is set to the same color (or a very similar shade) as the background color (red). This likely happened due to a recent styling update where the background was changed to red without adjusting the typography colors.
> 
> **4. Suggested Fix or code snippet:**
> Update the text color to a high-contrast color, such as white or black.
> 
> ```css
> .banner-header {
>   background-color: #d32f2f; /* Assuming this is the red color */
>   color: #ffffff; /* Change text color to white for contrast */
> }
> ```

### Case 10: Real-World GitHub Pricing (Desktop 1280×800) CTA Button Z-Index Collision (`10-real-github-pricing-desktop`)

- **Category:** Real Website / Z-Index Collision
- **Without ZeroVisual Tokens:** 1828 (Image: 1000) | Latency: 28131ms | Accuracy: 30%
- **With ZeroVisual Tokens:** **1208** (Image: **256**) | Latency: 37394ms | Accuracy: 65%
- **Savings:** **33.9% total tokens**, **74.4% vision image tokens**, **82.1% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element:** Hero `<h1>` heading ("GitHub, the complete developer platform").
> 
> **2. Visual Defect:** Horizontal clipping/overflow — the left edge of the heading is cut off by the viewport ("**G**itHub" → "itHub", "**d**eveloper" → "eveloper"). The sub‑text and CTA button below are correctly centered, so only the H1 is mispositioned.
> 
> **3. Probable Root Cause:** The H1 (or its wrapper) is left‑aligned inside a container whose left edge sits outside the viewport — typically a negative `margin-left`, a `transform: translateX(-…)`, or a `width: 100vw`/`min-width` that ignores the parent's padding. The centered siblings confirm the page grid is fine; only the heading's box is shifted left.
> 
> **4. Suggested Fix:**
> ```css
> .hero__heading {
>   /* remove any negative offset / transform */
>   margin-left: 0;
>   transform: none;
>   width: 100%;
>   max-width: 100%;
>   text-align: center;      /* match the sub‑text & CTA */
>   overflow-wrap: break-word;
> }
> .hero {
>   overflow-x: hidden;      /* safety net against 100vw overflow */
>   padding-inline: 1rem;    /* respect container gutters */
> }
> ```
> Verify the H1's computed `left`/`margin-left`/`transform` in DevTools; it should align with the centered paragraph. Re‑run the snapshot after the change.

### Case 11: Real-World MDN Web Docs (Mobile 390×844) Search Contrast Failure (`11-real-mdn-search-mobile`)

- **Category:** Real Website / Accessibility Contrast Failure
- **Without ZeroVisual Tokens:** 2438 (Image: 252) | Latency: 99486ms | Accuracy: 30%
- **With ZeroVisual Tokens:** **1886** (Image: **78**) | Latency: 81588ms | Accuracy: 65%
- **Savings:** **22.6% total tokens**, **69.0% vision image tokens**, **91.5% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> Hero banner CTA graphic — the right "hand/cursor" icon and its backing rectangle inside the WorkOS "Build faster." ad module (the light‑lavender square behind the right pointer).
> 
> **2. Nature of the Visual Defect**
> An unintended solid light‑lavender block is rendered behind the right cursor, overlapping it and breaking the left/right symmetry (left cursor sits cleanly on the blue field, right cursor sits on a stray box). Reads as a mis‑colored / mis‑positioned element or a leaked hover/focus state — not part of the intended composition.
> 
> **3. Probable Root Cause**
> - A `background-color` (or a failed `background-image` falling back to a default) applied to the cursor's wrapper / drop‑target card that should be `transparent`.
> - OR a `:hover` / `:focus-within` / `:active` state on that element is active at capture time (test‑harness pointer position), painting the lavender fill.
> - OR an absolutely‑positioned decorative element with the wrong `background` and no `z-index` containment, bleeding over the cursor.
> 
> **4. Suggested Fix**
> Make the wrapper transparent, kill the stray state, and guard the background image:
> 
> ```css
> /* The cursor / drop-target wrapper should have no fill */
> .hero-cursor,
> .hero-cursor::before {
>   background: transparent;          /* remove lavender block */
>   background-image: none;           /* or correct the asset URL */
> }
> 
> /* Ensure no hover/focus fill leaks into the screenshot */
> .hero-cursor:hover,
> .hero-cursor:focus,
> .hero-cursor:focus-within {
>   background: transparent;
>   outline: none;
> }
> 
> /* If the lavender box is a separate decorative node, hide/fix it */
> .hero-cursor__card {
>   background: transparent;          /* was: #d8d0f0 */
>   /* or: display: none; if it's a leftover placeholder */
> }
> ```
> 
> **Verification:** Re‑run the snapshot with the pointer parked outside the banner (or with `:hover`/`:focus` suppressed via `page.emulateMedia` / forced‑states) and confirm both cursors render on the uniform blue field with no backing rectangle.

## 📂 Agent Session Traces

Full interaction sessions (prompts, raw reasoning, tool outputs, latency metrics) are archived in JSON format under `benchmark/results/sessions/`:

- [`session-01-wikipedia-search-offset-without-1792783250915.json`](./sessions/session-01-wikipedia-search-offset-without-1792783250915.json) (without_zerovisual, 1795 tokens)
- [`session-01-wikipedia-search-offset-with-1792783351667.json`](./sessions/session-01-wikipedia-search-offset-with-1792783351667.json) (with_zerovisual, 2378 tokens)
- [`session-02-github-pr-merge-without-1792783368491.json`](./sessions/session-02-github-pr-merge-without-1792783368491.json) (without_zerovisual, 1563 tokens)
- [`session-02-github-pr-merge-with-1792783427587.json`](./sessions/session-02-github-pr-merge-with-1792783427587.json) (with_zerovisual, 1505 tokens)
- [`session-03-saas-pricing-contrast-without-1792783527359.json`](./sessions/session-03-saas-pricing-contrast-without-1792783527359.json) (without_zerovisual, 3164 tokens)
- [`session-03-saas-pricing-contrast-with-1792783570565.json`](./sessions/session-03-saas-pricing-contrast-with-1792783570565.json) (with_zerovisual, 1118 tokens)
- [`session-04-ecommerce-checkout-collision-without-1792783616479.json`](./sessions/session-04-ecommerce-checkout-collision-without-1792783616479.json) (without_zerovisual, 2116 tokens)
- [`session-04-ecommerce-checkout-collision-with-1792783630905.json`](./sessions/session-04-ecommerce-checkout-collision-with-1792783630905.json) (with_zerovisual, 685 tokens)
- [`session-05-dashboard-stat-overflow-without-1792783704543.json`](./sessions/session-05-dashboard-stat-overflow-without-1792783704543.json) (without_zerovisual, 2600 tokens)
- [`session-05-dashboard-stat-overflow-with-1792783802460.json`](./sessions/session-05-dashboard-stat-overflow-with-1792783802460.json) (with_zerovisual, 2255 tokens)
- [`session-06-mobile-nav-overflow-without-1792783911926.json`](./sessions/session-06-mobile-nav-overflow-without-1792783911926.json) (without_zerovisual, 2438 tokens)
- [`session-06-mobile-nav-overflow-with-1792784006957.json`](./sessions/session-06-mobile-nav-overflow-with-1792784006957.json) (with_zerovisual, 2090 tokens)
- [`session-07-real-wikipedia-desktop-without-1792784062008.json`](./sessions/session-07-real-wikipedia-desktop-without-1792784062008.json) (without_zerovisual, 2182 tokens)
- [`session-07-real-wikipedia-desktop-with-1792784148852.json`](./sessions/session-07-real-wikipedia-desktop-with-1792784148852.json) (with_zerovisual, 1986 tokens)
- [`session-08-real-wikipedia-mobile-without-1792784237426.json`](./sessions/session-08-real-wikipedia-mobile-without-1792784237426.json) (without_zerovisual, 2438 tokens)
- [`session-08-real-wikipedia-mobile-with-1792784336137.json`](./sessions/session-08-real-wikipedia-mobile-with-1792784336137.json) (with_zerovisual, 2256 tokens)
- [`session-09-real-hackernews-desktop-without-1792784435260.json`](./sessions/session-09-real-hackernews-desktop-without-1792784435260.json) (without_zerovisual, 3186 tokens)
- [`session-09-real-hackernews-desktop-with-1792784451342.json`](./sessions/session-09-real-hackernews-desktop-with-1792784451342.json) (with_zerovisual, 738 tokens)
- [`session-10-real-github-pricing-desktop-without-1792784479475.json`](./sessions/session-10-real-github-pricing-desktop-without-1792784479475.json) (without_zerovisual, 1828 tokens)
- [`session-10-real-github-pricing-desktop-with-1792784516895.json`](./sessions/session-10-real-github-pricing-desktop-with-1792784516895.json) (with_zerovisual, 1208 tokens)
- [`session-11-real-mdn-search-mobile-without-1792784616384.json`](./sessions/session-11-real-mdn-search-mobile-without-1792784616384.json) (without_zerovisual, 2438 tokens)
- [`session-11-real-mdn-search-mobile-with-1792784697981.json`](./sessions/session-11-real-mdn-search-mobile-with-1792784697981.json) (with_zerovisual, 1886 tokens)
