/* ──────────────────────────────────────────────────────────
   LUMIÈRE COLLECTION — Mobile-First SPA
   Vanilla JS, ES6+, no framework
   ────────────────────────────────────────────────────────── */

'use strict';

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────

const state = {
  products: [],
  status: null,
  currentSlug: null,
  currentProduct: null,
  currentContentPack: null,
  currentPlatform: 'instagram',
  selectedDay: null,          // Date object for schedule view
  queue: { scheduled: [], tiktokDrafts: [] },
  addStep: 0,
};

// ─────────────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────────────

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function mk(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, duration = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─────────────────────────────────────────────────────────────
// COPY TO CLIPBOARD
// ─────────────────────────────────────────────────────────────

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => showToast('Copy failed — try long-pressing'));
}

// Build a copy block: text + full-width copy button
function copyBlock(text) {
  const wrap = mk('div', 'copy-block');
  const pre = mk('div', 'copy-block-inner');
  pre.textContent = text;
  const btn = mk('button', 'copy-btn', 'Copy');
  btn.onclick = () => copyText(text, btn);
  wrap.appendChild(pre);
  wrap.appendChild(btn);
  return wrap;
}

// Section container
function section(title) {
  const s = mk('div', 'content-section');
  if (title) {
    const h = mk('div', 'content-section-title', title);
    s.appendChild(h);
  }
  return s;
}

// ─────────────────────────────────────────────────────────────
// DATE / FORMAT HELPERS
// ─────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function platformEmoji(p) {
  const m = {
    instagram: '📸', tiktok: '🎵', pinterest: '📌',
    shopify: '🛍️', facebook: '💙', email: '✉️',
    video: '🎬', capcut: '✂️',
  };
  return m[p] || '📋';
}

// ─────────────────────────────────────────────────────────────
// SHEET / OVERLAY MANAGEMENT
// ─────────────────────────────────────────────────────────────

let openSheets = [];

function openSheet(sheetId) {
  const sheet = $(`#${sheetId}`);
  const overlay = $('#sheetOverlay');
  if (!sheet) return;
  sheet.classList.add('open');
  overlay.classList.add('active');
  if (!openSheets.includes(sheetId)) openSheets.push(sheetId);
}

function closeSheet(sheetId) {
  const sheet = $(`#${sheetId}`);
  if (!sheet) return;
  sheet.classList.remove('open');
  openSheets = openSheets.filter(id => id !== sheetId);
  if (openSheets.length === 0) {
    $('#sheetOverlay').classList.remove('active');
  }
}

function closeAllSheets() {
  openSheets.slice().forEach(id => closeSheet(id));
}

// Overlay tap closes topmost sheet
$('#sheetOverlay').addEventListener('click', () => {
  const top = openSheets[openSheets.length - 1];
  if (top) closeSheet(top);
});

// ─────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────

function switchView(viewName) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.bnav-item').forEach(n => n.classList.remove('active'));

  const view = $(`#view-${viewName}`);
  const navBtn = $(`.bnav-item[data-view="${viewName}"]`);
  if (view) view.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  if (viewName === 'schedule') renderScheduleView();
  if (viewName === 'queue')    loadQueue();
  if (viewName === 'settings') renderSettings();
}

$$('.bnav-item').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

// ─────────────────────────────────────────────────────────────
// FAB — opens Add Product sheet
// ─────────────────────────────────────────────────────────────

$('#fab').addEventListener('click', () => {
  resetAddForm();
  openSheet('addSheet');
});

// ─────────────────────────────────────────────────────────────
// STATUS CHECK
// ─────────────────────────────────────────────────────────────

async function checkStatus() {
  try {
    const r = await fetch('/api/status');
    state.status = await r.json();
  } catch {
    state.status = null;
  }
}

// ─────────────────────────────────────────────────────────────
// PRODUCTS LIST
// ─────────────────────────────────────────────────────────────

async function loadProducts() {
  const grid  = $('#productsGrid');
  const empty = $('#productsEmpty');
  grid.innerHTML = '';

  try {
    const r = await fetch('/api/products');
    state.products = await r.json();

    if (!Array.isArray(state.products) || state.products.length === 0) {
      grid.appendChild(empty);
      return;
    }

    state.products.forEach(p => grid.appendChild(buildProductCard(p)));
  } catch {
    grid.innerHTML = '<p style="color:var(--error);padding:24px;grid-column:1/-1">Could not load products — is the server running?</p>';
  }
}

function buildProductCard(p) {
  const card = mk('div', 'product-card');

  // Image area
  const imgDiv = mk('div', 'card-image');
  if (p.heroImage) {
    const img = new Image();
    img.src = p.heroImage;
    img.alt = p.name;
    imgDiv.appendChild(img);
  } else {
    imgDiv.appendChild(mk('div', 'card-image-placeholder', '👗'));
  }
  card.appendChild(imgDiv);

  // Body
  const body = mk('div', 'card-body');
  body.appendChild(mk('div', 'card-name', escHtml(p.name)));

  const ageStr = p.ageRange ? `Ages ${p.ageRange}` : '';
  const priceStr = p.price ? `R${p.price}` : '';
  const seasonStr = p.season || '';
  const meta = [ageStr, priceStr, seasonStr].filter(Boolean).join(' · ');
  body.appendChild(mk('div', 'card-meta', meta));

  // Actions
  const actions = mk('div', 'card-actions');
  const viewBtn = mk('button', 'card-view-btn', 'View Content');
  viewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openContentSheet(p.slug);
  });

  const schedBtn = mk('button', 'card-sched-btn', '📅');
  schedBtn.title = 'Schedule post';
  schedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.currentSlug = p.slug;
    openScheduleSheet();
  });

  actions.appendChild(viewBtn);
  actions.appendChild(schedBtn);
  body.appendChild(actions);
  card.appendChild(body);

  return card;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────
// ADD PRODUCT MULTI-STEP FORM
// ─────────────────────────────────────────────────────────────

function resetAddForm() {
  state.addStep = 0;
  $('#fieldName').value = '';
  $('#fieldPrice').value = '';
  $('#fieldAgeRange').value = '';
  $('#fieldSeason').value = 'all-season';
  $('#fieldColours').value = '';
  $('#fieldDescription').value = '';
  $('#fieldImageUrls').value = '';

  // Reset pills
  $$('#ageRangePills .pill').forEach(p => p.classList.remove('active'));
  $$('#seasonPills .pill').forEach(p => p.classList.remove('active'));
  $('#seasonPills .pill[data-value="all-season"]').classList.add('active');

  showAddStep(0);
}

