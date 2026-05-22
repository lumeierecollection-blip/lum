/**
 * Lumière Collection — Content Generator
 * Generates all copy via Claude API with brand voice validation and auto-retry.
 */

import Anthropic from '@anthropic-ai/sdk';
import brand from '../config/brand.js';
import {
  BRAND_SYSTEM_PROMPT,
  shopifyProductTitle,
  shopifyDescription,
  shopifyBulletPoints,
  shopifyMetaTags,
  instagramCaption,
  instagramHashtags,
  tiktokScript,
  pinterestPin,
  facebookCaption,
  emailSubjectLines,
  productAltText,
} from '../config/prompts.js';
import logger from '../utils/logger.js';

const MAX_RETRIES = 2;

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN;

    if (!apiKey && !authToken) {
      throw new Error('ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is not set in .env');
    }

    // ANTHROPIC_AUTH_TOKEN (Bearer) takes precedence if set;
    // ANTHROPIC_API_KEY is for standard sk-ant-api- keys.
    // The SDK auto-reads both env vars — instantiating with no options works.
    _client = new Anthropic();
  }
  return _client;
}

/**
 * Call Claude API with the brand system prompt.
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @returns {Promise<string>} Raw text response
 */
async function callClaude(userPrompt, maxTokens = 1024) {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: BRAND_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}

/**
 * Scan text for forbidden brand words.
 * @param {string} text
 * @returns {string[]} Array of found forbidden words
 */
function findForbiddenWords(text) {
  const lowerText = text.toLowerCase();
  return brand.FORBIDDEN_WORDS.filter((word) => lowerText.includes(word.toLowerCase()));
}

/**
 * Call Claude and auto-retry if forbidden words are found.
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @param {string} fieldName - For logging
 * @returns {Promise<string>}
 */
async function callClaudeWithBrandCheck(userPrompt, maxTokens = 1024, fieldName = 'copy') {
  let result = await callClaude(userPrompt, maxTokens);
  let violations = findForbiddenWords(result);

  let attempt = 0;
  while (violations.length > 0 && attempt < MAX_RETRIES) {
    attempt++;
    violations.forEach((w) => logger.brandViolation(w, attempt));

    const correctionPrompt = `The following copy contains forbidden words that make it sound AI-generated: ${violations.map((w) => `"${w}"`).join(', ')}.

Rewrite the following copy removing those words entirely and replacing with natural, human language:

${result}

Do NOT use any of these words: ${violations.join(', ')}`;

    result = await callClaude(correctionPrompt, maxTokens);
    violations = findForbiddenWords(result);
  }

  logger.brandClean(violations.length);

  if (violations.length > 0) {
    logger.warn(`⚠ ${fieldName} still has ${violations.length} violation(s) after ${MAX_RETRIES} retries — flagged for review`);
  }

  return result;
}

/**
 * Parse JSON from Claude response, stripping any accidental markdown fences.
 * @param {string} text
 * @returns {object}
 */
