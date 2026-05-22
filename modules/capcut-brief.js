/**
 * Lumière Collection — CapCut Edit Brief Generator
 * Produces a complete, human-followable video editing brief for CapCut.
 */

import path from 'path';
import { writeFileSafe } from '../utils/file-utils.js';
import brand from '../config/brand.js';

/**
 * Generate a CapCut edit brief and save it to the output directory.
 * @param {object} product
 * @param {object} contentPack - Generated content from content-generator.js
 * @param {Array} imageFiles - Enhanced image file details
 * @param {string} outputDir
 * @returns {Promise<string>} Path to the written file
 */
export async function generateCapCutBrief(product, contentPack, imageFiles, outputDir) {
  const brief = buildBrief(product, contentPack, imageFiles);
  const outputPath = path.join(outputDir, 'capcut-brief.md');
  writeFileSafe(outputPath, brief);
  return outputPath;
}

/**
 * Build the full CapCut brief markdown document.
 */
function buildBrief(product, contentPack, imageFiles) {
  const heroImage = imageFiles[0]?.filename || 'hero.jpg';
  const tiktok = contentPack.tiktok || {};
  const soundMood = tiktok.soundMood || 'Upbeat, warm acoustic — light guitar or piano, 90–110 BPM, gentle positive energy';
  const hook = tiktok.hook || `${product.name} — for ages ${product.ageRange}.`;
  const script = tiktok.script || '';
  const onScreenText = Array.isArray(tiktok.onScreenText) ? tiktok.onScreenText : [];

  const videoClips = [
    { time: '0:00–0:03', type: 'HOOK CLIP', source: 'Kling/Veo3 Prompt 1 (Garden / Golden Hour)', text: hook, style: 'large, centre' },
    { time: '0:03–0:08', type: 'PRODUCT DETAIL', source: `Enhanced image: ${heroImage}`, text: null, style: null },
    { time: '0:08–0:14', type: 'LIFESTYLE CLIP', source: 'Kling/Veo3 Prompt 2 (Indoor Soft Light)', text: onScreenText[1]?.text || product.name, style: 'small, lower third' },
    { time: '0:14–0:18', type: 'PRICE + CTA', source: `Static: ${heroImage} with text overlay`, text: `R${product.price} | Shop the link 👇`, style: 'medium, animated' },
    { time: '0:18–0:22', type: 'END CARD', source: 'Brand colour background', text: `${brand.BRAND_NAME}\n${brand.BRAND_TAGLINE}`, style: 'brand font' },
  ];

  const musicSearchTerms = deriveMusicSearchTerms(soundMood, product.season);

  return `# CAPCUT EDIT BRIEF — ${product.name.toUpperCase()}

**Lumière Collection — Content Automation System**
Generated: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}

---

## TARGET SPECS
| | |
|---|---|
| Platform | TikTok + Instagram Reels |
| Dimensions | 1080 × 1920 (9:16 vertical) |
| Total Duration | 18–22 seconds |
| Frame Rate | 30fps |
| Export Quality | 1080p minimum |

---

## COLOUR GRADE
Apply in CapCut's Adjustment panel (or use a Film Warm LUT if available):

| Setting | Value | Why |
|---------|-------|-----|
| Exposure | -0.2 | Slightly darker = more cinematic |
| Contrast | +15 | Pop without harshness |
| Saturation | -8 | Film look, prevents garish colours |
| Highlights | -20 | Protect the bright areas |
| Shadows | +10 | Lift shadows for warmth |
| Temperature | +12 | Warmer overall |
| Tint | +3 | Slight magenta shift |
| Film Grain | 15% | Built-in CapCut overlay |

**LUT Option:** If using a CapCut template LUT, search "Film Grain Warm" — apply at 60% opacity.

---

## SHOT ORDER

${videoClips.map((clip) => buildClipBlock(clip)).join('\n\n')}

---

## AUDIO

**Sound Mood:** ${soundMood}

**CapCut Search Terms (try these in order until you find the right vibe):**
${musicSearchTerms.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

**Volume Levels:**
- Music under voiceover sections: **35%**
- Music in no-voice sections: **65%**
- Voiceover: **100%**
- Fade out: Start fade 2 seconds before end

**Audio Tip:** In CapCut, use "Volume" keyframes to automate the dip under voiceover.

---

## TRANSITIONS

| Transition | Type | Duration |
|-----------|------|----------|
| Between all clips | Cross-dissolve | 0.3 seconds |
| Into end card | Fade to white → fade in brand colour | 0.5 seconds |

**Why cross-dissolve:** Swipes and zooms are associated with low-effort content. A simple dissolve reads as editorial and intentional.

---

## TEXT OVERLAYS

| Timestamp | Text | Font | Size | Colour | Position |
|-----------|------|------|------|--------|----------|
| 0:00 | ${hook.slice(0, 50)} | Cormorant Garamond | 48 | Ivory #FAF7F0 | Centre-bottom |
| 0:08 | ${product.name} | Jost | 28 | Ivory #FAF7F0 | Lower third |
| 0:14 | R${product.price} \| Shop the link 👇 | Jost Bold | 36 | Gold #C9A84C | Centre |
| 0:18 | ${brand.BRAND_NAME} | Cormorant Garamond | 56 | Gold #C9A84C | Centre |
| 0:21 | ${brand.BRAND_TAGLINE} | Jost Light | 22 | Ivory #FAF7F0 | Centre-below-title |

**Font Note:** CapCut may not have Cormorant Garamond exactly — use "Playfair Display" or "Noto Serif Display" as the closest match. For Jost, use "Poppins" or "Nunito".

---

## VOICEOVER (OPTIONAL BUT RECOMMENDED)

**Script to record:**
> ${buildVoiceoverScript(product, hook, script)}

**Recording tips:**
- Record in a quiet room. Close windows, turn off fans.
- No ring-light hum. No echo (use a wardrobe/closet if needed).
- Speak unhurried — like you're recommending something to a friend.
- Pace: natural, not broadcast. Pauses between sentences.
- After recording, apply CapCut's **"Voice Enhance"** filter.

---

## CAPTIONS (AUTO-CAPTIONS)

1. Enable "Auto Captions" in CapCut
2. Select font closest to Cormorant Garamond (Playfair / Noto Serif Display)
3. Set caption text colour to **Ivory (#FAF7F0)**
4. Enable background pill: **Charcoal (#3D3535)** at 60% opacity
5. Position: **Lower third** — ensure no overlap with product image
6. Review and correct any mispronounced words (especially "Lumière")

---

## PRODUCT DETAIL SHOT (Ken Burns)

For the 0:03–0:08 static product image section:
- Import **${heroImage}** as a static clip
- Apply CapCut's "Ken Burns" animation
- Settings: Start zoom 100% → End zoom 108%
- Direction: Slow drift upward (to reveal product detail)
- Duration: 5 seconds

---

## END CARD SETUP

1. Add a solid colour background clip — **Blush #E8C4C4** (or use brand colour fill)
2. Duration: 4 seconds
3. Text 1: "${brand.BRAND_NAME}" — Cormorant Garamond equivalent, size 56, Gold #C9A84C, centred
4. Text 2: "${brand.BRAND_TAGLINE}" — Jost Light, size 22, Ivory #FAF7F0, below title
5. Animation: Fade in at 0.5s (not zoom, not bounce — understated)
6. Optional: Add brand logo if available, at 60% opacity

---

## EXPORT SETTINGS

| Setting | Value |
|---------|-------|
| Resolution | 1080 × 1920 |
| Frame Rate | 30fps |
| Quality | High (not "auto") |
| Format | MP4 |
| Remove CapCut Watermark | Yes (requires CapCut Pro) |

---

*This brief was generated by Lumière Collection Automation System.*
*Video prompts for all AI clips are in: \`video-prompts.md\`*
`;
}

