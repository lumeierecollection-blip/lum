# Lumière Collection — Content Automation System

> *Dressed in wonder.*

A production-grade, fully automated content creation system for Lumière Collection. Transforms raw supplier product details into complete, ready-to-publish content packages: enhanced images, hyperrealistic AI video prompts, platform-specific copy, CapCut edit briefs, and scheduled social posts — without a photographer, videographer, or creative agency.

---

## What This System Does

Given a product name, price, age range, and a few supplier images, the system:

1. Downloads and enhances supplier images to lifestyle photography quality (warm grade, contrast, subtle grain)
2. Optionally upscales to 4K via Replicate's Real-ESRGAN model
3. Generates 5 hyperrealistic video prompts engineered for **Kling AI** and **Google Veo 3** — all 8 layers included
4. Writes all copy via Claude API:
   - Shopify product title, description, bullets, SEO meta tags, alt texts
   - Instagram captions (story / feature / UGC styles) + 28–30 hashtags
   - TikTok hook, voiceover script, on-screen text cues
   - Pinterest pin titles and SEO descriptions
   - Facebook caption
   - 3 email subject line A/B variants
5. Generates a CapCut edit brief with exact colour grades, shot order, text overlays, music direction
6. Pushes to Shopify via GraphQL Admin API (optional)
7. Schedules Instagram + Facebook posts via Meta Graph API (optional)
8. Creates Pinterest pins via Pinterest API v5 (optional)
9. Saves TikTok draft packages for manual upload or API queue
10. Outputs a weekly content calendar with SAST post times
11. Packages everything in a clean per-product folder

---

## Prerequisites

- **Node.js 20+** — check with `node --version`
- An **Anthropic API key** (required for all copy generation)
- Optional (for publishing): Shopify, Meta, Pinterest, TikTok API credentials
- Optional (for 4K upscaling): Replicate API key
- **Kling AI account** (klingai.com) for generating videos from prompts
- **Google AI Studio account** (aistudio.google.com) for Veo 3 video generation
- **CapCut** (mobile or desktop) for video editing

---

## Installation

### 1. Clone and install

```bash
cd lumiere-automation
npm install
```

### 2. Set up environment variables

The `.env` file is already included in the repo with the default settings. Open it in any text editor and fill in your keys. At minimum you need:

```env
CEREBRAS_API_KEY=your_key_here   # free at cloud.cerebras.ai
```

All other keys are optional — the system gracefully skips features when credentials are missing, saving draft files for manual use instead.

### 3. Verify setup

```bash
node lumiere.js status
```

This checks all API keys and prints token expiry warnings if relevant.

---

## API Account Setup

