# 📊 ZeroVisual Empirical Benchmark Report

> **Model Evaluated:** `RadixArk/Qwen3.8-27B-NVFP4` via SGLang (`https://spark.ntsd.dev:8001/v1`)
> **Date:** 2026-10-21T22:23:07.377Z
> **Total Test Cases:** 6

## 🌟 Executive Summary

| Core Metric | Without ZeroVisual (Raw) | With ZeroVisual (Optimized) | Empirical Improvement |
| :--- | :--- | :--- | :--- |
| **Total Tokens Consumed** | **11,556 tokens** | **5,421 tokens** | **-53.1% Token Reduction** |
| **Vision Image Tokens (ViT)** | **5,252 tokens** | **644 tokens** | **-87.7% Vision Token Savings** |
| **Network Payload Transfer** | **146.6 KB** | **21.7 KB** | **-85.2% Payload Bandwidth Reduction** |
| **Average Roundtrip Latency** | **53306 ms** | **36436 ms** | **32% Faster** |
| **Average Triage Accuracy** | **76.7%** | **82.5%** | **+5.8% Accuracy** |

## 📋 Per-Case Benchmark Breakdown

| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wikipedia Portal Search Bar Shift** | Raw Viewport | 1280×800 | 24.6 KB | 3186 | 1000 | 136060 ms | 65% |
| | **ZeroVisual** | **504×389** | **6.0 KB** | **887** | **192** | **38100 ms** | **65%** |
| **GitHub Pull Request Merge Card Regression** | Raw Viewport | 1280×800 | 27.1 KB | 1607 | 1000 | 23864 ms | 65% |
| | **ZeroVisual** | **504×92** | **3.3 KB** | **1573** | **76** | **86918 ms** | **100%** |
| **SaaS Pricing Card Contrast Violation** | Raw Viewport | 1280×800 | 34.3 KB | 1594 | 1000 | 24001 ms | 65% |
| | **ZeroVisual** | **274×103** | **0.6 KB** | **605** | **70** | **17127 ms** | **65%** |
| **E-Commerce Checkout Total & Button Collision** | Raw Viewport | 1280×800 | 22.4 KB | 2567 | 1000 | 78966 ms | 100% |
| | **ZeroVisual** | **504×328** | **7.0 KB** | **847** | **160** | **25435 ms** | **100%** |
| **Dashboard KPI Metric Overflow and Clipping** | Raw Viewport | 1280×800 | 32.8 KB | 1714 | 1000 | 30920 ms | 65% |
| | **ZeroVisual** | **504×66** | **3.4 KB** | **766** | **69** | **26434 ms** | **65%** |
| **Mobile Safari Navigation Drawer Overflow** | Raw Viewport | 390×664 | 5.5 KB | 888 | 252 | 26022 ms | 100% |
| | **ZeroVisual** | **194×121** | **1.4 KB** | **743** | **77** | **24603 ms** | **100%** |

---

## 🔬 Deep-Dive Case Details & Model Responses

### Case 1: Wikipedia Portal Search Bar Shift (`01-wikipedia-search-offset`)

- **Category:** Layout Shift / Component Offset
- **Without ZeroVisual Tokens:** 3186 (Image: 1000) | Latency: 136060ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **887** (Image: **192**) | Latency: 38100ms | Accuracy: 65%
- **Savings:** **72.2% total tokens**, **80.8% vision image tokens**, **75.6% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name**
> Search Input Container / Wrapper
> 
> **2. Nature of the Visual Defect**
> Unexpected thick red border surrounding the entire search component (input field, language selector, and button).
> 
> **3. Probable Root Cause in CSS or layout**
> The search input or its parent container is currently in a `:focus` or `:focus-within` state. Automated test scripts often programmatically focus input fields to type text. The CSS for this focus state is applying a prominent red border (likely intended for accessibility or error indication, but triggering a false positive in the visual baseline).
> 
> **4. Suggested Fix or code snippet**
> *   **Test Script Fix (Preferred):** Ensure the element is blurred before the screenshot is taken.
>     ```javascript
>     // Example in Playwright/Puppeteer
>     await page.keyboard.press('Tab'); // or explicitly blur the element
>     // take screenshot
>     ```
> *   **CSS Fix:** Ensure the focus state does not drastically change the border color/width if it's not intended to be part of the standard visual baseline.
>     ```css
>     .search-container:focus-within {
>       /* Remove or adjust the red border if it's causing test failures */
>       /* border: 2px solid red; */
>       outline: 2px solid #3366cc; /* Use a standard, expected focus indicator */
>     }
>     ```

### Case 2: GitHub Pull Request Merge Card Regression (`02-github-pr-merge`)

