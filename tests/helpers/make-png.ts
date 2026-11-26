import sharp from 'sharp';

/**
 * Build a solid-color RGBA PNG buffer via sharp's create option.
 * Shared test fixture — replaces per-test 8-line `sharp({ create: {...} })` blocks.
 */
export async function makePng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
  alpha = 1
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { ...color, alpha } }
  })
    .png()
    .toBuffer();
}
