/**
 * Lumière Collection — Weekly Content Calendar Generator
 * Produces a 7-day content calendar in markdown and JSON.
 */

import path from 'path';
import { format, addDays, startOfWeek, getISOWeek, getYear } from 'date-fns';
import { writeFileSafe, writeJsonFile } from '../utils/file-utils.js';
import brand from '../config/brand.js';
import logger from '../utils/logger.js';

/**
 * Generate a weekly content calendar for a set of products.
 * @param {Array} products - Array of processed product objects with their content packs
 * @param {string} outputBaseDir - Base output directory
 * @param {'current'|'next'} weekTarget
 * @returns {{ mdPath: string, jsonPath: string }}
 */
export async function generateWeeklyCalendar(products, outputBaseDir, weekTarget = 'current') {
  const weekStart = getWeekStart(weekTarget);
  const weekNumber = getISOWeek(weekStart);
  const year = getYear(weekStart);

  const calendarEntries = buildCalendarEntries(products, weekStart);
  const mdContent = buildMarkdownCalendar(calendarEntries, weekStart, weekNumber);
  const jsonContent = buildJsonCalendar(calendarEntries, weekNumber, year);

  const filenameBase = `calendar-${year}-W${String(weekNumber).padStart(2, '0')}`;
  const mdPath = path.join(outputBaseDir, `${filenameBase}.md`);
  const jsonPath = path.join(outputBaseDir, `${filenameBase}.json`);

  writeFileSafe(mdPath, mdContent);
  writeJsonFile(jsonPath, jsonContent);

  logger.success(`Weekly calendar saved: ${filenameBase}`);

  return { mdPath, jsonPath };
}

/**
 * Generate a single product's calendar entry and save to its output folder.
 * @param {object} product
 * @param {object} contentPack
 * @param {Array} imageFiles
 * @param {string} productOutputDir
 */
export function generateProductCalendarEntry(product, contentPack, imageFiles, productOutputDir) {
  const tomorrow = addDays(new Date(), 1);
  const entry = buildSingleProductEntry(product, contentPack, imageFiles, tomorrow);
  const content = buildProductCalendarMarkdown(entry);

  const entryPath = path.join(productOutputDir, 'calendar-entry.md');
  writeFileSafe(entryPath, content);
  return entryPath;
}

// ─────────────────────────────────────────────────────────────
// CALENDAR BUILDERS
// ─────────────────────────────────────────────────────────────

function getWeekStart(weekTarget) {
  const today = new Date();
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
  return weekTarget === 'next' ? addDays(thisWeekStart, 7) : thisWeekStart;
}

/**
 * Build calendar entries spread across the week for all products.
 */
function buildCalendarEntries(products, weekStart) {
  const entries = [];
  const platforms = [
    { platform: 'Instagram', type: 'Feed', times: brand.POSTING_TIMES_SAST.instagramFeed },
    { platform: 'Instagram', type: 'Reels', times: brand.POSTING_TIMES_SAST.instagramReels },
    { platform: 'Instagram', type: 'Stories', times: brand.POSTING_TIMES_SAST.instagramStories },
    { platform: 'Facebook', type: 'Photo', times: brand.POSTING_TIMES_SAST.facebook },
    { platform: 'TikTok', type: 'Video', times: brand.POSTING_TIMES_SAST.tiktok },
    { platform: 'Pinterest', type: 'Pin', times: brand.POSTING_TIMES_SAST.pinterest },
  ];

  // Distribute products + platform posts across the 7-day week
  let dayOffset = 0;
  products.forEach((item, productIndex) => {
    const product = item.product;
    const contentPack = item.contentPack;
    const imageFiles = item.imageFiles || [];

    platforms.forEach((platformConfig, pIdx) => {
      const day = addDays(weekStart, (dayOffset + pIdx) % 7);
      const time = platformConfig.times[productIndex % platformConfig.times.length];

      entries.push({
        date: format(day, 'yyyy-MM-dd'),
        dayName: format(day, 'EEEE'),
        platform: platformConfig.platform,
        type: platformConfig.type,
        product: product.name,
        productSlug: product.slug,
        captionVariant: selectCaptionVariant(platformConfig.platform, platformConfig.type),
        postTime: time,
        postTimeSAST: `${time} SAST`,
        mediaFile: imageFiles[0]?.filename || 'hero.jpg',
        status: 'queued',
        notes: buildPostNotes(platformConfig, contentPack, product),
      });
    });

    dayOffset += 2; // Stagger products by 2 days
  });

  // Sort by date + time
  return entries.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.postTime.localeCompare(b.postTime);
  });
}

function selectCaptionVariant(platform, type) {
  if (platform === 'Instagram') {
    if (type === 'Stories') return 'story';
    if (type === 'Reels') return 'feature';
    return 'feature';
  }
  if (platform === 'TikTok') return 'tiktok';
  if (platform === 'Pinterest') return 'pinterest';
  if (platform === 'Facebook') return 'facebook';
  return 'feature';
}

function buildPostNotes(platformConfig, contentPack, product) {
  if (platformConfig.platform === 'TikTok') {
    return `Use hook: "${contentPack?.tiktok?.hook?.slice(0, 60) || '...'}" | See tiktok-draft/ folder`;
  }
  if (platformConfig.platform === 'Pinterest') {
    return contentPack?.pinterest?.boardSuggestion || 'Pin to New Arrivals board';
  }
  if (platformConfig.type === 'Reels') {
    return 'Use edited Kling/Veo3 clip — see capcut-brief.md';
  }
  return '';
}

