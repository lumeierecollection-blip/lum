/**
 * Lumière Collection — Meta Graph API Poster
 * Handles Instagram + Facebook posting, scheduling, and rate limiting.
 */

import path from 'path';
import { apiJson } from '../utils/api-client.js';
import { writeJsonFile, readJsonFile, writeFileSafe } from '../utils/file-utils.js';
import { checkMetaTokenHealth } from '../utils/token-manager.js';
import logger from '../utils/logger.js';

const META_BASE = 'https://graph.facebook.com/v21.0';
const DAILY_LIMIT = 25;
const DAILY_WARN_THRESHOLD = 20;

// ─────────────────────────────────────────────────────────────
// RATE LIMIT TRACKING
// ─────────────────────────────────────────────────────────────

function getRateLimitPath() {
  return path.join(process.env.QUEUE_DIR || './queue', 'meta-rate-limit.json');
}

function getRateLimitData() {
  const data = readJsonFile(getRateLimitPath());
  const today = new Date().toISOString().slice(0, 10);

  if (!data || data.date !== today) {
    return { date: today, count: 0 };
  }
  return data;
}

function incrementRateLimit() {
  const data = getRateLimitData();
  data.count += 1;
  writeJsonFile(getRateLimitPath(), data);
  return data.count;
}

function checkRateLimit() {
  const data = getRateLimitData();
  if (data.count >= DAILY_LIMIT) {
    throw new Error(`Meta daily post limit reached (${DAILY_LIMIT}/day). Will reset at midnight.`);
  }
  if (data.count >= DAILY_WARN_THRESHOLD) {
    logger.warn(`Meta rate limit warning: ${data.count}/${DAILY_LIMIT} posts today`);
  }
}

// ─────────────────────────────────────────────────────────────
// INSTAGRAM POSTING
// ─────────────────────────────────────────────────────────────

/**
 * Post a single image to Instagram feed.
 * @param {object} contentPack
 * @param {string} imageUrl - Public URL of the image (must be publicly accessible)
 * @param {'story'|'feature'|'ugc'} captionType
 * @returns {Promise<{postId: string, permalink: string}|null>}
 */
export async function postToInstagram(contentPack, imageUrl, captionType = 'feature') {
  const token = process.env.META_LONG_LIVED_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!token || !igUserId) {
    logger.warn('Meta credentials not set — skipping Instagram post');
    return null;
  }

  checkMetaTokenHealth(process.env.META_TOKEN_CREATED_DATE);
  checkRateLimit();

  const caption = contentPack.instagram[`caption${captionType.charAt(0).toUpperCase() + captionType.slice(1)}`];
  const hashtags = contentPack.instagram.hashtags;
  const fullCaption = `${caption}\n\n.\n.\n.\n${hashtags}`;

  try {
    // Step 1: Create media container
    logger.step('Creating Instagram media container...');
    const container = await apiJson(
      `${META_BASE}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: fullCaption,
          access_token: token,
        }),
      },
      { retries: 2 }
    );

    if (!container.id) throw new Error('No container ID returned from Instagram');

    // Step 2: Poll until container is ready
    logger.step('Waiting for Instagram container to process...');
    const containerId = container.id;
    let status = 'IN_PROGRESS';
    let attempts = 0;

    while (status === 'IN_PROGRESS' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusResult = await apiJson(
        `${META_BASE}/${containerId}?fields=status_code&access_token=${token}`,
        {},
        { retries: 2 }
      );
      status = statusResult.status_code;
      attempts++;
    }

    if (status !== 'FINISHED') {
      throw new Error(`Instagram container status: ${status} after ${attempts} attempts`);
    }

    // Step 3: Publish
    logger.step('Publishing to Instagram...');
    const publishResult = await apiJson(
      `${META_BASE}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: token,
        }),
      },
      { retries: 2 }
    );

    const count = incrementRateLimit();
    logger.success(`Instagram post published (ID: ${publishResult.id}) — ${count}/${DAILY_LIMIT} today`);

    return { postId: publishResult.id, platform: 'instagram' };
  } catch (err) {
    logger.error(`Instagram post failed: ${err.message}`);
    return null;
  }
}

/**
 * Post a Reel to Instagram.
 * @param {object} contentPack
 * @param {string} videoUrl - Public URL to the video file
 * @returns {Promise<object|null>}
 */
export async function postReelToInstagram(contentPack, videoUrl) {
  const token = process.env.META_LONG_LIVED_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!token || !igUserId) {
    logger.warn('Meta credentials not set — skipping Instagram Reel');
    return null;
  }

  checkRateLimit();

  const caption = contentPack.tiktok?.script
    ? `${contentPack.instagram.captionFeature}\n\n.\n.\n.\n${contentPack.instagram.hashtags}`
    : `${contentPack.instagram.captionFeature}\n\n${contentPack.instagram.hashtags}`;

  try {
    // Step 1: Initialise reel upload
    const container = await apiJson(
      `${META_BASE}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          share_to_feed: true,
          access_token: token,
        }),
      },
      { retries: 2 }
    );

    if (!container.id) throw new Error('No container ID for Reel');

    // Step 2: Poll (reels take longer — up to 5 mins)
    logger.step('Processing Reel (this can take 2–5 minutes)...');
    let status = 'IN_PROGRESS';
    let attempts = 0;

    while (status === 'IN_PROGRESS' && attempts < 100) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusResult = await apiJson(
        `${META_BASE}/${container.id}?fields=status_code&access_token=${token}`,
        {},
        { retries: 2 }
      );
      status = statusResult.status_code;
      attempts++;
    }

    if (status !== 'FINISHED') {
      throw new Error(`Reel container never finished: ${status}`);
    }

    const publishResult = await apiJson(
      `${META_BASE}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      },
      { retries: 2 }
    );

    incrementRateLimit();
    logger.success(`Instagram Reel published (ID: ${publishResult.id})`);
    return { postId: publishResult.id, platform: 'instagram_reel' };
  } catch (err) {
    logger.error(`Instagram Reel failed: ${err.message}`);
    return null;
  }
}