- **Category:** Button Layout Shift / Sizing
- **Without ZeroVisual Tokens:** 1607 (Image: 1000) | Latency: 23864ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **1573** (Image: **76**) | Latency: 86918ms | Accuracy: 100%
- **Savings:** **2.1% total tokens**, **92.4% vision image tokens**, **87.7% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element:** Primary action button — `Merge pull request` (orange CTA, right side of the merge panel).
> 
> **2. Nature of the Visual Defect:** An unwanted **dashed focus outline / border** is rendered tightly around the button (no offset, hugging the orange fill). The button is not in a legitimate keyboard‑focus state in the design spec, so this outline is a regression artifact. No padding, font, or alignment shift on the left‑side text block.
> 
> **3. Probable Root Cause:**
> - A `:focus` / `:focus-visible` rule (or a leftover `outline`/`border` rule) is applying `outline: … dashed` to the button, **or**
> - The element retained DOM focus at capture time (e.g., a prior click/tab in the test flow), so the focus ring was baked into the screenshot.
> 
> **4. Suggested Fix:**
> - Replace the dashed ring with the design‑system focus indicator, scoped to `:focus-visible` only:
> ```css
> .btn-merge:focus-visible {
>   outline: 2px solid var(--focus-ring, #fff);
>   outline-offset: 2px;
> }
> .btn-merge:focus:not(:focus-visible) {
>   outline: none;
> }
> ```
> - In the test harness, clear focus before capture so the baseline is the unfocused state:
> ```js
> document.activeElement?.blur();
> await page.keyboard.press('Escape'); // optional
> ```
> - Re‑run the snapshot; the dashed outline should disappear and the diff should clear.

### Case 3: SaaS Pricing Card Contrast Violation (`03-saas-pricing-contrast`)

- **Category:** Accessibility / Color Contrast Failure
- **Without ZeroVisual Tokens:** 1594 (Image: 1000) | Latency: 24001ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **605** (Image: **70**) | Latency: 17127ms | Accuracy: 65%
- **Savings:** **62.0% total tokens**, **93.0% vision image tokens**, **98.4% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name:**
> "Get Pro" Button
> 
> **2. Nature of the Visual Defect:**
> Severe contrast violation. The text color is nearly identical to the button's background color, making the label illegible.
> 
> **3. Probable Root Cause in CSS or layout:**
> The CSS `color` property applied to the button's text is set to a light shade that lacks sufficient contrast against the button's `background-color`.
> 
> **4. Suggested Fix or code snippet:**
> Increase the contrast by changing the text color to a darker shade (e.g., dark blue or black) or a lighter shade (e.g., white) if the background is darkened.
> 
> ```css
> /* Example fix assuming a light background */
> .get-pro-button {
>   background-color: #e2e8f0; /* Existing light background */
>   color: #1e293b; /* Changed to a dark, high-contrast color */
> }
> ```

### Case 4: E-Commerce Checkout Total & Button Collision (`04-ecommerce-checkout-collision`)

- **Category:** Layout Collision / Margin Collapse
- **Without ZeroVisual Tokens:** 2567 (Image: 1000) | Latency: 78966ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **847** (Image: **160**) | Latency: 25435ms | Accuracy: 100%
- **Savings:** **67.0% total tokens**, **84.0% vision image tokens**, **68.8% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name**
> Bottom action button (Green button containing "Total Due", "Pay $53.41 Now", and "$53.41").
> 
> **2. Nature of the Visual Defect**
> Text overlap and layout collapse. The text elements inside the button are overlapping each other instead of being spaced evenly across the button's width.
> 
> **3. Probable Root Cause in CSS or layout**
> The button is likely a flex container intended to space out its children (e.g., `justify-content: space-between`), but the text elements are missing `white-space: nowrap`, causing them to shrink or wrap. Alternatively, the button lacks a defined `width` or `min-width`, causing the flex container to collapse to the size of its content, resulting in the overlap.
> 
> **4. Suggested Fix or code snippet**
> Ensure the button acts as a proper flex container and the text does not wrap:
> 
> ```css
> .order-summary-button {
>   display: flex;
>   justify-content: space-between;
>   align-items: center;
>   width: 100%; /* or a specific fixed width */
>   padding: 0 16px;
> }
> 
> .order-summary-button span {
>   white-space: nowrap;
> }
> ```

### Case 5: Dashboard KPI Metric Overflow and Clipping (`05-dashboard-stat-overflow`)

