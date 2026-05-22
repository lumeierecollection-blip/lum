/**
 * Lumière Collection — Output Packager
 * Assembles the final per-product output folder with all assets.
 */

import path from 'path';
import { writeFileSafe, writeJsonFile, printTree, ensureDir } from '../utils/file-utils.js';
import brand from '../config/brand.js';
import logger from '../utils/logger.js';

/**
 * Assemble the full output package for a product.
 * Writes the copy-pack.md and 00-README.md files.
 * @param {object} product
 * @param {object} contentPack
 * @param {Array} imageFiles
 * @param {string} outputDir
 */
export async function assemblePackage(product, contentPack, imageFiles, outputDir) {
  ensureDir(outputDir);
  ensureDir(path.join(outputDir, 'images'));
  ensureDir(path.join(outputDir, 'tiktok-draft'));

  // Write the human-readable copy pack
  const copyPackPath = path.join(outputDir, 'copy-pack.md');
  writeFileSafe(copyPackPath, buildCopyPack(product, contentPack));

  // Write the README
  const readmePath = path.join(outputDir, '00-README.md');
  writeFileSafe(readmePath, buildProductReadme(product, contentPack, imageFiles, outputDir));

  return { copyPackPath, readmePath };
}

/**
 * Print the completion summary to the terminal.
 * @param {object} product
 * @param {string} outputDir
 * @param {number} elapsedMs
 * @param {object} results - What was actually completed
 */
