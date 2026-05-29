/**
 * Lumière Collection — Web Dashboard Server
 * Express server with SSE for real-time content generation progress.
 * Run: node server.js   →  open http://localhost:3000
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import slugify from 'slugify';

import { ensureDir, readJsonFile, writeJsonFile, listDirs, exists } from './utils/file-utils.js';
import { enhanceProductImages } from './modules/image-enhancer.js';
import { generateAndSaveVideoPrompts } from './modules/video-prompter.js';
import { generateFullContentPack } from './modules/content-generator.js';
import { generateCapCutBrief } from './modules/capcut-brief.js';
import { saveShopifyPayload } from './modules/shopify-publisher.js';
import { saveMetaQueue } from './modules/meta-poster.js';
import { savePinterestDraft } from './modules/pinterest-pinner.js';
import { saveTikTokDraft } from './modules/tiktok-queue.js';
import { generateProductCalendarEntry } from './modules/calendar-generator.js';
import { assemblePackage } from './modules/packager.js';
import { getActiveProvider } from './config/ai-provider.js';
import { uploadProductToDrive, checkDriveConnection } from './modules/google-drive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'output');
const QUEUE_DIR  = process.env.QUEUE_DIR  || path.join(__dirname, 'queue');
const PORT       = process.env.PORT || 3000;

ensureDir(OUTPUT_DIR);
ensureDir(QUEUE_DIR);
ensureDir(path.join(QUEUE_DIR, 'tiktok'));
ensureDir(path.join(QUEUE_DIR, 'scheduled'));
ensureDir(path.join(__dirname, 'public'));

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────
// SSE HELPER
// ─────────────────────────────────────────────────────────────

function sseSetup(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
}

function sseSend(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseDone(res, data) {
  if (!res.writableEnded) {
    sseSend(res, 'done', data);
    res.end();
  }
}

function sseError(res, message) {
  if (!res.writableEnded) {
    sseSend(res, 'error', { message });
    res.end();
  }
}

// ─────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────

/** GET /api/status — system health */
app.get('/api/status', (req, res) => {
  const ai = getActiveProvider();
  const hasCerebras = !!process.env.CEREBRAS_API_KEY;
  const hasGemini = !!process.env.GOOGLE_AI_STUDIO_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasShopify = !!(process.env.SHOPIFY_ADMIN_API_TOKEN && process.env.SHOPIFY_STORE_DOMAIN);
  const hasMeta = !!(process.env.META_LONG_LIVED_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
  const hasPinterest = !!process.env.PINTEREST_ACCESS_TOKEN;
  const hasTikTok = !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_APPROVED === 'true');
  const hasDrive  = process.env.GOOGLE_DRIVE_ENABLED === 'true' && !!process.env.GOOGLE_DRIVE_FOLDER_ID;

  res.json({
    ai,
    ready: hasCerebras || hasGemini || hasOpenRouter || !!process.env.OLLAMA_BASE_URL,
    drive: { enabled: hasDrive },
    integrations: {
      shopify:   hasShopify,
      instagram: hasMeta,
      facebook:  hasMeta,
      pinterest: hasPinterest,
      tiktok:    hasTikTok,
    },
  });
});

/** GET /api/products — list all processed products */
app.get('/api/products', (req, res) => {
  if (!exists(OUTPUT_DIR)) return res.json([]);

  const slugs = fs.readdirSync(OUTPUT_DIR).filter((d) => {
    const stat = fs.statSync(path.join(OUTPUT_DIR, d));
    return stat.isDirectory() && exists(path.join(OUTPUT_DIR, d, 'product-meta.json'));
  });

  const products = slugs.map((slug) => {
    const meta = readJsonFile(path.join(OUTPUT_DIR, slug, 'product-meta.json'));
    if (!meta) return null;
    const images = listImages(slug);
    return {
      slug,
      name: meta.product?.name || slug,
      price: meta.product?.price,
      ageRange: meta.product?.ageRange,
      season: meta.product?.season,
      colours: meta.product?.colours,
      processedAt: meta.processedAt,
      heroImage: images[0] || null,
      hasContent: exists(path.join(OUTPUT_DIR, slug, 'copy-pack.md')),
      hasVideo: exists(path.join(OUTPUT_DIR, slug, 'video-prompts.md')),
    };
  }).filter(Boolean);

  res.json(products.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt)));
});