function showAddStep(step) {
  state.addStep = step;
  $$('.add-step').forEach((el, i) => el.classList.toggle('active', i === step));
  $$('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === step);
    dot.classList.toggle('done', i < step);
  });
  $('#addStepLabel').textContent = `Step ${step + 1} of 3`;
  $('#addStepBack').style.display = step === 0 ? 'none' : '';
  $('#addStepNext').textContent = step === 2 ? 'Generate ✨' : 'Next';
}

// Pill selectors
function initPillGroup(groupId, hiddenId) {
  const container = $(`#${groupId}`);
  if (!container) return;
  container.addEventListener('click', e => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    $$('.pill', container).forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    if (hiddenId) $(`#${hiddenId}`).value = btn.dataset.value;
  });
}

initPillGroup('ageRangePills', 'fieldAgeRange');
initPillGroup('seasonPills', 'fieldSeason');

$('#addSheetClose').addEventListener('click', () => closeSheet('addSheet'));

$('#addStepBack').addEventListener('click', () => {
  if (state.addStep > 0) showAddStep(state.addStep - 1);
});

$('#addStepNext').addEventListener('click', async () => {
  if (state.addStep === 0) {
    if (!$('#fieldName').value.trim()) { showToast('Please enter a product name'); return; }
    if (!$('#fieldPrice').value) { showToast('Please enter a price'); return; }
    if (!$('#fieldAgeRange').value) { showToast('Please select an age range'); return; }
    showAddStep(1);
  } else if (state.addStep === 1) {
    showAddStep(2);
  } else {
    // Submit
    const data = {
      name: $('#fieldName').value.trim(),
      price: $('#fieldPrice').value,
      ageRange: $('#fieldAgeRange').value,
      season: $('#fieldSeason').value || 'all-season',
      colours: $('#fieldColours').value,
      description: $('#fieldDescription').value,
      imageUrls: $('#fieldImageUrls').value,
    };
    closeSheet('addSheet');
    await startProductGeneration(data);
  }
});

// ─────────────────────────────────────────────────────────────
// PRODUCT GENERATION (SSE)
// ─────────────────────────────────────────────────────────────

const GENERATION_STEPS = [
  { key: 'images',   icon: '🖼️',  label: 'Downloading & enhancing images' },
  { key: 'video',    icon: '🎬',  label: 'Generating video prompts' },
  { key: 'copy',     icon: '✍️',  label: 'Writing all copy (Groq AI)' },
  { key: 'shopify',  icon: '🛍️', label: 'Shopify product listing' },
  { key: 'instagram',icon: '📸', label: 'Instagram captions' },
  { key: 'tiktok',   icon: '🎵', label: 'TikTok script & hook' },
  { key: 'pinterest',icon: '📌', label: 'Pinterest pins' },
  { key: 'facebook', icon: '💙', label: 'Facebook caption' },
  { key: 'email',    icon: '✉️',  label: 'Email subject lines' },
  { key: 'capcut',   icon: '✂️',  label: 'CapCut edit brief' },
  { key: 'package',  icon: '📦', label: 'Assembling content package' },
  { key: 'tiktok_draft', icon: '📁', label: 'Saving TikTok draft' },
  { key: 'drive',    icon: '☁️',  label: 'Uploading to Google Drive' },
];

async function startProductGeneration(formData) {
  const overlay = $('#progressOverlay');
  const fill    = $('#progressTopFill');
  const nameEl  = $('#progressProductName');
  const list    = $('#progressStepsList');

  // Build step UI
  list.innerHTML = '';
  fill.style.width = '0%';
  nameEl.textContent = `Generating: ${formData.name}`;
  overlay.classList.add('active');

  const stepEls = {};
  GENERATION_STEPS.forEach(s => {
    const row  = mk('div', 'progress-step');
    const icon = mk('div', 'step-icon', s.icon);
    const lbl  = mk('span', '', s.label);
    row.appendChild(icon);
    row.appendChild(lbl);
    list.appendChild(row);
    stepEls[s.key] = { row, icon, lbl };
  });

  let doneCount = 0;

  function activate(key) {
    const s = stepEls[key]; if (!s) return;
    // de-activate previous active
    $$('.progress-step.active', list).forEach(r => r.classList.remove('active'));
    s.row.classList.add('active');
    s.icon.textContent = '⟳';
  }

  function markDone(key) {
    const s = stepEls[key]; if (!s) return;
    if (s.row.classList.contains('done')) return;
    s.row.classList.remove('active');
    s.row.classList.add('done');
    s.icon.textContent = '✓';
    doneCount++;
    fill.style.width = `${Math.min(100, Math.round((doneCount / GENERATION_STEPS.length) * 100))}%`;
  }

  function markError(key, msg) {
    const s = stepEls[key]; if (!s) return;
    s.row.classList.remove('active');
    s.row.classList.add('error');
    s.icon.textContent = '✗';
    if (msg) s.lbl.textContent = msg;
  }

  let activeKey = null;

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        formData.name,
        price:       formData.price,
        ageRange:    formData.ageRange,
        season:      formData.season,
        colours:     formData.colours,
        description: formData.description,
        imageUrls:   formData.imageUrls || '',
      }),
    });

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';
    let lastEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event:')) {
          lastEvent = trimmed.slice(6).trim();
          continue;
        }
        if (!trimmed.startsWith('data:')) continue;

        let payload;
        try { payload = JSON.parse(trimmed.slice(5).trim()); } catch { continue; }

        if (lastEvent === 'progress' && payload.step) {
          // Mark previous active step as done when a new step arrives
          if (activeKey && activeKey !== payload.step) {
            markDone(activeKey);
          }
          activate(payload.step);
          activeKey = payload.step;
        }

        if (lastEvent === 'done') {
          // Mark remaining active/undone as done
          if (activeKey) markDone(activeKey);
          GENERATION_STEPS.forEach(s => markDone(s.key));
          fill.style.width = '100%';

          setTimeout(async () => {
            overlay.classList.remove('active');
            await loadProducts();
            if (payload.slug) {
              setTimeout(() => openContentSheet(payload.slug), 350);
            }
          }, 900);
          return;
        }

        if (lastEvent === 'error') {
          if (activeKey) markError(activeKey, payload.message || 'Error');
          nameEl.textContent = 'Generation failed';
          setTimeout(() => overlay.classList.remove('active'), 3000);
          return;
        }
      }
    }

    // Stream ended without done event — mark all done
    GENERATION_STEPS.forEach(s => markDone(s.key));
    fill.style.width = '100%';
    setTimeout(async () => {
      overlay.classList.remove('active');
      await loadProducts();
    }, 900);

  } catch (err) {
    nameEl.textContent = 'Generation failed';
    if (activeKey) markError(activeKey, err.message);
    else {
      const errRow = mk('div', 'progress-step error');
      errRow.appendChild(mk('div', 'step-icon', '✗'));
      errRow.appendChild(mk('span', '', err.message));
      list.appendChild(errRow);
    }
    setTimeout(() => overlay.classList.remove('active'), 4000);
  }
}

