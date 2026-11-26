import sharp from 'sharp';

/**
 * Create a solid-color PNG buffer via sharp's `create` pipeline.
 * All fixtures in the test suite use 4-channel RGBA with alpha = 1.
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
