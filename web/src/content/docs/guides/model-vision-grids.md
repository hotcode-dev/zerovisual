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
By bounding the failure diff to 512×512, it guarantees that OpenAI evaluates the high-resolution image in exactly **1 single tile**, keeping the cost at $85 + 170 = \mathbf{255\text{ tokens}}$, rather than spanning multiple tiles ($600–2,100\text{ tokens}$).

---

## 3. Google Gemini (Gemini 2.0 Flash & Gemini 1.5 Pro)

Gemini divides images into discrete tiles of **768 × 768 pixels**:
- Each 768×768 tile costs **258 tokens**.
- Images exceeding 768px on any side trigger additional tile allocations.

### ZeroVisual `lowTokenMode` for Gemini
When `lowTokenMode: true` is configured, ZeroVisual downscales the diff to **`384 × 384 px`**:
- This fits well below the base tile limit and runs with ultra-low latency.
- Ideal for high-throughput CI/CD pipelines evaluating hundreds of PRs.

---

## 4. Local Vision Models (Qwen2-VL, Gemma, Llama-Vision)

Local open-source VLMs typically use a vision encoder (like SigLIP or CLIP) trained on $384\text{px}$ or $448\text{px}$ inputs.

ZeroVisual targets `448 × 448 px` by default for the `local` provider:
- You can also provide custom dimensions via the `customDimensions` option (e.g., `{ width: 384, height: 384 }`).
- Pre-scaling images on the host CPU with Sharp saves massive amounts of GPU memory (VRAM) during local model inference.

---

## 5. Token & Economics Comparison Matrix

| Scenario | Full HD Canvas (1920×1080) | ZeroVisual Anthropic (504px) | ZeroVisual OpenAI (512px) | ZeroVisual Gemini (768px) | ZeroVisual Small Diff (184×112) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Anthropic Tokens** | 2,691 | **324** | 361 | 756 | **28** |
| **OpenAI Tokens** | 2,125 | 255 | **255** | 425 | **255** |
| **Gemini Tokens** | 1,032 | 258 | 258 | **258** | **258** |
| **Base64 Payload Size** | ~5,300 KB | **~47 KB** | **~47 KB** | **~65 KB** | **~12 KB** |
| **Vision Token Savings** | Baseline | **88%** | **88%** | **75%** | **Up to 99%** |
| **Network Byte Savings**| Baseline | **99.1%** | **99.1%** | **98.8%** | **99.8%** |