/**
 * Build a single product's calendar entry object.
 */
function buildSingleProductEntry(product, contentPack, imageFiles, startDate) {
  const heroImage = imageFiles[0]?.filename || 'hero.jpg';

  return {
    product: product.name,
    slug: product.slug,
    posts: [
      {
        date: format(startDate, 'yyyy-MM-dd'),
        platform: 'Instagram',
        type: 'Feed',
        time: brand.POSTING_TIMES_SAST.instagramFeed[0],
        caption: contentPack.instagram.captionFeature?.slice(0, 80) + '...',
        mediaFile: heroImage,
        hashtags: contentPack.instagram.hashtags?.slice(0, 60) + '...',
        status: 'queued',
      },
      {
        date: format(addDays(startDate, 1), 'yyyy-MM-dd'),
        platform: 'Instagram',
        type: 'Reels',
        time: brand.POSTING_TIMES_SAST.instagramReels[1],
        caption: 'Use Reel with edited video from capcut-brief.md',
        mediaFile: 'edited-video.mp4',
        status: 'queued',
      },
      {
        date: format(addDays(startDate, 1), 'yyyy-MM-dd'),
        platform: 'TikTok',
        type: 'Video',
        time: brand.POSTING_TIMES_SAST.tiktok[2],
        caption: 'See tiktok-draft/caption.txt',
        mediaFile: 'edited-video.mp4',
        status: 'draft',
      },
      {
        date: format(addDays(startDate, 2), 'yyyy-MM-dd'),
        platform: 'Pinterest',
        type: 'Pin',
        time: brand.POSTING_TIMES_SAST.pinterest[0],
        caption: contentPack.pinterest.pinDescription?.slice(0, 60) + '...',
        mediaFile: heroImage,
        status: 'queued',
      },
      {
        date: format(addDays(startDate, 3), 'yyyy-MM-dd'),
        platform: 'Facebook',
        type: 'Photo',
        time: brand.POSTING_TIMES_SAST.facebook[1],
        caption: contentPack.facebook.caption?.slice(0, 80) + '...',
        mediaFile: heroImage,
        status: 'queued',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// MARKDOWN BUILDERS
// ─────────────────────────────────────────────────────────────

function buildMarkdownCalendar(entries, weekStart, weekNumber) {
  const weekEnd = addDays(weekStart, 6);
  const dateRange = `${format(weekStart, 'dd MMM')} – ${format(weekEnd, 'dd MMM yyyy')}`;

  const rows = entries.map((e) =>
    `| ${e.dayName} ${e.date} | ${e.platform} | ${e.type} | ${e.product} | ${e.captionVariant} | ${e.postTimeSAST} | ${e.mediaFile} | ${e.status} |`
  );

  const grouped = groupByDay(entries);
  const dayBlocks = Object.entries(grouped).map(([date, dayEntries]) => buildDayBlock(date, dayEntries));

  return `# CONTENT CALENDAR — WEEK ${weekNumber}
**Lumière Collection**
**${dateRange}**
*All times in SAST (UTC+2)*

---

## WEEKLY OVERVIEW

| Day & Date | Platform | Type | Product | Caption | Time (SAST) | Media | Status |
|-----------|---------|------|---------|---------|------------|-------|--------|
${rows.join('\n')}

---

## DAILY BREAKDOWN

${dayBlocks.join('\n\n---\n\n')}

---

## NOTES

- ✅ Posts marked "queued" are ready to publish via Meta API or manual upload
- 📋 TikTok posts are "draft" until API is approved — use manual upload
- 🔄 Pinterest posts need public image URLs — upload to Shopify/CDN first
- ⏰ All times are SAST (South Africa Standard Time, UTC+2)
- 📱 Instagram Stories: post these at the time listed, not via API — use the app

---
*Generated by Lumière Collection Automation System*
`;
}

function buildDayBlock(date, entries) {
  const dayName = entries[0]?.dayName || '';
  const postLines = entries.map((e) => `
**${e.postTimeSAST}** — ${e.platform} ${e.type}
- Product: ${e.product}
- Media: \`${e.mediaFile}\`
- Caption variant: ${e.captionVariant}
${e.notes ? `- Note: ${e.notes}` : ''}
- Status: \`${e.status}\``).join('\n');

  return `### ${dayName}, ${date}\n${postLines}`;
}

function groupByDay(entries) {
  return entries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});
}

function buildJsonCalendar(entries, weekNumber, year) {
  return {
    week: weekNumber,
    year,
    generatedAt: new Date().toISOString(),
    timezone: process.env.TIMEZONE || 'Africa/Johannesburg',
    totalPosts: entries.length,
    entries,
  };
}

function buildProductCalendarMarkdown(entry) {
  const postBlocks = entry.posts.map((p) => `
**${p.date} at ${p.time} SAST** — ${p.platform} ${p.type}
- Media: \`${p.mediaFile}\`
- Status: \`${p.status}\`
- Caption: ${p.caption || 'See copy-pack.md'}`).join('\n');

  return `# CALENDAR ENTRY — ${entry.product.toUpperCase()}

**Recommended posting schedule:**
${postBlocks}

---

*See the full weekly calendar in \`output/calendar-[YYYY-WW].md\`*
`;
}