- **Category:** Text Overflow / Component Clipping
- **Without ZeroVisual Tokens:** 1714 (Image: 1000) | Latency: 30920ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **766** (Image: **69**) | Latency: 26434ms | Accuracy: 65%
- **Savings:** **55.3% total tokens**, **93.1% vision image tokens**, **89.7% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name**
> "ACTIVE AGENTS" metric card (specifically the subtext "↑ 34% this week").
> 
> **2. Nature of the Visual Defect**
> Text clipping / Vertical overflow. The bottom portion of the subtext is cut off by the card's boundary.
> 
> **3. Probable Root Cause in CSS or layout**
> The card container has a fixed `height` that is insufficient to contain the larger main value ("12,450") plus the subtext. The content is overflowing the container's bounds.
> 
> **4. Suggested Fix or code snippet**
> Change the card's `height` to `min-height` to allow it to expand, or increase the fixed height value.
> 
> ```css
> .metric-card {
>   /* Change fixed height to allow expansion */
>   min-height: 120px; 
>   /* OR increase the fixed height */
>   /* height: 130px; */
> }
> ```

### Case 6: Mobile Safari Navigation Drawer Overflow (`06-mobile-nav-overflow`)

- **Category:** Mobile Responsive / Viewport Overflow
- **Without ZeroVisual Tokens:** 888 (Image: 252) | Latency: 26022ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **743** (Image: **77**) | Latency: 24603ms | Accuracy: 100%
- **Savings:** **16.3% total tokens**, **69.4% vision image tokens**, **73.6% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> **1. Affected Element / Component name:**
> Top-right red menu button and the "Mobile Dashboard View" button.
> 
> **2. Nature of the Visual Defect:**
> Element overlap / Z-index collision. The red menu button is overlapping the top-right corner of the "Mobile Dashboard View" button.
> 
> **3. Probable Root Cause in CSS or layout:**
> The red button is likely positioned absolutely (`position: absolute` or `fixed`) and lacks a sufficient `z-index` to remain above the subsequent content. Alternatively, the main content container lacks the necessary top padding or margin to clear the header area where the red button resides.
> 
> **4. Suggested Fix or code snippet:**
> *   **Option A (Z-index):** Ensure the red button has a higher stacking context.
>     ```css
>     .menu-button {
>       position: absolute; /* or fixed */
>       z-index: 100; /* Ensure it's higher than the content buttons */
>     }
>     ```
> *   **Option B (Layout/Padding):** Adjust the main content container to push the buttons down so they don't intersect with the header area.
>     ```css
>     .main-content {
>       padding-top: 80px; /* Adjust value to clear the header height */
>     }
>     ```

## 📂 Agent Session Traces

Full interaction sessions (prompts, raw reasoning, tool outputs, latency metrics) are archived in JSON format under `benchmark/results/sessions/`:

- [`session-01-wikipedia-search-offset-without-1792620984774.json`](./sessions/session-01-wikipedia-search-offset-without-1792620984774.json) (without_zerovisual, 3186 tokens)
- [`session-01-wikipedia-search-offset-with-1792621022921.json`](./sessions/session-01-wikipedia-search-offset-with-1792621022921.json) (with_zerovisual, 887 tokens)
- [`session-02-github-pr-merge-without-1792621046791.json`](./sessions/session-02-github-pr-merge-without-1792621046791.json) (without_zerovisual, 1607 tokens)
- [`session-02-github-pr-merge-with-1792621133735.json`](./sessions/session-02-github-pr-merge-with-1792621133735.json) (with_zerovisual, 1573 tokens)
- [`session-03-saas-pricing-contrast-without-1792621157741.json`](./sessions/session-03-saas-pricing-contrast-without-1792621157741.json) (without_zerovisual, 1594 tokens)
- [`session-03-saas-pricing-contrast-with-1792621174895.json`](./sessions/session-03-saas-pricing-contrast-with-1792621174895.json) (with_zerovisual, 605 tokens)
- [`session-04-ecommerce-checkout-collision-without-1792621253866.json`](./sessions/session-04-ecommerce-checkout-collision-without-1792621253866.json) (without_zerovisual, 2567 tokens)
- [`session-04-ecommerce-checkout-collision-with-1792621279342.json`](./sessions/session-04-ecommerce-checkout-collision-with-1792621279342.json) (with_zerovisual, 847 tokens)
- [`session-05-dashboard-stat-overflow-without-1792621310267.json`](./sessions/session-05-dashboard-stat-overflow-without-1792621310267.json) (without_zerovisual, 1714 tokens)
- [`session-05-dashboard-stat-overflow-with-1792621336731.json`](./sessions/session-05-dashboard-stat-overflow-with-1792621336731.json) (with_zerovisual, 766 tokens)
- [`session-06-mobile-nav-overflow-without-1792621362758.json`](./sessions/session-06-mobile-nav-overflow-without-1792621362758.json) (without_zerovisual, 888 tokens)
- [`session-06-mobile-nav-overflow-with-1792621387374.json`](./sessions/session-06-mobile-nav-overflow-with-1792621387374.json) (with_zerovisual, 743 tokens)