export function printCompletionSummary(product, outputDir, elapsedMs, results = {}) {
  const tree = printTree(outputDir, '', 2);
  const secs = Math.round(elapsedMs / 1000);

  console.log('');
  console.log('\x1b[33m─────────────────────────────────────────\x1b[0m');
  console.log(`\x1b[33m✨ COMPLETE — \x1b[0m\x1b[1m${product.name}\x1b[0m`);
  console.log('\x1b[2m   Output: \x1b[0m' + outputDir);
  console.log('\x1b[2m   Time:   \x1b[0m' + `${secs} seconds`);
  console.log('');

  if (results.shopifyUrl) {
    console.log('\x1b[32m   ✓ Shopify:\x1b[0m ' + results.shopifyUrl);
  }
  if (results.instagramPostId) {
    console.log('\x1b[32m   ✓ Instagram:\x1b[0m post ID ' + results.instagramPostId);
  }
  if (results.pinterestPins > 0) {
    console.log('\x1b[32m   ✓ Pinterest:\x1b[0m ' + results.pinterestPins + ' pins created');
  }
  if (results.tiktokDraftPath) {
    console.log('');
    console.log('\x1b[33m📋 TikTok draft saved:\x1b[0m');
    console.log('   ' + results.tiktokDraftPath);
    console.log('\x1b[2m   → Upload manually or run: node lumiere.js tiktok-publish (after API approval)\x1b[0m');
  }

  console.log('');
  console.log('\x1b[2mOutput folder:\x1b[0m');
  console.log(tree);
  console.log('\x1b[33m─────────────────────────────────────────\x1b[0m');
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// DOCUMENT BUILDERS
// ─────────────────────────────────────────────────────────────

/**
 * Build the comprehensive copy-pack.md document.
 */
function buildCopyPack(product, contentPack) {
  const { shopify, instagram, tiktok, pinterest, facebook, email } = contentPack;

  return `# COPY PACK — ${product.name.toUpperCase()}

**Lumière Collection — Content Automation System**
Generated: ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}

---

## PRODUCT DETAILS

| Field | Value |
|-------|-------|
| Name | ${product.name} |
| Price | R${product.price} |
| Age Range | ${product.ageRange} |
| Season | ${product.season} |
| Colours | ${Array.isArray(product.colours) ? product.colours.join(', ') : product.colours} |
| Slug | \`${product.slug}\` |

---

## SHOPIFY

### Product Title
${shopify.title}

### Product Description
${shopify.description}

### Bullet Points
${shopify.bullets?.map((b) => `- ${b}`).join('\n') || ''}

### SEO Meta Title (60 chars max)
${shopify.metaTitle}

### SEO Meta Description (155 chars max)
${shopify.metaDescription}

### Shopify Tags
${shopify.tags?.join(', ') || ''}

### Image Alt Texts
${shopify.altTexts?.map((alt, i) => `**Image ${i + 1}:** ${alt}`).join('\n') || ''}

---

## INSTAGRAM

### Caption — Story Style
${instagram.captionStory}

### Caption — Feature Style
${instagram.captionFeature}

### Caption — UGC Style
${instagram.captionUGC}

### Hashtags
${instagram.hashtags}

---

## TIKTOK

### Hook (First 3 Seconds)
**"${tiktok.hook || ''}"**

### Full Script
${tiktok.script || ''}

### On-Screen Text Cues
${Array.isArray(tiktok.onScreenText)
  ? tiktok.onScreenText.map((t) => `- **${t.timestamp}** — "${t.text}" (${t.style || 'text'})`).join('\n')
  : ''}

### Hashtags
${tiktok.hashtags || ''}

### Sound Mood
${tiktok.soundMood || ''}

---

## PINTEREST

### Pin Title
${pinterest.pinTitle || product.name}

### Pin Description
${pinterest.pinDescription || ''}

### Board Suggestion
${pinterest.boardSuggestion || 'New Arrivals'}

---

## FACEBOOK

### Caption
${facebook.caption || ''}

### Hashtags
${facebook.hashtags || ''}

---

## EMAIL

### Subject Line A (Curiosity)
${email.subjectA || ''}

### Subject Line B (Direct)
${email.subjectB || ''}

### Subject Line C (Urgency/Social Proof)
${email.subjectC || ''}

### Preview Text
${email.previewText || ''}

---

*All copy passed brand voice validation. Forbidden words checked and corrected.*
*Review any [FLAGGED] sections before publishing.*

---
*Lumière Collection Automation System — ${brand.BRAND_TAGLINE}*
`;
}

/**
 * Build the 00-README.md for the product output folder.
 */
function buildProductReadme(product, contentPack, imageFiles, outputDir) {
  const heroImage = imageFiles[0]?.filename || 'hero.jpg';

  return `# ${product.name.toUpperCase()}
## Lumière Collection — Content Package

**Generated:** ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
**Product:** ${product.name} | Ages ${product.ageRange} | R${product.price} | ${product.season}

---

## WHAT'S IN THIS FOLDER

| File | What it is | How to use it |
|------|-----------|---------------|
| \`copy-pack.md\` | All written copy for every platform | Copy-paste directly. Each section is labelled. |
| \`video-prompts.md\` | 5 AI video prompts (Kling + Veo 3) | Paste into Kling AI or Google AI Studio verbatim |
| \`capcut-brief.md\` | Step-by-step CapCut editing guide | Follow section by section in CapCut |
| \`shopify-payload.json\` | Shopify product data | Auto-pushed (if credentials set) or use Shopify Admin |
| \`meta-queue.json\` | Instagram + Facebook scheduled posts | Auto-posted (if credentials set) or schedule manually |
| \`pinterest-draft.json\` | Pinterest pin data | Auto-pinned (if credentials set) or pin manually |
| \`calendar-entry.md\` | This product's posting schedule | Check against weekly calendar |
| \`images/hero.jpg\` | Best enhanced image | Use as Instagram hero, TikTok thumbnail |
| \`images/composition-guide.md\` | Which image for which platform | Read before posting |
| \`tiktok-draft/\` | TikTok-specific content package | See folder for caption, script, prompts |

---

## QUICK START — TODAY'S ACTIONS

### 1. Generate your AI video (15 mins)
Open \`video-prompts.md\` → Use Prompt 1 in Kling AI or Prompt 2 in Google Veo 3.
Download the best take.

### 2. Edit in CapCut (20–30 mins)
Open \`capcut-brief.md\` and follow it step by step.
Export as 1080×1920 MP4.

### 3. Post to Instagram
- Feed post: Use \`${heroImage}\` with the feature caption from \`copy-pack.md\`
- Reels: Use your edited CapCut video

### 4. Post the TikTok
Open \`tiktok-draft/caption.txt\` → copy-paste into TikTok when uploading your video.

### 5. Shopify
Check \`shopify-payload.json\` — if auto-push worked, product is already live.
If not, use Shopify Admin to create the product with the data from \`copy-pack.md\`.

---

## IMAGES

${imageFiles.map((img) => `- \`images/${img.filename}\` — ${img.width}×${img.height}px, ${img.sizeKb}KB`).join('\n')}

> See \`images/composition-guide.md\` for which image to use where.

---

## COPY SUMMARY

| Platform | Status | File |
|---------|--------|------|
| Shopify | ✅ Ready | \`copy-pack.md → Shopify section\` |
| Instagram (3 variants) | ✅ Ready | \`copy-pack.md → Instagram section\` |
| TikTok | ✅ Ready | \`tiktok-draft/caption.txt\` |
| Pinterest | ✅ Ready | \`copy-pack.md → Pinterest section\` |
| Facebook | ✅ Ready | \`copy-pack.md → Facebook section\` |
| Email | ✅ Ready | \`copy-pack.md → Email section\` |

---

*Lumière Collection — ${brand.BRAND_TAGLINE}*
*Automation System v1.0*
`;
}
