---
title: Model Vision Grids & Tokens
description: Detailed token mechanics and tile calculations for OpenAI, Anthropic, Gemini, and Local Vision LLMs.
sidebar:
  order: 3
---

Different Vision Large Language Models employ vastly different tokenization algorithms. Understanding how your model processes images is the key to optimizing token budgets and eliminating latency.

---

## 1. Anthropic Claude (Claude 3.5 & 3.7 Sonnet)

Anthropic calculates tokens using a continuous grid of **28 × 28 pixel patches**:

$$\text{Tokens} = \left\lceil \frac{\text{Width}}{28} \right\rceil \times \left\lceil \frac{\text{Height}}{28} \right\rceil$$

### Why ZeroVisual targets `504 × 504 px`
- $504 = 18 \times 28$.
- An image scaled into a 504×504 box consumes exactly $18 \times 18 = 324\text{ tokens}$.
- If an image were 512×512, it would round up to $\lceil 512 / 28 \rceil = 19$ patches, consuming $19 \times 19 = 361\text{ tokens}$ for 8 pixels of extra padding!
- **Small Diffs (`withoutEnlargement: true`):** A small 120×48 button diff with 32px padding is 184×112px. It consumes only $\lceil 184 / 28 \rceil \times \lceil 112 / 28 \rceil = 7 \times 4 = \mathbf{28\text{ tokens}}$!

---

## 2. OpenAI GPT-4o & GPT-4o-mini

OpenAI uses a two-tier resolution system:

1. **Low Detail Mode:** Flat cost of **85 tokens** (rescaled to 512×512).
2. **High Detail Mode:**
   - Image is first downscaled to fit within a 2048×2048 bounding box.
   - The shortest side is rescaled to 768px.
   - The image is divided into $512 \times 512\text{ px}$ tiles.
   - Each tile costs **170 tokens**, plus the **85 tokens** base overview:
     $$\text{Tokens} = 85 + (\text{Tiles}_W \times \text{Tiles}_H \times 170)$$

### Why ZeroVisual targets `512 × 512 px`
By bounding the failure diff to 512×512, it guarantees that OpenAI evaluates the high-resolution image in exactly **1 single tile**, keeping the cost at $85 + 170 = \mathbf{255\text{ tokens}}$, rather than spanning multiple tiles (600–2,100 tokens).

---

## 3. Google Gemma & Gemini (`gemma` / `gemini`)

Google's multimodal vision architectures—including **`google/gemma-4-26B-A4B-it`**, **PaliGemma 2**, and **Gemini 2.0 Flash**—divide input images into discrete tiles of **768 × 768 pixels**:

- Each 768×768 tile costs **258 tokens**.
- Images exceeding 768px on any dimension span across a multi-tile grid:
  $$\text{Tiles}_W = \left\lceil \frac{\text{Width}}{768} \right\rceil, \quad \text{Tiles}_H = \left\lceil \frac{\text{Height}}{768} \right\rceil$$
  $$\text{Tokens} = \text{Tiles}_W \times \text{Tiles}_H \times 258$$

### Why ZeroVisual targets `768 × 768 px` for Gemma
- **The Raw Canvas Penalty:** A raw desktop screenshot at $1280 \times 800\text{ px}$ requires $\lceil 1280 / 768 \rceil \times \lceil 800 / 768 \rceil = 2 \times 2 = \mathbf{4\text{ tiles}}$ ($1,032\text{ tokens}$). A full HD $1920 \times 1080\text{ px}$ screenshot spans $3 \times 2 = \mathbf{6\text{ tiles}}$ ($1,548\text{ tokens}$).
- **The ZeroVisual Guarantee:** By detecting the failure bounding box and downscaling to fit within 768×768px, ZeroVisual guarantees the diff fits inside **1 single native tile** ($\mathbf{258\text{ tokens}}$). On every desktop failure, this yields an immediate **75.0% ViT token reduction**.

### ZeroVisual `lowTokenMode` for Gemma & Gemini
When `lowTokenMode: true` is configured, ZeroVisual downscales the diff to **`384 × 384 px`**:
- Aligns perfectly with PaliGemma's native 384px patch grid and cuts memory footprint on local vLLM / Ollama deployments.
- Runs with ultra-low latency—ideal for high-throughput CI/CD pipelines evaluating hundreds of PRs.

### Empirical Validation on Local Gemma 4 26B
In our empirical benchmark against `google/gemma-4-26B-A4B-it` served locally via vLLM across 11 visual regression scenarios (including real websites Wikipedia, Hacker News, GitHub, MDN):
- **Vision Image Tokens:** Slashed from 9,030 down to 2,838 tokens (**-68.6% ViT reduction**).
- **Network Payload:** Reduced from 638.9 KB to 116.2 KB (**-81.8% bandwidth saved**).
- **Diagnostic Triage Accuracy:** Increased from 59.1% to 65.5% (**+6.4% boost**), jumping by **+14.0%** on live production websites by eliminating peripheral canvas noise.

---

## 4. Qwen-VL (`qwen`) & Local Open-Source VLMs (`local`)

### Qwen Vision (`qwen`)
Qwen models (Qwen2-VL, Qwen2.5-VL) use dynamic 2D spatial patch grids with $28 \times 28\text{ px}$ patches:
- ZeroVisual bounds Qwen images to **`504 × 504 px`** (an exact $18 \times 18$ grid of 28px patches = 324 tokens max).
- Small localized diffs consume as few as 28 tokens.

### Local Vision Models (`local`)
Local open-source VLMs typically use a vision encoder (like SigLIP or CLIP) trained on $384\text{px}$ or $448\text{px}$ inputs.
- ZeroVisual targets `448 × 448 px` by default for the `local` provider.
- Custom dimensions can be supplied via `customDimensions` (e.g. `{ width: 384, height: 384 }`).
- Pre-scaling images on the host CPU with Sharp saves massive amounts of GPU memory (VRAM) during local model inference.

---

## 5. Token & Economics Comparison Matrix

| Scenario | Full HD Canvas (1920×1080) | ZeroVisual Anthropic (504px) | ZeroVisual OpenAI (512px) | ZeroVisual Gemma / Gemini (768px) | ZeroVisual Small Diff (184×112) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Anthropic Tokens** | 2,691 | **324** | 361 | 756 | **28** |
| **OpenAI Tokens** | 2,125 | 255 | **255** | 425 | **255** |
| **Gemma / Gemini Tokens** | 1,548 (6 tiles) | 258 (1 tile) | 258 (1 tile) | **258 (1 tile)** | **258 (1 tile)** |
| **Base64 Payload Size** | ~5,300 KB | **~47 KB** | **~47 KB** | **~65 KB** | **~12 KB** |
| **Vision Token Savings** | Baseline | **88%** | **88%** | **83.3%** | **Up to 99%** |
| **Network Byte Savings**| Baseline | **99.1%** | **99.1%** | **98.8%** | **99.8%** |