// ─────────────────────────────────────────────────────────────
// CONTENT SHEET (product detail)
// ─────────────────────────────────────────────────────────────

async function openContentSheet(slug) {
  state.currentSlug = slug;
  state.currentProduct = null;
  state.currentContentPack = null;
  state.currentPlatform = 'instagram';

  // Reset UI
  $('#contentProductName').textContent = 'Loading…';
  $('#contentProductSubtitle').textContent = '';
  $('#contentImages').innerHTML = '';
  $('#contentBody').innerHTML = '<div class="empty-state"><p>Loading content…</p></div>';
  $$('.platform-pill', $('#platformRow')).forEach((p, i) => p.classList.toggle('active', i === 0));

  openSheet('contentSheet');

  try {
    const [detailRes, packRes] = await Promise.all([
      fetch(`/api/products/${slug}`),
      fetch(`/api/products/${slug}/content-pack`),
    ]);

    if (!detailRes.ok) throw new Error('Product not found');
    const detail = await detailRes.json();
    const pack   = packRes.ok ? await packRes.json() : null;

    state.currentProduct    = detail;
    state.currentContentPack = pack;

    const p = detail.product || {};
    $('#contentProductName').textContent = p.name || slug;
    const colours = Array.isArray(p.colours) ? p.colours.join(', ') : (p.colours || '');
    $('#contentProductSubtitle').textContent = [
      p.ageRange ? `Ages ${p.ageRange}` : '',
      p.price    ? `R${p.price}`        : '',
      p.season   || '',
      colours    || '',
    ].filter(Boolean).join(' · ');

    // Drive folder banner
    const existingBanner = $('#driveBanner');
    if (existingBanner) existingBanner.remove();
    if (detail.driveFolderUrl) {
      const banner = mk('a', 'drive-banner');
      banner.id   = 'driveBanner';
      banner.href = detail.driveFolderUrl;
      banner.target = '_blank';
      banner.rel  = 'noopener noreferrer';
      banner.innerHTML = '☁️ <span>Open in Google Drive</span> <span class="drive-banner-arrow">↗</span>';
      $('#contentSheet').insertBefore(banner, $('#contentBody'));
    }

    // Images
    const imgStrip = $('#contentImages');
    imgStrip.innerHTML = '';
    if (detail.images && detail.images.length) {
      detail.images.forEach(src => {
        const img = new Image();
        img.src = src;
        img.alt = p.name;
        imgStrip.appendChild(img);
      });
    } else {
      imgStrip.appendChild(mk('div', 'content-images-empty', 'No product images'));
    }

    renderPlatformContent('instagram');

  } catch (err) {
    $('#contentBody').innerHTML = `<div class="empty-state"><p style="color:var(--error)">Failed to load: ${escHtml(err.message)}</p></div>`;
  }
}

$('#contentSheetClose').addEventListener('click', () => closeSheet('contentSheet'));

// Delete product
$('#contentDeleteBtn').addEventListener('click', async () => {
  const slug = state.currentSlug;
  if (!slug) return;
  if (!confirm('Delete this product and all its content? This cannot be undone.')) return;

  const r = await fetch(`/api/products/${slug}`, { method: 'DELETE' });
  if (r.ok) {
    closeSheet('contentSheet');
    showToast('Product deleted');
    await loadProducts();
  } else {
    showToast('Delete failed');
  }
});

// Platform switcher
$('#platformRow').addEventListener('click', e => {
  const btn = e.target.closest('.platform-pill');
  if (!btn) return;
  $$('.platform-pill', $('#platformRow')).forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  state.currentPlatform = btn.dataset.platform;
  renderPlatformContent(state.currentPlatform);
});

function renderPlatformContent(platform) {
  const body = $('#contentBody');
  const detail = state.currentProduct;
  const pack   = state.currentContentPack;

  if (!detail && !pack) {
    body.innerHTML = '<div class="empty-state"><p>No content available</p></div>';
    return;
  }

  body.innerHTML = '';

  switch (platform) {
    case 'instagram':  renderInstagram(body, pack?.instagram); break;
    case 'tiktok':     renderTikTok(body, pack?.tiktok, detail); break;
    case 'pinterest':  renderPinterest(body, pack?.pinterest); break;
    case 'shopify':    renderShopify(body, pack?.shopify, detail); break;
    case 'facebook':   renderFacebook(body, pack?.facebook); break;
    case 'email':      renderEmail(body, pack?.email); break;
    case 'video':      renderMarkdown(body, detail?.content?.videoPrompts, 'Video Prompts'); break;
    case 'capcut':     renderMarkdown(body, detail?.content?.capcutBrief, 'CapCut Brief'); break;
    default:           body.innerHTML = '<div class="empty-state"><p>Select a platform above</p></div>';
  }
}

// ── PLATFORM RENDERERS ───────────────────────────────────────

function noContent(el, msg) {
  el.innerHTML = `<div class="empty-state" style="padding:40px 20px"><div class="empty-icon">🤷</div><p>${msg}</p></div>`;
}

