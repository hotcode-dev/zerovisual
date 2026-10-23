# 📊 ZeroVisual Empirical Benchmark Report

> **Model Evaluated:** `google/gemma-4-26B-A4B-it` via SGLang (`https://spark.ntsd.dev:8001/v1`)
> **Date:** 2026-10-23T05:39:24.843Z
> **Total Test Cases:** 11

## 🌟 Executive Summary

| Core Metric | Without ZeroVisual (Raw) | With ZeroVisual (Optimized) | Empirical Improvement |
| :--- | :--- | :--- | :--- |
| **Total Tokens Consumed** | **7,612 tokens** | **7,148 tokens** | **-6.1% Token Reduction** |
| **Vision Image Tokens (ViT)** | **0 tokens** | **0 tokens** | **-0% Vision Token Savings** |
| **Network Payload Transfer** | **638.9 KB** | **116.2 KB** | **-81.8% Payload Bandwidth Reduction** |
| **Average Roundtrip Latency** | **8359 ms** | **7336 ms** | **12% Faster** |
| **Average Triage Accuracy** | **59.1%** | **65.5%** | **+6.4% Accuracy** |

## 📋 Per-Case Benchmark Breakdown

| Test Case | Mode | Resolution | Payload | Total Tokens | Image Tokens | Latency | Accuracy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wikipedia Portal Search Bar Shift** | Raw Viewport | 1280×800 | 24.6 KB | 797 | 0 | 11299 ms | 65% |
| | **ZeroVisual** | **634×489** | **8.2 KB** | **700** | **0** | **8522 ms** | **65%** |
| **GitHub Pull Request Merge Card Regression** | Raw Viewport | 1280×800 | 27.1 KB | 606 | 0 | 6088 ms | 65% |
| | **ZeroVisual** | **768×140** | **6.0 KB** | **662** | **0** | **7393 ms** | **65%** |
| **SaaS Pricing Card Contrast Violation** | Raw Viewport | 1280×800 | 34.3 KB | 716 | 0 | 8723 ms | 65% |
| | **ZeroVisual** | **274×103** | **0.6 KB** | **592** | **0** | **5824 ms** | **65%** |
| **E-Commerce Checkout Total & Button Collision** | Raw Viewport | 1280×800 | 22.4 KB | 650 | 0 | 7122 ms | 100% |
| | **ZeroVisual** | **504×328** | **7.0 KB** | **646** | **0** | **7396 ms** | **100%** |
| **Dashboard KPI Metric Overflow and Clipping** | Raw Viewport | 1280×800 | 32.8 KB | 678 | 0 | 7882 ms | 65% |
| | **ZeroVisual** | **768×101** | **5.9 KB** | **736** | **0** | **9139 ms** | **65%** |
| **Mobile Safari Navigation Drawer Overflow** | Raw Viewport | 390×664 | 5.5 KB | 645 | 0 | 7489 ms | 65% |
| | **ZeroVisual** | **194×121** | **1.4 KB** | **590** | **0** | **5635 ms** | **65%** |
| **Real-World Wikipedia Portal (Desktop 1280×800) Search Bar Shift** | Raw Viewport | 1280×800 | 122.3 KB | 820 | 0 | 11292 ms | 65% |
| | **ZeroVisual** | **768×221** | **11.1 KB** | **628** | **0** | **7166 ms** | **65%** |
| **Real-World Wikipedia Portal (Mobile 390×844) Language Switcher Displacement** | Raw Viewport | 390×664 | 48.9 KB | 631 | 0 | 7189 ms | 0% |
| | **ZeroVisual** | **370×133** | **1.5 KB** | **593** | **0** | **5779 ms** | **35%** |
| **Real-World Hacker News (Desktop 1280×800) Header Navigation Collapse** | Raw Viewport | 1280×800 | 154.2 KB | 600 | 0 | 5934 ms | 65% |
| | **ZeroVisual** | **768×540** | **36.9 KB** | **645** | **0** | **7165 ms** | **65%** |
| **Real-World GitHub Pricing (Desktop 1280×800) CTA Button Z-Index Collision** | Raw Viewport | 1280×800 | 111.9 KB | 875 | 0 | 12668 ms | 65% |
| | **ZeroVisual** | **758×768** | **33.0 KB** | **747** | **0** | **9995 ms** | **65%** |
| **Real-World MDN Web Docs (Mobile 390×844) Search Contrast Failure** | Raw Viewport | 390×664 | 55.1 KB | 594 | 0 | 6262 ms | 30% |
| | **ZeroVisual** | **390×168** | **4.7 KB** | **609** | **0** | **6677 ms** | **65%** |

