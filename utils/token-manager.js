/**
 * Lumière Collection — Token Manager
 * Tracks Meta long-lived token expiry and warns before it expires.
 * Meta tokens last 60 days by default; this manager warns at 7 days.
 */

import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import logger from './logger.js';

const WARN_DAYS_BEFORE_EXPIRY = 7;
const TOKEN_LIFESPAN_DAYS = 60;

/**
 * Check Meta long-lived token health and print a warning if expiring soon.
 * @param {string} tokenCreatedDate - ISO date string from .env META_TOKEN_CREATED_DATE
 * @returns {{ valid: boolean, daysLeft: number, expiresOn: string }}
 */
export function checkMetaTokenHealth(tokenCreatedDate) {
  if (!tokenCreatedDate) {
    logger.warn('META_TOKEN_CREATED_DATE not set in .env — cannot verify token expiry');
    return { valid: false, daysLeft: 0, expiresOn: 'unknown' };
  }

  let createdDate;
  try {
    createdDate = parseISO(tokenCreatedDate);
  } catch {
    logger.warn(`META_TOKEN_CREATED_DATE is not a valid ISO date: "${tokenCreatedDate}"`);
    return { valid: false, daysLeft: 0, expiresOn: 'unknown' };
  }

  const expiresOn = addDays(createdDate, TOKEN_LIFESPAN_DAYS);
  const daysLeft = differenceInDays(expiresOn, new Date());
  const expiresOnFormatted = format(expiresOn, 'dd MMM yyyy');

  if (daysLeft <= 0) {
    logger.error(`Meta token EXPIRED on ${expiresOnFormatted}. Refresh immediately.`);
    logger.info('Get a new token at: https://developers.facebook.com/tools/explorer/');
    return { valid: false, daysLeft: 0, expiresOn: expiresOnFormatted };
  }

  if (daysLeft <= WARN_DAYS_BEFORE_EXPIRY) {
    logger.warn(`Meta token expires in ${daysLeft} days (${expiresOnFormatted}).`);
    logger.info('Refresh now: https://developers.facebook.com/tools/explorer/');
    logger.info('Update META_LONG_LIVED_TOKEN and META_TOKEN_CREATED_DATE in .env after refresh.');
  }

  return { valid: true, daysLeft, expiresOn: expiresOnFormatted };
}

/**
 * Validate all required API keys are present in process.env.
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateEnv() {
  const provider = process.env.AI_PROVIDER || 'cerebras';
  const providerKeyMap = {
    cerebras: 'CEREBRAS_API_KEY',
    gemini: 'GOOGLE_AI_STUDIO_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    ollama: null, // no key needed
  };

  const requiredKey = providerKeyMap[provider];
  const required = requiredKey && !process.env[requiredKey] ? [requiredKey] : [];

  const optional = [
    'SHOPIFY_STORE_DOMAIN',
    'SHOPIFY_ADMIN_API_TOKEN',
    'META_LONG_LIVED_TOKEN',
    'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    'FACEBOOK_PAGE_ID',
    'TIKTOK_ACCESS_TOKEN',
    'PINTEREST_ACCESS_TOKEN',
    'GOOGLE_AI_STUDIO_API_KEY',
    'KLING_API_KEY',
    'REPLICATE_API_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);
  const missingOptional = optional.filter((key) => !process.env[key]);

  return {
    ok: missing.length === 0,
    missing,
    missingOptional,
  };
}

/**
 * Print a full status report of all API keys.
 */
export function printStatusReport() {
  const { ok, missing, missingOptional } = validateEnv();

  logger.banner();
  console.log('API KEY STATUS\n');

  const provider = process.env.AI_PROVIDER || 'cerebras';
  const providerKeyMap = {
    cerebras: { key: 'CEREBRAS_API_KEY', label: 'Cerebras AI (llama-3.3-70b)' },
    gemini: { key: 'GOOGLE_AI_STUDIO_API_KEY', label: 'Google Gemini AI' },
    openrouter: { key: 'OPENROUTER_API_KEY', label: 'OpenRouter AI' },
    ollama: { key: null, label: 'Ollama (local)' },
  };
  const { key: aiKey, label: aiLabel } = providerKeyMap[provider] || providerKeyMap.cerebras;

  const checks = [
    { key: aiKey, label: aiLabel, required: !!aiKey },
    { key: 'SHOPIFY_ADMIN_API_TOKEN', label: 'Shopify Admin API', required: false },
    { key: 'META_LONG_LIVED_TOKEN', label: 'Meta (Instagram/Facebook)', required: false },
    { key: 'INSTAGRAM_BUSINESS_ACCOUNT_ID', label: 'Instagram Business Account', required: false },
    { key: 'FACEBOOK_PAGE_ID', label: 'Facebook Page', required: false },
    { key: 'TIKTOK_ACCESS_TOKEN', label: 'TikTok API', required: false },
    { key: 'PINTEREST_ACCESS_TOKEN', label: 'Pinterest API', required: false },
    { key: 'GOOGLE_AI_STUDIO_API_KEY', label: 'Google AI Studio (Veo 3)', required: false },
    { key: 'KLING_API_KEY', label: 'Kling AI API', required: false },
    { key: 'REPLICATE_API_KEY', label: 'Replicate (4K upscale)', required: false },
  ];

  checks.forEach(({ key, label, required }) => {
    if (!key) {
      logger.success(`${label}: ready (no key required)`);
      return;
    }
    const value = process.env[key];
    if (value) {
      const masked = value.slice(0, 6) + '••••••••';
      logger.success(`${label}: ${masked}`);
    } else if (required) {
      logger.error(`${label}: MISSING (required)`);
    } else {
      logger.warn(`${label}: not set (optional)`);
    }
  });

  // Meta token expiry check
  if (process.env.META_TOKEN_CREATED_DATE) {
    console.log('');
    console.log('META TOKEN EXPIRY');
    const health = checkMetaTokenHealth(process.env.META_TOKEN_CREATED_DATE);
    if (health.valid) {
      logger.success(`Token valid — expires ${health.expiresOn} (${health.daysLeft} days)`);
    }
  }

  console.log('');

  if (!ok) {
    logger.error(`${missing.length} required key(s) missing. System cannot run.`);
  } else {
    logger.success('Core system ready.');
    if (missingOptional.length > 0) {
      logger.info(`${missingOptional.length} optional keys not set — those features will be skipped.`);
    }
  }

  return { ok };
}