function renderInstagram(container, ig) {
  if (!ig) { noContent(container, 'No Instagram content. Re-generate the product.'); return; }

  // Caption variant cards
  const sec = section('Captions — pick one');
  const cards = mk('div', 'caption-cards');

  const variants = [
    { label: 'Story — emotional, moment-based', text: ig.captionStory },
    { label: 'Feature — product-led, direct',   text: ig.captionFeature },
    { label: 'UGC — real mum voice',            text: ig.captionUGC },
  ];

  variants.forEach(v => {
    if (!v.text) return;
    const card = mk('div', 'caption-card');
    card.appendChild(mk('div', 'caption-card-label', v.label));
    const textEl = mk('div', 'caption-card-text');
    textEl.textContent = v.text;
    const btn = mk('button', 'copy-btn', 'Copy');
    btn.onclick = () => copyText(v.text, btn);
    card.appendChild(textEl);
    card.appendChild(btn);
    cards.appendChild(card);
  });

  sec.appendChild(cards);
  container.appendChild(sec);

  // Hashtags
  if (ig.hashtags) {
    const hSec = section('Hashtags');
    const hBlock = mk('div', 'hashtag-block');
    hBlock.textContent = ig.hashtags;
    const btn = mk('button', 'copy-btn', 'Copy Hashtags');
    btn.style.marginTop = '8px';
    btn.onclick = () => copyText(ig.hashtags, btn);
    hSec.appendChild(hBlock);
    hSec.appendChild(btn);
    container.appendChild(hSec);
  }
}

function renderTikTok(container, tk, detail) {
  if (!tk) { noContent(container, 'No TikTok content. Re-generate the product.'); return; }

  if (tk.hook) {
    const s = section('Hook (First 3 Seconds)');
    s.appendChild(copyBlock(tk.hook));
    container.appendChild(s);
  }

  if (tk.script) {
    const s = section('Full Script (Voiceover)');
    s.appendChild(copyBlock(tk.script));
    container.appendChild(s);
  }

  if (tk.onScreenText && tk.onScreenText.length) {
    const s = section('On-Screen Text Timeline');
    const timeline = mk('div', 'on-screen-timeline');
    tk.onScreenText.forEach(item => {
      const row = mk('div', 'timeline-item');
      row.appendChild(mk('div', 'timeline-time', item.timestamp || '?'));
      const txt = mk('div', 'timeline-text');
      txt.textContent = `"${item.text}"${item.style ? ` — ${item.style}` : ''}`;
      row.appendChild(txt);
      timeline.appendChild(row);
    });
    s.appendChild(timeline);
    container.appendChild(s);
  }

  if (tk.soundMood) {
    const s = section('Music Mood (for CapCut search)');
    s.appendChild(copyBlock(tk.soundMood));
    container.appendChild(s);
  }

  if (tk.hashtags) {
    const s = section('TikTok Hashtags');
    const hBlock = mk('div', 'hashtag-block');
    hBlock.textContent = tk.hashtags;
    const btn = mk('button', 'copy-btn', 'Copy Hashtags');
    btn.style.marginTop = '8px';
    btn.onclick = () => copyText(tk.hashtags, btn);
    s.appendChild(hBlock);
    s.appendChild(btn);
    container.appendChild(s);
  }

  if (detail?.content?.tiktokCaption) {
    const s = section('Complete TikTok Caption (caption.txt)');
    s.appendChild(copyBlock(detail.content.tiktokCaption));
    container.appendChild(s);
  }
}

function renderPinterest(container, pin) {
  if (!pin) { noContent(container, 'No Pinterest content. Re-generate the product.'); return; }

  if (pin.pinTitle) {
    const s = section('Pin Title (max 100 chars)');
    s.appendChild(copyBlock(pin.pinTitle));
    container.appendChild(s);
  }

  if (pin.pinDescription) {
    const s = section('Pin Description (SEO-optimised)');
    s.appendChild(copyBlock(pin.pinDescription));
    container.appendChild(s);
  }

  if (pin.boardSuggestion) {
    const s = section('Board Recommendation');
    const p = mk('p', '', '');
    p.textContent = pin.boardSuggestion;
    p.style.cssText = 'font-size:.86rem;color:var(--charcoal2);line-height:1.5;';
    s.appendChild(p);
    container.appendChild(s);
  }
}

function renderShopify(container, sh, detail) {
  if (!sh) { noContent(container, 'No Shopify content. Re-generate the product.'); return; }

  if (sh.title) {
    const s = section('Product Title');
    s.appendChild(copyBlock(sh.title));
    container.appendChild(s);
  }

  if (sh.description) {
    const s = section('Product Description');
    s.appendChild(copyBlock(sh.description));
    container.appendChild(s);
  }

  if (sh.bullets && sh.bullets.length) {
    const s = section('Bullet Points');
    const list = mk('ul', 'bullet-list');
    sh.bullets.forEach(b => {
      const li = mk('li', 'bullet-item');
      li.textContent = b;
      list.appendChild(li);
    });
    const copyBtn = mk('button', 'copy-btn', 'Copy All Bullets');
    copyBtn.style.marginTop = '10px';
    copyBtn.onclick = () => copyText(sh.bullets.join('\n'), copyBtn);
    s.appendChild(list);
    s.appendChild(copyBtn);
    container.appendChild(s);
  }

  if (sh.metaTitle) {
    const s = section('SEO Meta Title');
    s.appendChild(copyBlock(sh.metaTitle));
    container.appendChild(s);
  }

  if (sh.metaDescription) {
    const s = section('SEO Meta Description');
    s.appendChild(copyBlock(sh.metaDescription));
    container.appendChild(s);
  }

  if (sh.tags && sh.tags.length) {
    const s = section('Shopify Tags');
    const tagList = mk('div', 'tag-list');
    sh.tags.forEach(t => tagList.appendChild(mk('span', 'tag', escHtml(t))));
    const copyBtn = mk('button', 'copy-btn', 'Copy Tags');
    copyBtn.style.marginTop = '8px';
    copyBtn.onclick = () => copyText(sh.tags.join(', '), copyBtn);
    s.appendChild(tagList);
    s.appendChild(copyBtn);
    container.appendChild(s);
  }

  if (sh.altTexts && sh.altTexts.length) {
    const s = section('Image Alt Texts');
    sh.altTexts.forEach((alt, i) => {
      const lbl = mk('div', '');
      lbl.style.cssText = 'font-size:.72rem;color:var(--muted);font-weight:500;margin-bottom:4px;margin-top:8px;';
      lbl.textContent = `Image ${i + 1}`;
      s.appendChild(lbl);
      s.appendChild(copyBlock(alt));
    });
    container.appendChild(s);
  }
}

