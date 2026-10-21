import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

interface BenchmarkCaseConfig {
  id: string;
  name: string;
  category: string;
  viewport: { width: number; height: number };
  device?: string;
  baselineHtml: string;
  actualHtml: string;
  groundTruth: {
    defect: string;
    affectedElement: string;
    defectType: string;
    rootCause: string;
    suggestedFix: string;
    expectedBoundingBox: { x: number; y: number; width: number; height: number };
  };
}

async function createPixelDiff(baselinePng: Buffer, actualPng: Buffer, outputPath: string) {
  // Use sharp to create a visual diff highlighting changed pixels in magenta / red
  const baseline = sharp(baselinePng);
  const actual = sharp(actualPng);

  const bMeta = await baseline.metadata();
  const width = bMeta.width ?? 1280;
  const height = bMeta.height ?? 800;

  const bRaw = await baseline.ensureAlpha().raw().toBuffer();
  const aRaw = await actual.ensureAlpha().raw().toBuffer();

  const diffBuf = Buffer.alloc(width * height * 4);

  let diffCount = 0;
  for (let i = 0; i < width * height * 4; i += 4) {
    const dr = Math.abs(bRaw[i] - aRaw[i]);
    const dg = Math.abs(bRaw[i + 1] - aRaw[i + 1]);
    const db = Math.abs(bRaw[i + 2] - aRaw[i + 2]);

    if (dr > 15 || dg > 15 || db > 15) {
      diffCount++;
      // Highlight diff in bright Playwright magenta (#ff00ff)
      diffBuf[i] = 255;
      diffBuf[i + 1] = 0;
      diffBuf[i + 2] = 255;
      diffBuf[i + 3] = 255;
    } else {
      // Dim unchanged pixels
      diffBuf[i] = Math.round(aRaw[i] * 0.4);
      diffBuf[i + 1] = Math.round(aRaw[i + 1] * 0.4);
      diffBuf[i + 2] = Math.round(aRaw[i + 2] * 0.4);
      diffBuf[i + 3] = 255;
    }
  }

  await sharp(diffBuf, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);

  return diffCount;
}

