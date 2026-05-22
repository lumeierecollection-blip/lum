/**
 * Lumière Collection — Video Prompt Engine
 * Generates hyperrealistic Kling AI + Google Veo 3 prompts for every product.
 * All 8 layers are enforced. Incomplete prompts produce AI-looking output.
 */

import path from 'path';
import { generateVideoPrompts } from '../config/prompts.js';
import { writeFileSafe } from '../utils/file-utils.js';
import logger from '../utils/logger.js';

/**
 * Generates 5 video prompts for a product and writes video-prompts.md.
 * @param {object} product - Full product object
 * @param {string} outputDir - Product output directory
 * @returns {Promise<string>} Path to the written file
 */
export async function generateAndSaveVideoPrompts(product, outputDir) {
  const prompts = generateVideoPrompts(product);
  const content = buildVideoPromptsDocument(product, prompts);

  const outputPath = path.join(outputDir, 'video-prompts.md');
  writeFileSafe(outputPath, content);

  return outputPath;
}

/**
 * Builds the full video-prompts.md document.
 * @param {object} product
 * @param {Array} prompts
 * @returns {string}
 */
function buildVideoPromptsDocument(product, prompts) {
  const header = buildHeader(product);
  const checklist = buildHyperrealismChecklist();
  const promptSections = prompts.map((p, i) => buildPromptSection(p, i + 1)).join('\n\n---\n\n');

  return `${header}\n\n${checklist}\n\n---\n\n${promptSections}\n\n${buildWorkflowNotes()}`;
}

function buildHeader(product) {
  return `# VIDEO PROMPTS — ${product.name.toUpperCase()}
**Lumière Collection — Content Automation System**
Generated: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}

**Product:** ${product.name}
**Age Range:** ${product.ageRange}
**Season:** ${product.season}
**Colours:** ${Array.isArray(product.colours) ? product.colours.join(', ') : product.colours}

> These prompts are engineered for maximum photorealism.
> Use them verbatim. Do NOT simplify or shorten — every word is doing work.`;
}

function buildHyperrealismChecklist() {
  return `## HYPERREALISM CHECKLIST
Before generating, confirm every prompt contains all 8 layers:

- [ ] **Layer 1 — Subject specificity:** Specific child age, hair, energy — not "a child"
- [ ] **Layer 2 — Clothing integration:** Fabric is part of the action, not just described
- [ ] **Layer 3 — Environmental realism:** Named setting with textures, depth, specific details
- [ ] **Layer 4 — Lighting specification:** Named light quality, time of day, temperature
- [ ] **Layer 5 — Camera language:** Focal length, aperture, movement, framing
- [ ] **Layer 6 — Motion and timing:** Natural, candid behaviour — child unaware of camera
- [ ] **Layer 7 — Anti-AI instructions:** Explicitly states photorealistic, not illustrated/animated
- [ ] **Layer 8 — Duration and format:** Exact seconds and aspect ratio

**What makes these prompts fail (avoid):**
- Using "a child" instead of a specific age and physical description
- Describing clothing as static ("she is wearing") vs active ("the fabric brushes the grass")
- Generic settings ("a park", "indoors") — specificity = realism
- No camera language — AI defaults to flat, neutral composition
- No anti-AI instructions — Kling/Veo3 will default to illustrated or stylised output`;
}

function buildPromptSection(prompt, index) {
  const settingsBlock = buildSettingsBlock(prompt);

  return `## PROMPT ${index} — ${prompt.label}
**Platform:** ${prompt.platform}

${settingsBlock}

### FULL PROMPT
\`\`\`
${prompt.fullPrompt}
\`\`\`

### NEGATIVE PROMPT
\`\`\`
${prompt.negativePrompt}
\`\`\``;
}

function buildSettingsBlock(prompt) {
  const s = prompt.platform_settings;

  if (prompt.platform.includes('Kling')) {
    return `**KLING SETTINGS:**
| Setting | Value |
|---------|-------|
| Model | \`${s.model}\` |
| Duration | \`${s.duration}\` |
| Aspect Ratio | \`${s.aspect_ratio}\` |
| Mode | \`${s.mode}\` |
| CFG Scale | \`${s.cfg_scale}\` (lower = more realistic) |

> **Tip:** In Kling AI Studio, paste the full prompt into the "Prompt" field.
> Paste the negative prompt into the "Negative Prompt" field.
> Set CFG Scale to ${s.cfg_scale} — this is critical for photorealism.`;
  }

  if (prompt.platform.includes('Veo') || prompt.platform.includes('Google')) {
    return `**VEO 3 SETTINGS (Google AI Studio):**
| Setting | Value |
|---------|-------|
| Duration | \`${s.duration}\` |
| Aspect Ratio | \`${s.aspect_ratio}\` |
| Generate Audio | \`${s.generate_audio ? 'Yes' : 'No'}\` |
| Audio Note | ${s.audio_note || 'N/A'} |

> **Tip:** In Google AI Studio, select Veo 3. Paste the full prompt.
> Enable "Generate Audio" for ambient sound — it adds significant realism.
> Veo 3 does not have a separate negative prompt field — anti-AI instructions
> are baked into the main prompt text above.`;
  }

  return '';
}

function buildWorkflowNotes() {
  return `---

## VIDEO WORKFLOW GUIDE

### Using Kling AI (prompts 1, 3, 5)
1. Go to [klingai.com](https://klingai.com) → Video Generation
2. Select **kling-v2-master** model
3. Set duration and aspect ratio as specified above
4. Paste the full prompt — do not edit or shorten
5. Paste the negative prompt
6. Set CFG Scale to 0.5
7. Generate. Download the best take (generate 2–3 variants).

### Using Google Veo 3 (prompts 2, 4)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Select **Veo 3** model
3. Set aspect ratio to 9:16
4. Enable audio generation
5. Paste the full prompt
6. Generate. Download the result.

### After Generation — Quality Check
Before using any clip, confirm:
- [ ] Fabric looks like real textile (not plastic or illustrated)
- [ ] Skin tones look natural (not AI-smooth or waxy)
- [ ] Light matches the described source (not studio flat)
- [ ] Child's face, if visible, looks natural (no uncanny valley)
- [ ] Motion is fluid, not robotic or stuttery

If a clip fails the check: regenerate with a slightly different seed, or use the next prompt variant.

### Once You Have Your Clips
Open your **CapCut edit brief** in \`capcut-brief.md\` for exact assembly instructions.
`;
}
