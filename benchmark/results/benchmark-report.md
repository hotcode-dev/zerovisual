# 📊 ZeroVisual Empirical Benchmark Report

> **Model Evaluated:** `RadixArk/Qwen3.8-27B-NVFP4` via SGLang (`https://spark.ntsd.dev:8001/v1`)
> **Date:** 2026-10-22T17:23:37.175Z
> **Total Test Cases:** 11

## 🌟 Executive Summary

| Core Metric | Without ZeroVisual (Raw) | With ZeroVisual (Optimized) | Empirical Improvement |
| :--- | :--- | :--- | :--- |
| **Total Tokens Consumed** | **23,907 tokens** | **17,946 tokens** | **-24.9% Token Reduction** |
| **Vision Image Tokens (ViT)** | **8,756 tokens** | **1,304 tokens** | **-85.1% Vision Token Savings** |
| **Network Payload Transfer** | **638.9 KB** | **71.8 KB** | **-88.8% Payload Bandwidth Reduction** |
| **Average Roundtrip Latency** | **56006 ms** | **61094 ms** | **Comparable** |
| **Average Triage Accuracy** | **65.5%** | **53.6%** | **-11.9%** |

## 📋 Per-Case Benchmark Breakdown

| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wikipedia Portal Search Bar Shift** | Raw Viewport | 1280×800 | 24.6 KB | 3186 | 1000 | 103371 ms | 65% |
| | **ZeroVisual** | **504×389** | **6.0 KB** | **2378** | **192** | **96812 ms** | **65%** |
| **GitHub Pull Request Merge Card Regression** | Raw Viewport | 1280×800 | 27.1 KB | 1645 | 1000 | 20399 ms | 65% |
| | **ZeroVisual** | **504×92** | **3.3 KB** | **2262** | **76** | **91317 ms** | **35%** |
| **SaaS Pricing Card Contrast Violation** | Raw Viewport | 1280×800 | 34.3 KB | 1710 | 1000 | 20706 ms | 65% |
| | **ZeroVisual** | **274×103** | **0.6 KB** | **1167** | **70** | **43489 ms** | **65%** |
| **E-Commerce Checkout Total & Button Collision** | Raw Viewport | 1280×800 | 22.4 KB | 2330 | 1000 | 52272 ms | 100% |
| | **ZeroVisual** | **504×328** | **7.0 KB** | **1830** | **160** | **62391 ms** | **100%** |
| **Dashboard KPI Metric Overflow and Clipping** | Raw Viewport | 1280×800 | 32.8 KB | 2737 | 1000 | 72290 ms | 100% |
| | **ZeroVisual** | **504×66** | **3.4 KB** | **784** | **69** | **18929 ms** | **65%** |
| **Mobile Safari Navigation Drawer Overflow** | Raw Viewport | 390×664 | 5.5 KB | 1825 | 252 | 60216 ms | 100% |
| | **ZeroVisual** | **194×121** | **1.4 KB** | **1160** | **77** | **32710 ms** | **70%** |
| **Real-World Wikipedia Portal (Desktop 1280×800) Search Bar Shift** | Raw Viewport | 1280×800 | 122.3 KB | 1657 | 1000 | 20908 ms | 65% |
| | **ZeroVisual** | **504×145** | **5.9 KB** | **1807** | **80** | **74290 ms** | **65%** |
| **Real-World Wikipedia Portal (Mobile 390×844) Language Switcher Displacement** | Raw Viewport | 390×664 | 48.9 KB | 840 | 252 | 15400 ms | 0% |
| | **ZeroVisual** | **370×133** | **1.5 KB** | **1998** | **70** | **80120 ms** | **0%** |
| **Real-World Hacker News (Desktop 1280×800) Header Navigation Collapse** | Raw Viewport | 1280×800 | 154.2 KB | 2353 | 1000 | 57602 ms | 65% |
| | **ZeroVisual** | **504×354** | **18.0 KB** | **1471** | **176** | **54434 ms** | **30%** |
| **Real-World GitHub Pricing (Desktop 1280×800) CTA Button Z-Index Collision** | Raw Viewport | 1280×800 | 111.9 KB | 3186 | 1000 | 90245 ms | 30% |
| | **ZeroVisual** | **498×504** | **20.1 KB** | **2442** | **256** | **103132 ms** | **65%** |
| **Real-World MDN Web Docs (Mobile 390×844) Search Contrast Failure** | Raw Viewport | 390×664 | 55.1 KB | 2438 | 252 | 102658 ms | 65% |
| | **ZeroVisual** | **390×168** | **4.7 KB** | **647** | **78** | **14413 ms** | **30%** |