### Cerebras (AI / Copy Generation) — Required
1. Go to [cloud.cerebras.ai](https://cloud.cerebras.ai)
2. Create a free account → API Keys → Create new key
3. Copy key to `CEREBRAS_API_KEY` in `.env`
4. The default model is `gpt-oss-120b` — no changes needed

### Shopify — Optional
1. In your Shopify Admin: Settings → Apps and sales channels → Develop apps
2. Create a new app → Configure Admin API scopes:
   - `write_products`, `read_products`
   - `write_inventory`, `read_inventory`
3. Install the app → copy the Admin API access token
4. Add to `.env`:
   ```env
   SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
   SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxx
   ```

### Meta (Instagram + Facebook) — Optional
This requires a Facebook Developer account and a Business Manager setup.

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App
2. Add products: **Instagram Graph API** + **Facebook Pages API**
3. Get a long-lived token (60 days):
   - Use the [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Select your app → Generate User Access Token
   - Permissions needed: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
   - Exchange for long-lived token via: `GET /oauth/access_token?grant_type=fb_exchange_token&...`
4. Find your Instagram Business Account ID:
   - `GET /me/accounts` → find your Page ID
   - `GET /{page-id}?fields=instagram_business_account` → get Instagram account ID
5. Add to `.env`:
   ```env
   META_LONG_LIVED_TOKEN=EAAxxxxx
   META_TOKEN_CREATED_DATE=2026-05-22
   INSTAGRAM_BUSINESS_ACCOUNT_ID=12345678
   FACEBOOK_PAGE_ID=87654321
   ```

> **Token expiry:** Meta long-lived tokens expire after 60 days. The system warns you 7 days before expiry. Run `node lumiere.js status` to check. Refresh at: [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)

### Pinterest — Optional
1. Go to [developers.pinterest.com](https://developers.pinterest.com)
2. Create an app → Request access to the Pins API
3. Generate an access token with scopes: `pins:read`, `pins:write`, `boards:read`
4. Find your board IDs:
   - `GET /v5/boards` to list your boards
   - Note the `id` field for each board
5. Add to `.env`:
   ```env
   PINTEREST_ACCESS_TOKEN=your_token
   PINTEREST_BOARD_NEW_ARRIVALS=board_id_here
   PINTEREST_BOARD_GIRLS=board_id_here
   PINTEREST_BOARD_BABY=board_id_here
   ```

### TikTok — Optional (Approval Required)
TikTok's Content Posting API requires an application review process.

1. Apply at [developers.tiktok.com](https://developers.tiktok.com) → Content Posting API
2. While waiting: the system saves ready-to-use draft packages to `queue/tiktok/`
3. Once approved, set in `.env`:
   ```env
   TIKTOK_APPROVED=true
   TIKTOK_ACCESS_TOKEN=your_token
   ```

### Replicate (4K Upscaling) — Optional
1. Go to [replicate.com](https://replicate.com) → Account → API tokens
2. Copy token to `REPLICATE_API_KEY` in `.env`
3. Uses the Real-ESRGAN x4 model — free tier available

### Google AI Studio (Veo 3) — Optional (for prompt-only reference)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Get API Key → copy to `GOOGLE_AI_STUDIO_API_KEY` in `.env`
3. Note: Veo 3 video generation via API has limited availability. The system generates complete prompts you can paste directly into AI Studio.

---

## Usage

### Process a new product (full pipeline)

```bash
node lumiere.js add \
  --name "Mini Floral Summer Dress" \
  --price 299 \
  --age "3-6" \
  --season summer \
  --colours "blush,white" \
  --description "Lightweight cotton dress with floral print, elasticated waist, machine washable" \
  --images "https://example.com/img1.jpg,https://example.com/img2.jpg" \
  --push-shopify \
  --post-instagram \
  --pin-pinterest
```

**Flags:**
- `--push-shopify` — push product to Shopify (requires credentials)
- `--post-instagram` — schedule Instagram feed post (requires credentials)
- `--pin-pinterest` — create Pinterest pins (requires credentials)

### Interactive wizard (recommended for beginners)

```bash
node lumiere.js wizard
# or simply:
node lumiere.js
```

Walks you through each field with prompts. Best for quickly adding products without remembering all the flags.

### Generate weekly content calendar

```bash
node lumiere.js calendar --week current
node lumiere.js calendar --week next
```

Reads all processed products from `output/` and generates a 7-day content calendar.

### Regenerate copy only (no image processing)

```bash
node lumiere.js copy --product "meadow-linen-playsuit"
```

Re-runs Claude API for all copy for an existing product. Useful if you want to update tone or try new variations.

### Regenerate video prompts only

```bash
node lumiere.js prompts --product "meadow-linen-playsuit"
```

### Process TikTok publish queue (after API approval)

```bash
node lumiere.js tiktok-publish
```

Processes all items in `queue/tiktok/`. Each item must have an `.mp4` file in its folder before it will publish.

### Check API token health

```bash
node lumiere.js status
```

### View pending scheduled posts

```bash
node lumiere.js queue --show
```

---

## Daily Workflow — Product Drop Day

Here's the complete workflow for adding a new product and creating content for it:

**Morning (15–20 mins):**
1. Run the `add` command with your product details
2. The system generates all content — takes ~45–90 seconds
3. Open `output/[product-slug]/video-prompts.md`
4. Generate 2–3 video clips using Kling AI and/or Veo 3 (use Prompt 1 first)
5. Download the best takes

**Midday (20–30 mins):**
6. Open `output/[product-slug]/capcut-brief.md` in CapCut
7. Follow the brief step-by-step — colour grade, shot order, text overlays, music
8. Export as 1080×1920 MP4

**Posting (10 mins):**
9. Post the CapCut video to Instagram Reels + TikTok
10. Use `output/[product-slug]/copy-pack.md` for captions — everything is pre-written
11. If Shopify auto-push worked, product is already live — check your store
12. Pinterest pins publish automatically (if API is configured)

---

## Video Workflow — Kling AI

1. Open [klingai.com](https://klingai.com) → Video Generation
2. Select model: **kling-v2-master**
3. Set duration: **5 seconds**, aspect ratio: **9:16**, mode: **Pro**
4. Set CFG Scale to **0.5** — critical for photorealism
5. Open `video-prompts.md` → copy **FULL PROMPT** for Prompt 1 (Garden Golden Hour)
6. Paste into the Prompt field
7. Copy the **NEGATIVE PROMPT** → paste into the Negative Prompt field
8. Generate. Download the best result.
9. Repeat for Prompt 3 (Park Morning) if you need a second clip.

**Quality checklist before using a clip:**
- Fabric looks like real textile (not plastic or illustrated)
- Skin tones look natural (not AI-smooth or waxy)
- Light matches the described source
- Motion is fluid, not robotic

If a clip fails: regenerate with a different seed. The prompt is engineered correctly — variance in output is expected.

---

## Video Workflow — Google Veo 3

1. Open [aistudio.google.com](https://aistudio.google.com)
2. Select **Veo 3** in the model dropdown
3. Set aspect ratio to **9:16**
4. Enable **"Generate Audio"** — ambient sound adds significant realism
5. Open `video-prompts.md` → copy **FULL PROMPT** for Prompt 2 (Indoor Soft Light) or Prompt 4 (Beach)
6. Note: Veo 3 does not have a separate negative prompt field — the anti-AI instructions are baked into the main prompt
7. Generate and download

---

## CapCut Workflow

Your `capcut-brief.md` file is a complete shot-by-shot editing guide. Here's the overview:

1. **Import clips** into CapCut — your AI-generated videos + enhanced product images
2. **Apply colour grade** — use the Adjustment values in the brief exactly
3. **Assemble in order** — the brief has exact timestamps for each clip
4. **Add text overlays** — font, size, colour, and position are all specified
5. **Add music** — search the exact terms provided, set volume levels as instructed
6. **Add voiceover** (optional) — the script is in `copy-pack.md → TikTok → Full Script`
7. **Enable auto-captions** — settings are specified in the brief
8. **Export** as 1080×1920, 30fps MP4

**Pro tip:** Do the colour grade first, before anything else — it changes how you perceive the music and text choices.

---

## TikTok — Before API Approval

While your TikTok Content Posting API application is under review, use the manual workflow:

1. Open `queue/tiktok/[date]-[product-slug]/` or `output/[product-slug]/tiktok-draft/`
2. `caption.txt` — ready to paste directly into TikTok
3. Upload your edited video via the TikTok app
4. Paste the caption
5. Post at the recommended time from `calendar-entry.md`

### After API approval:
1. Set `TIKTOK_APPROVED=true` in `.env`
2. Add your edited MP4 to the draft folder: `queue/tiktok/[date]-[slug]/[product-name].mp4`
3. Run: `node lumiere.js tiktok-publish`

---

## Troubleshooting

### "AI provider key missing"
Add your Cerebras API key to `.env`: `CEREBRAS_API_KEY=your_key_here`. Get a free key at [cloud.cerebras.ai](https://cloud.cerebras.ai).

### "Shopify push failed: HTTP 401"
Your `SHOPIFY_ADMIN_API_TOKEN` is wrong or the app doesn't have `write_products` scope. Check Shopify Admin → Apps → Your App → API credentials.

### "Instagram container never finished"
The image URL must be publicly accessible. Local file paths won't work — you need a CDN or Shopify URL. The system saves `meta-queue.json` with all the data for manual posting.

### "Replicate timed out"
Real-ESRGAN can take up to 3 minutes. If it times out consistently, remove `REPLICATE_API_KEY` from `.env` — the system works fine without it (images are still warm-graded by Sharp).

### Brand voice violations still appearing after retries
The system retries twice and then flags for human review. Open `copy-pack.md` and manually edit the flagged sections. The forbidden word list is in `config/brand.js` if you want to adjust it.

### "No product found at output/[slug]/"
The slug is generated from the product name. Run `node lumiere.js status` to see what's in the output directory.

### Sharp install errors on Apple Silicon / Linux
Sharp requires platform-specific native binaries. If `npm install` fails on Sharp:
```bash
npm install --platform=linux --arch=x64 sharp
# or for Apple Silicon:
npm install --platform=darwin --arch=arm64 sharp
```

---

## Token Management

### Meta (Instagram + Facebook)
- Tokens expire after **60 days**
- The system tracks expiry from `META_TOKEN_CREATED_DATE` in `.env`
- Warnings appear 7 days before expiry
- Check anytime: `node lumiere.js status`

**To refresh:**
1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)
2. Generate a new User Access Token with the same permissions
3. Exchange for a new long-lived token
4. Update `META_LONG_LIVED_TOKEN` and `META_TOKEN_CREATED_DATE` in `.env`

### Pinterest
- Pinterest access tokens have longer lifespans but check your app's settings
- Refresh at [developers.pinterest.com/apps](https://developers.pinterest.com/apps)

---

## Output Folder Structure

After running `node lumiere.js add` for a product, you'll find:

```
output/
└── meadow-linen-playsuit/
    ├── 00-README.md              What's in this folder + quick start guide
    ├── images/
    │   ├── meadow-linen-playsuit-hero.jpg
    │   ├── meadow-linen-playsuit-detail-1.jpg
    │   └── composition-guide.md  Which image goes where
    ├── video-prompts.md          5 complete Kling AI + Veo 3 prompts
    ├── copy-pack.md              All written copy, every platform
    ├── capcut-brief.md           Step-by-step CapCut editing guide
    ├── shopify-payload.json      Shopify product data (auto-pushed or manual)
    ├── meta-queue.json           Instagram + Facebook post queue
    ├── pinterest-draft.json      Pinterest pin data
    ├── calendar-entry.md         This product's slot in the weekly calendar
    ├── product-meta.json         Internal metadata (do not edit manually)
    └── tiktok-draft/
        ├── caption.txt           Ready-to-paste TikTok caption
        ├── script.md             Full voiceover script
        └── prompts.md            Which video prompts to use
```

---

## Brand Configuration

All brand settings — tone rules, forbidden words, colours, fonts, posting times, hashtag packs — are in `config/brand.js`. Edit this file to update the brand voice for all future content generation.

The video prompt engine is in `config/prompts.js`. Each scenario (garden, indoor, park, beach, bedroom) can be customised to better fit your products.

---

## Test Product

Run this to test the full system without real API credentials:

```bash
node lumiere.js add \
  --name "Meadow Linen Playsuit" \
  --price 349 \
  --age "2-5" \
  --season summer \
  --colours "sage,white" \
  --description "Loose-fit linen playsuit with button front, wide-leg shorts, adjustable straps. Machine washable. 100% linen." \
  --images "https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=800,https://images.unsplash.com/photo-1503944168849-8bf86875bbd4?w=800"
```

Expected output: full `output/meadow-linen-playsuit/` folder with all assets. Shopify/Instagram/Pinterest pushes will be skipped gracefully (credentials not set) — all data is saved to the output folder for manual use.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ (ESM) |
| AI / Copy | Cerebras Inference API (`gpt-oss-120b`) |
| Image processing | Sharp (warm grade + grain) |
| 4K upscaling | Replicate Real-ESRGAN (optional) |
| Video prompts | Kling AI v2 + Google Veo 3 (prompt generation) |
| E-commerce | Shopify GraphQL Admin API 2026-04 |
| Social | Meta Graph API v21.0 (Instagram + Facebook) |
| Pinterest | Pinterest API v5 |
| TikTok | TikTok Content Posting API v2 (post-approval) |
| CLI | Commander.js + Inquirer.js |
| Logging | Chalk + Ora |

---

*Lumière Collection — Dressed in wonder.*
*Automation System v1.0*