/** GET /api/products/:slug — full product detail */
app.get('/api/products/:slug', (req, res) => {
  const { slug } = req.params;
  const productDir = path.join(OUTPUT_DIR, slug);

  if (!exists(productDir)) return res.status(404).json({ error: 'Product not found' });

  const meta = readJsonFile(path.join(productDir, 'product-meta.json'));
  const shopifyPayload = readJsonFile(path.join(productDir, 'shopify-payload.json'));
  const metaQueue = readJsonFile(path.join(productDir, 'meta-queue.json'));
  const pinterestDraft = readJsonFile(path.join(productDir, 'pinterest-draft.json'));

  // Read markdown files
  const readMd = (filename) => {
    const p = path.join(productDir, filename);
    return exists(p) ? fs.readFileSync(p, 'utf8') : null;
  };

  const copyPack = readMd('copy-pack.md');
  const videoPrompts = readMd('video-prompts.md');
  const capcutBrief = readMd('capcut-brief.md');
  const calendarEntry = readMd('calendar-entry.md');

  // Read TikTok draft
  const tiktokCaption = (() => {
    const p = path.join(productDir, 'tiktok-draft', 'caption.txt');
    return exists(p) ? fs.readFileSync(p, 'utf8') : null;
  })();
  const tiktokScript = (() => {
    const p = path.join(productDir, 'tiktok-draft', 'script.md');
    return exists(p) ? fs.readFileSync(p, 'utf8') : null;
  })();

  res.json({
    product: meta?.product,
    processedAt: meta?.processedAt,
    driveFolderUrl: meta?.driveFolderUrl || null,
    images: listImages(slug),
    content: {
      copyPack,
      videoPrompts,
      capcutBrief,
      calendarEntry,
      tiktokCaption,
      tiktokScript,
    },
    shopifyPayload,
    metaQueue,
    pinterestDraft,
  });
});

/** GET /api/products/:slug/content-pack — structured JSON content */
app.get('/api/products/:slug/content-pack', (req, res) => {
  const { slug } = req.params;
  const packPath = path.join(OUTPUT_DIR, slug, 'content-pack.json');

  if (!exists(packPath)) return res.status(404).json({ error: 'Content pack not found' });
  res.json(readJsonFile(packPath));
});

/**
 * POST /api/products — add + process a new product (SSE stream)
 * Body: { name, price, ageRange, season, colours, description, imageUrls, imageData }
 * imageData is an optional array of { name, base64, mimeType } for direct file uploads.
 */