/**
 * Post to Facebook Page.
 * @param {object} contentPack
 * @param {string} imageUrl - Public URL
 * @returns {Promise<object|null>}
 */
export async function postToFacebook(contentPack, imageUrl) {
  const token = process.env.META_LONG_LIVED_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!token || !pageId) {
    logger.warn('Facebook credentials not set — skipping Facebook post');
    return null;
  }

  checkRateLimit();

  const facebook = contentPack.facebook;
  const fullCaption = `${facebook.caption}\n\n${facebook.hashtags}`;

  try {
    const result = await apiJson(
      `${META_BASE}/${pageId}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imageUrl,
          caption: fullCaption,
          access_token: token,
        }),
      },
      { retries: 2 }
    );

    incrementRateLimit();
    logger.success(`Facebook post published (ID: ${result.id})`);
    return { postId: result.id, platform: 'facebook' };
  } catch (err) {
    logger.error(`Facebook post failed: ${err.message}`);
    return null;
  }
}

/**
 * Schedule a post for a future time via Meta API.
 * @param {object} contentPack
 * @param {string} imageUrl
 * @param {Date} scheduledTime - Must be 10 minutes to 30 days in future
 * @param {'instagram'|'facebook'} platform
 * @returns {Promise<object|null>}
 */
export async function schedulePost(contentPack, imageUrl, scheduledTime, platform = 'instagram') {
  const token = process.env.META_LONG_LIVED_TOKEN;
  const targetId = platform === 'instagram'
    ? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
    : process.env.FACEBOOK_PAGE_ID;

  if (!token || !targetId) {
    logger.warn(`${platform} credentials not set — saving to queue instead`);
    await saveToQueue(contentPack, imageUrl, scheduledTime, platform);
    return null;
  }

  const unixTime = Math.floor(scheduledTime.getTime() / 1000);
  const caption = platform === 'instagram'
    ? `${contentPack.instagram.captionFeature}\n\n${contentPack.instagram.hashtags}`
    : `${contentPack.facebook.caption}\n\n${contentPack.facebook.hashtags}`;

  try {
    if (platform === 'instagram') {
      // Create container with scheduled publish
      const container = await apiJson(
        `${META_BASE}/${targetId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            caption,
            access_token: token,
          }),
        },
        { retries: 2 }
      );

      // Schedule publish
      await apiJson(
        `${META_BASE}/${targetId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: container.id,
            publish_time: unixTime,
            access_token: token,
          }),
        },
        { retries: 2 }
      );

      logger.success(`Instagram post scheduled for ${scheduledTime.toLocaleString('en-ZA')}`);
    } else {
      await apiJson(
        `${META_BASE}/${targetId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: imageUrl,
            caption,
            published: false,
            scheduled_publish_time: unixTime,
            access_token: token,
          }),
        },
        { retries: 2 }
      );
      logger.success(`Facebook post scheduled for ${scheduledTime.toLocaleString('en-ZA')}`);
    }

    return { scheduled: true, scheduledTime, platform };
  } catch (err) {
    logger.error(`Scheduling failed: ${err.message}`);
    await saveToQueue(contentPack, imageUrl, scheduledTime, platform);
    return null;
  }
}

/**
 * Save a post to the local queue for later processing.
 */
async function saveToQueue(contentPack, imageUrl, scheduledTime, platform) {
  const queuePath = path.join(process.env.QUEUE_DIR || './queue', 'scheduled');
  const filename = `${scheduledTime.toISOString().slice(0, 10)}-${platform}-${Date.now()}.json`;
  writeJsonFile(path.join(queuePath, filename), {
    platform,
    imageUrl,
    caption: platform === 'instagram'
      ? `${contentPack.instagram.captionFeature}\n\n${contentPack.instagram.hashtags}`
      : `${contentPack.facebook.caption}\n\n${contentPack.facebook.hashtags}`,
    scheduledTime: scheduledTime.toISOString(),
    status: 'queued',
  });
  logger.info(`Post saved to queue: ${filename}`);
}

/**
 * Build and save the meta queue JSON for a product.
 * @param {object} product
 * @param {object} contentPack
 * @param {Array} imageFiles
 * @param {string} outputDir
 */
export function saveMetaQueue(product, contentPack, imageFiles, outputDir) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);

  const payload = {
    product: product.name,
    productSlug: product.slug,
    scheduledPosts: [
      {
        platform: 'instagram',
        type: 'FEED',
        captionType: 'feature',
        caption: contentPack.instagram.captionFeature,
        hashtags: contentPack.instagram.hashtags,
        scheduledTime: tomorrow.toISOString(),
        imageFile: imageFiles[0]?.filename || 'hero.jpg',
        status: 'queued',
      },
      {
        platform: 'facebook',
        type: 'PHOTO',
        caption: contentPack.facebook.caption,
        hashtags: contentPack.facebook.hashtags,
        scheduledTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(), // +1hr
        imageFile: imageFiles[0]?.filename || 'hero.jpg',
        status: 'queued',
      },
    ],
  };

  const queuePath = path.join(outputDir, 'meta-queue.json');
  writeJsonFile(queuePath, payload);
  return queuePath;
}