---

## 🔬 Deep-Dive Case Details & Model Responses

### Case 1: Wikipedia Portal Search Bar Shift (`01-wikipedia-search-offset`)

- **Category:** Layout Shift / Component Offset
- **Without ZeroVisual Tokens:** 797 (Image: 0) | Latency: 11299ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **700** (Image: **0**) | Latency: 8522ms | Accuracy: 65%
- **Savings:** **12.2% total tokens**, **0% vision image tokens**, **66.8% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element**: Search Bar Component (Input field and Search button container).
> 
> 2. **Nature of the Visual Defect**: **Alignment/Layout mismatch**. The search button is vertically misaligned or lacks proper container constraints, causing the red background to extend beyond the expected height of the input field, or the input field is not vertically centered within the red border container.
> 
> 3. **Probable Root Cause**: 
>    - Lack of `display: flex` or `align-items: center` on the parent container.
>    - Incorrect `height` or `line-height` definitions on the input vs. the button.
>    - Box-sizing issue (`content-box` vs `border-box`) causing the button to overflow the container's height.
> 
> 4. **Suggested Fix**:
> Ensure the container uses Flexbox to align children vertically and uses `border-box` for consistent sizing.
> 
> ```css
> .search-container {
>   display: flex;
>   align-items: stretch; /* Ensures button and input have same height */
>   height: 40px;         /* Explicit height */
>   box-sizing: border-box;
> }
> 
> .search-input {
>   flex-grow: 1;
>   border: none;
>   padding: 0 10px;
> }
> 
> .search-button {
>   background-color: #d33;
>   color: white;
>   border: none;
>   display: flex;
>   align-items: center;
>   justify-content: center;
> }
> ```

### Case 2: GitHub Pull Request Merge Card Regression (`02-github-pr-merge`)

- **Category:** Button Layout Shift / Sizing
- **Without ZeroVisual Tokens:** 606 (Image: 0) | Latency: 6088ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **662** (Image: **0**) | Latency: 7393ms | Accuracy: 65%
- **Savings:** **-9.2% total tokens**, **0% vision image tokens**, **78.0% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element**: `Merge pull request` Button.
> 
> 2. **Nature of the Visual Defect**: Border/Outline misalignment and potential padding inconsistency. The dashed border is not perfectly centered around the button's bounding box and appears to be clipping or misaligned with the button's edge.
> 
> 3. **Probable Root Cause**: 
>    - Use of `outline` instead of `border` with an offset that doesn't account for the element's box model.
>    - An incorrect `outline-offset` value.
>    - A `box-shadow` being used to simulate a border without proper spread/radius alignment.
> 
> 4. **Suggested Fix**:
> Use `box-shadow` for a cleaner, non-layout-shifting "dashed" effect, or ensure `outline-offset` is correctly calculated.
> 
> ```css
> /* Recommended approach using box-shadow to avoid layout shifts */
> .merge-button:focus {
>   outline: none;
>   box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #ff8c00; /* Creates a double ring effect */
> }
> 
> /* If using outline, ensure offset is applied */
> .merge-button:focus {
>   outline: 2px dashed #ffffff;
>   outline-offset: 4px;
> }
> ```

### Case 3: SaaS Pricing Card Contrast Violation (`03-saas-pricing-contrast`)

- **Category:** Accessibility / Color Contrast Failure
- **Without ZeroVisual Tokens:** 716 (Image: 0) | Latency: 8723ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **592** (Image: **0**) | Latency: 5824ms | Accuracy: 65%
- **Savings:** **17.3% total tokens**, **0% vision image tokens**, **98.4% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element**: "Get Pro" Button.
> 
> 2. **Nature of the Visual Defect**: **Contrast Violation (Accessibility failure)**. The text color is too similar to the button background color, making it nearly unreadable.
> 
> 3. **Probable Root Cause**: Insufficient color contrast ratio between the `color` property (text) and the `background-color` property of the button component.
> 
> 4. **Suggested Fix**: Increase the contrast by darkening the text color or lightening the background.
> 
> **Code Snippet Example:**
> ```css
> /* Current (Failing) */
> .button-get-pro {
>   background-color: #e0e7ff; /* Light lavender */
>   color: #cbd5e1;            /* Low contrast grey/blue */
> }
> 
> /* Suggested Fix (Passing) */
> .button-get-pro {
>   background-color: #e0e7ff; 
>   color: #1e3a8a;            /* Darker blue for WCAG compliance */
> }
> ```