---

## 🔬 Deep-Dive Case Details & Model Responses

### Case 1: Wikipedia Portal Search Bar Shift (`01-wikipedia-search-offset`)

- **Category:** Layout Shift / Component Offset
- **Without ZeroVisual Tokens:** 3186 (Image: 1000) | Latency: 103371ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **2378** (Image: **192**) | Latency: 96812ms | Accuracy: 65%
- **Savings:** **25.4% total tokens**, **80.8% vision image tokens**, **75.6% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> Search box group (`.searchbox` wrapper containing the text input, the `EN ▼` language selector, and the red **Search** button).
> 
> **2. Nature of the Visual Defect**
> A thick red/brand‑colored border (or focus outline) is drawn around the *entire* search group, instead of a thin neutral‑gray border on the input only. The outline wraps the input **and** the button, so the button's red fill merges with the ring and the whole control reads as "selected / error state." This does not match the reference (gray input border, standalone red button, no outer ring).
> 
> **3. Probable Root Cause**
> A `border`/`outline` rule (or an unsuppressed `:focus` ring) is applied to the wrapper element rather than being scoped to the input. Likely something like `.searchbox { border: 2px solid #cc0000; }` or a default `outline` that wasn't reset, so the ring inherits the brand red and encloses the button

### Case 2: GitHub Pull Request Merge Card Regression (`02-github-pr-merge`)

- **Category:** Button Layout Shift / Sizing
- **Without ZeroVisual Tokens:** 1645 (Image: 1000) | Latency: 20399ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **2262** (Image: **76**) | Latency: 91317ms | Accuracy: 35%
- **Savings:** **-37.5% total tokens**, **92.4% vision image tokens**, **87.7% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> Hmm, if `align-items: flex-end`, button bottom aligns with left div bottom (description bottom). The description is the bottom line, so button would align near the bottom of description. The button is taller than the text, so button center would be a bit above description bottom. That roughly matches: button center ~110, description center ~110, description bottom ~120, button bottom ~150. Not exactly flex-end.
> 
> This is too detailed. For a concise QA report, I'll state the defect as vertical misalignment between the action button and the status/description block, with the button aligned to the secondary text instead of the block center, and the status line having empty space to its right. Root cause: flex alignment / vertical centering mismatch (e.g., `align-items` set to `flex-start`/`flex-end` or the left column using `justify-content: space-between` with the button in a separate row). Fix: wrap left content in a single column and set the row to `align-items: center`, or use `align-self: center` on the button, ensuring the status and description are grouped so the button centers against the whole group.
> 
> Hold on, maybe I'm overanalyzing and the actual intended defect in this synthetic image is something else, like the

### Case 3: SaaS Pricing Card Contrast Violation (`03-saas-pricing-contrast`)

