/**
 * Lumière Collection — Prompt Templates
 * All AI system prompts and video AI prompt generators.
 * This file is the creative engine of the entire system.
 */

import brand from './brand.js';

// ─────────────────────────────────────────────────────────────
// VIDEO PROMPT ENGINE
// Each prompt uses all 8 layers for hyperrealistic output
// ─────────────────────────────────────────────────────────────

const VIDEO_SCENARIOS = [
  {
    id: 1,
    label: 'GARDEN PLAY — GOLDEN HOUR',
    platform: 'Kling AI',
    setting: 'a sun-dappled suburban garden in late morning, brick patio edge visible in background, out-of-focus hydrangeas in blush and white',
    time: 'golden hour, 1 hour before sunset, warm amber light raking across the scene',
    motion: 'child crouching to examine something small on the ground, slow natural movement, completely unaware of camera',
    camera: 'handheld camera with subtle natural motion, 35mm equivalent lens, shallow depth of field f/1.8, subject sharp, background pleasingly blurred',
    platform_settings: {
      model: 'kling-v2-master',
      duration: '5s',
      aspect_ratio: '9:16',
      mode: 'pro',
      cfg_scale: 0.5,
    },
  },
  {
    id: 2,
    label: 'INDOOR SOFT LIGHT — WINDOW MORNING',
    platform: 'Google Veo 3',
    setting: 'a bright Scandinavian-style living room, white linen sofa partially visible, soft shadows from a large sash window, wooden floor with a round wool rug',
    time: 'mid-morning natural light, overcast sky outside creating even, diffused window light, no harsh shadows anywhere',
    motion: 'child leafing through a picture book, looking up briefly then returning to the page, natural fidgeting, unselfconscious',
    camera: '50mm equivalent lens, camera static on slight low angle looking up, shallow depth of field f/2.0, very subtle focus breathing',
    platform_settings: {
      duration: '8s',
      aspect_ratio: '9:16',
      generate_audio: true,
      audio_note: 'ambient room sounds — pages turning, faint birds outside',
    },
  },
  {
    id: 3,
    label: 'PARK MORNING — SOFT OVERCAST',
    platform: 'Kling AI',
    setting: 'a quiet city park in the morning, dewy grass, a wooden bench out of focus in background, oak tree casting soft dappled shade',
    time: 'soft overcast morning light, 9am, cool clean air quality visible in the light, no direct sun',
    motion: 'child running away from camera then turning back to laugh, natural candid energy, hair and fabric moving with the run',
    camera: 'slight telephoto 85mm equivalent, handheld tracking motion, motion blur on background emphasising movement, subject sharp at peak of turn',
    platform_settings: {
      model: 'kling-v2-master',
      duration: '5s',
      aspect_ratio: '9:16',
      mode: 'pro',
      cfg_scale: 0.5,
    },
  },
  {
    id: 4,
    label: 'BEACH — GOLDEN HOUR',
    platform: 'Google Veo 3',
    setting: 'a wide, uncrowded beach at low tide, wet sand reflecting the sky, small waves in far background, no other people visible',
    time: 'golden hour 30 minutes before sunset, warm golden-orange light, long soft shadows on the sand',
    motion: 'child walking slowly along the shoreline, picking something up, examining it — completely absorbed, no performance for camera',
    camera: 'handheld 35mm equivalent, low angle (camera near sand level), subject silhouetted and lit from behind with rim lighting on hair and fabric edges',
    platform_settings: {
      duration: '8s',
      aspect_ratio: '9:16',
      generate_audio: true,
      audio_note: 'gentle waves, light wind, no music',
    },
  },
  {
    id: 5,
    label: 'BEDROOM — EARLY MORNING NATURAL LIGHT',
    platform: 'Kling AI',
    setting: "a child's bedroom with linen curtains filtering early morning light, a low wooden bed with white cotton sheets, a small bookshelf visible, plants on windowsill",
    time: 'early morning 7am light through sheer linen curtains, soft and directional, very warm colour temperature',
    motion: 'child waking up, stretching, then noticing something outside the window and sitting up to look — natural and unhurried',
    camera: 'static camera on tripod, 35mm equivalent, eye-level with the bed, shallow depth of field, slight warmth in colour profile',
    platform_settings: {
      model: 'kling-v2-master',
      duration: '5s',
      aspect_ratio: '9:16',
      mode: 'pro',
      cfg_scale: 0.5,
    },
  },
];