### Case 4: E-Commerce Checkout Total & Button Collision (`04-ecommerce-checkout-collision`)

- **Category:** Layout Collision / Margin Collapse
- **Without ZeroVisual Tokens:** 650 (Image: 0) | Latency: 7122ms | Accuracy: 100%
- **With ZeroVisual Tokens:** **646** (Image: **0**) | Latency: 7396ms | Accuracy: 100%
- **Savings:** **0.6% total tokens**, **0% vision image tokens**, **68.8% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element / Component name**: Order Summary Footer / Total Due Bar.
> 
> 2. **Nature of the Visual Defect**: Element overlap and text clipping. The "Pay $53.41 Now" call-to-action text is colliding with the "$53.41" price amount on the right.
> 
> 3. **Probable Root Cause in CSS or layout**: 
>    - Lack of flexible spacing (e.g., `justify-content: space-between`) in a flex container.
>    - Fixed width on the container or child elements preventing proper reflow.
>    - Absence of `gap` property or sufficient padding to handle varying text lengths.
> 
> 4. **Suggested Fix or code snippet**:
> Use Flexbox with `justify-content: space-between` and ensure the container has adequate padding.
> 
> ```css
> .total-due-bar {
>   display: flex;
>   justify-content: space-between;
>   align-items: center;
>   padding: 16px 24px; /* Ensure internal breathing room */
>   width: 100%;
>   box-sizing: border-box;
> }
> 
> /* If using a nested structure for the CTA */
> .cta-text {
>   margin-right: auto; /* Pushes the price to the far right */
> }
> ```

### Case 5: Dashboard KPI Metric Overflow and Clipping (`05-dashboard-stat-overflow`)

- **Category:** Text Overflow / Component Clipping
- **Without ZeroVisual Tokens:** 678 (Image: 0) | Latency: 7882ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **736** (Image: **0**) | Latency: 9139ms | Accuracy: 65%
- **Savings:** **-8.6% total tokens**, **0% vision image tokens**, **81.9% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> Based on the provided screenshot, here is the visual regression analysis:
> 
> 1.  **Affected Element / Component name**: `Active Agents` Stat Card.
> 2.  **Nature of the Visual Defect**: **Alignment/Padding Inconsistency**. While the other three cards have their content vertically centered or top-aligned with consistent spacing, the "Active Agents" card has significantly larger top padding or a different flex/alignment property, causing the text to sit lower than the sibling components.
> 3.  **Probable Root Cause in CSS or layout**: 
>     *   Inconsistent `padding-top` or `justify-content: center` vs `flex-start` applied specifically to this card container.
>     *   The large font size of the value (`12,450`) might be interacting with a fixed `height` or `line-height` differently than the smaller text in other cards, causing a layout shift.
> 4.  **Suggested Fix or code snippet**:
>     Ensure all stat cards share a common class for layout structure. Use Flexbox to normalize vertical distribution:
> 
> ```css
> /* Ensure all stat cards use the same alignment logic */
> .stat-card {
>   display: flex;
>   flex-direction: column;
>   justify-content: flex-start; /* Or center, as long as it is consistent */
>   padding: 24px; /* Standardize padding across all cards */
>   align-items: flex-start;
> }
> 
> /* Check if the large font is causing overflow/shifting */
> .stat-card__value {
>   line-height: 1; /* Prevent extra leading from pushing the element down */
>   margin: 0;
> }
> ```

### Case 6: Mobile Safari Navigation Drawer Overflow (`06-mobile-nav-overflow`)

