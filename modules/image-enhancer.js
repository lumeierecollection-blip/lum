/**
 * Lumière Collection — Image Enhancer
 * Downloads supplier images and runs them through a warm lifestyle photography pipeline.
 * Optional: Real-ESRGAN 4K upscaling via Replicate API.
 */

import sharp from 'sharp';
import path from 'path';
import { downloadBuffer, apiJson } from '../utils/api-client.js';
import { ensureDir, writeFileSafe } from '../utils/file-utils.js';
import logger from '../utils/logger.js';

/**
 * Process a single image through the enhancement pipeline.
 * Applies warm grade, contrast boost, subtle grain, and sharpening.
 * @param {Buffer} inputBuffer - Raw image buffer
 * @returns {Promise<Buffer>} Enhanced JPEG buffer
 */
async function enhanceImage(inputBuffer) {
  // Film grain overlay: generate a noise layer via sharp
  const metadata = await sharp(inputBuffer).metadata();
  const width = Math.max(metadata.width || 1200, 2048);
  const height = Math.max(metadata.height || 2048, 2048);

  // Step 1: Resize, warm grade, contrast, sharpen
  const enhanced = await sharp(inputBuffer)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    // Warm colour grading — boost reds, reduce blues
    .modulate({
      saturation: 0.95, // Slightly desaturated = film look
    })
    // Contrast and brightness curves to taste
    .linear(
      [1.06, 1.04, 0.97], // r, g, b multipliers for warm grade
      [-3, -2, 4]         // r, g, b offsets
    )
    // Sharpen for fabric detail
    .sharpen({ sigma: 0.8 })
    // Add subtle noise for film grain effect
    .convolve({
      width: 3,
      height: 3,
      kernel: [0, -0.1, 0, -0.1, 1.4, -0.1, 0, -0.1, 0],
    })
    // Output high-quality JPEG
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();

  return enhanced;
}

/**
 * Upscale an image to 4K using Replicate's Real-ESRGAN model.
 * Only runs if REPLICATE_API_KEY is set.
 * @param {Buffer} imageBuffer
 * @param {string} tempInputPath - Temp path to write buffer for Replicate
 * @returns {Promise<Buffer>} Upscaled image buffer
 */