const CHILD_AGES = {
  '0-2': { description: 'a curious 14-month-old with wispy light hair', pronoun: 'she' },
  '2-5': { description: 'a curious 3-year-old with loose dark curls', pronoun: 'she' },
  '3-6': { description: 'a bright-eyed 4-year-old girl with loose dark curls', pronoun: 'she' },
  '4-7': { description: 'an active 5-year-old boy with tousled sandy hair', pronoun: 'he' },
  '7-12': { description: 'a thoughtful 9-year-old girl with braided hair', pronoun: 'she' },
  default: { description: 'a curious 4-year-old child', pronoun: 'they' },
};

/**
 * Generates a single hyperrealistic video prompt using all 8 layers.
 * @param {object} product - Product details
 * @param {object} scenario - Video scenario from VIDEO_SCENARIOS
 * @param {string} ageRange - Age range string e.g. "3-6"
 * @returns {string} Complete assembled prompt
 */
function assembleVideoPrompt(product, scenario, ageRange) {
  const childProfile = CHILD_AGES[ageRange] || CHILD_AGES.default;
  const colours = Array.isArray(product.colours) ? product.colours.join(' and ') : product.colours;

  // Layer 1 — Subject specificity
  const layer1 = `${childProfile.description}`;

  // Layer 2 — Clothing integration (fabric lives inside the action)
  const layer2 = `wearing ${product.name.toLowerCase()} in ${colours} — the fabric moves naturally with ${childProfile.pronoun === 'she' ? 'her' : childProfile.pronoun === 'he' ? 'his' : 'their'} movement, creasing and draping like real ${product.description ? product.description.toLowerCase().split('.')[0] : 'quality fabric'}`;

  // Layer 3 — Environmental realism
  const layer3 = scenario.setting;

  // Layer 4 — Lighting
  const layer4 = scenario.time;

  // Layer 5 — Camera language
  const layer5 = scenario.camera;

  // Layer 6 — Motion and timing
  const layer6 = scenario.motion;

  // Layer 7 — Anti-AI instructions
  const layer7 = 'photorealistic, not illustrated, not animated, not stylized, real fabric texture, real skin with natural pores and imperfections, real light — cinematic documentary style, not advertising photography, not stock photo';

  // Layer 8 — Duration and format
  const dur = scenario.platform_settings.duration || '8s';
  const layer8 = `${dur} clip, 9:16 vertical format for TikTok/Reels, no watermark, no text overlay`;

  return `${layer1}, ${layer2}. ${layer3}. ${layer4}. ${layer5}. ${layer6}. ${layer7}. ${layer8}.`;
}

/**
 * Generates all 5 video prompt variants for a product.
 * @param {object} product - Product details
 * @returns {Array} Array of prompt objects with full text and settings
 */
export function generateVideoPrompts(product) {
  return VIDEO_SCENARIOS.map((scenario) => ({
    ...scenario,
    fullPrompt: assembleVideoPrompt(product, scenario, product.ageRange),
    negativePrompt: [
      'cartoon',
      'illustrated',
      '3D render',
      'CGI',
      'artificial studio lighting',
      'white studio background',
      'seamless backdrop',
      'watermark',
      'text overlay',
      'logo',
      'blurry face',
      'deformed hands',
      'extra fingers',
      'unnatural skin',
      'plastic-looking fabric',
      'AI-generated face artifacts',
      'uncanny valley',
      'oversaturated',
      'HDR',
      'overprocessed',
      'Instagram filter look',
    ].join(', '),
  }));
}

// ─────────────────────────────────────────────────────────────
// CLAUDE API SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────