- **Category:** Accessibility / Color Contrast Failure
- **Without ZeroVisual Tokens:** 1710 (Image: 1000) | Latency: 20706ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **1167** (Image: **70**) | Latency: 43489ms | Accuracy: 65%
- **Savings:** **31.8% total tokens**, **93.0% vision image tokens**, **98.4% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> `Get Pro` CTA button (the inner rounded pill inside the bordered card).
> 
> **2. Nature of the Visual Defect**
> Severe **contrast violation / color mismatch** on the button label. The text "Get Pro" is rendered in a near‑background light gray (~`#C8CED8`) on a pale blue‑gray fill (~`#DCE2EC`), making it almost illegible. The button also lacks its expected solid brand fill and reads as a flat, washed‑out block.
> 
> **3. Probable Root Cause**
> CSS token/variable mismatch on the button class. Most likely the `background-color` token resolved to a light surface value (or the rule was dropped, falling back to a default gray) while `color` resolved to a light "muted text" token intended for dark backgrounds. A secondary possibility: an unintended `opacity` / `:disabled` / `:focus` state is being applied, washing out both fill and label.
> 
> **4. Suggested Fix**
> Pin explicit, high‑contrast values (and verify no stray opacity/disabled rule is overriding them):
> 
> ```css
> .btn-pro {
>   background-color: var(--brand-500, #4F46E5); /* solid indigo, matches card border */
>   color: #FFFFFF;                              /* WCAG AA+ contrast */
>   border: 1px solid transparent;
>   opacity: 1;
> }
> .btn-pro:hover { background-color: var(--brand-600, #4338CA); }
> ```
> 
> If the pale fill is intentional, change only the label to a dark token:
> ```css
> .btn-pro { color: var(--text-strong, #1F2937); }
> ```
> Re‑run the snapshot after the change and confirm the label passes a 4.5:1 contrast check.

### Case 4: E-Commerce Checkout Total & Button Collision (`04-ecommerce-checkout-collision`)

- **Category:** Layout Collision / Margin Collapse
- **Without ZeroVisual Tokens:** 2330 (Image: 1000) | Latency: 52272ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **1830** (Image: **160**) | Latency: 62391ms | Accuracy: 100%
- **Savings:** **21.5% total tokens**, **84.0% vision image tokens**, **68.8% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> `Order Summary` card → bottom "Total Due" row (the green bar containing the `Total Due` label, the `Pay $53.41 Now` CTA, and the `$53.41` total).
> 
> **2. Nature of the Visual Defect**
> Element / text overlap. The centered CTA label `Pay $53.41 Now` collides with the right‑aligned total `$53.41` (the words "Now" and "$53.41" are touching/overlapping), and the left `Total Due` label is cramped against the CTA. The three items no longer have distinct horizontal zones.
> 
> **3. Probable Root Cause**
> The CTA is rendered in the *same* row as the total but is centered via absolute positioning / `transform: translateX(-50%)` (or a `margin: 0 auto` / `flex: 1` + `text-align:center` button) inside a `position: relative` container that also holds the right‑aligned price. Because the centered button's box is not part of the flex flow, it overlaps the price column. The row also lacks a `gap`, so once the button's intrinsic width grows (longer price/label), the columns collide.
> 
> **4. Suggested Fix**
> Make the row a proper 3‑zone flex layout (no absolute positioning) with a `gap`, or move the CTA to its own row.
> 
> ```css
> .order-total-row {
>   display: flex;
>   align-items: center;
>   justify-content: space-between;
>   gap: 16px;            /* prevents collision */
>   background: #10b981;
>   padding: 12px 16px;
>   border-radius: 8px;
> }
> .order-total-row .label { flex: 0 0 auto; }
> .order-total-row .cta   { flex: 1 1 auto; text-align: center; }
> .order-total-row .total { flex: 0 0 auto; }
> ```
> 
> If the CTA must stay a full‑width button, stack it instead:
> 
> ```css
> .order-total-row { display: block; }
> .order-total-row .cta {
>   display: block;
>   width: 100%;
>   margin-top: 8px;
>   text-align: center;
> }
> ```
> 
> Remove any `position: absolute` / `transform: translateX(-50%)` on the CTA so it participates in normal flow. Re‑run the visual test to confirm the three zones no longer overlap.

### Case 5: Dashboard KPI Metric Overflow and Clipping (`05-dashboard-stat-overflow`)