app.post('/api/products', async (req, res) => {
  sseSetup(res);

  const { name, price, ageRange, season, colours, description, imageUrls, imageData } = req.body;

  if (!name || !price || !ageRange) {
    return sseError(res, 'name, price, and ageRange are required');
  }

  const product = {
    name,
    price: Number(price),
    ageRange,
    season: season || 'all-season',
    colours: Array.isArray(colours) ? colours : (colours || '').split(',').map((c) => c.trim()).filter(Boolean),
    description: description || '',
    imageUrls: Array.isArray(imageUrls) ? imageUrls : (imageUrls || '').split(',').map((u) => u.trim()).filter(Boolean),
    imageData: Array.isArray(imageData) ? imageData : [],
    slug: slugify(name, { lower: true, strict: true }),
  };

  const productDir = path.join(OUTPUT_DIR, product.slug);
  ensureDir(productDir);

  const send = (step, message, data = {}) => sseSend(res, 'progress', { step, message, ...data });
  const startTime = Date.now();

  try {
    // Step 1: Images
    send('images', 'Downloading and enhancing images...');
    let imageFiles = [];
    const hasUrls = product.imageUrls.length > 0;
    const hasUploads = product.imageData.length > 0;
    if (hasUrls || hasUploads) {
      try {
        imageFiles = await enhanceProductImages(product.imageUrls, product.slug, productDir, product.imageData);
        send('images', `Enhanced ${imageFiles.length} image(s)`, { count: imageFiles.length });
      } catch (err) {
        send('images', `Image processing skipped: ${err.message}`, { warning: true });
      }
    } else {
      send('images', 'No images provided — skipping', { warning: true });
    }

    // Step 2: Video prompts
    send('video', 'Generating video prompts (Kling AI + Veo 3)...');
    await generateAndSaveVideoPrompts(product, productDir);
    send('video', '5 hyperrealistic video prompts created');

    // Step 3: Content pack (AI copy)
    send('copy', 'Generating all copy (Cerebras AI)...');
    const contentPack = await generateFullContentPack(product, (substep, msg) => {
      send('copy', msg, { substep });
    });

    // Save structured content pack JSON for the UI
    writeJsonFile(path.join(productDir, 'content-pack.json'), contentPack);

    send('copy', 'All copy generated and brand-checked');

    // Step 4: CapCut brief
    send('capcut', 'Generating CapCut edit brief...');
    await generateCapCutBrief(product, contentPack, imageFiles, productDir);
    send('capcut', 'CapCut brief ready');

    // Step 5: Assemble package files
    send('package', 'Assembling content package...');
    await assemblePackage(product, contentPack, imageFiles, productDir);

    // Step 6: Save platform payloads
    saveShopifyPayload(product, contentPack, imageFiles, productDir);
    saveMetaQueue(product, contentPack, imageFiles, productDir);
    savePinterestDraft(product, contentPack, imageFiles, productDir);

    // Step 7: TikTok draft
    send('tiktok', 'Saving TikTok draft...');
    await saveTikTokDraft(product, contentPack, productDir);
    send('tiktok', 'TikTok draft saved to queue');

    // Step 8: Calendar entry
    generateProductCalendarEntry(product, contentPack, imageFiles, productDir);

    // Save product metadata
    writeJsonFile(path.join(productDir, 'product-meta.json'), {
      product,
      processedAt: new Date().toISOString(),
      imageFiles: imageFiles.map((f) => ({ filename: f.filename, label: f.label })),
    });

    // Step 9: Google Drive upload (if enabled)
    let driveResult = null;
    if (process.env.GOOGLE_DRIVE_ENABLED === 'true') {
      send('drive', 'Uploading to Google Drive...');
      try {
        driveResult = await uploadProductToDrive(
          product,
          contentPack,
          imageFiles,
          productDir,
          (msg) => send('drive', msg),
        );
        send('drive', `✓ ${driveResult.fileCount} files uploaded to Drive`);
        // Persist the Drive folder URL in product meta for easy access
        const metaPath = path.join(productDir, 'product-meta.json');
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.driveFolderUrl = driveResult.folderUrl;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      } catch (err) {
        send('drive', `Drive upload failed: ${err.message}`, { warning: true });
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    sseDone(res, {
      slug: product.slug,
      name: product.name,
      elapsedSeconds: elapsed,
      imageCount: imageFiles.length,
      driveFolderUrl: driveResult?.folderUrl || null,
    });
  } catch (err) {
    sseError(res, `Processing failed: ${err.message}`);
  }
});

/** DELETE /api/products/:slug — delete a product */
app.delete('/api/products/:slug', (req, res) => {
  const { slug } = req.params;
  const productDir = path.join(OUTPUT_DIR, slug);

  if (!exists(productDir)) return res.status(404).json({ error: 'Not found' });

  fs.rmSync(productDir, { recursive: true, force: true });
  res.json({ ok: true });
});

/** GET /api/queue — all scheduled posts */
app.get('/api/queue', (req, res) => {
  const scheduledDir = path.join(QUEUE_DIR, 'scheduled');
  const tiktokDir    = path.join(QUEUE_DIR, 'tiktok');

  const scheduled = [];
  const tiktokDrafts = [];

  if (exists(scheduledDir)) {
    fs.readdirSync(scheduledDir)
      .filter((f) => f.endsWith('.json'))
      .forEach((f) => {
        const data = readJsonFile(path.join(scheduledDir, f));
        if (data) scheduled.push({ ...data, id: f.replace('.json', ''), type: 'scheduled' });
      });
  }

  if (exists(tiktokDir)) {
    fs.readdirSync(tiktokDir).forEach((d) => {
      const dPath = path.join(tiktokDir, d);
      if (!fs.statSync(dPath).isDirectory()) return;
      const meta = readJsonFile(path.join(dPath, 'metadata.json'));
      if (meta) tiktokDrafts.push({ ...meta, id: d, type: 'tiktok_draft' });
    });
  }

  res.json({
    scheduled: scheduled.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)),
    tiktokDrafts,
  });
});

