/**
 * Lumière Collection — Brand Configuration
 * Single source of truth for brand identity, tone rules, and scheduling data.
 */

const brand = {
  BRAND_NAME: 'Lumière Collection',
  BRAND_TAGLINE: 'Dressed in wonder.',
  BRAND_URL: 'lumierecollection.co.za',

  BRAND_COLOURS: {
    blush: '#E8C4C4',
    ivory: '#FAF7F0',
    gold: '#C9A84C',
    charcoal: '#3D3535',
  },

  BRAND_FONTS: {
    display: 'Cormorant Garamond',
    body: 'Jost',
  },

  TARGET_AUDIENCE: 'Parents aged 24–40, value aesthetics and quality for their children',
  NICHE: "Children's clothing and apparel, ages 0–12",

  /**
   * Tone and voice rules enforced in every AI call.
   * DO rules describe the target voice.
   * DONT rules prevent common AI writing patterns.
   */
  BRAND_TONE_RULES: [
    "DO: Write like a warm, trusted friend who has excellent taste in children's clothing",
    'DO: Use short, punchy sentences with real human rhythm',
    'DO: Lead with the child experience — what it feels like to wear, play, run, explore',
    'DO: Reference real moments parents recognise (muddy knees, impromptu picnics, school gate rushes)',
    'DO: Treat the parent as a sensible adult, not someone who needs convincing',
    'DO: Let price confidence show — no apologising, no hedging',
    "DO: Mention fabric and practicality naturally — parents care about what goes in the washing machine",
    "DONT: Start sentences with 'Introducing...' or 'Meet the...'",
    "DONT: Use the passive voice ('is designed to', 'was crafted to')",
    "DONT: Stack three adjectives before a noun ('soft, dreamy, lightweight fabric')",
    "DONT: End with a generic CTA like 'Shop now and elevate your little one's wardrobe'",
    "DONT: Describe the brand as 'luxury' or 'premium' — show it, don't say it",
    'DONT: Use alliteration or rhyming product descriptions',
    'DONT: Use em-dashes for dramatic effect mid-sentence — it reads as AI',
    "DONT: Start with 'When it comes to...' or 'Whether you...'",
  ],

  FORBIDDEN_WORDS: [
    'amazing',
    'stunning',
    'perfect',
    'incredible',
    'game-changer',
    'game changer',
    'elevate',
    'curated',
    'bespoke',
    'seamlessly',
    'revolutionize',
    'revolutionise',
    'meticulously',
    'carefully crafted',
    'thoughtfully designed',
    'unparalleled',
    'unrivalled',
    'unrivaled',
    'luxury',
    'premium',
    'exceptional',
    'exquisite',
    'magnificent',
    'delightful',
    'timeless',
    'effortlessly',
    'impeccable',
    'breathtaking',
    'little one',
    'little ones',
  ],

  /**
   * Optimal posting times in SAST (UTC+2).
   * Based on South African parent audience engagement data.
   */
  POSTING_TIMES_SAST: {
    instagramFeed: ['07:00', '12:30', '19:00'],
    instagramReels: ['08:00', '17:00', '20:00'],
    instagramStories: ['09:00', '14:00', '21:00'],
    facebook: ['08:00', '13:00', '16:00'],
    tiktok: ['07:00', '12:00', '19:00', '21:00'],
    pinterest: ['20:00', '21:00', '22:00'],
  },

  HASHTAG_PACKS: {
    niche: [
      '#kidsootd',
      '#kidsclothing',
      '#kidsfashion',
      '#childrensfashion',
      '#girlsclothing',
      '#boysclothing',
      '#babyootd',
      '#babyclothes',
      '#toddlerootd',
      '#toddlerfashion',
      '#kidsstyle',
      '#babystyle',
      '#momlife',
      '#momstyle',
      '#saparents',
      '#joburggirls',
      '#capetownkids',
    ],
    broad: [
      '#ootd',
      '#instakids',
      '#cutekids',
      '#kidsofinstagram',
      '#childhood',
      '#parenthood',
      '#motherhood',
      '#families',
      '#childhoodunplugged',
      '#letthembelittle',
      '#simplechildhood',
      '#slowchildhood',
    ],
    seasonal: {
      summer: ['#summeroutfit', '#summervibes', '#beachready', '#hotdays', '#summerwardrobe'],
      winter: ['#winterlayers', '#cozylooks', '#kidscoats', '#warmdays', '#winterwardrobe'],
      spring: ['#springlooks', '#floralprint', '#freshlook', '#newseason'],
      autumn: ['#autumnlook', '#fallstyle', '#earthtones', '#autumnkids'],
    },
    brand: ['#lumierecollection', '#dressedinwonder', '#lumierekids'],
  },

  /**
   * Allowed emojis (use max 2 per caption)
   */
  ALLOWED_EMOJIS: ['✨', '🌿', '🧡', '💛', '🌸', '👶', '👗'],

  /**
   * Age-range board mapping for Pinterest
   */
  PINTEREST_AGE_BOARDS: {
    '0-2': 'PINTEREST_BOARD_BABY',
    '2-4': 'PINTEREST_BOARD_BABY',
    '3-6': 'PINTEREST_BOARD_GIRLS',
    '4-7': 'PINTEREST_BOARD_GIRLS',
    '7-12': 'PINTEREST_BOARD_GIRLS',
    default: 'PINTEREST_BOARD_NEW_ARRIVALS',
  },
};

export default brand;
