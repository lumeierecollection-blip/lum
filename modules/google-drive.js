/**
 * Lumière Collection — Google Drive Uploader
 *
 * Uploads a product's full content package to Google Drive.
 * Uses a service account — no OAuth browser flow required.
 *
 * Setup (one-time):
 *  1. Go to console.cloud.google.com → New project → Enable "Google Drive API"
 *  2. IAM & Admin → Service Accounts → Create → Download JSON key
 *  3. In Google Drive, create a folder called "Lumière Collection"
 *     → Right-click → Share → paste the service account email (ends in @...iam.gserviceaccount.com)
 *     → Give "Editor" access
 *  4. Copy the folder ID from its URL:
 *     drive.google.com/drive/folders/THIS_PART_IS_THE_ID
 *  5. Add to .env:
 *     GOOGLE_DRIVE_ENABLED=true
 *     GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
 *     GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
 *     (or paste the JSON inline as a string — see .env.example)
 */

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const MIME = {
  md:   'text/markdown',
  txt:  'text/plain',
  json: 'application/json',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  folder: 'application/vnd.google-apps.folder',
};

function getMime(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

function getAuth() {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonEnv) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set in .env');

  let credentials;
  if (jsonEnv.trim().startsWith('{')) {
    credentials = JSON.parse(jsonEnv);
  } else {
    credentials = JSON.parse(fs.readFileSync(jsonEnv, 'utf8'));
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

// ─────────────────────────────────────────────────────────────
// DRIVE HELPERS
// ─────────────────────────────────────────────────────────────

async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: MIME.folder,
      parents: [parentId],
    },
    fields: 'id',
  });
  return res.data.id;
}

async function findOrCreateFolder(drive, name, parentId) {
  const q = `name='${name}' and mimeType='${MIME.folder}' and '${parentId}' in parents and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id, name)', pageSize: 1 });
  if (res.data.files.length > 0) return res.data.files[0].id;
  return createFolder(drive, name, parentId);
}

async function uploadFile(drive, localPath, name, parentId) {
  if (!fs.existsSync(localPath)) return null;
  const mimeType = getMime(name);
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body: fs.createReadStream(localPath) },
    fields: 'id, webViewLink',
  });
  return res.data;
}

async function uploadText(drive, content, name, parentId) {
  const { Readable } = await import('stream');
  const mimeType = getMime(name);
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body: Readable.from([content]) },
    fields: 'id, webViewLink',
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

/**
 * Upload a product's full content package to Google Drive.
 * @param {object} product
 * @param {object} contentPack   — structured content JSON
 * @param {Array}  imageFiles    — [{ filename, ... }]
 * @param {string} productDir    — local output directory for this product
 * @param {function} onProgress  — (message) => void for SSE updates
 * @returns {{ folderUrl: string, fileCount: number }}
 */
export async function uploadProductToDrive(product, contentPack, imageFiles, productDir, onProgress = () => {}) {
  if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') return null;

  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set in .env');

  const auth  = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  // Build folder name: "Meadow Linen Playsuit — 22 May 2026"
  const dateStr = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  const folderName = `${product.name} — ${dateStr}`;

  onProgress('Creating Drive folder…');
  const productFolderId = await createFolder(drive, folderName, rootFolderId);

  let fileCount = 0;

  // ── 1. Copy Pack (the main document — most important) ──────
  const copyPackPath = path.join(productDir, 'copy-pack.md');
  if (fs.existsSync(copyPackPath)) {
    onProgress('Uploading copy pack…');
    await uploadFile(drive, copyPackPath, '📋 Copy Pack.md', productFolderId);
    fileCount++;
  }

  // ── 2. Video Prompts ───────────────────────────────────────
  const videoPath = path.join(productDir, 'video-prompts.md');
  if (fs.existsSync(videoPath)) {
    await uploadFile(drive, videoPath, '🎬 Video Prompts.md', productFolderId);
    fileCount++;
  }

  // ── 3. CapCut Brief ────────────────────────────────────────
  const capcutPath = path.join(productDir, 'capcut-brief.md');
  if (fs.existsSync(capcutPath)) {
    await uploadFile(drive, capcutPath, '✂️ CapCut Brief.md', productFolderId);
    fileCount++;
  }

  // ── 4. Platform JSON payloads ──────────────────────────────
  const jsonFiles = [
    ['shopify-payload.json',  '🛍️ Shopify Payload.json'],
    ['meta-queue.json',       '📸 Instagram + Facebook.json'],
    ['pinterest-draft.json',  '📌 Pinterest Draft.json'],
    ['content-pack.json',     '📊 Full Content Pack.json'],
  ];
  for (const [filename, label] of jsonFiles) {
    const p = path.join(productDir, filename);
    if (fs.existsSync(p)) {
      await uploadFile(drive, p, label, productFolderId);
      fileCount++;
    }
  }

  // ── 5. Images ──────────────────────────────────────────────
  const imagesDir = path.join(productDir, 'images');
  if (fs.existsSync(imagesDir) && imageFiles.length > 0) {
    onProgress(`Uploading ${imageFiles.length} image(s)…`);
    const imgFolderId = await createFolder(drive, '📸 Images', productFolderId);

    for (const img of imageFiles) {
      const imgPath = path.join(imagesDir, img.filename);
      if (fs.existsSync(imgPath)) {
        await uploadFile(drive, imgPath, img.filename, imgFolderId);
        fileCount++;
      }
    }

    const compositionPath = path.join(imagesDir, 'composition-guide.md');
    if (fs.existsSync(compositionPath)) {
      await uploadFile(drive, compositionPath, 'composition-guide.md', imgFolderId);
      fileCount++;
    }
  }

  // ── 6. TikTok draft ────────────────────────────────────────
  const tiktokDir = path.join(productDir, 'tiktok-draft');
  if (fs.existsSync(tiktokDir)) {
    const tiktokFolderId = await createFolder(drive, '🎵 TikTok Draft', productFolderId);
    for (const f of fs.readdirSync(tiktokDir)) {
      await uploadFile(drive, path.join(tiktokDir, f), f, tiktokFolderId);
      fileCount++;
    }
  }

  // ── 7. README ──────────────────────────────────────────────
  const readmePath = path.join(productDir, '00-README.md');
  if (fs.existsSync(readmePath)) {
    await uploadFile(drive, readmePath, '📖 README.md', productFolderId);
    fileCount++;
  }

  // Get a shareable link to the product folder
  await drive.permissions.create({
    fileId: productFolderId,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  const folderMeta = await drive.files.get({ fileId: productFolderId, fields: 'webViewLink' });
  const folderUrl = folderMeta.data.webViewLink;

  onProgress(`Uploaded ${fileCount} files → Drive`);
  return { folderUrl, fileCount, folderId: productFolderId };
}

/**
 * Quick check — returns true if Drive is configured and reachable.
 */
export async function checkDriveConnection() {
  if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') return { enabled: false };
  try {
    const auth  = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.get({ fileId: process.env.GOOGLE_DRIVE_FOLDER_ID, fields: 'id,name' });
    return { enabled: true, connected: true };
  } catch (err) {
    return { enabled: true, connected: false, error: err.message };
  }
}