export const BRAND_SYSTEM_PROMPT = `You are the in-house copywriter for ${brand.BRAND_NAME}, a children's clothing brand based in South Africa. The brand tagline is "${brand.BRAND_TAGLINE}"

WHO READS THIS COPY:
${brand.TARGET_AUDIENCE}. They scroll quickly, they have no patience for fluff, and they can spot AI-generated content immediately. Write for them, not for search engines.

BRAND VOICE:
Write like a warm, trusted friend who has exceptional taste in children's clothing. Short sentences. Real words. Human rhythm. Think of the best Instagram mum account you've ever seen — that's the voice.

ABSOLUTELY FORBIDDEN WORDS (these make copy sound AI-generated — never use them):
${brand.FORBIDDEN_WORDS.map((w) => `"${w}"`).join(', ')}

FORBIDDEN PATTERNS:
- Never start with "Introducing..." or "Meet the..."
- Never use the passive voice: "is designed to", "was crafted to", "has been carefully..."
- Never stack three adjectives before a noun
- Never end with a generic "Shop now and elevate your little one's wardrobe"
- Never use "little one" or "little ones" — it's patronising
- Never use em-dashes for dramatic effect mid-sentence
- Never start with "When it comes to..." or "Whether you..."
- No alliteration in product names or descriptions

EXAMPLE — BAD (AI-sounding):
"Introducing the stunning Meadow Linen Playsuit — a carefully curated piece that seamlessly blends effortless style with unparalleled comfort. Perfect for your little one, this meticulously crafted garment will elevate their wardrobe."

EXAMPLE — GOOD (human, on-brand):
"Linen in summer. That's the whole answer. This playsuit is loose where it needs to be, cool when it matters, and somehow still looks put-together at 4pm after the park."

EXAMPLE — BAD Instagram caption:
"✨ Stunning new arrivals just dropped! Our amazing Meadow Linen Playsuit is the perfect addition to your little one's summer wardrobe. Shop now and elevate their style! 🌿"

EXAMPLE — GOOD Instagram caption:
"Sage green and a warm day. That's all you need. 🌿 The linen playsuit that doesn't need ironing — and the one she won't take off."

ALWAYS OUTPUT VALID JSON when asked for structured data. Do not add markdown code fences around JSON unless specifically asked.`;

// ─────────────────────────────────────────────────────────────
// COPY PROMPT TEMPLATES
// ─────────────────────────────────────────────────────────────

/**
 * @param {string} productName
 * @param {string} ageRange
 */
export function shopifyProductTitle(productName, ageRange) {
  return `Write a Shopify product title for "${productName}" (ages ${ageRange}).

Rules:
- Maximum 60 characters
- Include the age range naturally (e.g. "Ages 2–5" not "(2-5 years old)")
- No brand name in title (it's on the store)
- Natural, searchable language — how a parent would search for this
- No exclamation marks

Return ONLY the title text. No quotes, no explanation.`;
}

/**
 * @param {object} productDetails
 */
export function shopifyDescription(productDetails) {
  return `Write a Shopify product description for the following children's clothing item:

Product: ${productDetails.name}
Age range: ${productDetails.ageRange}
Season: ${productDetails.season}
Colours: ${Array.isArray(productDetails.colours) ? productDetails.colours.join(', ') : productDetails.colours}
Material/Details: ${productDetails.description}
Price: R${productDetails.price}

Rules:
- 80 to 120 words exactly
- Written to the parent, not the child
- Lead with how it feels to wear it / what real life situation it solves
- Include one specific practical detail (machine washable, adjustable straps, etc.)
- End with one line about the child's experience wearing it — keep it real, not sentimental
- No bullet points in the description body (those come separately)
- No forbidden words

Return ONLY the description text. No heading, no quotes, no explanation.`;
}

/**
 * @param {object} productDetails
 */