/** POST /api/queue/schedule — add a post to the schedule */
app.post('/api/queue/schedule', (req, res) => {
  const { slug, platform, postType, scheduledTime, captionVariant } = req.body;
  if (!slug || !platform || !scheduledTime) {
    return res.status(400).json({ error: 'slug, platform, and scheduledTime are required' });
  }

  const meta = readJsonFile(path.join(OUTPUT_DIR, slug, 'product-meta.json'));
  const contentPack = readJsonFile(path.join(OUTPUT_DIR, slug, 'content-pack.json'));
  if (!meta || !contentPack) return res.status(404).json({ error: 'Product or content not found' });

  const id = `${new Date(scheduledTime).toISOString().slice(0, 10)}-${platform}-${slug}-${Date.now()}`;
  const entry = {
    id,
    slug,
    product: meta.product?.name || slug,
    platform,
    postType: postType || 'FEED',
    captionVariant: captionVariant || 'feature',
    scheduledTime,
    status: 'queued',
    createdAt: new Date().toISOString(),
    imageFile: meta.imageFiles?.[0]?.filename || 'hero.jpg',
  };

  writeJsonFile(path.join(QUEUE_DIR, 'scheduled', `${id}.json`), entry);
  res.json({ ok: true, id });
});

/** PATCH /api/queue/:id/status — update post status */
app.patch('/api/queue/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const filePath = path.join(QUEUE_DIR, 'scheduled', `${id}.json`);

  if (!exists(filePath)) return res.status(404).json({ error: 'Queue item not found' });

  const data = readJsonFile(filePath);
  data.status = status;
  if (status === 'published') data.publishedAt = new Date().toISOString();
  writeJsonFile(filePath, data);

  res.json({ ok: true });
});

/** DELETE /api/queue/:id — remove from queue */
app.delete('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  const filePath = path.join(QUEUE_DIR, 'scheduled', `${id}.json`);

  if (!exists(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

/** GET /api/images/:slug/:filename — serve product images */
app.get('/api/images/:slug/:filename', (req, res) => {
  const { slug, filename } = req.params;
  const imgPath = path.join(OUTPUT_DIR, slug, 'images', filename);
  if (!exists(imgPath)) return res.status(404).send('Not found');
  res.sendFile(imgPath);
});

// ─────────────────────────────────────────────────────────────
// SPA FALLBACK
// ─────────────────────────────────────────────────────────────

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function listImages(slug) {
  const imagesDir = path.join(OUTPUT_DIR, slug, 'images');
  if (!exists(imagesDir)) return [];
  return fs.readdirSync(imagesDir)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map((f) => `/api/images/${slug}/${f}`);
}

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('\x1b[33m╔══════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[33m║\x1b[0m\x1b[97m  LUMIÈRE COLLECTION DASHBOARD v1.0   \x1b[0m\x1b[33m║\x1b[0m');
  console.log('\x1b[33m╚══════════════════════════════════════╝\x1b[0m');
  console.log('');
  console.log(`  \x1b[32m✓\x1b[0m Dashboard: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  const ai = getActiveProvider();
  console.log(`  \x1b[32m✓\x1b[0m AI Provider: ${ai.provider} / ${ai.model} \x1b[33m(free)\x1b[0m`);
  console.log('');
});

export default app;