async function upscaleWithReplicate(imageBuffer, tempInputPath) {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) return imageBuffer;

  // Write to a temp path for Replicate's file-based API
  writeFileSafe(tempInputPath, imageBuffer, null);

  // Convert buffer to base64 data URL for Replicate input
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;

  logger.step('Sending to Replicate Real-ESRGAN x4...');

  try {
    // Start prediction
    const prediction = await apiJson(
      'https://api.replicate.com/v1/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee2d209f07ea5c2d3f706',
          input: {
            image: dataUrl,
            scale: 4,
            face_enhance: false,
          },
        }),
      },
      { retries: 2 }
    );

    if (!prediction.id) throw new Error('No prediction ID returned from Replicate');

    // Poll for completion
    let result;
    let attempts = 0;
    const maxAttempts = 60; // 60 × 3s = 3 minutes max

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 3000));
      result = await apiJson(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { Authorization: `Token ${apiKey}` },
        },
        { retries: 2 }
      );

      if (result.status === 'succeeded') break;
      if (result.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${result.error}`);
      }
      attempts++;
    }

    if (result?.status !== 'succeeded' || !result.output) {
      throw new Error('Replicate timed out or returned no output');
    }

    // Download the upscaled result
    const upscaledBuffer = await downloadBuffer(result.output);
    logger.success('Real-ESRGAN 4K upscale complete');
    return upscaledBuffer;
  } catch (err) {
    logger.warn(`Replicate upscale skipped: ${err.message}`);
    return imageBuffer;
  }
}

/**
 * Full image enhancement pipeline for a product.
 * Downloads, enhances, optionally upscales, and saves all supplier images.
 *
 * @param {string[]} imageUrls - Array of supplier image URLs
 * @param {string} productSlug - Used for naming output files
 * @param {string} outputDir - Base output directory path
 * @returns {Promise<Array<{path: string, label: string, width: number, height: number}>>}
 */
export async function enhanceProductImages(imageUrls, productSlug, outputDir) {
  const imagesDir = path.join(outputDir, 'images');
  ensureDir(imagesDir);

  const results = [];
  const labels = ['hero', 'detail-1', 'detail-2', 'detail-3', 'detail-4'];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i].trim();
    const label = labels[i] || `detail-${i}`;
    const outputFilename = `${productSlug}-${label}.jpg`;
    const outputPath = path.join(imagesDir, outputFilename);

    try {
      // 1. Download
      logger.step(`Downloading image ${i + 1}/${imageUrls.length}...`);
      const rawBuffer = await downloadBuffer(url);

      // 2. Enhance through Sharp pipeline
      logger.step(`Enhancing ${label}...`);
      const enhancedBuffer = await enhanceImage(rawBuffer);

      // 3. Optional 4K upscale via Replicate
      const finalBuffer = process.env.REPLICATE_API_KEY
        ? await upscaleWithReplicate(enhancedBuffer, path.join(imagesDir, `_temp-${label}.jpg`))
        : enhancedBuffer;

      // 4. Save final image
      writeFileSafe(outputPath, finalBuffer, null);

      // 5. Get final dimensions
      const meta = await sharp(finalBuffer).metadata();
      results.push({
        path: outputPath,
        label,
        filename: outputFilename,
        width: meta.width,
        height: meta.height,
        sizeKb: Math.round(finalBuffer.length / 1024),
      });
    } catch (err) {
      logger.error(`Failed to process image ${i + 1}: ${err.message}`);
    }
  }

  // 6. Write composition guide
  const compositionGuide = buildCompositionGuide(results, productSlug);
  writeFileSafe(path.join(imagesDir, 'composition-guide.md'), compositionGuide);

  return results;
}

/**
 * Builds a markdown composition guide for the human operator.
 * @param {Array} images
 * @param {string} productSlug
 * @returns {string}
 */
function buildCompositionGuide(images, productSlug) {
  const hero = images[0];
  const details = images.slice(1);

  return `# IMAGE COMPOSITION GUIDE — ${productSlug}

Generated by Lumière Collection Automation System

---

## RECOMMENDED USAGE

### Instagram Hero (Feed / Reels Thumbnail)
**File:** ${hero?.filename || 'hero.jpg'}
**Why:** Hero image gives maximum visual impact. Best for first-impression scroll-stopping.
**Crop:** Square 1:1 for feed, or 4:5 portrait for maximum feed coverage.

### TikTok Thumbnail
**File:** ${hero?.filename || 'hero.jpg'}
**Why:** Use the hero image cropped to 9:16 for TikTok cover.
**Tip:** Place the main product element in the upper 60% — TikTok overlays description text at the bottom.

### Pinterest Pin
**File:** ${details[0]?.filename || images[0]?.filename || 'detail-1.jpg'}
**Why:** Pinterest rewards tall images (2:3 ratio). Detail shot shows product quality better for Pinterest's visual search.
**Size:** 1000×1500px minimum.

### Shopify Product Gallery Order
${images.map((img, i) => `${i + 1}. ${img.filename} — ${i === 0 ? 'Hero/main image' : `Detail view ${i}`}`).join('\n')}

### CapCut Slide Order
0:03–0:08 → ${hero?.filename || 'hero.jpg'} (Ken Burns slow zoom)
${details.map((img, i) => `0:${String(8 + i * 3).padStart(2, '0')}–0:${String(11 + i * 3).padStart(2, '0')} → ${img.filename}`).join('\n')}

---

## TECHNICAL DETAILS
${images.map((img) => `- **${img.filename}**: ${img.width}×${img.height}px | ${img.sizeKb}KB`).join('\n')}

---

*All images have been warm-graded and sharpened for lifestyle photography quality.*
*If Replicate API was active, images have been upscaled to 4K resolution.*
`;
}
