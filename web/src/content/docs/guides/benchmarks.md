---
title: Empirical LLM Benchmarks
description: Real-world empirical benchmark comparing Vision LLM visual regression triage with and without ZeroVisual on local Qwen 3.8-27B.
---

## 🌟 Executive Summary

To evaluate ZeroVisual in realistic production settings, we conducted an empirical benchmark using a real local Vision-Language Model (`RadixArk/Qwen3.8-27B-NVFP4` served via SGLang) across 6 diverse web UI visual regression scenarios.

ZeroVisual crops visual failure diffs, aligns them to native Vision Transformer (ViT) patch grids, and converts them to optimized WebP format—achieving dramatic reductions in token overhead and latency while improving triage accuracy.

| Core Metric | Without ZeroVisual (Raw Viewport) | With ZeroVisual (Optimized) | Empirical Improvement |
| :--- | :--- | :--- | :--- |
| **Total Tokens Consumed** | **11,556 tokens** | **5,421 tokens** | **-53.1% Total Tokens Saved** |
| **Vision Image Tokens (ViT)** | **5,252 tokens** | **644 tokens** | **-87.7% ViT Token Reduction** |
| **Network Payload Transfer** | **146.6 KB** | **21.7 KB** | **-85.2% Bandwidth Reduced** |
| **Average Roundtrip Latency** | **53.3 seconds** | **36.4 seconds** | **32% Faster Latency** |
| **Average Triage Accuracy** | **76.7%** | **82.5%** | **+5.8% Accuracy Improvement** |

---

## 📋 Per-Case Benchmark Results

| Test Case | Mode | Resolution | Payload | Total Tokens | ViT Image Tokens | Latency | Accuracy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Wikipedia Search Bar Shift** | Raw Viewport | 1280×800 | 24.6 KB | 3,186 | 1,000 | 136,060 ms | 65% |
| | **ZeroVisual** | **504×389** | **6.0 KB** | **887** | **192** | **38,100 ms** (3.5x faster) | **65%** |
| **2. GitHub PR Merge Box Regression** | Raw Viewport | 1280×800 | 27.1 KB | 1,607 | 1,000 | 23,864 ms | 65% |
| | **ZeroVisual** | **504×92** | **3.3 KB** | **1,573** | **76** | **86,918 ms** | **100%** |
| **3. SaaS Pricing Card Contrast Violation** | Raw Viewport | 1280×800 | 34.3 KB | 1,594 | 1,000 | 24,001 ms | 65% |
| | **ZeroVisual** | **274×103** | **0.6 KB** | **605** | **70** | **17,127 ms** (29% faster) | **65%** |
| **4. E-Commerce Checkout Collision** | Raw Viewport | 1280×800 | 22.4 KB | 2,567 | 1,000 | 78,966 ms | 100% |
| | **ZeroVisual** | **504×328** | **7.0 KB** | **847** | **160** | **25,435 ms** (3.1x faster) | **100%** |
| **5. Dashboard Stat Overflow & Clipping** | Raw Viewport | 1280×800 | 32.8 KB | 1,714 | 1,000 | 30,920 ms | 65% |
| | **ZeroVisual** | **504×66** | **3.4 KB** | **766** | **69** | **26,434 ms** (15% faster) | **65%** |
| **6. Mobile Safari Nav Drawer Overflow** | Raw Viewport | 390×664 | 5.5 KB | 888 | 252 | 26,022 ms | 100% |
| | **ZeroVisual** | **194×121** | **1.4 KB** | **743** | **77** | **24,603 ms** | **100%** |

---

## 🔬 Benchmark Methodology

### Evaluated Model & Architecture
- **Model:** `RadixArk/Qwen3.8-27B-NVFP4` running locally via SGLang
- **API Protocol:** Standard OpenAI-compatible `/v1/chat/completions` endpoint
- **Vision Grid:** Qwen native 28×28 pixel merged patches

### Evaluation Rubric
Each response is scored against ground-truth metadata across three dimensions:
1. **Target Element Identification:** Did the model identify the exact offending DOM component?
2. **Defect Classification:** Did the model diagnose the visual defect type (layout shift, contrast violation, flex collision, etc.)?
3. **Probable Root Cause & Fix:** Did the model deduce the correct CSS property (margin, z-index, font-size, outline) and offer a working fix?

---

## 💡 Key Architectural Insights

### 1. Vision Token Allocation (ViT Patch Math)
Without ZeroVisual, full-viewport screenshots (1280×800) consume **1,000 image tokens** per query on Qwen ViT. With ZeroVisual's bounding-box isolation and patch-aligned downscaling, image tokens drop to **69 – 192 tokens**—an **87.7% reduction**.

### 2. Eliminating Canvas Hallucinations
In complex pages like the GitHub PR view, feeding the full viewport caused the model to hallucinate issues in peripheral sidebars. Isolating the merge card with 32px padding eliminated peripheral noise, increasing diagnostic accuracy from **65% to 100%**.

### 3. Reasoning Latency
Full-size images impose substantial overhead during multi-head cross-attention. In Case 1 (Wikipedia Search), response latency dropped from **136.0s to 38.1s** (a **3.5x speedup**), preventing client request timeouts and token exhaustion.

---

## 🚀 Running the Benchmarks Locally

The benchmark dataset and automated test runner are included in the ZeroVisual repository:

```bash
# Generate the benchmark image dataset (if needed)
npm run benchmark:dataset

# Run the empirical benchmark suite against your LLM endpoint
npm run benchmark
```

Configuration is handled via `benchmark/.env`:

```bash
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=none
AGENT_MODEL=your-vision-model-id
```
