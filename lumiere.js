#!/usr/bin/env node
/**
 * Lumière Collection — Main CLI Entry Point
 * Usage: node lumiere.js [command] [options]
 * Run `node lumiere.js --help` for all commands.
 */

import 'dotenv/config';
import { program } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import slugify from 'slugify';

import logger from './utils/logger.js';
import { printStatusReport, validateEnv } from './utils/token-manager.js';
import { ensureDir, readJsonFile, writeJsonFile, exists } from './utils/file-utils.js';
import { enhanceProductImages } from './modules/image-enhancer.js';
import { generateAndSaveVideoPrompts } from './modules/video-prompter.js';
import { generateFullContentPack, regenerateCopy } from './modules/content-generator.js';
import { generateCapCutBrief } from './modules/capcut-brief.js';
import { publishToShopify, saveShopifyPayload } from './modules/shopify-publisher.js';
import { postToInstagram, schedulePost, saveMetaQueue } from './modules/meta-poster.js';
import { pinProduct, savePinterestDraft } from './modules/pinterest-pinner.js';
import { saveTikTokDraft, processTikTokQueue } from './modules/tiktok-queue.js';
import { generateWeeklyCalendar, generateProductCalendarEntry } from './modules/calendar-generator.js';
import { assemblePackage, printCompletionSummary } from './modules/packager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'output');
const QUEUE_DIR = process.env.QUEUE_DIR || path.join(__dirname, 'queue');

// Ensure base directories exist
ensureDir(OUTPUT_DIR);
ensureDir(QUEUE_DIR);
ensureDir(path.join(QUEUE_DIR, 'tiktok'));
ensureDir(path.join(QUEUE_DIR, 'scheduled'));

// ─────────────────────────────────────────────────────────────
// PRODUCT BUILDER — core pipeline
// ─────────────────────────────────────────────────────────────

/**
 * Main product processing pipeline.
 * @param {object} options - CLI options
 */