- **Category:** Text Overflow / Component Clipping
- **Without ZeroVisual Tokens:** 2737 (Image: 1000) | Latency: 72290ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **784** (Image: **69**) | Latency: 18929ms | Accuracy: 65%
- **Savings:** **71.4% total tokens**, **93.1% vision image tokens**, **89.7% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name:**
> The "COST PER OFF" label in the fourth (rightmost) metric card.
> 
> **2. Nature of the Visual Defect:**
> Text truncation / clipping. The word "OFFSET" (or similar) is cut off, leaving only "COST PER OFF".
> 
> **3. Probable Root Cause in CSS or layout:**
> The container for the label has a fixed width or `max-width` that is too narrow to accommodate the full text string. Alternatively, the font size is too large for the allocated space, and `overflow: hidden` is clipping the text without an ellipsis.
> 
> **4. Suggested Fix or code snippet:**
> *   **Option A (Best):** Increase the width of the card or the label container.
> *   **Option B:** Reduce the font size of the label.
> *   **Option C (If truncation is acceptable):** Add ellipsis to indicate missing text.
>     ```css
>     .card-label {
>       white-space: nowrap;
>       overflow: hidden;
>       text-overflow: ellipsis;
>     }
>     ```

### Case 6: Mobile Safari Navigation Drawer Overflow (`06-mobile-nav-overflow`)

- **Category:** Mobile Responsive / Viewport Overflow
- **Without ZeroVisual Tokens:** 1825 (Image: 252) | Latency: 60216ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **1160** (Image: **77**) | Latency: 32710ms | Accuracy: 70%
- **Savings:** **36.4% total tokens**, **69.4% vision image tokens**, **73.6% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name**
> Top-right navigation button (Hamburger menu)
> 
> **2. Nature of the Visual Defect**
> Vertical misalignment of the icon. The hamburger icon is shifted significantly towards the top edge of the red button container instead of being centered.
> 
> **3. Probable Root Cause in CSS or layout**
> The button container is missing vertical centering properties. This is typically caused by a missing `align-items: center` in a flexbox layout, or asymmetric `padding-top` / `padding-bottom` values.
> 
> **4. Suggested Fix or code snippet**
> Apply flexbox centering to the button container to ensure the icon is perfectly aligned vertically and horizontally:
> 
> ```css
> .menu-button {
>   display: flex;
>   justify-content: center;
>   align-items: center;
> }
> ```

### Case 7: Real-World Wikipedia Portal (Desktop 1280×800) Search Bar Shift (`07-real-wikipedia-desktop`)

- **Category:** Real Website / Layout Shift
- **Without ZeroVisual Tokens:** 1657 (Image: 1000) | Latency: 20908ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **1807** (Image: **80**) | Latency: 74290ms | Accuracy: 65%
- **Savings:** **-9.1% total tokens**, **92.0% vision image tokens**, **95.2% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> Header search bar — specifically the language `<select>` + text input + the red "search" submit button (the `.searchbox` / `.searchbox__form` group at the top of the page).
> 
> **2. Nature of the Visual Defect**
> Color / contrast regression on the search control. The submit button is rendered in a saturated red/magenta and the input's border color has shifted, so the whole control's pixel signature differs from the baseline. The diff mask (red outline) tightly wraps the input border + button, indicating a styling change rather than a content change. No text or icon is missing; it is a pure paint‑layer difference (possible 1–2 px border‑width shift contributing to the diff).
> 
> **3. Probable Root Cause**
> A CSS color token / theme variable for the primary action and the input border was changed or is no longer being applied to the search form. Most likely the button's `background-color` and the input's `border-color` now resolve to the wrong value (e.g., a fallback red instead of the expected brand blue), or a `:focus`/`outline` rule is leaking into the default state.
> 
> **4. Suggested Fix**
> Pin the search control to the design‑system tokens and remove any stray outline:
> 
> ```css
> .searchbox__input {
>   border: 1px solid var(--color-border, #a2a9b1); /* was shifting */
>   outline: none;
> }
> .searchbox__button {
>   background-color: var(--color-primary, #3366cc); /* was rendering red */
>   color: #fff;
>   border: 0;
> }
> .searchbox__button:focus-visible {
>   outline: 2px solid var(--color-focus, #3366cc);
>   outline-offset: 2px;
> }
> ```
> 
> Re‑run the snapshot after the change; if the button is *supposed* to be red, update the baseline instead of the code. Verify the input border width is exactly `1px` to rule out a sub‑pixel layout shift.