const cases: BenchmarkCaseConfig[] = [
  // CASE 1: Wikipedia Search Bar Offset
  {
    id: '01-wikipedia-search-offset',
    name: 'Wikipedia Portal Search Bar Shift',
    category: 'Layout Shift / Component Offset',
    viewport: { width: 1280, height: 800 },
    baselineHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 800px; }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo h1 { font-size: 32px; font-weight: 400; letter-spacing: 2px; }
    .logo p { font-size: 13px; color: #555; }
    .lang-ring { width: 240px; height: 180px; border: 2px dashed #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #888; font-size: 13px; margin-bottom: 30px; }
    .search-box { display: flex; width: 540px; border: 1px solid #72777d; border-radius: 2px; }
    .search-input { flex: 1; padding: 12px 16px; border: none; font-size: 16px; outline: none; }
    .search-lang { padding: 0 12px; display: flex; align-items: center; border-left: 1px solid #c8ccd1; color: #555; font-size: 14px; }
    .search-btn { background: #36c; color: #fff; border: none; padding: 0 20px; font-weight: bold; cursor: pointer; }
    footer { margin-top: 60px; font-size: 12px; color: #72777d; }
  </style>
</head>
<body>
  <div class="logo">
    <h1>WIKIPEDIA</h1>
    <p>The Free Encyclopedia</p>
  </div>
  <div class="lang-ring">English • 日本語 • Deutsch • Français</div>
  <div class="search-box">
    <input class="search-input" placeholder="Search Wikipedia" value="Visual regression">
    <div class="search-lang">EN ▼</div>
    <button class="search-btn">Search</button>
  </div>
  <footer>Wikipedia is hosted by the Wikimedia Foundation</footer>
</body>
</html>`,
    actualHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 800px; }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo h1 { font-size: 32px; font-weight: 400; letter-spacing: 2px; }
    .logo p { font-size: 13px; color: #555; }
    .lang-ring { width: 240px; height: 180px; border: 2px dashed #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #888; font-size: 13px; margin-bottom: 30px; }
    /* REGRESSION: unexpected 24px extra padding-left and button misaligned */
    .search-box { display: flex; width: 540px; border: 2px solid #e11d48; border-radius: 2px; margin-left: 60px; }
    .search-input { flex: 1; padding: 24px 16px; border: none; font-size: 16px; outline: none; }
    .search-lang { padding: 0 12px; display: flex; align-items: center; border-left: 1px solid #c8ccd1; color: #555; font-size: 14px; }
    .search-btn { background: #e11d48; color: #fff; border: none; padding: 0 10px; font-weight: bold; cursor: pointer; }
    footer { margin-top: 60px; font-size: 12px; color: #72777d; }
  </style>
</head>
<body>
  <div class="logo">
    <h1>WIKIPEDIA</h1>
    <p>The Free Encyclopedia</p>
  </div>
  <div class="lang-ring">English • 日本語 • Deutsch • Français</div>
  <div class="search-box">
    <input class="search-input" placeholder="Search Wikipedia" value="Visual regression">
    <div class="search-lang">EN ▼</div>
    <button class="search-btn">Search</button>
  </div>
  <footer>Wikipedia is hosted by the Wikimedia Foundation</footer>
</body>
</html>`,
    groundTruth: {
      defect: 'The .search-box container is shifted right by 60px with red border, input height expanded by 24px padding, and search button color changed to red.',
      affectedElement: '.search-box',
      defectType: 'layout_shift',
      rootCause: 'Accidental margin-left: 60px, padding: 24px, and background: #e11d48 override in CSS',
      suggestedFix: 'Remove margin-left: 60px, restore input padding to 12px 16px, restore button color to #36c',
      expectedBoundingBox: { x: 370, y: 460, width: 600, height: 90 }
    }
  },

  // CASE 2: GitHub PR Merge Button Shift
  {
    id: '02-github-pr-merge',
    name: 'GitHub Pull Request Merge Card Regression',
    category: 'Button Layout Shift / Sizing',
    viewport: { width: 1280, height: 800 },
    baselineHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; }
    .header { font-size: 24px; font-weight: 600; margin-bottom: 20px; }
    .merge-card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 20px; max-width: 800px; }
    .checks { display: flex; align-items: center; gap: 8px; color: #3fb950; font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .merge-row { display: flex; align-items: center; justify-content: space-between; }
    .desc { font-size: 13px; color: #8b949e; }
    .btn-merge { background: #238636; color: #fff; font-size: 14px; font-weight: 600; padding: 9px 18px; border: 1px solid rgba(240,246,252,0.1); border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="header">feat(auth): add OAuth2 token refresh #104</div>
  <div class="merge-card">
    <div class="checks">✓ All checks have passed (8 successful)</div>
    <div class="merge-row">
      <div class="desc">Merging will update master branch and trigger deployment.</div>
      <button class="btn-merge">Merge pull request</button>
    </div>
  </div>
</body>
</html>`,
    actualHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; }
    .header { font-size: 24px; font-weight: 600; margin-bottom: 20px; }
    .merge-card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 20px; max-width: 800px; }
    .checks { display: flex; align-items: center; gap: 8px; color: #3fb950; font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .merge-row { display: flex; align-items: center; justify-content: space-between; }
    .desc { font-size: 13px; color: #8b949e; }
    /* REGRESSION: Button padding blown up and background changed to orange */
    .btn-merge { background: #d97706; color: #fff; font-size: 18px; font-weight: 600; padding: 24px 36px; border: 2px dashed #f59e0b; border-radius: 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="header">feat(auth): add OAuth2 token refresh #104</div>
  <div class="merge-card">
    <div class="checks">✓ All checks have passed (8 successful)</div>
    <div class="merge-row">
      <div class="desc">Merging will update master branch and trigger deployment.</div>
      <button class="btn-merge">Merge pull request</button>
    </div>
  </div>
</body>
</html>`,
    groundTruth: {
      defect: 'The .btn-merge button has an oversized padding (24px 36px), orange background (#d97706), and dashed border instead of the canonical GitHub green button.',
      affectedElement: '.btn-merge',
      defectType: 'button_styling_regression',
      rootCause: 'Incorrect CSS rule overriding padding, font-size, and background color',
      suggestedFix: 'Restore background: #238636, padding: 9px 18px, font-size: 14px, border-radius: 6px',
      expectedBoundingBox: { x: 550, y: 110, width: 280, height: 90 }
    }
  },

  // CASE 3: SaaS Pricing Card Low Contrast
  {
    id: '03-saas-pricing-contrast',
    name: 'SaaS Pricing Card Contrast Violation',
    category: 'Accessibility / Color Contrast Failure',
    viewport: { width: 1280, height: 800 },
    baselineHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 60px; display: flex; justify-content: center; }
    .pricing-grid { display: grid; grid-template-columns: repeat(3, 260px); gap: 24px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .card.pro { border-color: #6366f1; box-shadow: 0 10px 25px -5px rgba(99,102,241,0.2); }
    .plan { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1e293b; }
    .price { font-size: 32px; font-weight: 800; color: #0f172a; margin-bottom: 24px; }
    .features { list-style: none; font-size: 13px; color: #64748b; line-height: 2; margin-bottom: 32px; }
    .cta-btn { width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; }
    .cta-free { background: #f1f5f9; color: #334155; }
    .cta-pro { background: #6366f1; color: #ffffff; }
    .cta-ent { background: #0f172a; color: #ffffff; }
  </style>
</head>
<body>
  <div class="pricing-grid">
    <div class="card">
      <div class="plan">Starter</div>
      <div class="price">$0</div>
      <ul class="features"><li>5 Projects</li><li>Community Support</li></ul>
      <button class="cta-btn cta-free">Start Free</button>
    </div>
    <div class="card pro">
      <div class="plan">Pro</div>
      <div class="price">$29<span style="font-size:14px">/mo</span></div>
      <ul class="features"><li>Unlimited Projects</li><li>ZeroVisual MCP</li><li>24/7 SLA</li></ul>
      <button class="cta-btn cta-pro">Get Pro</button>
    </div>
    <div class="card">
      <div class="plan">Enterprise</div>
      <div class="price">$99<span style="font-size:14px">/mo</span></div>
      <ul class="features"><li>Dedicated VPC</li><li>Custom Integrations</li></ul>
      <button class="cta-btn cta-ent">Contact Sales</button>
    </div>
  </div>
</body>
</html>`,
    actualHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 60px; display: flex; justify-content: center; }
    .pricing-grid { display: grid; grid-template-columns: repeat(3, 260px); gap: 24px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .card.pro { border-color: #6366f1; box-shadow: 0 10px 25px -5px rgba(99,102,241,0.2); }
    .plan { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1e293b; }
    .price { font-size: 32px; font-weight: 800; color: #0f172a; margin-bottom: 24px; }
    .features { list-style: none; font-size: 13px; color: #64748b; line-height: 2; margin-bottom: 32px; }
    .cta-btn { width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; }
    .cta-free { background: #f1f5f9; color: #334155; }
    /* REGRESSION: Extreme contrast failure on Pro CTA button (#e2e8f0 on #cbd5e1) */
    .cta-pro { background: #e2e8f0; color: #cbd5e1; }
    .cta-ent { background: #0f172a; color: #ffffff; }
  </style>
</head>
<body>
  <div class="pricing-grid">
    <div class="card">
      <div class="plan">Starter</div>
      <div class="price">$0</div>
      <ul class="features"><li>5 Projects</li><li>Community Support</li></ul>
      <button class="cta-btn cta-free">Start Free</button>
    </div>
    <div class="card pro">
      <div class="plan">Pro</div>
      <div class="price">$29<span style="font-size:14px">/mo</span></div>
      <ul class="features"><li>Unlimited Projects</li><li>ZeroVisual MCP</li><li>24/7 SLA</li></ul>
      <button class="cta-btn cta-pro">Get Pro</button>
    </div>
    <div class="card">
      <div class="plan">Enterprise</div>
      <div class="price">$99<span style="font-size:14px">/mo</span></div>
      <ul class="features"><li>Dedicated VPC</li><li>Custom Integrations</li></ul>
      <button class="cta-btn cta-ent">Contact Sales</button>
    </div>
  </div>
</body>
</html>`,
    groundTruth: {
      defect: 'The Pro plan CTA button (.cta-pro) has illegible low contrast: light gray text (#cbd5e1) on light gray background (#e2e8f0), violating WCAG 2.1 AA.',
      affectedElement: '.cta-pro',
      defectType: 'accessibility_contrast_violation',
      rootCause: 'Improper color values: background: #e2e8f0; color: #cbd5e1',
      suggestedFix: 'Set background: #6366f1; color: #ffffff to ensure >= 4.5:1 contrast ratio',
      expectedBoundingBox: { x: 508, y: 310, width: 212, height: 48 }
    }
  },

  // CASE 4: E-Commerce Checkout Flex Collision
  {
    id: '04-ecommerce-checkout-collision',
    name: 'E-Commerce Checkout Total & Button Collision',
    category: 'Layout Collision / Margin Collapse',
    viewport: { width: 1280, height: 800 },
    baselineHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 800px; }
    .checkout-modal { background: #fff; border-radius: 16px; padding: 32px; width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
    .line-item { display: flex; justify-content: space-between; font-size: 14px; color: #64748b; margin-bottom: 12px; }
    .divider { border-top: 1px dashed #cbd5e1; margin: 16px 0; }
    .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 24px; }
    .btn-pay { width: 100%; background: #10b981; color: #fff; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="checkout-modal">
    <div class="modal-title">Order Summary</div>
    <div class="line-item"><span>Vision Token Pack</span><span>$49.00</span></div>
    <div class="line-item"><span>Estimated Tax</span><span>$4.41</span></div>
    <div class="divider"></div>
    <div class="total-row"><span>Total Due</span><span>$53.41</span></div>
    <button class="btn-pay">Pay $53.41 Now</button>
  </div>
</body>
</html>`,
    actualHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 800px; }
    .checkout-modal { background: #fff; border-radius: 16px; padding: 32px; width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
    .line-item { display: flex; justify-content: space-between; font-size: 14px; color: #64748b; margin-bottom: 12px; }
    .divider { border-top: 1px dashed #cbd5e1; margin: 16px 0; }
    /* REGRESSION: Negative margin causing Total Due to collide and overlap button */
    .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: -32px; position: relative; z-index: 2; }
    .btn-pay { width: 100%; background: #10b981; color: #fff; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="checkout-modal">
    <div class="modal-title">Order Summary</div>
    <div class="line-item"><span>Vision Token Pack</span><span>$49.00</span></div>
    <div class="line-item"><span>Estimated Tax</span><span>$4.41</span></div>
    <div class="divider"></div>
    <div class="total-row"><span>Total Due</span><span>$53.41</span></div>
    <button class="btn-pay">Pay $53.41 Now</button>
  </div>
</body>
</html>`,
    groundTruth: {
      defect: 'The .total-row text overlaps directly on top of the .btn-pay button due to negative margin-bottom: -32px.',
      affectedElement: '.total-row and .btn-pay',
      defectType: 'layout_element_collision',
      rootCause: 'margin-bottom: -32px on .total-row causing overlapping layout collision',
      suggestedFix: 'Remove negative margin and set margin-bottom: 24px',
      expectedBoundingBox: { x: 420, y: 440, width: 440, height: 100 }
    }
  },

  // CASE 5: Analytics Dashboard Card Text Truncation
  {
    id: '05-dashboard-stat-overflow',
    name: 'Dashboard KPI Metric Overflow and Clipping',
    category: 'Text Overflow / Component Clipping',
    viewport: { width: 1280, height: 800 },
    baselineHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; }
    .dash-header { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .kpi-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; overflow: hidden; }
    .kpi-label { font-size: 13px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
    .kpi-val { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px; }
    .kpi-sub { font-size: 12px; color: #10b981; font-weight: 600; }
  </style>
</head>
<body>
  <div class="dash-header">Production Telemetry</div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">Tokens Saved</div><div class="kpi-val">94.2%</div><div class="kpi-sub">↑ 4.1% vs avg</div></div>
    <div class="kpi-card"><div class="kpi-label">Active Agents</div><div class="kpi-val">12,450</div><div class="kpi-sub">↑ 14% this week</div></div>
    <div class="kpi-card"><div class="kpi-label">Payload P95</div><div class="kpi-val">34 KB</div><div class="kpi-sub">↓ 98% reduced</div></div>
    <div class="kpi-card"><div class="kpi-label">Cost per Diff</div><div class="kpi-val">$0.0002</div><div class="kpi-sub">Zero API Keys</div></div>
  </div>
</body>
</html>`,
    actualHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; }
    .dash-header { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .kpi-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; overflow: hidden; }
    .kpi-label { font-size: 13px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
    .kpi-val { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px; }
    .kpi-sub { font-size: 12px; color: #10b981; font-weight: 600; }
    /* REGRESSION: Second card font-size blown up to 64px causing text clipping and overflow */
    .kpi-card:nth-child(2) .kpi-val { font-size: 64px; line-height: 1; color: #f43f5e; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="dash-header">Production Telemetry</div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">Tokens Saved</div><div class="kpi-val">94.2%</div><div class="kpi-sub">↑ 4.1% vs avg</div></div>
    <div class="kpi-card"><div class="kpi-label">Active Agents</div><div class="kpi-val">12,450</div><div class="kpi-sub">↑ 14% this week</div></div>
    <div class="kpi-card"><div class="kpi-label">Payload P95</div><div class="kpi-val">34 KB</div><div class="kpi-sub">↓ 98% reduced</div></div>
    <div class="kpi-card"><div class="kpi-label">Cost per Diff</div><div class="kpi-val">$0.0002</div><div class="kpi-sub">Zero API Keys</div></div>
  </div>
</body>
</html>`,
    groundTruth: {
      defect: 'The "Active Agents" metric font size is oversized (64px) and colored red, causing it to clip and break the card layout.',
      affectedElement: '.kpi-card:nth-child(2) .kpi-val',
      defectType: 'typography_overflow_clipping',
      rootCause: 'font-size: 64px on metric value exceeds card dimensions',
      suggestedFix: 'Restore font-size: 28px and color: #fff',
      expectedBoundingBox: { x: 345, y: 90, width: 285, height: 130 }
    }
  },

  // CASE 6: Mobile Navigation Drawer Overflow (iPhone 14)
  {
    id: '06-mobile-nav-overflow',
    name: 'Mobile Safari Navigation Drawer Overflow',
    category: 'Mobile Responsive / Viewport Overflow',
    viewport: { width: 390, height: 844 },
    device: 'iPhone 14',
    baselineHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, sans-serif; width: 390px; height: 844px; overflow: hidden; }
    .nav { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #30363d; background: #161b22; }
    .brand { font-size: 16px; font-weight: 700; color: #58a6ff; }
    .hamburger { width: 32px; height: 32px; background: #21262d; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #c9d1d9; font-size: 18px; border: 1px solid #30363d; }
    .content { padding: 24px 20px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="nav">
    <div class="brand">ZeroVisual</div>
    <div class="hamburger">☰</div>
  </div>
  <div class="content">
    <div class="card">Mobile Dashboard View</div>
    <div class="card">Real-Time QA Stream</div>
  </div>
</body>
</html>`,
    actualHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, sans-serif; width: 390px; height: 844px; overflow: hidden; }
    .nav { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #30363d; background: #161b22; }
    .brand { font-size: 16px; font-weight: 700; color: #58a6ff; }
    /* REGRESSION: Negative margin-right pushes hamburger button outside mobile viewport */
    .hamburger { width: 48px; height: 48px; margin-right: -36px; background: #e11d48; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; border: 2px solid #f43f5e; }
    .content { padding: 24px 20px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="nav">
    <div class="brand">ZeroVisual</div>
    <div class="hamburger">☰</div>
  </div>
  <div class="content">
    <div class="card">Mobile Dashboard View</div>
    <div class="card">Real-Time QA Stream</div>
  </div>
</body>
</html>`,
    groundTruth: {
      defect: 'The .hamburger button has margin-right: -36px pushing it off the right edge of the mobile screen, with red background (#e11d48).',
      affectedElement: '.hamburger',
      defectType: 'mobile_viewport_overflow',
      rootCause: 'Negative margin margin-right: -36px causing off-screen overflow',
      suggestedFix: 'Remove margin-right: -36px and set width: 32px, height: 32px, background: #21262d',
      expectedBoundingBox: { x: 330, y: 10, width: 60, height: 50 }
    }
  }
];

async function generateBenchmarkDataset() {
  const browser = await chromium.launch({ headless: true });
  const baseDir = path.resolve(process.cwd(), 'benchmark/testdata');

  console.log(`Generating ${cases.length} web-UI benchmark test cases in ${baseDir}...`);

  for (const c of cases) {
    const caseDir = path.join(baseDir, c.id);
    fs.mkdirSync(caseDir, { recursive: true });

    const context = c.device 
      ? await browser.newContext(devices[c.device])
      : await browser.newContext({ viewport: c.viewport });

    const page = await context.newPage();

    // 1. Render Baseline
    await page.setContent(c.baselineHtml);
    const baselinePng = await page.screenshot({ scale: 'css' });
    fs.writeFileSync(path.join(caseDir, 'baseline.png'), baselinePng);

    // 2. Render Actual with Regression
    await page.setContent(c.actualHtml);
    const actualPng = await page.screenshot({ scale: 'css' });
    fs.writeFileSync(path.join(caseDir, 'actual.png'), actualPng);

    // 3. Compute Diff
    const diffCount = await createPixelDiff(
      baselinePng,
      actualPng,
      path.join(caseDir, 'diff.png')
    );

    // 4. Write Metadata
    const metadata = {
      id: c.id,
      name: c.name,
      category: c.category,
      viewport: c.viewport,
      diffPixels: diffCount,
      groundTruth: c.groundTruth
    };
    fs.writeFileSync(
      path.join(caseDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`✓ [${c.id}] ${c.name} (Diff Pixels: ${diffCount})`);
    await context.close();
  }

  await browser.close();
  console.log('✅ Benchmark dataset generation complete!');
}

generateBenchmarkDataset().catch(console.error);