function renderFacebook(container, fb) {
  if (!fb) { noContent(container, 'No Facebook content. Re-generate the product.'); return; }

  if (fb.caption) {
    const s = section('Caption');
    s.appendChild(copyBlock(fb.caption));
    container.appendChild(s);
  }

  if (fb.hashtags) {
    const s = section('Hashtags');
    const hBlock = mk('div', 'hashtag-block');
    hBlock.textContent = fb.hashtags;
    const btn = mk('button', 'copy-btn', 'Copy Hashtags');
    btn.style.marginTop = '8px';
    btn.onclick = () => copyText(fb.hashtags, btn);
    s.appendChild(hBlock);
    s.appendChild(btn);
    container.appendChild(s);
  }
}

function renderEmail(container, email) {
  if (!email) { noContent(container, 'No email content. Re-generate the product.'); return; }

  const variants = [
    { label: 'Subject A — Curiosity (recommended)', text: email.subjectA },
    { label: 'Subject B — Direct announcement',     text: email.subjectB },
    { label: 'Subject C — Urgency / social proof',  text: email.subjectC },
  ];

  const s = section('Subject Lines (A/B/C test)');
  const cards = mk('div', 'caption-cards');

  variants.forEach(v => {
    if (!v.text) return;
    const card = mk('div', 'caption-card');
    card.appendChild(mk('div', 'caption-card-label', v.label));
    const textEl = mk('div', 'caption-card-text');
    textEl.textContent = v.text;
    const btn = mk('button', 'copy-btn', 'Copy');
    btn.onclick = () => copyText(v.text, btn);
    card.appendChild(textEl);
    card.appendChild(btn);
    cards.appendChild(card);
  });

  s.appendChild(cards);
  container.appendChild(s);

  if (email.previewText) {
    const ps = section('Email Preview Text');
    ps.appendChild(copyBlock(email.previewText));
    container.appendChild(ps);
  }
}

function renderMarkdown(container, md, title) {
  if (!md) { noContent(container, `No ${title} found. Re-generate the product.`); return; }

  const s = section(title);
  const wrap = mk('div', 'markdown-block');
  const prose = mk('div', 'markdown-prose');
  prose.innerHTML = markdownToHtml(md);
  wrap.appendChild(prose);
  const copyBtn = mk('button', 'copy-btn', 'Copy Raw Text');
  copyBtn.style.marginTop = '10px';
  copyBtn.onclick = () => copyText(md, copyBtn);
  s.appendChild(wrap);
  s.appendChild(copyBtn);
  container.appendChild(s);
}

// ── BASIC MARKDOWN → HTML ─────────────────────────────────────

function markdownToHtml(md) {
  let html = String(md)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks first (protect from further processing)
  const codeBlocks = [];
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/gm, (_, code) => {
    codeBlocks.push(code);
    return `%%CODE${codeBlocks.length - 1}%%`;
  });

  html = html
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold & italic
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // HR
    .replace(/^---+$/gm, '<hr>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    // Paragraphs (double newline → p)
    .replace(/\n\n([^<])/g, '\n\n<p>$1')
    .replace(/([^>])\n\n/g, '$1</p>\n\n')
    // Single newlines → <br> inside paragraphs (simple approach)
    .replace(/([^\n>])\n([^\n<])/g, '$1<br>$2');

  // Restore code blocks
  codeBlocks.forEach((code, i) => {
    html = html.replace(`%%CODE${i}%%`, `<pre><code>${code}</code></pre>`);
  });

  return html;
}

// ── SCHEDULE POST BUTTON ──────────────────────────────────────

$('#contentScheduleBtn').addEventListener('click', () => {
  openScheduleSheet();
});

// ─────────────────────────────────────────────────────────────
// SCHEDULE SHEET
// ─────────────────────────────────────────────────────────────

const BEST_TIMES = {
  instagram:  ['07:00', '12:30', '19:00'],
  tiktok:     ['07:00', '12:00', '19:00', '21:00'],
  pinterest:  ['20:00', '21:00', '22:00'],
  facebook:   ['08:00', '13:00', '16:00'],
};

function openScheduleSheet() {
  // Defaults
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  $('#schedDate').value = tomorrow.toISOString().slice(0, 10);
  $('#schedTime').value = '07:00';
  $('#schedPlatform').value = 'instagram';

  // Reset platform icons
  $$('.platform-icon-btn', $('#schedPlatformRow')).forEach((btn, i) => btn.classList.toggle('active', i === 0));

  // Reset variant pills
  $$('#schedVariantPills .pill').forEach((p, i) => p.classList.toggle('active', i === 0));
  $('#schedCaptionVariant').value = 'feature';

  updateTimeChips('instagram');
  openSheet('scheduleSheet');
}

// Platform icon buttons in schedule sheet
$('#schedPlatformRow').addEventListener('click', e => {
  const btn = e.target.closest('.platform-icon-btn');
  if (!btn) return;
  $$('.platform-icon-btn', $('#schedPlatformRow')).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  $('#schedPlatform').value = btn.dataset.platform;
  updateTimeChips(btn.dataset.platform);
});

// Caption variant pills in schedule sheet
initPillGroupDirect('#schedVariantPills', '#schedCaptionVariant');

function initPillGroupDirect(groupSel, hiddenSel) {
  const container = $(groupSel);
  if (!container) return;
  container.addEventListener('click', e => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    $$('.pill', container).forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(hiddenSel).value = btn.dataset.value;
  });
}

function updateTimeChips(platform) {
  const chips = $('#schedTimeChips');
  chips.innerHTML = '';
  const times = BEST_TIMES[platform] || ['07:00', '12:00', '19:00'];
  times.forEach(t => {
    const chip = mk('button', 'time-chip', `${t} SAST`);
    chip.addEventListener('click', () => {
      $$('.time-chip', chips).forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      $('#schedTime').value = t;
    });
    chips.appendChild(chip);
  });
}

$('#scheduleSheetClose').addEventListener('click', () => closeSheet('scheduleSheet'));
$('#schedSheetCancel').addEventListener('click', () => closeSheet('scheduleSheet'));