### Case 8: Real-World Wikipedia Portal (Mobile 390×844) Language Switcher Displacement (`08-real-wikipedia-mobile`)

- **Category:** Real Website / Mobile Regression
- **Without ZeroVisual Tokens:** 840 (Image: 252) | Latency: 15400ms | Accuracy: 0%
- **With ZeroVisual Tokens:** **1998** (Image: **70**) | Latency: 80120ms | Accuracy: 0%
- **Savings:** **-137.9% total tokens**, **72.2% vision image tokens**, **96.9% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **Finding 1 — Article counter (`1 711 000+ haseł`)**
> 1. **Element:** Stats / article-count label.
> 2. **Defect:** Unwanted line wrap — `haseł` breaks to a second line and looks mis‑aligned (indented) under the number.
> 3. **Root cause:** Container `max-width` too narrow for the full string at the current `font-size`; combined with `text-align:center`, the shorter wrapped line centers and appears offset. No `nowrap`/flex on the number+label pair.
> 4. **Fix:**
> ```css
> .counter { white-space: nowrap; }            /* keep on one line */
> /* or, if wrapping is acceptable, align left + use flex: */
> .counter { display: flex; align-items: baseline; gap: .35em; text-align: left; }
> ```
> Also widen the parent or step down `font-size` so the string fits.
> 
> **Finding 2 — Language selector (`Read Wikipedia in your language`)**
> 1. **Element:** Language / search dropdown (globe icon + placeholder + chevron).
> 2. **Defect:** Contrast violation — text, icon and chevron are near‑invisible (very light gray on white).
> 3. **Root cause:** Muted‑text color too light (e.g. `#f0f0f0` / `rgba(0,0,0,.05)`), failing WCAG 4.5:1; icon likely not inheriting `currentColor`.
> 4. **Fix:**
> ```css
> .lang-select { color: #6b7280; }            /* ≥ 4.5:1 on white */
> .lang-select svg { fill: currentColor; }
> ```
> 
> **Primary regression to fix first:** Finding 1 (layout wrap) — it changes the bounding box and is the most likely pixel‑diff trigger; Finding 2 is a contrast/AA issue to file alongside.

### Case 9: Real-World Hacker News (Desktop 1280×800) Header Navigation Collapse (`09-real-hackernews-desktop`)

- **Category:** Real Website / Flex & Font Collapse
- **Without ZeroVisual Tokens:** 2353 (Image: 1000) | Latency: 57602ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **1471** (Image: **176**) | Latency: 54434ms | Accuracy: 30%
- **Savings:** **37.5% total tokens**, **82.4% vision image tokens**, **88.4% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component**
> Top header / site‑title banner (the red bar containing the logo glyph on the left and the wordmark text on the right). The numbered list below renders correctly, so the defect is isolated to this header.
> 
> **2. Nature of the Visual Defect**
> The header wordmark is not rendering as readable text — it appears as a row of tiny white dashes / missing‑glyph boxes ("tofu") instead of the expected title characters. The left logo glyph is also a fallback box. This is a font‑rendering / missing‑glyph failure, not a layout or color shift.
> 
> **3. Probable Root Cause**
> The header uses a custom web font (or an icon font for the logo) that failed to load or has no valid fallback, so the browser substitutes empty/placeholder glyphs. Typical triggers:
> - `@font-face` `src` URL 404 / wrong format / blocked by CSP or network.
> - `font-family` stack missing a usable system fallback.
> - Icon‑font codepoints not mapped (e.g., Font Awesome / custom icon font not loaded).
> 
> **4. Suggested Fix**
> ```css
> /* 1) Provide a safe fallback so text is never blank */
> .site-header__title {
>   font-family: "BrandFont", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
>   font-display: swap;            /* avoid invisible text while font loads */
> }
> 
> /* 2) Ensure the font actually ships */
> @font-face {
>   font-family: "BrandFont";
>   src: url("/fonts/BrandFont.woff2") format("woff2"),
>        url("/fonts/BrandFont.woff")  format("woff");
>   font-display: swap;
> }
> ```
> - Verify the `.woff2`/`.woff` URLs return `200` and the correct `Content-Type` (`font/woff2`).
> - Add `<link rel="preconnect">` / `preload` for the font to avoid FOUT/FOIT.
> - Replace the logo glyph with an inline `<svg>` or `<img>` instead of an icon‑font character so the brand mark can't break on font failure.
> - Re‑run the visual test after the font is cached to confirm the wordmark matches the baseline.