export function shopifyBulletPoints(productDetails) {
  return `Write 5 product bullet points for: ${productDetails.name}

Material/Details: ${productDetails.description}
Age range: ${productDetails.ageRange}

Each bullet: feature first, then the specific parent-relevant benefit.
Format: "Feature — specific benefit"

Examples of good bullets:
- "100% linen — breathable in 35°C heat without synthetic feel against skin"
- "Adjustable shoulder straps — fits through growth spurts, not just one season"
- "Machine washable on 30°C — no special care, just wash and wear"

Return as a JSON array of 5 strings. No markdown, just the array.`;
}

/**
 * @param {object} productDetails
 */
export function shopifyMetaTags(productDetails) {
  return `Write SEO meta tags for a Shopify product page:

Product: ${productDetails.name}
Age range: ${productDetails.ageRange}
Season: ${productDetails.season}
Description summary: ${productDetails.description}

Return a JSON object with exactly these keys:
{
  "metaTitle": "max 60 chars, natural search language",
  "metaDescription": "max 155 chars, includes age range and key feature, conversational not robotic",
  "tags": ["array", "of", "8-12", "shopify", "tags", "lowercase", "no-hyphens"]
}

No markdown fences. Return only the JSON object.`;
}

/**
 * @param {object} productDetails
 * @param {'story'|'feature'|'ugc'} captionType
 */
export function instagramCaption(productDetails, captionType) {
  const typeInstructions = {
    story: `STORY caption: Lead with a real-life moment a parent will recognise. The product is mentioned but not the focus — the child's experience is. End with a question or observation, not a CTA. 2 sentences max before the line break.`,
    feature: `FEATURE caption: Lead with the most useful thing about this product. Second sentence: when/why you'd buy it. Short. No fluff. Optional: 1 emoji from this approved list only: ✨ 🌿 🧡 💛 🌸`,
    ugc: `UGC caption: Write as if a real mum is posting this. First person. Casual. Specific about one thing she loves. Include "from @lumierecollection" naturally. Feels like a real review, not a gifted post.`,
  };

  return `Write an Instagram caption for this product:

Product: ${productDetails.name}
Age range: ${productDetails.ageRange}
Season: ${productDetails.season}
Key detail: ${productDetails.description}
Colours: ${Array.isArray(productDetails.colours) ? productDetails.colours.join(', ') : productDetails.colours}

Caption type: ${captionType.toUpperCase()}
${typeInstructions[captionType]}

Rules:
- Maximum 2 emojis total, only from: ✨ 🌿 🧡 💛 🌸 👶 👗
- No forbidden words
- No "little one"
- Ends before the hashtag block (no hashtags in caption body)
- 3–5 lines maximum

Return ONLY the caption text. No quotes, no explanation.`;
}

/**
 * @param {object} productDetails
 * @param {string} season
 */
export function instagramHashtags(productDetails, season) {
  return `Generate 28–30 Instagram hashtags for this product:

Product: ${productDetails.name}
Age range: ${productDetails.ageRange}
Season: ${season}
Colours: ${Array.isArray(productDetails.colours) ? productDetails.colours.join(', ') : productDetails.colours}

Mix:
- 8–10 niche children's fashion tags
- 8–10 broad parenting/lifestyle tags
- 3–4 South Africa specific tags
- 2–3 seasonal tags
- 3 brand tags: #lumierecollection #dressedinwonder #lumierekids
- 1–2 colour/style specific tags

Format: one block of hashtags starting with # each, space separated.
No line breaks within the block. Return ONLY the hashtag string.`;
}

/**
 * @param {object} productDetails
 */