$('#schedConfirm').addEventListener('click', async () => {
  const slug     = state.currentSlug;
  const platform = $('#schedPlatform').value;
  const variant  = $('#schedCaptionVariant').value;
  const date     = $('#schedDate').value;
  const time     = $('#schedTime').value;

  if (!slug) { showToast('No product selected'); return; }
  if (!date || !time) { showToast('Please pick a date and time'); return; }

  const scheduledTime = new Date(`${date}T${time}:00`).toISOString();

  const r = await fetch('/api/queue/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, platform, captionVariant: variant, scheduledTime }),
  });

  if (r.ok) {
    closeSheet('scheduleSheet');
    showToast('Post added to queue ✓');
    if ($('#view-queue').classList.contains('active')) loadQueue();
    if ($('#view-schedule').classList.contains('active')) renderScheduleView();
  } else {
    showToast('Failed to schedule post');
  }
});

// ─────────────────────────────────────────────────────────────
// SCHEDULE VIEW (day strip + posts)
// ─────────────────────────────────────────────────────────────

async function renderScheduleView() {
  // Build 7-day strip centred on today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!state.selectedDay) state.selectedDay = new Date(today);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }

  const strip = $('#dayStrip');
  strip.innerHTML = '';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  days.forEach(day => {
    const isToday    = day.toDateString() === today.toDateString();
    const isSelected = day.toDateString() === state.selectedDay.toDateString();

    const pill = mk('div', `day-pill${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`);
    pill.appendChild(mk('div', 'day-pill-name', dayNames[day.getDay()]));
    pill.appendChild(mk('div', 'day-pill-date', day.getDate()));

    pill.addEventListener('click', () => {
      state.selectedDay = new Date(day);
      renderScheduleView();
    });

    strip.appendChild(pill);
  });

  // Load queue data
  let queue = { scheduled: [] };
  try {
    const r = await fetch('/api/queue');
    queue = await r.json();
  } catch { /* offline */ }

  // Filter posts for selected day
  const selDay = state.selectedDay;
  const dayPosts = (queue.scheduled || []).filter(p => {
    const pd = new Date(p.scheduledTime);
    pd.setHours(0, 0, 0, 0);
    return pd.toDateString() === selDay.toDateString();
  }).sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

  const postsEl = $('#schedulePosts');
  postsEl.innerHTML = '';

  if (dayPosts.length === 0) {
    postsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No posts on this day</h3><p>Schedule content from a product to see it here.</p></div>`;
    return;
  }

  dayPosts.forEach(post => {
    const item = mk('div', 'schedule-post-item');

    const plat = mk('div', `spost-platform ${post.platform}`, platformEmoji(post.platform));
    item.appendChild(plat);

    const info = mk('div', 'spost-info');
    const pname = mk('div', 'spost-product');
    pname.textContent = post.product || post.slug;
    info.appendChild(pname);
    const ptime = mk('div', 'spost-time');
    ptime.textContent = `${post.platform} · ${fmtTime(post.scheduledTime)}`;
    info.appendChild(ptime);
    item.appendChild(info);

    const status = mk('span', `spost-status ${post.status}`, post.status);
    item.appendChild(status);

    postsEl.appendChild(item);
  });
}

// ─────────────────────────────────────────────────────────────
// QUEUE VIEW
// ─────────────────────────────────────────────────────────────

async function loadQueue() {
  try {
    const r = await fetch('/api/queue');
    state.queue = await r.json();
  } catch { return; }

  // Scheduled
  const list  = $('#queueList');
  const count = $('#queueCount');
  list.innerHTML = '';
  const scheduled = state.queue.scheduled || [];
  count.textContent = scheduled.length;

  if (scheduled.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No posts scheduled</h3><p>Open a product and tap "Schedule Post".</p></div>';
  } else {
    scheduled.forEach(post => list.appendChild(buildQueueItem(post)));
  }

  // TikTok drafts
  const tlist = $('#tiktokList');
  tlist.innerHTML = '';
  const drafts = state.queue.tiktokDrafts || [];

  if (drafts.length === 0) {
    tlist.innerHTML = '<div class="empty-state"><div class="empty-icon">🎵</div><h3>No TikTok drafts</h3></div>';
  } else {
    drafts.forEach(draft => tlist.appendChild(buildTikTokItem(draft)));
  }
}

function buildQueueItem(post) {
  const item = mk('div', 'queue-item');

  item.appendChild(mk('div', `queue-platform ${post.platform}`, platformEmoji(post.platform)));

  const info = mk('div', 'queue-info');
  const prod = mk('div', 'queue-product');
  prod.textContent = post.product || post.slug;
  info.appendChild(prod);
  const time = mk('div', 'queue-time');
  time.textContent = `${post.platform} · ${fmtDateTime(post.scheduledTime)}`;
  info.appendChild(time);
  item.appendChild(info);

  item.appendChild(mk('span', `queue-status ${post.status}`, post.status));

  const actions = mk('div', 'queue-actions');

  if (post.status !== 'published') {
    const markBtn = mk('button', 'btn-q success', '✓ Done');
    markBtn.addEventListener('click', async () => {
      const r = await fetch(`/api/queue/${post.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (r.ok) { showToast('Marked as published'); loadQueue(); }
    });
    actions.appendChild(markBtn);
  }

  const delBtn = mk('button', 'btn-q danger', '✕');
  delBtn.addEventListener('click', async () => {
    if (!confirm('Remove from queue?')) return;
    const r = await fetch(`/api/queue/${post.id}`, { method: 'DELETE' });
    if (r.ok) { showToast('Removed from queue'); loadQueue(); }
  });
  actions.appendChild(delBtn);
  item.appendChild(actions);

  return item;
}

function buildTikTokItem(draft) {
  const item = mk('div', 'queue-item');
  item.appendChild(mk('div', 'queue-platform tiktok', '🎵'));

  const info = mk('div', 'queue-info');
  const prod = mk('div', 'queue-product');
  prod.textContent = draft.product || draft.id;
  info.appendChild(prod);
  const time = mk('div', 'queue-time');
  time.textContent = `TikTok draft · ${fmtDate(draft.createdAt)}`;
  info.appendChild(time);
  item.appendChild(info);

  item.appendChild(mk('span', `queue-status ${draft.status || 'queued'}`, draft.status || 'queued'));
  return item;
}