### Case 10: Real-World GitHub Pricing (Desktop 1280×800) CTA Button Z-Index Collision (`10-real-github-pricing-desktop`)

- **Category:** Real Website / Z-Index Collision
- **Without ZeroVisual Tokens:** 3186 (Image: 1000) | Latency: 90245ms | Accuracy: 30%
- **With ZeroVisual Tokens:** **2442** (Image: **256**) | Latency: 103132ms | Accuracy: 65%
- **Savings:** **23.4% total tokens**, **74.4% vision image tokens**, **82.1% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> But a visual regression test wouldn't have a random scroll. Unless the page has horizontal overflow and the test's screenshot tool captured with a scroll position, or the layout has an element causing horizontal scroll and the default scroll is not 0.
> 
> Alternatively the simplest interpretation for a QA answer: The hero section content (H1 + paragraph) is horizontally misaligned / overflowing the left edge, indicating the container's left padding is missing or a negative margin/transform is applied, causing text clipping. The pricing cards and nav also show horizontal overflow, suggesting the page has unintended horizontal overflow (body wider than viewport).
> 
> Given the instruction to be concise and direct, I'll provide

### Case 11: Real-World MDN Web Docs (Mobile 390×844) Search Contrast Failure (`11-real-mdn-search-mobile`)

- **Category:** Real Website / Accessibility Contrast Failure
- **Without ZeroVisual Tokens:** 2438 (Image: 252) | Latency: 102658ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **647** (Image: **78**) | Latency: 14413ms | Accuracy: 30%
- **Savings:** **73.5% total tokens**, **69.0% vision image tokens**, **91.5% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name**
> Right hand cursor graphic and its container.
> 
> **2. Nature of the Visual Defect**
> Unintended background block / Element overlap. A light purple/white rectangular box is visible behind the right hand cursor, breaking the solid blue background of the banner.
> 
> **3. Probable Root Cause in CSS or layout**
> The container wrapping the right hand cursor image has an unintended background color (likely defaulting to white or a light theme color) instead of being transparent. Alternatively, it could be a z-index issue where a background layer is incorrectly overlapping the main banner.
> 
> **4. Suggested Fix or code snippet**
> Ensure the container for the right hand cursor has a transparent background.
> 
> ```css
> .right-hand-cursor-container {
>   background: transparent; /* or background: none; */
> }
> ```

## 📂 Agent Session Traces

Full interaction sessions (prompts, raw reasoning, tool outputs, latency metrics) are archived in JSON format under `benchmark/results/sessions/`:

- [`session-01-wikipedia-search-offset-without-1792688632113.json`](./sessions/session-01-wikipedia-search-offset-without-1792688632113.json) (without_zerovisual, 3186 tokens)
- [`session-01-wikipedia-search-offset-with-1792688728968.json`](./sessions/session-01-wikipedia-search-offset-with-1792688728968.json) (with_zerovisual, 2378 tokens)
- [`session-02-github-pr-merge-without-1792688749371.json`](./sessions/session-02-github-pr-merge-without-1792688749371.json) (without_zerovisual, 1645 tokens)
- [`session-02-github-pr-merge-with-1792688840719.json`](./sessions/session-02-github-pr-merge-with-1792688840719.json) (with_zerovisual, 2262 tokens)
- [`session-03-saas-pricing-contrast-without-1792688861430.json`](./sessions/session-03-saas-pricing-contrast-without-1792688861430.json) (without_zerovisual, 1710 tokens)
- [`session-03-saas-pricing-contrast-with-1792688904949.json`](./sessions/session-03-saas-pricing-contrast-with-1792688904949.json) (with_zerovisual, 1167 tokens)
- [`session-04-ecommerce-checkout-collision-without-1792688957225.json`](./sessions/session-04-ecommerce-checkout-collision-without-1792688957225.json) (without_zerovisual, 2330 tokens)
- [`session-04-ecommerce-checkout-collision-with-1792689019623.json`](./sessions/session-04-ecommerce-checkout-collision-with-1792689019623.json) (with_zerovisual, 1830 tokens)
- [`session-05-dashboard-stat-overflow-without-1792689091917.json`](./sessions/session-05-dashboard-stat-overflow-without-1792689091917.json) (without_zerovisual, 2737 tokens)
- [`session-05-dashboard-stat-overflow-with-1792689110862.json`](./sessions/session-05-dashboard-stat-overflow-with-1792689110862.json) (with_zerovisual, 784 tokens)
- [`session-06-mobile-nav-overflow-without-1792689171085.json`](./sessions/session-06-mobile-nav-overflow-without-1792689171085.json) (without_zerovisual, 1825 tokens)
- [`session-06-mobile-nav-overflow-with-1792689203800.json`](./sessions/session-06-mobile-nav-overflow-with-1792689203800.json) (with_zerovisual, 1160 tokens)
- [`session-07-real-wikipedia-desktop-without-1792689224713.json`](./sessions/session-07-real-wikipedia-desktop-without-1792689224713.json) (without_zerovisual, 1657 tokens)
- [`session-07-real-wikipedia-desktop-with-1792689299031.json`](./sessions/session-07-real-wikipedia-desktop-with-1792689299031.json) (with_zerovisual, 1807 tokens)
- [`session-08-real-wikipedia-mobile-without-1792689314437.json`](./sessions/session-08-real-wikipedia-mobile-without-1792689314437.json) (without_zerovisual, 840 tokens)
- [`session-08-real-wikipedia-mobile-with-1792689394573.json`](./sessions/session-08-real-wikipedia-mobile-with-1792689394573.json) (with_zerovisual, 1998 tokens)
- [`session-09-real-hackernews-desktop-without-1792689452180.json`](./sessions/session-09-real-hackernews-desktop-without-1792689452180.json) (without_zerovisual, 2353 tokens)
- [`session-09-real-hackernews-desktop-with-1792689506651.json`](./sessions/session-09-real-hackernews-desktop-with-1792689506651.json) (with_zerovisual, 1471 tokens)
- [`session-10-real-github-pricing-desktop-without-1792689596905.json`](./sessions/session-10-real-github-pricing-desktop-without-1792689596905.json) (without_zerovisual, 3186 tokens)
- [`session-10-real-github-pricing-desktop-with-1792689700079.json`](./sessions/session-10-real-github-pricing-desktop-with-1792689700079.json) (with_zerovisual, 2442 tokens)
- [`session-11-real-mdn-search-mobile-without-1792689802742.json`](./sessions/session-11-real-mdn-search-mobile-without-1792689802742.json) (without_zerovisual, 2438 tokens)
- [`session-11-real-mdn-search-mobile-with-1792689817171.json`](./sessions/session-11-real-mdn-search-mobile-with-1792689817171.json) (with_zerovisual, 647 tokens)