async function runProductPipeline(options) {
  const startTime = Date.now();

  logger.banner();

  // Validate required env
  const { ok } = validateEnv();
  if (!ok) {
    const provider = process.env.AI_PROVIDER || 'cerebras';
    logger.error(`AI provider key missing for provider "${provider}". Check AI_PROVIDER and the matching key in .env.`);
    process.exit(1);
  }

  // Build product object
  const product = {
    name: options.name,
    price: Number(options.price),
    ageRange: options.age,
    season: options.season || 'all-season',
    colours: options.colours ? options.colours.split(',').map((c) => c.trim()) : ['multicolour'],
    description: options.description || '',
    imageUrls: options.images ? options.images.split(',').map((u) => u.trim()) : [],
    slug: slugify(options.name, { lower: true, strict: true }),
  };

  const productOutputDir = path.join(OUTPUT_DIR, product.slug);
  ensureDir(productOutputDir);

  logger.productHeader(product.name, product.ageRange);

  // ── Step 1: Images ──────────────────────────────────────────
  let imageFiles = [];
  if (product.imageUrls.length > 0) {
    const imageSpinner = logger.spinner('Downloading + enhancing supplier images...');
    try {
      imageFiles = await enhanceProductImages(product.imageUrls, product.slug, productOutputDir);
      imageSpinner.succeed(`Enhanced ${imageFiles.length} image(s)`);
    } catch (err) {
      imageSpinner.fail(`Image enhancement failed: ${err.message}`);
    }
  } else {
    logger.warn('No images provided — skipping image processing.');
  }

  // ── Step 2: Video Prompts ───────────────────────────────────
  const videoSpinner = logger.spinner('Generating video prompts...');
  try {
    await generateAndSaveVideoPrompts(product, productOutputDir);
    videoSpinner.succeed('5 hyperrealistic video prompts created (Kling + Veo3)');
  } catch (err) {
    videoSpinner.fail(`Video prompt generation failed: ${err.message}`);
  }

  // ── Step 3: Content Pack ────────────────────────────────────
  const copySpinner = logger.spinner('Generating content pack (Claude API)...');
  let contentPack;
  try {
    contentPack = await generateFullContentPack(product);
    copySpinner.succeed('Content pack complete');
  } catch (err) {
    copySpinner.fail(`Content generation failed: ${err.message}`);
    process.exit(1);
  }

  // ── Step 4: CapCut Brief ────────────────────────────────────
  const capcutSpinner = logger.spinner('Generating CapCut edit brief...');
  try {
    await generateCapCutBrief(product, contentPack, imageFiles, productOutputDir);
    capcutSpinner.succeed('CapCut edit brief ready');
  } catch (err) {
    capcutSpinner.fail(`CapCut brief failed: ${err.message}`);
  }

  // ── Step 5: Assemble package ────────────────────────────────
  await assemblePackage(product, contentPack, imageFiles, productOutputDir);

  // ── Step 6: Shopify ─────────────────────────────────────────
  const results = {};
  const shopifyPayloadPath = saveShopifyPayload(product, contentPack, imageFiles, productOutputDir);

  if (options.pushShopify) {
    const shopifySpinner = logger.spinner('Pushing to Shopify...');
    try {
      const shopifyResult = await publishToShopify(product, contentPack, imageFiles);
      if (shopifyResult) {
        shopifySpinner.succeed(`Product live: ${shopifyResult.url}`);
        results.shopifyUrl = shopifyResult.url;
      } else {
        shopifySpinner.warn('Shopify push skipped (no credentials or error) — payload saved to shopify-payload.json');
      }
    } catch (err) {
      shopifySpinner.fail(`Shopify push failed: ${err.message}`);
    }
  }

  // ── Step 7: Instagram + Meta ────────────────────────────────
  const metaQueuePath = saveMetaQueue(product, contentPack, imageFiles, productOutputDir);

  if (options.postInstagram) {
    const igSpinner = logger.spinner('Scheduling Instagram post (07:00 SAST tomorrow)...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(7, 0, 0, 0);

      const igResult = await schedulePost(contentPack, null, tomorrow, 'instagram');
      if (igResult) {
        igSpinner.succeed(`Instagram post queued for ${tomorrow.toLocaleString('en-ZA')}`);
      } else {
        igSpinner.warn('Instagram scheduling skipped — post saved to meta-queue.json');
      }
    } catch (err) {
      igSpinner.fail(`Instagram scheduling failed: ${err.message}`);
    }
  }

  // ── Step 8: Pinterest ───────────────────────────────────────
  savePinterestDraft(product, contentPack, imageFiles, productOutputDir);

  if (options.pinPinterest) {
    const pinSpinner = logger.spinner('Creating Pinterest pins...');
    try {
      const pins = await pinProduct(product, contentPack, imageFiles);
      if (pins.length > 0) {
        pinSpinner.succeed(`${pins.length} Pinterest pin(s) created`);
        results.pinterestPins = pins.length;
      } else {
        pinSpinner.warn('Pinterest pins skipped — see pinterest-draft.json for manual pinning data');
      }
    } catch (err) {
      pinSpinner.fail(`Pinterest failed: ${err.message}`);
    }
  }

  // ── Step 9: TikTok Draft ────────────────────────────────────
  const tiktokSpinner = logger.spinner('Saving TikTok draft...');
  try {
    const draftPath = await saveTikTokDraft(product, contentPack, productOutputDir);
    tiktokSpinner.succeed('TikTok draft saved');
    results.tiktokDraftPath = draftPath;
  } catch (err) {
    tiktokSpinner.fail(`TikTok draft save failed: ${err.message}`);
  }

  // ── Step 10: Calendar Entry ─────────────────────────────────
  try {
    generateProductCalendarEntry(product, contentPack, imageFiles, productOutputDir);
  } catch (err) {
    logger.warn(`Calendar entry skipped: ${err.message}`);
  }

  // Save product metadata for later use (calendar, regeneration)
  writeJsonFile(path.join(productOutputDir, 'product-meta.json'), {
    product,
    processedAt: new Date().toISOString(),
    imageFiles: imageFiles.map((f) => ({ filename: f.filename, label: f.label })),
  });

  // ── Done ────────────────────────────────────────────────────
  printCompletionSummary(product, productOutputDir, Date.now() - startTime, results);
}

