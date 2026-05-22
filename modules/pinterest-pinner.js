/**
 * Lumière Collection — Pinterest API v5 Pinner
 * Creates pins on Pinterest with SEO-optimised titles, descriptions, and board routing.
 */

import { apiJson } from '../utils/api-client.js';
import { writeJsonFile } from '../utils/file-utils.js';
import path from 'path';
import brand from '../config/brand.js';
import logger from '../utils/logger.js';

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

/**
 * Get the correct Pinterest board ID based on product age range.
 * @param {string} ageRange - e.g. "3-6", "0-2"
 * @returns {string} Environment variable key for the board ID
 */
function selectBoard(ageRange) {
  const boardMap = {
    '0-2': 'PINTEREST_BOARD_BABY',
    '2-4': 'PINTEREST_BOARD_BABY',
    '3-6': 'PINTEREST_BOARD_GIRLS',
    '4-7': 'PINTEREST_BOARD_GIRLS',
    '7-12': 'PINTEREST_BOARD_GIRLS',
  };

  const boardEnvKey = boardMap[ageRange] || brand.PINTEREST_AGE_BOARDS[ageRange] || 'PINTEREST_BOARD_NEW_ARRIVALS';
  return process.env[boardEnvKey] || process.env.PINTEREST_BOARD_NEW_ARRIVALS;
}

/**
 * Create a single Pinterest pin.
 * @param {string} boardId
 * @param {string} imageUrl - Public URL of the image
 * @param {string} title
 * @param {string} description
 * @param {string} linkUrl - Link the pin points to
 * @returns {Promise<object|null>}
 */
async function createPin(boardId, imageUrl, title, description, linkUrl) {
  const token = process.env.PINTEREST_ACCESS_TOKEN;

  const pinData = {
    board_id: boardId,
    title: title.slice(0, 100),
    description: description.slice(0, 500),
    link: linkUrl,
    media_source: {
      source_type: 'image_url',
      url: imageUrl,
    },
  };

  const result = await apiJson(
    `${PINTEREST_API_BASE}/pins`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinData),
    },
    { retries: 2 }
  );

  return result;
}

/**
 * Pin a product to Pinterest — creates pins on relevant boards.
 * Maximum 5 pins per product (Pinterest best practice).
 * @param {object} product
 * @param {object} contentPack
 * @param {Array} imageFiles - Enhanced image details with public URLs
 * @returns {Promise<Array>} Created pin objects
 */
export async function pinProduct(product, contentPack, imageFiles) {
  const token = process.env.PINTEREST_ACCESS_TOKEN;

  if (!token) {
    logger.warn('Pinterest token not set — skipping Pinterest pins. Payload saved to output.');
    return [];
  }

  const pinterest = contentPack.pinterest || {};
  const pinTitle = pinterest.pinTitle || product.name;
  const pinDescription = pinterest.pinDescription || `${product.name} for ages ${product.ageRange}. Shop at Lumière Collection.`;
  const storeUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN || 'lumierecollection.co.za'}/products/${product.slug}`;

  const createdPins = [];

  // Board routing: always pin to New Arrivals + age-specific board
  const boards = [];

  const newArrivalsBoard = process.env.PINTEREST_BOARD_NEW_ARRIVALS;
  if (newArrivalsBoard) boards.push({ id: newArrivalsBoard, name: 'New Arrivals' });

  const ageBoard = selectBoard(product.ageRange);
  if (ageBoard && ageBoard !== newArrivalsBoard) {
    boards.push({ id: ageBoard, name: `Age ${product.ageRange}` });
  }

  if (boards.length === 0) {
    logger.warn('No Pinterest board IDs configured. Set PINTEREST_BOARD_NEW_ARRIVALS in .env');
    return [];
  }

  // Pin up to 3 images across boards
  const imagesToPin = imageFiles.slice(0, Math.min(3, imageFiles.length));

  for (const board of boards) {
    for (let i = 0; i < imagesToPin.length; i++) {
      const imageFile = imagesToPin[i];

      // Images need public URLs — for local files, log a skip message
      if (!imageFile.publicUrl) {
        logger.step(`Skipping Pinterest pin for ${imageFile.filename} — no public URL available yet.`);
        logger.info('  Upload images to CDN/Shopify first, then set publicUrl in output metadata.');
        continue;
      }

      try {
        const variantTitle = i === 0
          ? pinTitle
          : `${pinTitle} — Detail View ${i}`;

        const result = await createPin(
          board.id,
          imageFile.publicUrl,
          variantTitle,
          pinDescription,
          storeUrl
        );

        createdPins.push({ ...result, board: board.name });
        logger.success(`Pinterest pin created on "${board.name}" (pin ID: ${result.id})`);

        // Rate limit: max 5 pins per product, 100 per day
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        logger.error(`Pinterest pin failed for ${board.name}: ${err.message}`);
      }
    }
  }

  return createdPins;
}

/**
 * Save a Pinterest draft for manual pinning (when no public URLs are available yet).
 * @param {object} product
 * @param {object} contentPack
 * @param {Array} imageFiles
 * @param {string} outputDir
 */
export function savePinterestDraft(product, contentPack, imageFiles, outputDir) {
  const pinterest = contentPack.pinterest || {};
  const storeUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN || 'lumierecollection.co.za'}/products/${product.slug}`;

  const draft = {
    product: product.name,
    slug: product.slug,
    boards: ['New Arrivals', `Kids Ages ${product.ageRange}`],
    pins: imageFiles.slice(0, 3).map((img, i) => ({
      imageFile: img.filename,
      title: i === 0 ? (pinterest.pinTitle || product.name) : `${pinterest.pinTitle || product.name} — Detail View ${i}`,
      description: pinterest.pinDescription || '',
      link: storeUrl,
      boardSuggestion: pinterest.boardSuggestion || 'New Arrivals',
    })),
    pinTitle: pinterest.pinTitle || product.name,
    pinDescription: pinterest.pinDescription || '',
    boardSuggestion: pinterest.boardSuggestion || '',
    storeUrl,
    manualInstructions: [
      '1. Go to pinterest.com/pin-builder',
      '2. Upload the image file from images/ folder',
      '3. Add the title and description below',
      '4. Set the link to your Shopify product URL',
      '5. Select the board and publish',
    ],
  };

  const draftPath = path.join(outputDir, 'pinterest-draft.json');
  writeJsonFile(draftPath, draft);
  return draftPath;
}