function buildClipBlock(clip) {
  const textLine = clip.text
    ? `\n  **On-screen text:** "${clip.text}"\n  **Text style:** ${clip.style}`
    : '\n  **On-screen text:** none';

  return `### ${clip.time} — ${clip.type}
  **Source:** ${clip.source}${textLine}`;
}

function buildVoiceoverScript(product, hook, fullScript) {
  if (fullScript && fullScript.length > 20) return fullScript;

  const colours = Array.isArray(product.colours) ? product.colours[0] : product.colours;
  return `${hook} ${colours} — for ages ${product.ageRange}. R${product.price}. Link in bio.`;
}

function deriveMusicSearchTerms(soundMood, season) {
  const base = ['warm acoustic gentle', 'soft cinematic kids', 'cozy indie morning'];
  const seasonalTerms = {
    summer: ['sunny upbeat acoustic', 'summer light guitar', 'warm breezy instrumental'],
    winter: ['warm cozy acoustic', 'gentle winter piano', 'soft indie folk'],
    spring: ['fresh uplifting acoustic', 'spring morning piano', 'light airy instrumental'],
    autumn: ['autumn mellow acoustic', 'warm earthy folk', 'golden hour instrumental'],
  };

  const seasonal = seasonalTerms[season?.toLowerCase()] || base;

  // Extract keywords from the soundMood description
  const moodWords = soundMood.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 4).slice(0, 3);
  const moodTerm = moodWords.join(' ');

  return [moodTerm || base[0], seasonal[0], seasonal[1]];
}