// ─────────────────────────────────────────────────────────────
// INTERACTIVE WIZARD
// ─────────────────────────────────────────────────────────────

async function runWizard() {
  const { default: inquirer } = await import('inquirer');

  logger.banner();
  console.log('Welcome to the Lumière Collection Content Wizard.\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Product name:',
      validate: (v) => v.trim().length > 0 || 'Product name is required',
    },
    {
      type: 'input',
      name: 'price',
      message: 'Price (R):',
      validate: (v) => !isNaN(Number(v)) || 'Enter a valid price',
    },
    {
      type: 'list',
      name: 'age',
      message: 'Age range:',
      choices: ['0-2', '2-5', '3-6', '4-7', '7-12'],
    },
    {
      type: 'list',
      name: 'season',
      message: 'Season:',
      choices: ['summer', 'winter', 'spring', 'autumn', 'all-season'],
    },
    {
      type: 'input',
      name: 'colours',
      message: 'Colours (comma-separated, e.g. "sage,white"):',
      default: 'mixed',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Product description (material, key features):',
    },
    {
      type: 'input',
      name: 'images',
      message: 'Image URLs (comma-separated, or leave blank to skip):',
      default: '',
    },
    {
      type: 'confirm',
      name: 'pushShopify',
      message: 'Push to Shopify?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'postInstagram',
      message: 'Schedule Instagram post?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'pinPinterest',
      message: 'Create Pinterest pins?',
      default: false,
    },
  ]);

  await runProductPipeline(answers);
}

// ─────────────────────────────────────────────────────────────
// CLI COMMANDS
// ─────────────────────────────────────────────────────────────

program
  .name('lumiere')
  .description('Lumière Collection — Content Automation System')
  .version('1.0.0');

// add — process a new product end-to-end
program
  .command('add')
  .description('Process a new product (images → copy → video prompts → Shopify → social)')
  .requiredOption('-n, --name <name>', 'Product name')
  .requiredOption('-p, --price <price>', 'Price in ZAR (e.g. 349)')
  .requiredOption('-a, --age <range>', 'Age range (e.g. "3-6")')
  .option('-s, --season <season>', 'Season (summer|winter|spring|autumn|all-season)', 'all-season')
  .option('-c, --colours <colours>', 'Comma-separated colours (e.g. "sage,white")', 'multicolour')
  .option('-d, --description <desc>', 'Product description / material details', '')
  .option('-i, --images <urls>', 'Comma-separated supplier image URLs', '')
  .option('--push-shopify', 'Push product to Shopify', false)
  .option('--post-instagram', 'Schedule Instagram post', false)
  .option('--pin-pinterest', 'Create Pinterest pins', false)
  .action(async (opts) => {
    await runProductPipeline({
      name: opts.name,
      price: opts.price,
      age: opts.age,
      season: opts.season,
      colours: opts.colours,
      description: opts.description,
      images: opts.images,
      pushShopify: opts.pushShopify,
      postInstagram: opts.postInstagram,
      pinPinterest: opts.pinPinterest,
    });
  });

// wizard — interactive mode
program
  .command('wizard')
  .description('Interactive wizard mode — guided step-by-step product entry')
  .action(runWizard);

// status — check API key health
program
  .command('status')
  .description('Check API key health and token expiry')
  .action(() => {
    printStatusReport();
  });

// calendar — generate weekly calendar
program
  .command('calendar')
  .description('Generate weekly content calendar')
  .option('-w, --week <week>', 'Which week (current|next)', 'current')
  .action(async (opts) => {
    logger.banner();
    const { default: fs } = await import('fs');
    const outputDirs = exists(OUTPUT_DIR)
      ? fs.readdirSync(OUTPUT_DIR)
          .filter((d) => {
            const metaPath = path.join(OUTPUT_DIR, d, 'product-meta.json');
            return exists(metaPath);
          })
      : [];

    if (outputDirs.length === 0) {
      logger.warn('No processed products found in output/. Run `node lumiere.js add` first.');
      return;
    }

    const products = outputDirs
      .map((d) => readJsonFile(path.join(OUTPUT_DIR, d, 'product-meta.json')))
      .filter(Boolean);

    await generateWeeklyCalendar(products, OUTPUT_DIR, opts.week);
  });

