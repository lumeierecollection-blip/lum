/**
 * Lumière Collection — TikTok Queue Manager
 * Pre-approval: saves structured draft packages for manual upload.
 * Post-approval (TIKTOK_APPROVED=true): publishes via TikTok Content Posting API v2.
 */

import fs from 'fs';
import path from 'path';
import { apiJson } from '../utils/api-client.js';
import { ensureDir, writeFileSafe, writeJsonFile, listDirs } from '../utils/file-utils.js';
import logger from '../utils/logger.js';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

/**
 * Save a TikTok draft package to the queue directory.
 * This is the default flow before API approval.
 * @param {object} product
 * @param {object} contentPack
 * @param {string} outputDir - Product output directory
 * @returns {string} Path to the draft folder
 */
export async function saveTikTokDraft(product, contentPack, outputDir) {
  const tiktok = contentPack.tiktok || {};
  const dateStr = new Date().toISOString().slice(0, 10);
  const draftDir = path.join(process.env.QUEUE_DIR || './queue', 'tiktok', `${dateStr}-${product.slug}`);
  ensureDir(draftDir);

  // 1. caption.txt — ready to copy-paste into TikTok
  const caption = buildTikTokCaption(tiktok, product);
  writeFileSafe(path.join(draftDir, 'caption.txt'), caption);

  // 2. script.md — voiceover script
  const scriptContent = buildScriptDoc(product, tiktok);
  writeFileSafe(path.join(draftDir, 'script.md'), scriptContent);

  // 3. on-screen-text.md — text overlay timings
  const onScreenContent = buildOnScreenDoc(tiktok);
  writeFileSafe(path.join(draftDir, 'on-screen-text.md'), onScreenContent);

  // 4. prompts.md — which video prompts to use for this TikTok
  const promptsRef = buildPromptsRef(product);
  writeFileSafe(path.join(draftDir, 'prompts.md'), promptsRef);

  // 5. metadata.json — structured data for later API upload
  writeJsonFile(path.join(draftDir, 'metadata.json'), {
    product: product.name,
    slug: product.slug,
    createdAt: new Date().toISOString(),
    status: 'draft',
    caption,
    hashtags: tiktok.hashtags || '',
    hook: tiktok.hook || '',
    soundMood: tiktok.soundMood || '',
  });

  // Also copy TikTok draft folder into the product output directory
  const productTikTokDir = path.join(outputDir, 'tiktok-draft');
  ensureDir(productTikTokDir);
  writeFileSafe(path.join(productTikTokDir, 'caption.txt'), caption);
  writeFileSafe(path.join(productTikTokDir, 'script.md'), scriptContent);
  writeFileSafe(path.join(productTikTokDir, 'prompts.md'), promptsRef);

  return draftDir;
}

/**
 * Publish a video to TikTok via Content Posting API v2.
 * Only available when TIKTOK_APPROVED=true in .env.
 * @param {string} videoPath - Path to local video file
 * @param {object} metadata - caption, hashtags, etc.
 * @returns {Promise<object|null>}
 */
export async function publishToTikTok(videoPath, metadata) {
  if (process.env.TIKTOK_APPROVED !== 'true') {
    logger.warn('TikTok API not approved. Set TIKTOK_APPROVED=true in .env after approval.');
    logger.info('Apply for TikTok Content Posting API: https://developers.tiktok.com/');
    return null;
  }

  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) {
    logger.error('TIKTOK_ACCESS_TOKEN not set');
    return null;
  }

  try {
    const videoBuffer = fs.readFileSync(videoPath);
    const videoSize = videoBuffer.length;

    // Step 1: Initialise upload
    logger.step('Initialising TikTok upload...');
    const initResult = await apiJson(
      `${TIKTOK_API_BASE}/post/publish/video/init/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: metadata.caption.slice(0, 2200),
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize, // Single chunk for files under 64MB
            total_chunk_count: 1,
          },
        }),
      },
      { retries: 2 }
    );

    if (initResult.error?.code !== 'ok') {
      throw new Error(`TikTok init failed: ${initResult.error?.message}`);
    }

    const { upload_url, publish_id } = initResult.data;

    // Step 2: Upload video chunk
    logger.step('Uploading video to TikTok...');
    await apiJson(
      upload_url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
          'Content-Length': String(videoSize),
        },
        body: videoBuffer,
      },
      { retries: 2 }
    );

    // Step 3: Publish
    logger.step('Publishing TikTok post...');
    const publishResult = await apiJson(
      `${TIKTOK_API_BASE}/post/publish/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id }),
      },
      { retries: 2 }
    );

    if (publishResult.error?.code !== 'ok') {
      throw new Error(`TikTok publish failed: ${publishResult.error?.message}`);
    }

    logger.success(`TikTok post published (publish_id: ${publish_id})`);
    return { publishId: publish_id, platform: 'tiktok' };
  } catch (err) {
    logger.error(`TikTok publish failed: ${err.message}`);
    return null;
  }
}

/**
 * Process all items in the TikTok queue.
 * Run with: node lumiere.js tiktok-publish
 */
