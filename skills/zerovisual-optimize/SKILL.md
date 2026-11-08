---
name: zerovisual-optimize
description: Pre-process screenshots and UI images using model-aware tile downscaling and WebP compression to slash Vision LLM tokens by up to 90% and payload size by 99%.
---

# Vision Image Pre-Processing & Token Optimization Rubric

You are an expert AI Engineer and Vision Model Optimizer. Your objective is to ensure that screenshots, bug report images, and visual artifacts are pre-processed to fit the exact patch and tile geometry of target Vision LLMs—minimizing token burn and eliminating IPC/network payload latency.

## Why Optimization Is Essential Before Vision Prompts
1. **Raw Retina Screenshots Waste Thousands of Tokens:**
   - Standard macOS/Windows screenshots taken on high-DPI displays (e.g. `2880 × 1800 px`) consume between 2,000 and 4,000 tokens per single image.
   - Resizing to the target model's single-tile limit preserves full visual legibility while reducing token consumption to **~28 – 324 tokens**.
2. **Network & IPC Latency:**
   - Large PNG images (3–5 MB) become 4–7 MB Base64 strings.
   - Passing multiple uncompressed images freezes agent turn loops and risks hitting context limits.

## Optimization Procedure
1. **Identify the Source Image:** When a user provides a local image path, screenshot, or UI asset, locate the file on disk.
2. **Identify Target Provider:**
   - `anthropic`: Scales within `504 × 504 px` (exact 18×18 grid of 28×28px patches).
   - `openai`: Scales within `512 × 512 px` (single 512px tile).
   - `gemini`: Scales within `768 × 768 px` (or `384 × 384 px` with `--lowTokenMode`).
   - `local`: Scales within `448 × 448 px` for local VLMs (Gemma, Qwen-VL, Llama-Vision).
3. **Execute the Bundled Script (or CLI):**
   ```bash
   # Using the bundled skill script:
   node <skill-dir>/scripts/optimize.mjs <path-to-image> --provider anthropic --json

   # Or directly via npx:
   npx -y zerovisual optimize <path-to-image> --provider anthropic --json

   # Optional: Estimate token savings for any resolution without encoding:
   node <skill-dir>/scripts/optimize.mjs estimate --width 1920 --height 1080 --provider anthropic --json
   ```
4. **Inspect the Optimized Asset:**
   - Read the generated `.optimized.webp` file (`outputPath` in the JSON output) using your native file/image viewer tool instead of reading the raw uncompressed PNG.
   - Report the token and byte savings metrics from the script output.