// copy — regenerate copy only (no image processing)
program
  .command('copy')
  .description('Regenerate copy only for an existing product')
  .requiredOption('--product <slug>', 'Product slug (e.g. meadow-linen-playsuit)')
  .action(async (opts) => {
    logger.banner();
    const productDir = path.join(OUTPUT_DIR, opts.product);
    const meta = readJsonFile(path.join(productDir, 'product-meta.json'));

    if (!meta) {
      logger.error(`No product found at output/${opts.product}/. Run 'node lumiere.js add' first.`);
      process.exit(1);
    }

    const copySpinner = logger.spinner('Regenerating copy...');
    const contentPack = await regenerateCopy(meta.product);
    copySpinner.succeed('Copy regenerated');

    await assemblePackage(meta.product, contentPack, meta.imageFiles || [], productDir);
    logger.success('Copy pack updated: ' + path.join(productDir, 'copy-pack.md'));
  });

// prompts — regenerate video prompts only
program
  .command('prompts')
  .description('Regenerate video prompts for an existing product')
  .requiredOption('--product <slug>', 'Product slug')
  .action(async (opts) => {
    logger.banner();
    const productDir = path.join(OUTPUT_DIR, opts.product);
    const meta = readJsonFile(path.join(productDir, 'product-meta.json'));

    if (!meta) {
      logger.error(`No product found at output/${opts.product}/`);
      process.exit(1);
    }

    const spinner = logger.spinner('Regenerating video prompts...');
    await generateAndSaveVideoPrompts(meta.product, productDir);
    spinner.succeed('Video prompts updated: ' + path.join(productDir, 'video-prompts.md'));
  });

// tiktok-publish — process TikTok queue
program
  .command('tiktok-publish')
  .description('Process TikTok queue (publishes items with .mp4 videos attached)')
  .action(async () => {
    logger.banner();
    await processTikTokQueue();
  });

// queue — show pending scheduled posts
program
  .command('queue')
  .description('Show pending scheduled posts')
  .option('--show', 'Show all queued posts')
  .action(async () => {
    logger.banner();
    const scheduledDir = path.join(QUEUE_DIR, 'scheduled');
    const tiktokDir = path.join(QUEUE_DIR, 'tiktok');

    const { listFiles, listDirs } = await import('./utils/file-utils.js');

    const scheduledPosts = listFiles(scheduledDir);
    const tiktokDrafts = listDirs(tiktokDir);

    if (scheduledPosts.length === 0 && tiktokDrafts.length === 0) {
      logger.info('No posts in queue.');
      return;
    }

    if (scheduledPosts.length > 0) {
      logger.info(`${scheduledPosts.length} scheduled post(s) in queue/scheduled/`);
      scheduledPosts.forEach((f) => {
        const data = readJsonFile(f);
        if (data) logger.step(`${data.platform} — ${data.scheduledTime} — ${data.status}`);
      });
    }

    if (tiktokDrafts.length > 0) {
      logger.info(`${tiktokDrafts.length} TikTok draft(s) in queue/tiktok/`);
      tiktokDrafts.forEach((d) => {
        const meta = readJsonFile(path.join(d, 'metadata.json'));
        if (meta) logger.step(`${meta.product} — ${meta.status} — ${path.basename(d)}`);
      });
    }
  });

// ─────────────────────────────────────────────────────────────
// ENTRY
// ─────────────────────────────────────────────────────────────

// Default to wizard if no command given
if (process.argv.length <= 2) {
  runWizard().catch((err) => {
    logger.error('Wizard error: ' + err.message, err);
    process.exit(1);
  });
} else {
  program.parseAsync(process.argv).catch((err) => {
    logger.error(err.message, err);
    process.exit(1);
  });
}