function parseJsonResponse(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Generate complete Shopify copy pack.
 * @param {object} product
 * @returns {Promise<object>}
 */
async function generateShopifyCopy(product) {
  logger.step('Shopify copy...');

  const [title, description, bulletsRaw, metaRaw] = await Promise.all([
    callClaudeWithBrandCheck(shopifyProductTitle(product.name, product.ageRange), 128, 'shopify title'),
    callClaudeWithBrandCheck(shopifyDescription(product), 256, 'shopify description'),
    callClaudeWithBrandCheck(shopifyBulletPoints(product), 512, 'shopify bullets'),
    callClaude(shopifyMetaTags(product), 512),
  ]);

  let bullets = [];
  let metaTags = { metaTitle: '', metaDescription: '', tags: [] };

  try {
    bullets = parseJsonResponse(bulletsRaw);
  } catch {
    bullets = bulletsRaw.split('\n').filter((l) => l.trim().startsWith('-')).map((l) => l.replace(/^-\s*/, ''));
  }

  try {
    metaTags = parseJsonResponse(metaRaw);
  } catch {
    logger.warn('Could not parse Shopify meta tags JSON — using defaults');
  }

  // Generate alt texts for up to 4 images
  const altTexts = await Promise.all(
    ['hero', 'detail-1', 'detail-2', 'detail-3'].map((label) =>
      callClaude(productAltText(product, label), 128)
    )
  );

  return {
    title: title.trim(),
    description: description.trim(),
    bullets,
    metaTitle: metaTags.metaTitle || title.trim().slice(0, 60),
    metaDescription: metaTags.metaDescription || '',
    tags: metaTags.tags || [],
    altTexts,
  };
}

/**
 * Generate Instagram content.
 * @param {object} product
 * @returns {Promise<object>}
 */
async function generateInstagramCopy(product) {
  logger.step('Instagram captions...');

  const [captionStory, captionFeature, captionUGC, hashtags] = await Promise.all([
    callClaudeWithBrandCheck(instagramCaption(product, 'story'), 256, 'instagram story'),
    callClaudeWithBrandCheck(instagramCaption(product, 'feature'), 256, 'instagram feature'),
    callClaudeWithBrandCheck(instagramCaption(product, 'ugc'), 256, 'instagram ugc'),
    callClaude(instagramHashtags(product, product.season), 256),
  ]);

  return {
    captionStory: captionStory.trim(),
    captionFeature: captionFeature.trim(),
    captionUGC: captionUGC.trim(),
    hashtags: hashtags.trim(),
  };
}

/**
 * Generate TikTok content.
 * @param {object} product
 * @returns {Promise<object>}
 */
async function generateTikTokCopy(product) {
  logger.step('TikTok script...');

  const raw = await callClaudeWithBrandCheck(tiktokScript(product), 1024, 'tiktok script');

  try {
    const parsed = parseJsonResponse(raw);
    return parsed;
  } catch {
    logger.warn('Could not parse TikTok JSON — using raw text');
    return {
      hook: '',
      script: raw,
      onScreenText: [],
      hashtags: '',
      soundMood: '',
    };
  }
}

/**
 * Generate Pinterest content.
 * @param {object} product
 * @returns {Promise<object>}
 */
async function generatePinterestCopy(product) {
  logger.step('Pinterest pins...');

  const raw = await callClaudeWithBrandCheck(pinterestPin(product), 512, 'pinterest');

  try {
    const parsed = parseJsonResponse(raw);
    return parsed;
  } catch {
    return { pinTitle: product.name, pinDescription: '', boardSuggestion: 'New Arrivals' };
  }
}

/**
 * Generate Facebook content.
 * @param {object} product
 * @returns {Promise<object>}
 */
async function generateFacebookCopy(product) {
  logger.step('Facebook caption...');

  const raw = await callClaudeWithBrandCheck(facebookCaption(product), 512, 'facebook');

  try {
    const parsed = parseJsonResponse(raw);
    return parsed;
  } catch {
    return { caption: raw, hashtags: '#lumierecollection #kidsfashion' };
  }
}

/**
 * Generate email subject lines.
 * @param {object} product
 * @returns {Promise<object>}
 */
async function generateEmailCopy(product) {
  logger.step('Email subjects...');

  const raw = await callClaude(emailSubjectLines(product), 256);

  try {
    return parseJsonResponse(raw);
  } catch {
    return { subjectA: '', subjectB: '', subjectC: '', previewText: '' };
  }
}

/**
 * Generate the full content pack for a product.
 * This is the main export — all copy in one structured object.
 * @param {object} product
 * @returns {Promise<object>} Complete content pack
 */
export async function generateFullContentPack(product) {
  logger.step('Generating content pack (Claude API)...');

  const [shopify, instagram, tiktok, pinterest, facebook, email] = await Promise.all([
    generateShopifyCopy(product),
    generateInstagramCopy(product),
    generateTikTokCopy(product),
    generatePinterestCopy(product),
    generateFacebookCopy(product),
    generateEmailCopy(product),
  ]);

  return {
    shopify,
    instagram,
    tiktok,
    pinterest,
    facebook,
    email,
  };
}

/**
 * Regenerate just the copy for an existing product (no image processing).
 * @param {object} product
 * @returns {Promise<object>}
 */
export async function regenerateCopy(product) {
  return generateFullContentPack(product);
}