- **Category:** Mobile Responsive / Viewport Overflow
- **Without ZeroVisual Tokens:** 645 (Image: 0) | Latency: 7489ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **590** (Image: **0**) | Latency: 5635ms | Accuracy: 65%
- **Savings:** **8.5% total tokens**, **0% vision image tokens**, **73.6% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element**: Navigation Header / Menu Button.
> 
> 2. **Nature of the Visual Defect**: Element overlap and alignment issue. The red menu button is overlapping the header container's boundary and is not vertically centered relative to the "ZeroVisual" logo.
> 
> 3. **Probable Root Cause**: 
>    - Lack of `align-items: center` on the header flex container.
>    - The menu button likely has a fixed position, absolute positioning, or excessive `margin-top` that pushes it outside the header's intended bounding box.
> 
> 4. **Suggested Fix**:
> Ensure the header uses Flexbox for alignment:
> ```css
> header {
>   display: flex;
>   justify-content: space-between;
>   align-items: center; /* Vertically centers logo and button */
>   padding: 0 16px;     /* Ensures spacing from edges */
> }
> 
> .menu-button {
>   margin: 0;           /* Remove any offset margins causing the overlap */
> }
> ```

### Case 7: Real-World Wikipedia Portal (Desktop 1280×800) Search Bar Shift (`07-real-wikipedia-desktop`)

- **Category:** Real Website / Layout Shift
- **Without ZeroVisual Tokens:** 820 (Image: 0) | Latency: 11292ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **628** (Image: **0**) | Latency: 7166ms | Accuracy: 65%
- **Savings:** **23.4% total tokens**, **0% vision image tokens**, **91.0% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element**: Search Input Container / Search Bar.
> 
> 2. **Nature of the Visual Defect**: Element misalignment and layout overflow. The search icon button is misaligned vertically relative to the input field, and the input field's border/container appears to have inconsistent padding or height compared to the button.
> 
> 3. **Probable Root Cause**: 
>    - Lack of `align-items: center` on the flex container holding the input and the button.
>    - Inconsistent `height` or `line-height` definitions between the `<input>` and the `<button>`.
>    - Box-sizing mismatch (e.g., one element using `content-box` while the other uses `border-box`).
> 
> 4. **Suggested Fix**:
> Ensure the parent container uses Flexbox to align children vertically and that both elements share the same height.
> 
> ```css
> .search-container {
>   display: flex;
>   align-items: center; /* Vertically centers input and button */
>   height: 40px;        /* Explicitly define shared height */
> }
> 
> .search-input, .search-button {
>   height: 100%;        /* Ensure they fill the container height */
>   box-sizing: border-box; 
>   margin: 0;
> }
> ```

### Case 8: Real-World Wikipedia Portal (Mobile 390×844) Language Switcher Displacement (`08-real-wikipedia-mobile`)

- **Category:** Real Website / Mobile Regression
- **Without ZeroVisual Tokens:** 631 (Image: 0) | Latency: 7189ms | Accuracy: 0%
- **With ZeroVisual Tokens:** **593** (Image: **0**) | Latency: 5779ms | Accuracy: 35%
- **Savings:** **6.0% total tokens**, **0% vision image tokens**, **96.9% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element / Component name**: Language Selector Button (`Read Wikipedia in your language`)
> 
> 2. **Nature of the Visual Defect**: Element overlap / Layout collision. The language selector button is overlapping the text content ("1 711 000+ haseł") above it.
> 
> 3. **Probable Root Cause in CSS or layout**: 
>    - Insufficient `margin-top` or `padding-top` on the language selector container.
>    - A fixed `height` being applied to the parent container, causing overflow.
>    - Incorrect use of `position: absolute` without proper relative positioning on the parent.
> 
> 4. **Suggested Fix or code snippet**:
>    Increase the vertical spacing between the text block and the button.
>    ```css
>    /* Suggested fix: Add margin to separate from text above */
>    .language-selector-container {
>      margin-top: 16px; /* Adjust value as needed */
>      display: block;   /* Ensure it follows normal document flow */
>    }
>    ```

### Case 9: Real-World Hacker News (Desktop 1280×800) Header Navigation Collapse (`09-real-hackernews-desktop`)

- **Category:** Real Website / Flex & Font Collapse
- **Without ZeroVisual Tokens:** 600 (Image: 0) | Latency: 5934ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **645** (Image: **0**) | Latency: 7165ms | Accuracy: 65%
- **Savings:** **-7.5% total tokens**, **0% vision image tokens**, **76.1% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element / Component name**: Global Header / Navigation Bar.
> 
> 2. **Nature of the Visual Defect**: Layout breakage / Element misalignment. The navigation items (represented by vertical bars) are misaligned and lack proper spacing/container constraints relative to the logo.
> 
> 3. **Probable Root Cause in CSS or layout**: 
>    - Lack of a flexbox/grid container for the header items.
>    - Missing `padding` or `margin` on the navigation links.
>    - The header container likely lacks a defined `max-width` or `justify-content: space-between` property, causing elements to cluster incorrectly.
> 
> 4. **Suggested Fix or code snippet**:
> Apply Flexbox to the header container to distribute the logo and navigation items correctly.
> 
> ```css
> .header-container {
>   display: flex;
>   align-items: center;
>   justify-content: space-between; /* Pushes logo to left, nav to right */
>   padding: 0 20px; /* Adds breathing room on sides */
>   height: 60px; /* Ensure consistent height */
> }
> 
> .nav-links {
>   display: flex;
>   gap: 1.5rem; /* Provides consistent spacing between items */
>   list-style: none;
> }
> ```

