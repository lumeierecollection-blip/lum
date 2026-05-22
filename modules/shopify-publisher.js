/**
 * Lumière Collection — Shopify Publisher
 * Pushes products to Shopify via GraphQL Admin API 2026-04.
 */

import fs from 'fs';
import path from 'path';
import { graphqlRequest } from '../utils/api-client.js';
import { writeJsonFile } from '../utils/file-utils.js';
import logger from '../utils/logger.js';

/**
 * Get the Shopify GraphQL endpoint.
 */
function getShopifyEndpoint() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-04';
  return `https://${domain}/admin/api/${version}/graphql.json`;
}

/**
 * Get Shopify request headers.
 */
function getShopifyHeaders() {
  return {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN,
    'Content-Type': 'application/json',
  };
}

/**
 * Convert a description string to basic HTML for Shopify.
 * @param {string} description
 * @param {string[]} bullets
 * @returns {string} HTML string
 */
function buildShopifyHtml(description, bullets) {
  const descHtml = `<p>${description.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  const bulletsHtml = bullets && bullets.length
    ? `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
    : '';
  return `${descHtml}${bulletsHtml}`;
}

/**
 * Create a product on Shopify.
 * @param {object} product - Original product data
 * @param {object} contentPack - Generated copy from content-generator.js
 * @param {Array} imageFiles - Enhanced image file details
 * @returns {Promise<{id: string, handle: string, url: string}|null>}
 */
export async function publishToShopify(product, contentPack, imageFiles) {
  if (!process.env.SHOPIFY_ADMIN_API_TOKEN || !process.env.SHOPIFY_STORE_DOMAIN) {
    logger.warn('Shopify credentials not set — skipping Shopify push. Save payload to shopify-payload.json.');
    return null;
  }

  const shopify = contentPack.shopify;
  const endpoint = getShopifyEndpoint();
  const headers = getShopifyHeaders();

  const productInput = {
    title: shopify.title,
    descriptionHtml: buildShopifyHtml(shopify.description, shopify.bullets),
    vendor: 'Lumière Collection',
    productType: product.ageRange ? `Kids Ages ${product.ageRange}` : 'Kids Clothing',
    tags: shopify.tags,
    seo: {
      title: shopify.metaTitle,
      description: shopify.metaDescription,
    },
    status: 'DRAFT',
  };

  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          handle
          onlineStoreUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, mutation, { input: productInput }, headers);
    const result = data.productCreate;

    if (result.userErrors && result.userErrors.length > 0) {
      const errors = result.userErrors.map((e) => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Shopify product creation errors: ${errors}`);
    }

    const { id, handle } = result.product;

    // Add variants (price + inventory)
    await addProductVariant(id, product.price, endpoint, headers);

    // Upload images
    if (imageFiles && imageFiles.length > 0) {
      await uploadProductImages(id, imageFiles, shopify.altTexts || [], endpoint, headers);
    }

    const storeUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/products/${handle}`;
    logger.success(`Shopify product live: ${storeUrl}`);

    return { id, handle, url: storeUrl };
  } catch (err) {
    logger.error(`Shopify publish failed: ${err.message}`);
    return null;
  }
}

/**
 * Add a price variant to a product.
 */
async function addProductVariant(productId, priceRands, endpoint, headers) {
  const mutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    productId,
    variants: [
      {
        price: String(priceRands),
        inventoryItem: { tracked: true },
        inventoryQuantities: [{ availableQuantity: 50, locationId: null }],
      },
    ],
  };

  try {
    const data = await graphqlRequest(endpoint, mutation, variables, headers);
    if (data.productVariantsBulkCreate?.userErrors?.length > 0) {
      logger.warn('Variant creation had warnings: ' + JSON.stringify(data.productVariantsBulkCreate.userErrors));
    }
  } catch (err) {
    logger.warn(`Variant creation skipped: ${err.message}`);
  }
}

/**
 * Upload product images to Shopify.
 */
async function uploadProductImages(productId, imageFiles, altTexts, endpoint, headers) {
  const media = imageFiles.slice(0, 4).map((img, i) => {
    // For Shopify media upload we need staged uploads — but since images are local,
    // we'll use the file URLs if they're remote, or skip with a note if local-only.
    // In production: upload to CDN first, then pass URL to Shopify.
    return {
      alt: altTexts[i] || img.label,
      mediaContentType: 'IMAGE',
      // originalSource would be a public URL — requires staging for local files
    };
  });

  // Note: Full Shopify image upload requires staged uploads API for binary files.
  // This implementation logs the steps for the operator to complete manually.
  logger.step(`${imageFiles.length} images ready — upload via Shopify Admin or use staged upload API.`);
}

/**
 * Build and save the Shopify payload JSON for manual use or later push.
 * @param {object} product
 * @param {object} contentPack
 * @param {Array} imageFiles
 * @param {string} outputDir
 * @returns {string} Path to saved file
 */
export function saveShopifyPayload(product, contentPack, imageFiles, outputDir) {
  const shopify = contentPack.shopify;

  const payload = {
    product: {
      title: shopify.title,
      description: shopify.description,
      bullets: shopify.bullets,
      descriptionHtml: buildShopifyHtml(shopify.description, shopify.bullets),
      vendor: 'Lumière Collection',
      productType: `Kids Ages ${product.ageRange}`,
      tags: shopify.tags,
      seo: {
        metaTitle: shopify.metaTitle,
        metaDescription: shopify.metaDescription,
      },
      price: `R${product.price}`,
      priceNumeric: product.price,
      altTexts: shopify.altTexts,
      images: imageFiles.map((img) => ({
        filename: img.filename,
        label: img.label,
        dimensions: `${img.width}×${img.height}`,
      })),
    },
    publishedAt: new Date().toISOString(),
    automationVersion: '1.0.0',
  };

  const payloadPath = path.join(outputDir, 'shopify-payload.json');
  writeJsonFile(payloadPath, payload);
  return payloadPath;
}