export function tiktokScript(productDetails) {
  return `Write a TikTok video script for this product:

Product: ${productDetails.name}
Price: R${productDetails.price}
Age range: ${productDetails.ageRange}
Key detail: ${productDetails.description}
Colours: ${Array.isArray(productDetails.colours) ? productDetails.colours.join(', ') : productDetails.colours}

Return a JSON object with exactly these keys:
{
  "hook": "First 3 seconds — one punchy line, spoken aloud. Must stop the scroll. No brand name yet. Lead with the parent's problem or desire.",
  "script": "Full voiceover script, 15–20 seconds total when spoken at natural pace. Hook + 2 key features + price mention + CTA. Written to be SPOKEN, not read. Short sentences. Natural pauses.",
  "onScreenText": [
    {"timestamp": "0:00", "text": "on-screen text at this moment", "style": "large/small"},
    {"timestamp": "0:03", "text": "...", "style": "..."}
  ],
  "hashtags": "28 TikTok hashtags — mix of fyp tags, niche kids fashion, SA-specific",
  "soundMood": "2-sentence description of the music mood for CapCut search. Specific: tempo, instruments, vibe."
}

No markdown fences. Return only the JSON object.`;
}

/**
 * @param {object} productDetails
 */
export function pinterestPin(productDetails) {
  return `Write Pinterest pin content for:

Product: ${productDetails.name}
Price: R${productDetails.price}
Age range: ${productDetails.ageRange}
Season: ${productDetails.season}
Description: ${productDetails.description}
Colours: ${Array.isArray(productDetails.colours) ? productDetails.colours.join(', ') : productDetails.colours}

Return a JSON object:
{
  "pinTitle": "max 100 chars, SEO-optimised, includes age and season naturally",
  "pinDescription": "300–500 chars. Keyword-rich but readable. Include: product name, age range, key feature, colour, season, price range, brand name. End with the website URL anchor text.",
  "boardSuggestion": "which board this pin belongs on and why (one sentence)"
}

No markdown fences. Return only the JSON object.`;
}

/**
 * @param {object} productDetails
 */
export function facebookCaption(productDetails) {
  return `Write a Facebook post caption for a children's clothing brand:

Product: ${productDetails.name}
Price: R${productDetails.price}
Age range: ${productDetails.ageRange}
Description: ${productDetails.description}

Facebook audience: slightly older parents (28–42), community-minded, more likely to share than Instagram users. Slightly longer than Instagram. Can include a question to encourage comments.

Rules:
- 4–7 lines
- More conversational, less aesthetic than Instagram
- Include price naturally (not as a hard sell)
- End with a question that invites comments ("Anyone else...?" / "Tag a mum who would love this")
- Max 5–8 hashtags after the caption body (not 30 like Instagram)
- No forbidden words

Return a JSON object:
{
  "caption": "the full caption text",
  "hashtags": "#5to8hashtags separated by spaces"
}

No markdown fences. Return only the JSON.`;
}

/**
 * @param {object} productDetails
 */
export function emailSubjectLines(productDetails) {
  return `Write 3 email subject line variants for a product launch email:

Product: ${productDetails.name}
Price: R${productDetails.price}
Age range: ${productDetails.ageRange}
Season: ${productDetails.season}

Variant A: Curiosity-led (doesn't mention the product name, teases the outcome or feeling)
Variant B: Direct product announcement (clear, informational, includes price)
Variant C: Urgency or social proof angle

Rules:
- All under 50 characters
- No forbidden words
- No ALL CAPS
- No excessive punctuation

Also write a preview text (90 chars max) that complements Variant A.

Return a JSON object:
{
  "subjectA": "...",
  "subjectB": "...",
  "subjectC": "...",
  "previewText": "..."
}

No markdown fences. Return only the JSON.`;
}

/**
 * @param {object} productDetails
 * @param {string} imageNumber - e.g. "hero", "detail-1"
 */
export function productAltText(productDetails, imageNumber) {
  return `Write accessibility alt text for a product image.

Product: ${productDetails.name}
Image position: ${imageNumber}
Age range: ${productDetails.ageRange}
Colours: ${Array.isArray(productDetails.colours) ? productDetails.colours.join(' and ') : productDetails.colours}
Description: ${productDetails.description}

Alt text rules:
- Describe what's visually in the image (as if to someone who can't see it)
- Include the product name and key visual details
- 125 characters max
- No marketing language
- Start with the product type, not the brand name

Return ONLY the alt text string. No quotes, no explanation.`;
}

export { VIDEO_SCENARIOS, CHILD_AGES };