// ─────────────────────────────────────────────────────────────
// SETTINGS VIEW
// ─────────────────────────────────────────────────────────────

async function renderSettings() {
  const list = $('#settingsList');
  list.innerHTML = '';

  // Workflow button — top of settings
  const wfBtn = mk('button', 'settings-workflow-btn');
  const wfIcon = mk('div', 'settings-workflow-btn-icon', '🗂️');
  const wfBody = mk('div', 'settings-workflow-btn-body');
  const done = getWfDone();
  wfBody.appendChild(mk('div', 'settings-workflow-btn-title', 'Content Workflow'));
  wfBody.appendChild(mk('div', 'settings-workflow-btn-sub',
    done.size > 0
      ? `${done.size}/${PRODUCT_STEPS.length} steps done on current product`
      : 'Weekly plan · New product checklist · Posting tips'));
  wfBtn.appendChild(wfIcon);
  wfBtn.appendChild(wfBody);
  wfBtn.appendChild(mk('span', 'settings-workflow-btn-arrow', '›'));
  wfBtn.addEventListener('click', openWorkflowSheet);
  list.appendChild(wfBtn);

  // Re-fetch status for fresh data
  await checkStatus();
  const st = state.status;
  const integrations = st?.integrations || {};

  const cards = [
    {
      icon: '🤖',
      name: 'AI Provider',
      connected: st?.ready,
      special: true,
      provider: st?.ai?.provider,
      model: st?.ai?.model,
      connectedNote: 'Content generation is active and free.',
      notSetNote: 'Add GROQ_API_KEY to your .env file. Groq is free — sign up at groq.com',
    },
    {
      icon: '🛍️',
      name: 'Shopify',
      connected: integrations.shopify,
      connectedNote: 'Product listings will sync to your Shopify store.',
      notSetNote: 'Add SHOPIFY_ADMIN_API_TOKEN and SHOPIFY_STORE_DOMAIN to .env',
    },
    {
      icon: '📸',
      name: 'Instagram',
      connected: integrations.instagram,
      connectedNote: 'Instagram Business account connected via Meta API.',
      notSetNote: 'Add META_LONG_LIVED_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID to .env',
    },
    {
      icon: '💙',
      name: 'Facebook',
      connected: integrations.facebook,
      connectedNote: 'Facebook Page connected via Meta API.',
      notSetNote: 'Add META_LONG_LIVED_TOKEN to .env (same token as Instagram)',
    },
    {
      icon: '📌',
      name: 'Pinterest',
      connected: integrations.pinterest,
      connectedNote: 'Pinterest Business account connected.',
      notSetNote: 'Add PINTEREST_ACCESS_TOKEN to .env',
    },
    {
      icon: '🎵',
      name: 'TikTok',
      connected: integrations.tiktok,
      connectedNote: 'TikTok Content Posting API connected.',
      notSetNote: 'Add TIKTOK_ACCESS_TOKEN and set TIKTOK_APPROVED=true in .env',
    },
    {
      icon: '☁️',
      name: 'Google Drive',
      connected: st?.drive?.enabled,
      connectedNote: 'Every product pack uploads automatically to your Drive folder.',
      notSetNote: 'Set GOOGLE_DRIVE_ENABLED=true, GOOGLE_DRIVE_FOLDER_ID, and GOOGLE_SERVICE_ACCOUNT_JSON in .env',
    },
  ];

  cards.forEach(card => {
    const el = mk('div', 'settings-card');

    const top = mk('div', 'settings-card-top');

    const iconEl = mk('div', 'settings-card-icon', card.icon);
    top.appendChild(iconEl);

    const infoEl = mk('div', 'settings-card-info');
    const nameRow = mk('div', 'settings-card-name');
    nameRow.appendChild(document.createTextNode(card.name));

    if (card.connected) {
      nameRow.appendChild(mk('span', 'settings-badge-connected', 'Connected ✓'));
    } else {
      nameRow.appendChild(mk('span', 'settings-badge-notset', 'Not set up'));
    }

    if (card.special && card.connected) {
      nameRow.appendChild(mk('span', 'settings-badge-free', 'FREE'));
    }

    infoEl.appendChild(nameRow);

    if (card.special && card.model) {
      infoEl.appendChild(mk('div', 'settings-model-badge', `${card.provider} / ${card.model}`));
    } else {
      const statusEl = mk('div', 'settings-card-status');
      statusEl.textContent = card.connected
        ? (card.provider ? `${card.provider}` : '')
        : 'Not connected';
      infoEl.appendChild(statusEl);
    }

    top.appendChild(infoEl);
    el.appendChild(top);

    const note = mk('div', 'settings-card-note');
    note.textContent = card.connected ? card.connectedNote : card.notSetNote;
    el.appendChild(note);

    list.appendChild(el);
  });
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// WORKFLOW SHEET
// ─────────────────────────────────────────────────────────────

const WEEK_PLAN = [
  { day: 'Mon', icon: '📸', label: 'IG Feed', platform: 'instagram' },
  { day: 'Tue', icon: '🎵', label: 'TikTok', platform: 'tiktok' },
  { day: 'Wed', icon: '📌', label: 'Pinterest', platform: 'pinterest' },
  { day: 'Thu', icon: '📸', label: 'IG Story', platform: 'instagram' },
  { day: 'Fri', icon: '💙', label: 'Facebook', platform: 'facebook' },
  { day: 'Sat', icon: '🎬', label: 'IG Reel', platform: 'instagram' },
  { day: 'Sun', icon: '😴', label: 'Rest', platform: null },
];

const PRODUCT_STEPS = [
  { label: 'Get product details from supplier',   detail: 'Name, price, age range, colours, material, images',  time: '2 min' },
  { label: 'Open app → tap + → fill in form',     detail: 'Step 1: basics · Step 2: details · Step 3: image URLs', time: '3 min' },
  { label: 'Tap Generate — wait for content',     detail: 'AI writes all captions, titles, scripts, prompts',    time: '45 sec' },
  { label: 'Review content in app',               detail: 'Check each platform tab — edit anything that feels off', time: '5 min' },
  { label: 'Open Google Drive folder',            detail: 'Find the product folder — download images + copy pack', time: '2 min' },
  { label: 'Create the TikTok/Reel video',        detail: 'Open CapCut → follow CapCut Brief step by step',       time: '20 min' },
  { label: 'Post to Instagram',                   detail: 'Feed: hero image + feature caption · Reel: CapCut export', time: '5 min' },
  { label: 'Post to TikTok',                      detail: 'Upload CapCut video → paste caption.txt',              time: '3 min' },
  { label: 'Save to Pinterest',                   detail: 'Pin the hero image with pin title + description',       time: '2 min' },
  { label: 'Post to Facebook',                    detail: 'Share to Page — link to Shopify product',              time: '2 min' },
  { label: 'Add to Shopify',                      detail: 'Paste title, description, bullets from copy pack',     time: '5 min' },
  { label: 'Schedule next product',               detail: 'Keep the pipeline moving — aim for 3 products/week',   time: '1 min' },
];

const POSTING_TIPS = [
  { icon: '⏰', text: '<strong>Best posting times (SAST):</strong> Instagram 7 am & 7 pm · TikTok 7 am, noon & 9 pm · Pinterest 8–10 pm' },
  { icon: '📅', text: '<strong>Post 3 products/week</strong> — Mon, Wed, Fri IG feeds keeps the algorithm happy without burning out.' },
  { icon: '🎬', text: '<strong>TikTok & Reels first.</strong> Video content reaches 3–5× more people than static posts for new accounts.' },
  { icon: '📌', text: '<strong>Pinterest is long-term.</strong> Pins get traffic for months. Pin every product, every time.' },
  { icon: '🔁', text: '<strong>Repurpose everything.</strong> One product = 1 IG feed + 1 Reel + 1 TikTok + 3 Pins + 1 FB post + 1 email.' },
  { icon: '💬', text: '<strong>Always reply to comments</strong> within the first hour of posting — it boosts reach significantly.' },
];

const WF_DONE_KEY = 'wf_done_steps';

function getWfDone() {
  try { return new Set(JSON.parse(localStorage.getItem(WF_DONE_KEY) || '[]')); } catch { return new Set(); }
}
function saveWfDone(set) {
  localStorage.setItem(WF_DONE_KEY, JSON.stringify([...set]));
}

function openWorkflowSheet() {
  const body = $('#workflowBody');
  body.innerHTML = '';
  const done = getWfDone();

  // ── Section 1: Weekly posting plan ──────────────────────────
  const secWeek = mk('div', 'wf-section');
  secWeek.appendChild(mk('div', 'wf-section-title', 'Weekly Posting Plan'));

  const todayDow = new Date().getDay(); // 0=Sun … 6=Sat
  const dowMap = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:0 };

  const grid = mk('div', 'wf-week');
  WEEK_PLAN.forEach(d => {
    const isToday = dowMap[d.day] === todayDow;
    const cell = mk('div', `wf-day${isToday ? ' wf-day--today' : ''}${!d.platform ? ' wf-day--rest' : ''}`);
    cell.appendChild(mk('div', 'wf-day-name', d.day));
    cell.appendChild(mk('div', 'wf-day-icon', d.icon));
    cell.appendChild(mk('div', 'wf-day-label', d.label));
    grid.appendChild(cell);
  });
  secWeek.appendChild(grid);
  body.appendChild(secWeek);

  // ── Section 2: New product checklist ────────────────────────
  const secSteps = mk('div', 'wf-section');
  const completedCount = PRODUCT_STEPS.filter((_, i) => done.has(i)).length;
  secSteps.appendChild(mk('div', 'wf-section-title',
    `New Product Checklist — ${completedCount}/${PRODUCT_STEPS.length} done`));

  const stepsList = mk('div', 'wf-steps');
  PRODUCT_STEPS.forEach((step, i) => {
    const isDone   = done.has(i);
    const isActive = !isDone && !done.has(i - 1) && (i === 0 || done.has(i - 1) || [...done].some(d => d >= i - 1));
    const row = mk('div', `wf-step${isDone ? ' done' : isActive ? ' active' : ''}`);

    const num = mk('div', 'wf-step-num');
    if (!isDone) num.textContent = i + 1;
    row.appendChild(num);

    const stepBody = mk('div', 'wf-step-body');
    stepBody.appendChild(mk('div', 'wf-step-label', step.label));
    stepBody.appendChild(mk('div', 'wf-step-detail', step.detail));
    row.appendChild(stepBody);

    const timeEl = mk('div', 'wf-step-time', step.time);
    row.appendChild(timeEl);

    row.addEventListener('click', () => {
      const d2 = getWfDone();
      if (d2.has(i)) d2.delete(i); else d2.add(i);
      saveWfDone(d2);
      openWorkflowSheet(); // re-render
    });

    stepsList.appendChild(row);
  });
  secSteps.appendChild(stepsList);

  const resetBtn = mk('button', 'wf-reset-btn', 'Reset checklist');
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem(WF_DONE_KEY);
    openWorkflowSheet();
  });
  secSteps.appendChild(resetBtn);
  body.appendChild(secSteps);

  // ── Section 3: Tips ─────────────────────────────────────────
  const secTips = mk('div', 'wf-section');
  secTips.appendChild(mk('div', 'wf-section-title', 'Posting Tips'));
  const tips = mk('div', 'wf-tips');
  POSTING_TIPS.forEach(t => {
    const tip = mk('div', 'wf-tip');
    tip.appendChild(mk('div', 'wf-tip-icon', t.icon));
    const txt = mk('div', 'wf-tip-text');
    txt.innerHTML = t.text;
    tip.appendChild(txt);
    tips.appendChild(tip);
  });
  secTips.appendChild(tips);
  body.appendChild(secTips);

  openSheet('workflowSheet');
}

$('#workflowSheetClose').addEventListener('click', () => closeSheet('workflowSheet'));

// ─────────────────────────────────────────────────────────────
(async function init() {
  // Fetch status quietly in background
  checkStatus();

  // Load products immediately
  await loadProducts();

  // Pre-build schedule day strip (for instant feel)
  state.selectedDay = new Date();
  state.selectedDay.setHours(0, 0, 0, 0);

  // Initialise add form step UI
  showAddStep(0);

  // Set today's date as default in schedule sheet
  const today = new Date().toISOString().slice(0, 10);
  $('#schedDate').value = today;
})();