### Case 10: Real-World GitHub Pricing (Desktop 1280×800) CTA Button Z-Index Collision (`10-real-github-pricing-desktop`)

- **Category:** Real Website / Z-Index Collision
- **Without ZeroVisual Tokens:** 875 (Image: 0) | Latency: 12668ms | Accuracy: 65%
- **With ZeroVisual Tokens:** **747** (Image: **0**) | Latency: 9995ms | Accuracy: 65%
- **Savings:** **14.6% total tokens**, **0% vision image tokens**, **70.5% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> Based on the provided screenshot, here is the visual regression analysis:
> 
> 1.  **Affected Element / Component name:** Global Navigation Header (specifically the top utility bar/banner).
> 2.  **Nature of the Visual Defect:** Element overlap and layout breakage. The colorful decorative pattern/banner is overlapping the main navigation links and the "Save your seat" text, causing a visual collision.
> 3.  **Probable Root Cause in CSS or layout:** 
>     *   **Z-index issue:** The decorative element has a higher `z-index` than the navigation container without proper clearance.
>     *   **Positioning error:** The banner likely uses `position: absolute` or `fixed` without a defined container height, causing it to float over the content instead of pushing it down.
>     *   **Flexbox/Grid failure:** A failure in the parent container's layout flow (e.g., missing `flex-direction: column` or improper `margin-bottom` on the top bar).
> 4.  **Suggested Fix or code snippet:**
>     Ensure the top utility bar occupies its own space in the document flow and manage stacking contexts.
> 
>     ```css
>     /* Ensure the top bar pushes content down rather than floating over it */
>     .top-utility-bar {
>       position: relative; /* Change from absolute if applicable */
>       display: block;
>       width: 100%;
>     }
> 
>     /* Ensure navigation stays below the utility bar */
>     .main-nav {
>       position: relative;
>       z-index: 10; /* Ensure nav is above decorative elements if overlap is intended */
>     }
> 
>     /* If the colorful pattern is a background element, ensure it doesn't bleed */
>     .decorative-pattern {
>       z-index: -1; 
>     }
>     ```

### Case 11: Real-World MDN Web Docs (Mobile 390×844) Search Contrast Failure (`11-real-mdn-search-mobile`)

- **Category:** Real Website / Accessibility Contrast Failure
- **Without ZeroVisual Tokens:** 594 (Image: 0) | Latency: 6262ms | Accuracy: 30%
- **With ZeroVisual Tokens:** **609** (Image: **0**) | Latency: 6677ms | Accuracy: 65%
- **Savings:** **-2.5% total tokens**, **0% vision image tokens**, **91.5% bandwidth**

#### Model Diagnosis (ZeroVisual Optimized)
> 1. **Affected Element / Component name**: Hero Banner / Call-to-Action (CTA) Graphic.
> 
> 2. **Nature of the Visual Defect**: Element overlap and clipping. The "motion blur" effect/graphic is overlapping the text "Build faster." and lacks proper containment within its intended container.
> 
> 3. **Probable Root Cause in CSS or layout**: 
>    - Incorrect `z-index` layering causing the graphic to sit above the text.
>    - Lack of `overflow: hidden` on the parent container.
>    - Absolute positioning of the motion graphic without sufficient padding/margin on the text element.
> 
> 4. **Suggested Fix or code snippet**:
>    - **Option A (Fix Layering):** Ensure text has a higher `z-index`.
>      ```css
>      .hero-text { position: relative; z-index: 2; }
>      .motion-graphic { position: absolute; z-index: 1; }
>      ```
>    - **Option B (Fix Containment):** Add padding to the text container to prevent overlap.
>      ```css
>      .banner-container { padding-right: 200px; } /* Adjust based on graphic width */
>      ```

## 📂 Agent Session Traces