export async function processTikTokQueue() {
  const queueDir = path.join(process.env.QUEUE_DIR || './queue', 'tiktok');
  const draftFolders = listDirs(queueDir);

  if (draftFolders.length === 0) {
    logger.info('TikTok queue is empty.');
    return;
  }

  logger.info(`Processing ${draftFolders.length} item(s) in TikTok queue...`);

  for (const folder of draftFolders) {
    const metadataPath = path.join(folder, 'metadata.json');
    const metadataRaw = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
      : null;

    if (!metadataRaw) {
      logger.warn(`No metadata.json in ${folder} — skipping`);
      continue;
    }

    if (metadataRaw.status === 'published') {
      logger.info(`${metadataRaw.product} — already published, skipping`);
      continue;
    }

    // Look for a video file in the folder
    const videoFile = fs.readdirSync(folder).find((f) => f.endsWith('.mp4') || f.endsWith('.mov'));

    if (!videoFile) {
      logger.warn(`No video file in ${folder}. Add your edited video (MP4) and re-run.`);
      logger.info(`  Expected: ${path.join(folder, '[product-name].mp4')}`);
      continue;
    }

    const videoPath = path.join(folder, videoFile);
    const result = await publishToTikTok(videoPath, metadataRaw);

    if (result) {
      metadataRaw.status = 'published';
      metadataRaw.publishedAt = new Date().toISOString();
      writeJsonFile(metadataPath, metadataRaw);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CONTENT BUILDERS
// ─────────────────────────────────────────────────────────────

function buildTikTokCaption(tiktok, product) {
  const caption = tiktok.script
    ? tiktok.script.split('.')[0] + '.' // First sentence as caption opening
    : `${product.name} — ages ${product.ageRange}.`;

  const hashtags = tiktok.hashtags || '#kidsfashion #kidsclothing #lumierecollection #kidsstyle #fyp';

  return `${caption}\n\n${hashtags}`;
}

function buildScriptDoc(product, tiktok) {
  return `# TIKTOK SCRIPT — ${product.name.toUpperCase()}

## HOOK (0–3 seconds)
> Speak this directly to camera or use as opening text overlay.

**"${tiktok.hook || `${product.name} for ages ${product.ageRange}.`}"**

---

## FULL VOICEOVER SCRIPT

${tiktok.script || `${product.name}. Ages ${product.ageRange}. R${product.price}. Link in bio.`}

---

## ON-SCREEN TEXT CUES

${buildOnScreenTimings(tiktok.onScreenText)}

---

## SOUND MOOD
${tiktok.soundMood || 'Warm acoustic, gentle upbeat, 90–110 BPM. Light guitar or piano.'}

---

## DELIVERY NOTES
- Speak at a natural, unhurried pace
- Warm and conversational — like you're recommending this to a friend
- No broadcast voice, no hard sell
- Pause between the hook and the main script
- The hook should land before you show the product on screen
`;
}

function buildOnScreenDoc(tiktok) {
  if (!tiktok.onScreenText || tiktok.onScreenText.length === 0) {
    return '# ON-SCREEN TEXT\nRefer to capcut-brief.md for text overlay timings.\n';
  }

  const timings = tiktok.onScreenText.map(
    (item) => `**${item.timestamp}** | ${item.style?.toUpperCase() || 'TEXT'}: "${item.text}"`
  ).join('\n');

  return `# ON-SCREEN TEXT OVERLAYS\n\n${timings}\n\n---\n\nFont: Cormorant Garamond (or Playfair Display in CapCut)\nColour: Ivory #FAF7F0\nPosition: Lower third (leave top 60% clear for product)\n`;
}

function buildOnScreenTimings(onScreenText) {
  if (!onScreenText || onScreenText.length === 0) {
    return 'Refer to capcut-brief.md for timing suggestions.';
  }
  return onScreenText
    .map((item) => `- **${item.timestamp}** — "${item.text}" (${item.style || 'text'})`)
    .join('\n');
}

function buildPromptsRef(product) {
  return `# TIKTOK VIDEO PROMPTS REFERENCE — ${product.name.toUpperCase()}

The full video prompts for your Kling AI and Veo 3 clips are in:
\`../video-prompts.md\`

## RECOMMENDED CLIPS FOR TIKTOK

| Clip | Source | Use for |
|------|--------|---------|
| Prompt 1 (Garden Golden Hour) | Kling AI | Hero/hook clip (0:00–0:03) |
| Prompt 3 (Park Morning) | Kling AI | Movement/lifestyle clip (0:08–0:14) |
| Prompt 2 (Indoor Soft Light) | Veo 3 | Detail/calm beat (optional) |

**Editing instructions:** See \`../capcut-brief.md\`

## WHEN YOUR VIDEO IS READY

1. Add the edited MP4 to this folder
2. Run: \`node lumiere.js tiktok-publish\`
   (only works after TikTok API approval — see README for manual upload steps)

## MANUAL UPLOAD (before API approval)

1. Open TikTok on your phone
2. Press + → Upload video
3. Select your edited clip
4. Paste the caption from \`caption.txt\`
5. Post at the recommended time (see \`../calendar-entry.md\`)
`;
}
