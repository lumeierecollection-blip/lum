/**
 * Lumière Collection — Content Generator
 * Generates all copy via free AI provider (Groq/Gemini/OpenRouter/Ollama).
 * No API cost. Brand voice validation with auto-retry built in.
 */

import brand from '../config/brand.js';
import { callAI } from '../config/ai-provider.js';
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

/**
 * Call the AI provider with the brand system prompt.
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @returns {Promise<string>}
 */
async function callWithBrandPrompt(userPrompt, maxTokens = 1024) {
  return callAI(BRAND_SYSTEM_PROMPT, userPrompt, maxTokens);
}

/**
 * Scan text for forbidden brand words.
 * @param {string} text
 * @returns {string[]}
 */
function findForbiddenWords(text) {
  const lowerText = text.toLowerCase();
  return brand.FORBIDDEN_WORDS.filter((word) => lowerText.includes(word.toLowerCase()));
}

/**
 * Call AI and auto-retry if forbidden words are found in the output.
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @param {string} fieldName
 * @returns {Promise<string>}
 */
async function callWithBrandCheck(userPrompt, maxTokens = 1024, fieldName = 'copy') {
  let result = await callWithBrandPrompt(userPrompt, maxTokens);
  let violations = findForbiddenWords(result);

  let attempt = 0;
  while (violations.length > 0 && attempt < MAX_RETRIES) {
    attempt++;
    violations.forEach((w) => logger.brandViolation(w, attempt));

    const correctionPrompt = `The copy below contains these forbidden words that make it sound AI-generated: ${violations.map((w) => `"${w}"`).join(', ')}.

Rewrite it, removing those words entirely and replacing with natural human language:

${result}

Return only the rewritten copy. No preamble.`;

    result = await callWithBrandPrompt(correctionPrompt, maxTokens);
    violations = findForbiddenWords(result);
  }

  logger.brandClean(violations.length);

  if (violations.length > 0) {
    logger.warn(`⚠ ${fieldName} still has ${violations.length} violation(s) after ${MAX_RETRIES} retries — flagged for review`);
  }

  return result;
}

/**
 * Parse JSON from AI response, stripping accidental markdown fences.
 * @param {string} text
 * @returns {object}
 */
function parseJsonResponse(text) {
  const cleaned = text.replace(/^```json?\n?/im, '').replace(/\n?```$/im, '').trim();
  // Find the first { or [ and parse from there
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) return JSON.parse(cleaned.slice(jsonStart));
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────────────────────
// SECTION GENERATORS
// ─────────────────────────────────────────────────────────────

async function generateShopifyCopy(product) {
  logger.step('Shopify copy...');

  const [title, description, bulletsRaw, metaRaw] = await Promise.all([
    callWithBrandCheck(shopifyProductTitle(product.name, product.ageRange), 128, 'shopify title'),
    callWithBrandCheck(shopifyDescription(product), 256, 'shopify description'),
    callWithBrandCheck(shopifyBulletPoints(product), 512, 'shopify bullets'),
    callWithBrandPrompt(shopifyMetaTags(product), 512),
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

  const altTexts = await Promise.all(
    ['hero', 'detail-1', 'detail-2', 'detail-3'].map((label) =>
      callWithBrandPrompt(productAltText(product, label), 128)
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

async function generateInstagramCopy(product) {
  logger.step('Instagram captions...');

  const [captionStory, captionFeature, captionUGC, hashtags] = await Promise.all([
    callWithBrandCheck(instagramCaption(product, 'story'), 256, 'instagram story'),
    callWithBrandCheck(instagramCaption(product, 'feature'), 256, 'instagram feature'),
    callWithBrandCheck(instagramCaption(product, 'ugc'), 256, 'instagram ugc'),
    callWithBrandPrompt(instagramHashtags(product, product.season), 256),
  ]);

  return {
    captionStory: captionStory.trim(),
    captionFeature: captionFeature.trim(),
    captionUGC: captionUGC.trim(),
    hashtags: hashtags.trim(),
  };
}

async function generateTikTokCopy(product) {
  logger.step('TikTok script...');
  const raw = await callWithBrandCheck(tiktokScript(product), 1024, 'tiktok');

  try {
    return parseJsonResponse(raw);
  } catch {
    return { hook: '', script: raw, onScreenText: [], hashtags: '', soundMood: '' };
  }
}

async function generatePinterestCopy(product) {
  logger.step('Pinterest pins...');
  const raw = await callWithBrandCheck(pinterestPin(product), 512, 'pinterest');

  try {
    return parseJsonResponse(raw);
  } catch {
    return { pinTitle: product.name, pinDescription: '', boardSuggestion: 'New Arrivals' };
  }
}

async function generateFacebookCopy(product) {
  logger.step('Facebook caption...');
  const raw = await callWithBrandCheck(facebookCaption(product), 512, 'facebook');

  try {
    return parseJsonResponse(raw);
  } catch {
    return { caption: raw, hashtags: '#lumierecollection #kidsfashion' };
  }
}

async function generateEmailCopy(product) {
  logger.step('Email subjects...');
  const raw = await callWithBrandPrompt(emailSubjectLines(product), 256);

  try {
    return parseJsonResponse(raw);
  } catch {
    return { subjectA: '', subjectB: '', subjectC: '', previewText: '' };
  }
}

/**
 * Generate the full content pack for a product.
 * All AI calls run in parallel per section for speed.
 * @param {object} product
 * @param {Function} [onProgress] - optional callback(step, message)
 * @returns {Promise<object>}
 */
export async function generateFullContentPack(product, onProgress) {
  const notify = onProgress || (() => {});

  notify('start', 'Starting content generation...');

  const [shopify, instagram, tiktok, pinterest, facebook, email] = await Promise.all([
    generateShopifyCopy(product).then((r) => { notify('shopify', 'Shopify copy done'); return r; }),
    generateInstagramCopy(product).then((r) => { notify('instagram', 'Instagram captions done'); return r; }),
    generateTikTokCopy(product).then((r) => { notify('tiktok', 'TikTok script done'); return r; }),
    generatePinterestCopy(product).then((r) => { notify('pinterest', 'Pinterest pins done'); return r; }),
    generateFacebookCopy(product).then((r) => { notify('facebook', 'Facebook caption done'); return r; }),
    generateEmailCopy(product).then((r) => { notify('email', 'Email subjects done'); return r; }),
  ]);

  notify('complete', 'Content pack complete');

  return { shopify, instagram, tiktok, pinterest, facebook, email };
}

/**
 * Regenerate copy only for an existing product.
 * @param {object} product
 * @returns {Promise<object>}
 */
export async function regenerateCopy(product) {
  return generateFullContentPack(product);
}