Full interaction sessions (prompts, raw reasoning, tool outputs, latency metrics) are archived in JSON format under `benchmark/results/sessions/`:

- [`session-01-wikipedia-search-offset-without-1792733803061.json`](./sessions/session-01-wikipedia-search-offset-without-1792733803061.json) (without_zerovisual, 797 tokens)
- [`session-01-wikipedia-search-offset-with-1792733811628.json`](./sessions/session-01-wikipedia-search-offset-with-1792733811628.json) (with_zerovisual, 700 tokens)
- [`session-02-github-pr-merge-without-1792733817725.json`](./sessions/session-02-github-pr-merge-without-1792733817725.json) (without_zerovisual, 606 tokens)
- [`session-02-github-pr-merge-with-1792733825160.json`](./sessions/session-02-github-pr-merge-with-1792733825160.json) (with_zerovisual, 662 tokens)
- [`session-03-saas-pricing-contrast-without-1792733833890.json`](./sessions/session-03-saas-pricing-contrast-without-1792733833890.json) (without_zerovisual, 716 tokens)
- [`session-03-saas-pricing-contrast-with-1792733839738.json`](./sessions/session-03-saas-pricing-contrast-with-1792733839738.json) (with_zerovisual, 592 tokens)
- [`session-04-ecommerce-checkout-collision-without-1792733846863.json`](./sessions/session-04-ecommerce-checkout-collision-without-1792733846863.json) (without_zerovisual, 650 tokens)
- [`session-04-ecommerce-checkout-collision-with-1792733854278.json`](./sessions/session-04-ecommerce-checkout-collision-with-1792733854278.json) (with_zerovisual, 646 tokens)
- [`session-05-dashboard-stat-overflow-without-1792733862163.json`](./sessions/session-05-dashboard-stat-overflow-without-1792733862163.json) (without_zerovisual, 678 tokens)
- [`session-05-dashboard-stat-overflow-with-1792733871335.json`](./sessions/session-05-dashboard-stat-overflow-with-1792733871335.json) (with_zerovisual, 736 tokens)
- [`session-06-mobile-nav-overflow-without-1792733878829.json`](./sessions/session-06-mobile-nav-overflow-without-1792733878829.json) (without_zerovisual, 645 tokens)
- [`session-06-mobile-nav-overflow-with-1792733884481.json`](./sessions/session-06-mobile-nav-overflow-with-1792733884481.json) (with_zerovisual, 590 tokens)
- [`session-07-real-wikipedia-desktop-without-1792733895785.json`](./sessions/session-07-real-wikipedia-desktop-without-1792733895785.json) (without_zerovisual, 820 tokens)
- [`session-07-real-wikipedia-desktop-with-1792733902996.json`](./sessions/session-07-real-wikipedia-desktop-with-1792733902996.json) (with_zerovisual, 628 tokens)
- [`session-08-real-wikipedia-mobile-without-1792733910189.json`](./sessions/session-08-real-wikipedia-mobile-without-1792733910189.json) (without_zerovisual, 631 tokens)
- [`session-08-real-wikipedia-mobile-with-1792733915993.json`](./sessions/session-08-real-wikipedia-mobile-with-1792733915993.json) (with_zerovisual, 593 tokens)
- [`session-09-real-hackernews-desktop-without-1792733921931.json`](./sessions/session-09-real-hackernews-desktop-without-1792733921931.json) (without_zerovisual, 600 tokens)
- [`session-09-real-hackernews-desktop-with-1792733929148.json`](./sessions/session-09-real-hackernews-desktop-with-1792733929148.json) (with_zerovisual, 645 tokens)
- [`session-10-real-github-pricing-desktop-without-1792733941821.json`](./sessions/session-10-real-github-pricing-desktop-without-1792733941821.json) (without_zerovisual, 875 tokens)
- [`session-10-real-github-pricing-desktop-with-1792733951870.json`](./sessions/session-10-real-github-pricing-desktop-with-1792733951870.json) (with_zerovisual, 747 tokens)
- [`session-11-real-mdn-search-mobile-without-1792733958137.json`](./sessions/session-11-real-mdn-search-mobile-without-1792733958137.json) (without_zerovisual, 594 tokens)
- [`session-11-real-mdn-search-mobile-with-1792733964837.json`](./sessions/session-11-real-mdn-search-mobile-with-1792733964837.json) (with_zerovisual, 609 tokens)
