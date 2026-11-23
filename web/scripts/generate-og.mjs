import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, '../public/og-image.png');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    background-color: #090c12;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }

  /* Subtle 28px ViT patch grid background */
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(30, 39, 54, 0.42) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(30, 39, 54, 0.42) 1px, transparent 1px);
    background-size: 30px 30px;
    mask-image: radial-gradient(ellipse 90% 85% at 65% 45%, rgba(0, 0, 0, 0.85) 20%, transparent 100%);
  }

  /* Subtle emerald zenith wash */
  .zenith {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 65% 50% at 22% -8%, rgba(16, 185, 129, 0.14), transparent 72%),
      radial-gradient(ellipse 45% 45% at 88% 92%, rgba(34, 211, 238, 0.08), transparent 70%);
  }

  /* Top hairline accent bar */
  .top-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #10b981 0%, #34d399 45%, #22d3ee 100%);
  }

  .canvas {
    position: relative;
    z-index: 1;
    width: 1200px;
    height: 630px;
    padding: 56px 64px;
    display: grid;
    grid-template-columns: 1.18fr 0.82fr;
    gap: 48px;
    align-items: center;
  }

  /* Left column */
  .left {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-box {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-name {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #f8fafc;
  }

  .brand-domain {
    margin-left: auto;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
    font-weight: 500;
    color: #94a3b8;
    background: #0f141e;
    border: 1px solid #1e2736;
    padding: 6px 12px;
    border-radius: 8px;
  }

  .copy {
    margin-top: 28px;
  }

  h1 {
    font-size: 56px;
    font-weight: 800;
    line-height: 1.06;
    letter-spacing: -0.038em;
    color: #f8fafc;
  }

  h1 .accent {
    color: #34d399;
  }

  .subtitle {
    margin-top: 20px;
    font-size: 21px;
    line-height: 1.48;
    color: #94a3b8;
    max-width: 560px;
    font-weight: 400;
  }

  .subtitle strong {
    color: #e2e8f0;
    font-weight: 600;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: auto;
  }

  .stat-card {
    background: #0f141e;
    border: 1px solid #1e2736;
    border-radius: 12px;
    padding: 16px 18px;
  }

  .stat-value {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  .stat-value.emerald { color: #34d399; }
  .stat-value.cyan { color: #22d3ee; }
  .stat-value.white { color: #f8fafc; }

  .stat-label {
    margin-top: 6px;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94a3b8;
  }

  /* Right column: visual tile pipeline card */
  .pipeline-card {
    background: #0f141e;
    border: 1px solid #2d3a4f;
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
  }

  .stage-box {
    background: #090c12;
    border: 1px solid #1e2736;
    border-radius: 12px;
    padding: 16px;
  }

  .stage-box.optimized {
    border-color: rgba(16, 185, 129, 0.45);
    background: linear-gradient(180deg, rgba(16, 185, 129, 0.07) 0%, #090c12 100%);
  }

  .stage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .stage-tag {
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 6px;
  }

  .stage-tag.raw {
    color: #fda4af;
    background: rgba(251, 113, 133, 0.14);
    border: 1px solid rgba(251, 113, 133, 0.28);
  }

  .stage-tag.opt {
    color: #6ee7b7;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .stage-metric {
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .stage-metric.raw { color: #fb7185; }
  .stage-metric.opt { color: #34d399; }

  /* Mini browser wireframe for RAW */
  .wireframe {
    height: 112px;
    border-radius: 8px;
    background: #111827;
    border: 1px solid #1f2937;
    padding: 12px;
    position: relative;
    overflow: hidden;
  }

  .wf-bar {
    display: flex;
    gap: 5px;
    margin-bottom: 10px;
  }

  .wf-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #334155;
  }

  .wf-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .wf-line {
    height: 8px;
    border-radius: 4px;
    background: #1e293b;
  }

  .wf-crop-target {
    position: absolute;
    right: 18px;
    bottom: 16px;
    width: 152px;
    height: 44px;
    border: 2px solid #10b981;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wf-crop-target span {
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 600;
    color: #6ee7b7;
  }

  .connector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 600;
    color: #6ee7b7;
  }

  .connector-line {
    height: 1px;
    flex: 1;
    background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.45), transparent);
  }

  /* 1-tile WebP patch grid preview */
  .tile-preview {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .tile-grid {
    width: 126px;
    height: 88px;
    border-radius: 8px;
    border: 1.5px solid #10b981;
    background-color: #0d1620;
    background-image:
      linear-gradient(to right, rgba(16, 185, 129, 0.22) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(16, 185, 129, 0.22) 1px, transparent 1px);
    background-size: 18px 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tile-pill {
    background: #10b981;
    color: #03150e;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 8px;
    border-radius: 5px;
  }

  .tile-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tile-detail-title {
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
  }

  .tile-detail-sub {
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.45;
  }

  .cli-bar {
    background: #070a0f;
    border: 1px solid #1e2736;
    border-radius: 10px;
    padding: 12px 14px;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cli-prompt {
    color: #10b981;
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="zenith"></div>
  <div class="top-bar"></div>

  <div class="canvas">
    <div class="left">
      <div class="brand-row">
        <div class="logo-box">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 8V5a1 1 0 0 1 1-1h3" />
            <path d="M16 4h3a1 1 0 0 1 1 1v3" />
            <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
            <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
            <rect x="8" y="8" width="8" height="8" rx="1.5" fill="rgba(16, 185, 129, 0.22)" />
          </svg>
        </div>
        <span class="brand-name">ZeroVisual</span>
        <span class="brand-domain">zerovisual.hotcode.dev</span>
      </div>

      <div class="copy">
        <h1>
          <span class="accent">Zero-Waste</span> Visual QA<br />
          for AI Agents
        </h1>
        <p class="subtitle">
          Local visual regression &amp; <strong>rendered anti-slop</strong> pre-processor. Align diffs to exact LLM vision tiles with <strong>zero AI API keys</strong>.
        </p>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-value emerald">-85.1%</div>
          <div class="stat-label">ViT Tokens</div>
        </div>
        <div class="stat-card">
          <div class="stat-value cyan">-99%</div>
          <div class="stat-label">WebP Payload</div>
        </div>
        <div class="stat-card">
          <div class="stat-value white">0</div>
          <div class="stat-label">API Keys</div>
        </div>
      </div>
    </div>

    <div class="pipeline-card">
      <div class="stage-box">
        <div class="stage-header">
          <span class="stage-tag raw">Before · Raw PNG</span>
          <span class="stage-metric raw">2,691 tok · 4.0 MB</span>
        </div>
        <div class="wireframe">
          <div class="wf-bar">
            <span class="wf-dot"></span>
            <span class="wf-dot"></span>
            <span class="wf-dot"></span>
          </div>
          <div class="wf-lines">
            <div class="wf-line" style="width: 48%;"></div>
            <div class="wf-line" style="width: 72%;"></div>
            <div class="wf-line" style="width: 34%;"></div>
          </div>
          <div class="wf-crop-target">
            <span>diff bbox +32px</span>
          </div>
        </div>
      </div>

      <div class="connector">
        <span class="connector-line"></span>
        <span>↓ 1-Tile Grid Align + AOM Context</span>
        <span class="connector-line"></span>
      </div>

      <div class="stage-box optimized">
        <div class="stage-header">
          <span class="stage-tag opt">After · ZeroVisual</span>
          <span class="stage-metric opt">306 tok · 21 KB</span>
        </div>
        <div class="tile-preview">
          <div class="tile-grid">
            <span class="tile-pill">1-TILE</span>
          </div>
          <div class="tile-details">
            <div class="tile-detail-title">504 × 457 px WebP</div>
            <div class="tile-detail-sub">
              Claude · GPT-4o · Gemini · Qwen<br />
              + Scoped ariaSnapshot YAML
            </div>
          </div>
        </div>
      </div>

      <div class="cli-bar">
        <span class="cli-prompt">$</span>
        <span>npx skills add hotcode-dev/zerovisual</span>
      </div>
    </div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: outputPath, type: 'png' });
await browser.close();

const sizeKB = (statSync(outputPath).size / 1024).toFixed(1);
console.log(`Generated ${outputPath} (${sizeKB} KB)`);
