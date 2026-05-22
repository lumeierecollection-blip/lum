/* ──────────────────────────────────────────────────────────
   LUMIÈRE COLLECTION — Dashboard App
   Vanilla JS SPA — no framework, fast, simple
   ────────────────────────────────────────────────────────── */

'use strict';

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────

const state = {
  products: [],
  currentProduct: null,
  currentSlug: null,
  currentContentPack: null,
  calendarOffset: 0,  // weeks from current
  queue: { scheduled: [], tiktokDrafts: [] },
};

// ─────────────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────────────

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function el(tag, cls, content) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (content !== undefined) e.innerHTML = content;
  return e;
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
  });
}

function copyBlock(text) {
  const wrap = el('div', 'content-block');
  wrap.appendChild(document.createTextNode(text));
  const btn = el('button', 'copy-btn', 'Copy');
  btn.onclick = () => copyToClipboard(text, btn);
  wrap.appendChild(btn);
  return wrap;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function platformEmoji(p) {
  const m = { instagram: '📸', instagram_reels: '🎬', instagram_stories: '⭕', facebook: '💙', tiktok: '🎵', pinterest: '📌' };
  return m[p] || '📋';
}

// ─────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────

function switchView(viewName) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));

  const view = $(`#view-${viewName}`);
  const nav  = $(`[data-view="${viewName}"]`);
  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');

  const titles = { products: 'Products', schedule: 'Schedule', queue: 'Queue' };
  $('#viewTitle').textContent = titles[viewName] || viewName;

  if (viewName === 'schedule') renderCalendar();
  if (viewName === 'queue')    loadQueue();
}

$$('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchView(item.dataset.view);
    closeSidebar();
  });
});

// Mobile sidebar
$('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
function closeSidebar() { $('#sidebar').classList.remove('open'); }

// ─────────────────────────────────────────────────────────────
// STATUS CHECK
// ─────────────────────────────────────────────────────────────

async function checkStatus() {
  try {
    const r = await fetch('/api/status');
    const s = await r.json();
    const dot   = $('#statusDot');
    const label = $('#statusLabel');

    if (s.ready) {
      dot.className = 'status-dot ok';
      label.textContent = `${s.ai.provider} / free`;
    } else {
      dot.className = 'status-dot warn';
      label.textContent = 'No AI key set';
    }
  } catch {
    $('#statusDot').className = 'status-dot';
    $('#statusLabel').textContent = 'Server offline';
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

    if (state.products.length === 0) {
      grid.appendChild(empty);
      return;
    }

    state.products.forEach(p => grid.appendChild(buildProductCard(p)));
  } catch {
    grid.innerHTML = '<p style="color:var(--error);padding:20px">Could not load products — is the server running?</p>';
  }
}

function buildProductCard(p) {
  const card = el('div', 'product-card');

  const imageDiv = el('div', 'card-image');
  if (p.heroImage) {
    const img = new Image();
    img.src = p.heroImage;
    img.alt = p.name;
    imageDiv.appendChild(img);
  } else {
    imageDiv.appendChild(el('div', 'card-image-placeholder', '👗'));
  }
  card.appendChild(imageDiv);

  const body = el('div', 'card-body');
  body.appendChild(el('div', 'card-name', p.name));
  body.appendChild(el('div', 'card-meta', `Ages ${p.ageRange} · R${p.price} · ${p.season}`));

  const badges = el('div', 'card-badges');
  if (p.hasContent) badges.appendChild(el('span', 'badge badge-success', '✓ Copy'));
  if (p.hasVideo)   badges.appendChild(el('span', 'badge badge-gold', '🎬 Prompts'));
  const colourBadge = Array.isArray(p.colours) ? p.colours.slice(0,2).join(', ') : p.colours;
  if (colourBadge) badges.appendChild(el('span', 'badge badge-blush', colourBadge));
  body.appendChild(badges);
  card.appendChild(body);

  card.addEventListener('click', () => openProductModal(p.slug));
  return card;
}

// ─────────────────────────────────────────────────────────────
// ADD PRODUCT
// ─────────────────────────────────────────────────────────────

window.openAddProduct = function() { $('#addModal').classList.add('open'); };

$('#addProductBtn').addEventListener('click', openAddProduct);
$('#closeAddModal').addEventListener('click', () => $('#addModal').classList.remove('open'));
$('#cancelAddModal').addEventListener('click', () => $('#addModal').classList.remove('open'));

$('#submitProduct').addEventListener('click', async () => {
  const form = $('#addProductForm');
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form));
  $('#addModal').classList.remove('open');
  form.reset();

  await startProductGeneration(data);
});

async function startProductGeneration(formData) {
  const progressModal = $('#progressModal');
  const stepsEl = $('#progressSteps');
  const bar = $('#progressBar');
  const title = $('#progressTitle');

  const steps = [
    { key: 'images',   label: 'Downloading & enhancing images' },
    { key: 'video',    label: 'Generating video prompts' },
    { key: 'shopify',  label: 'Shopify copy' },
    { key: 'instagram',label: 'Instagram captions' },
    { key: 'tiktok',   label: 'TikTok script' },
    { key: 'pinterest',label: 'Pinterest pins' },
    { key: 'facebook', label: 'Facebook caption' },
    { key: 'email',    label: 'Email subjects' },
    { key: 'capcut',   label: 'CapCut edit brief' },
    { key: 'package',  label: 'Assembling package' },
    { key: 'tiktok_draft', label: 'Saving TikTok draft' },
  ];

  // Build step elements
  stepsEl.innerHTML = '';
  const stepEls = {};
  steps.forEach(s => {
    const row = el('div', 'progress-step');
    const icon = el('div', 'step-icon', '·');
    const lbl = el('span', '', s.label);
    row.appendChild(icon);
    row.appendChild(lbl);
    stepsEl.appendChild(row);
    stepEls[s.key] = { row, icon, lbl };
  });

  bar.style.width = '0%';
  title.textContent = `Generating: ${formData.name}`;
  progressModal.classList.add('open');

  let doneCount = 0;

  function markStep(key, done, error) {
    const s = stepEls[key];
    if (!s) return;
    $$('.progress-step.active', stepsEl).forEach(el => {
      if (!el.classList.contains('done')) el.classList.remove('active');
    });
    if (done) {
      s.row.classList.add('done'); s.row.classList.remove('active');
      s.icon.textContent = '✓';
      doneCount++;
    } else if (error) {
      s.row.classList.add('error'); s.icon.textContent = '✗';
    } else {
      s.row.classList.add('active');
      s.icon.textContent = '⟳';
    }
    bar.style.width = `${Math.round((doneCount / steps.length) * 100)}%`;
  }

  try {
    const body = {
      name: formData.name,
      price: formData.price,
      ageRange: formData.ageRange,
      season: formData.season,
      colours: formData.colours,
      description: formData.description,
      imageUrls: formData.imageUrls || '',
    };

    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('event: progress')) continue;
        if (line.startsWith('event: done')) continue;
        if (line.startsWith('event: error')) continue;
        if (!line.startsWith('data: ')) continue;

        try {
          const payload = JSON.parse(line.slice(6));

          if (payload.step) {
            const activeStep = steps.find(s => s.key === payload.step);
            if (activeStep) {
              markStep(payload.step, false, false);
              // If message indicates completion, mark done on next progress
            }
          }

          // Detect completion of a step by seeing the next one start
          if (payload.substep) {
            const prev = steps.find(s => s.label.toLowerCase().includes(payload.substep.split(' ')[0].toLowerCase()));
            if (prev) markStep(prev.key, true);
          }
        } catch {}
      }
    }

    // Parse final event
    const finalLines = buffer.split('\n');
    let finalData = null;
    for (const line of finalLines) {
      if (line.startsWith('data: ')) {
        try { finalData = JSON.parse(line.slice(6)); } catch {}
      }
    }

    // Mark all remaining as done
    steps.forEach(s => markStep(s.key, true));
    bar.style.width = '100%';

    setTimeout(async () => {
      progressModal.classList.remove('open');
      await loadProducts();

      if (finalData?.slug) {
        setTimeout(() => openProductModal(finalData.slug), 300);
      }
    }, 800);

  } catch (err) {
    title.textContent = 'Generation failed';
    const errEl = el('div', 'progress-step error');
    errEl.appendChild(el('div', 'step-icon', '✗'));
    errEl.appendChild(el('span', '', err.message));
    stepsEl.appendChild(errEl);
  }
}

// ─────────────────────────────────────────────────────────────
// PRODUCT DETAIL MODAL
// ─────────────────────────────────────────────────────────────

async function openProductModal(slug) {
  const modal = $('#productModal');
  modal.classList.add('open');

  $('#productModalTitle').textContent = 'Loading...';
  $('#productImages').innerHTML = '';
  $('#tabContent').innerHTML = '<p style="padding:20px;color:var(--muted)">Loading content...</p>';

  try {
    const [detailRes, packRes] = await Promise.all([
      fetch(`/api/products/${slug}`),
      fetch(`/api/products/${slug}/content-pack`),
    ]);

    const detail = await detailRes.json();
    const pack   = packRes.ok ? await packRes.json() : null;

    state.currentSlug = slug;
    state.currentProduct = detail;
    state.currentContentPack = pack;

    const p = detail.product;
    $('#productModalTitle').textContent = p.name;
    $('#productModalSubtitle').textContent = `Ages ${p.ageRange} · R${p.price} · ${p.season} · ${(Array.isArray(p.colours) ? p.colours : [p.colours]).join(', ')}`;

    // Images
    const imgStrip = $('#productImages');
    imgStrip.innerHTML = '';
    if (detail.images && detail.images.length > 0) {
      detail.images.forEach(src => {
        const img = new Image();
        img.src = src;
        img.alt = p.name;
        imgStrip.appendChild(img);
      });
    } else {
      imgStrip.appendChild(el('div', 'product-images-empty', 'No images — add image URLs when processing this product.'));
    }

    // Render active tab
    renderActiveTab(detail, pack);

  } catch (err) {
    $('#tabContent').innerHTML = `<p style="color:var(--error);padding:20px">Failed to load: ${err.message}</p>`;
  }
}

$('#closeProductModal').addEventListener('click', () => {
  $('#productModal').classList.remove('open');
  state.currentSlug = null;
});

// Tab switching
$('#contentTabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  $$('.tab', $('#contentTabs')).forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  renderActiveTab(state.currentProduct, state.currentContentPack);
});

function renderActiveTab(detail, pack) {
  const activeTab = $('.tab.active', $('#contentTabs'))?.dataset?.tab || 'shopify';
  const content = $('#tabContent');
  content.innerHTML = '';

  switch (activeTab) {
    case 'shopify':    renderShopifyTab(content, pack?.shopify, detail); break;
    case 'instagram':  renderInstagramTab(content, pack?.instagram); break;
    case 'tiktok':     renderTikTokTab(content, pack?.tiktok, detail); break;
    case 'pinterest':  renderPinterestTab(content, pack?.pinterest); break;
    case 'facebook':   renderFacebookTab(content, pack?.facebook); break;
    case 'email':      renderEmailTab(content, pack?.email); break;
    case 'video':      renderMarkdownTab(content, detail?.content?.videoPrompts, 'Video Prompts'); break;
    case 'capcut':     renderMarkdownTab(content, detail?.content?.capcutBrief, 'CapCut Brief'); break;
  }
}

// ── TAB RENDERERS ─────────────────────────────────────────────

function renderShopifyTab(el, shopify, detail) {
  if (!shopify) { el.innerHTML = '<p class="form-hint" style="padding:20px">Content not found. Re-generate the product.</p>'; return; }

  el.appendChild(section('Product Title', copyBlock(shopify.title || '')));
  el.appendChild(section('Product Description', copyBlock(shopify.description || '')));

  if (shopify.bullets?.length) {
    const s = section('Bullet Points');
    const list = document.createElement('ul');
    list.className = 'bullet-list';
    shopify.bullets.forEach(b => {
      const li = document.createElement('li');
      li.className = 'bullet-item';
      li.textContent = b;
      list.appendChild(li);
    });
    const copyAllBtn = el2('button', 'btn btn-ghost', 'Copy All Bullets');
    copyAllBtn.style.marginTop = '8px';
    copyAllBtn.onclick = () => copyToClipboard(shopify.bullets.join('\n'), copyAllBtn);
    s.appendChild(list);
    s.appendChild(copyAllBtn);
    el.appendChild(s);
  }

  el.appendChild(section('SEO Meta Title', copyBlock(shopify.metaTitle || '')));
  el.appendChild(section('SEO Meta Description', copyBlock(shopify.metaDescription || '')));

  if (shopify.tags?.length) {
    const s = section('Shopify Tags');
    const tags = el2('div', 'tag-list');
    shopify.tags.forEach(t => tags.appendChild(el2('span', 'tag', t)));
    s.appendChild(tags);
    el.appendChild(s);
  }

  if (shopify.altTexts?.length) {
    const s = section('Image Alt Texts');
    shopify.altTexts.forEach((alt, i) => {
      const row = el2('div', '', `<strong style="font-size:.75rem;color:var(--muted)">Image ${i+1}</strong>`);
      row.style.marginBottom = '8px';
      row.appendChild(copyBlock(alt));
      s.appendChild(row);
    });
    el.appendChild(s);
  }
}

function renderInstagramTab(container, instagram) {
  if (!instagram) { container.innerHTML = '<p class="form-hint" style="padding:20px">No Instagram content found.</p>'; return; }

  const cards = el2('div', 'caption-cards');
  const variants = [
    { label: 'Story — emotional, moment-based', text: instagram.captionStory },
    { label: 'Feature — product-led, direct',  text: instagram.captionFeature },
    { label: 'UGC — real mum voice',           text: instagram.captionUGC },
  ];
  variants.forEach(v => {
    const card = el2('div', 'caption-card');
    card.appendChild(el2('div', 'caption-card-label', v.label));
    const block = copyBlock(v.text || '');
    card.appendChild(block);
    cards.appendChild(card);
  });
  container.appendChild(section('Captions (choose one per post)', cards));

  const hashSection = section('Hashtags (copy entire block)');
  const hashBlock = el2('div', 'hashtag-block');
  hashBlock.appendChild(document.createTextNode(instagram.hashtags || ''));
  const copyBtn = el2('button', 'copy-btn', 'Copy');
  copyBtn.style.cssText = 'position:static;margin-top:8px;display:block;opacity:1;';
  copyBtn.onclick = () => copyToClipboard(instagram.hashtags || '', copyBtn);
  hashBlock.appendChild(copyBtn);
  hashSection.appendChild(hashBlock);
  container.appendChild(hashSection);
}

function renderTikTokTab(container, tiktok, detail) {
  if (!tiktok) { container.innerHTML = '<p class="form-hint" style="padding:20px">No TikTok content found.</p>'; return; }

  container.appendChild(section('Hook (First 3 Seconds)', copyBlock(tiktok.hook || '')));
  container.appendChild(section('Full Script (Voiceover)', copyBlock(tiktok.script || '')));

  if (tiktok.onScreenText?.length) {
    const s = section('On-Screen Text Cues');
    const timeline = el2('div', 'on-screen-timeline');
    tiktok.onScreenText.forEach(item => {
      const row = el2('div', 'timeline-item');
      row.appendChild(el2('div', 'timeline-time', item.timestamp || '?'));
      row.appendChild(el2('div', 'timeline-text', `"${item.text}" — ${item.style || ''}`));
      timeline.appendChild(row);
    });
    s.appendChild(timeline);
    container.appendChild(s);
  }

  if (tiktok.soundMood) {
    container.appendChild(section('Music Mood (for CapCut search)', copyBlock(tiktok.soundMood)));
  }

  const hashSection = section('TikTok Hashtags');
  const hashBlock = el2('div', 'hashtag-block');
  hashBlock.appendChild(document.createTextNode(tiktok.hashtags || ''));
  const copyBtn = el2('button', 'copy-btn', 'Copy');
  copyBtn.style.cssText = 'position:static;margin-top:8px;display:block;opacity:1;';
  copyBtn.onclick = () => copyToClipboard(tiktok.hashtags || '', copyBtn);
  hashBlock.appendChild(copyBtn);
  hashSection.appendChild(hashBlock);
  container.appendChild(hashSection);

  // TikTok draft caption
  if (detail?.content?.tiktokCaption) {
    const draftSection = section('Complete TikTok Caption (caption.txt)');
    draftSection.appendChild(copyBlock(detail.content.tiktokCaption));
    container.appendChild(draftSection);
  }
}

function renderPinterestTab(container, pinterest) {
  if (!pinterest) { container.innerHTML = '<p class="form-hint" style="padding:20px">No Pinterest content found.</p>'; return; }
  container.appendChild(section('Pin Title (max 100 chars)', copyBlock(pinterest.pinTitle || '')));
  container.appendChild(section('Pin Description (SEO)', copyBlock(pinterest.pinDescription || '')));
  if (pinterest.boardSuggestion) {
    container.appendChild(section('Board Recommendation', el2('p', '', pinterest.boardSuggestion)));
  }
}

function renderFacebookTab(container, facebook) {
  if (!facebook) { container.innerHTML = '<p class="form-hint" style="padding:20px">No Facebook content found.</p>'; return; }
  container.appendChild(section('Caption', copyBlock(facebook.caption || '')));
  if (facebook.hashtags) {
    const h = section('Hashtags');
    h.appendChild(copyBlock(facebook.hashtags));
    container.appendChild(h);
  }
}

function renderEmailTab(container, email) {
  if (!email) { container.innerHTML = '<p class="form-hint" style="padding:20px">No email content found.</p>'; return; }
  container.appendChild(section('Subject A — Curiosity (recommended to test first)', copyBlock(email.subjectA || '')));
  container.appendChild(section('Subject B — Direct product announcement', copyBlock(email.subjectB || '')));
  container.appendChild(section('Subject C — Urgency / social proof', copyBlock(email.subjectC || '')));
  container.appendChild(section('Email Preview Text', copyBlock(email.previewText || '')));
}

function renderMarkdownTab(container, markdown, title) {
  if (!markdown) { container.innerHTML = `<p class="form-hint" style="padding:20px">No ${title} found.</p>`; return; }
  const prose = el2('div', 'markdown-prose');
  prose.innerHTML = markdownToHtml(markdown);
  container.appendChild(prose);
}

// ── MARKDOWN RENDERER (basic) ─────────────────────────────────

function markdownToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headings
    .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1} (.+)$/gm, '<h1>$1</h1>')
    // Code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/gm, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Tables
    .replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/gm, (m, header, rows) => {
      const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
      const trs = rows.trim().split('\n').map(row => {
        const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    })
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Checkboxes
    .replace(/^- \[ \] (.+)$/gm, '<div style="display:flex;gap:8px;margin-bottom:6px"><input type="checkbox" disabled> <span>$1</span></div>')
    .replace(/^- \[x\] (.+)$/gim, '<div style="display:flex;gap:8px;margin-bottom:6px"><input type="checkbox" checked disabled> <span>$1</span></div>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    // Paragraphs
    .replace(/\n\n([^<\n])/g, '\n\n<p>$1')
    .replace(/([^>])\n\n/g, '$1</p>\n\n');
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE MODAL
// ─────────────────────────────────────────────────────────────

const BEST_TIMES = {
  instagram:         ['07:00', '12:30', '19:00'],
  instagram_reels:   ['08:00', '17:00', '20:00'],
  instagram_stories: ['09:00', '14:00', '21:00'],
  facebook:          ['08:00', '13:00', '16:00'],
  tiktok:            ['07:00', '12:00', '19:00', '21:00'],
  pinterest:         ['20:00', '21:00', '22:00'],
};

$('#scheduleFromModal').addEventListener('click', () => {
  if (!state.currentSlug) return;
  openScheduleModal(state.currentSlug);
});

$('#closeScheduleModal').addEventListener('click', () => $('#scheduleModal').classList.remove('open'));
$('#cancelScheduleModal').addEventListener('click', () => $('#scheduleModal').classList.remove('open'));

$('#schedulePlatform').addEventListener('change', updateTimeSuggestions);

function openScheduleModal(slug) {
  state.currentSlug = slug;
  // Default to tomorrow 07:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);
  $('#scheduleDateTime').value = tomorrow.toISOString().slice(0, 16);
  updateTimeSuggestions();
  $('#scheduleModal').classList.add('open');
}

function updateTimeSuggestions() {
  const platform = $('#schedulePlatform').value;
  const times = BEST_TIMES[platform] || ['07:00', '12:00', '19:00'];
  const chips = $('#timeChips');
  chips.innerHTML = '';

  times.forEach(t => {
    const chip = el2('button', 'time-chip', t + ' SAST');
    chip.onclick = () => {
      const current = new Date($('#scheduleDateTime').value);
      const [h, m] = t.split(':');
      current.setHours(Number(h), Number(m));
      $('#scheduleDateTime').value = current.toISOString().slice(0, 16);
    };
    chips.appendChild(chip);
  });
}

$('#confirmSchedule').addEventListener('click', async () => {
  const slug = state.currentSlug;
  const platform = $('#schedulePlatform').value;
  const captionVariant = $('#scheduleCaptionVariant').value;
  const dateTime = $('#scheduleDateTime').value;

  if (!slug || !dateTime) return;

  const r = await fetch('/api/queue/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, platform, captionVariant, scheduledTime: new Date(dateTime).toISOString() }),
  });

  if (r.ok) {
    $('#scheduleModal').classList.remove('open');
    showToast('Post added to schedule ✓');
  }
});

// ─────────────────────────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────────────────────────

$('#prevWeek').addEventListener('click', () => { state.calendarOffset--; renderCalendar(); });
$('#nextWeek').addEventListener('click', () => { state.calendarOffset++; renderCalendar(); });

async function renderCalendar() {
  const grid = $('#calendarGrid');
  grid.innerHTML = '';

  // Build week dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + state.calendarOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Update label
  const fmt = d => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  $('#weekLabel').textContent = `${fmt(days[0])} – ${fmt(days[6])}`;

  // Load queue for this period
  let queue = { scheduled: [] };
  try {
    const r = await fetch('/api/queue');
    queue = await r.json();
  } catch {}

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  days.forEach((day, i) => {
    const dayEl = el2('div', `cal-day${day.toDateString() === today.toDateString() ? ' today' : ''}`);
    dayEl.appendChild(el2('div', 'cal-day-header', dayNames[i]));
    dayEl.appendChild(el2('div', 'cal-day-date', day.getDate()));

    // Filter posts for this day
    const dayPosts = queue.scheduled.filter(p => {
      const postDay = new Date(p.scheduledTime);
      postDay.setHours(0, 0, 0, 0);
      return postDay.toDateString() === day.toDateString();
    });

    dayPosts.forEach(post => {
      const time = new Date(post.scheduledTime).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
      const postEl = el2('div', `cal-post ${post.platform}${post.status === 'published' ? ' published' : ''}`,
        `${time} ${post.product?.slice(0, 12) || post.slug}`
      );
      postEl.title = `${post.platform} · ${post.product} · ${time}`;
      dayEl.appendChild(postEl);
    });

    grid.appendChild(dayEl);
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

  // Scheduled posts
  const list = $('#queueList');
  list.innerHTML = '';
  const count = $('#queueCount');
  count.textContent = state.queue.scheduled.length;

  if (state.queue.scheduled.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No posts scheduled</h3><p>Open a product and click "Schedule Post".</p></div>';
  } else {
    state.queue.scheduled.forEach(post => list.appendChild(buildQueueItem(post)));
  }

  // TikTok drafts
  const tlist = $('#tiktokList');
  tlist.innerHTML = '';
  if (state.queue.tiktokDrafts.length === 0) {
    tlist.innerHTML = '<div class="empty-state"><div class="empty-icon">🎵</div><h3>No TikTok drafts</h3></div>';
  } else {
    state.queue.tiktokDrafts.forEach(draft => tlist.appendChild(buildTikTokDraftItem(draft)));
  }
}

function buildQueueItem(post) {
  const item = el2('div', 'queue-item');

  const platformEl = el2('div', `queue-platform ${post.platform}`, platformEmoji(post.platform));
  item.appendChild(platformEl);

  const info = el2('div', 'queue-info');
  info.appendChild(el2('div', 'queue-product', post.product || post.slug));
  info.appendChild(el2('div', 'queue-time', `${post.platform} · ${formatDateTime(post.scheduledTime)}`));
  item.appendChild(info);

  const status = el2('span', `queue-status ${post.status}`, post.status);
  item.appendChild(status);

  const actions = el2('div', 'queue-actions');

  if (post.status !== 'published') {
    const markBtn = el2('button', 'btn-icon success', '✓ Published');
    markBtn.onclick = async () => {
      await fetch(`/api/queue/${post.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      loadQueue();
    };
    actions.appendChild(markBtn);
  }

  const del = el2('button', 'btn-icon danger', '✕');
  del.onclick = async () => {
    if (!confirm('Remove from queue?')) return;
    await fetch(`/api/queue/${post.id}`, { method: 'DELETE' });
    loadQueue();
  };
  actions.appendChild(del);
  item.appendChild(actions);

  return item;
}

function buildTikTokDraftItem(draft) {
  const item = el2('div', 'queue-item');
  item.appendChild(el2('div', 'queue-platform tiktok', '🎵'));

  const info = el2('div', 'queue-info');
  info.appendChild(el2('div', 'queue-product', draft.product || draft.id));
  info.appendChild(el2('div', 'queue-time', `TikTok draft · Created ${formatDate(draft.createdAt)}`));
  item.appendChild(info);

  item.appendChild(el2('span', `queue-status ${draft.status}`, draft.status));
  return item;
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────

function showToast(message) {
  const toast = el2('div', '', message);
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    background: 'var(--charcoal)', color: 'var(--ivory)',
    padding: '12px 20px', borderRadius: '8px',
    fontSize: '.85rem', zIndex: 9999,
    boxShadow: 'var(--shadow-lg)',
    animation: 'fadeIn .2s ease',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ─────────────────────────────────────────────────────────────
// UTIL HELPERS (avoid collision with DOM $ shorthand)
// ─────────────────────────────────────────────────────────────

function el2(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function section(title, child) {
  const s = el2('div', 'content-section');
  if (title) s.appendChild(el2('h3', '', title));
  if (child) s.appendChild(child);
  return s;
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

checkStatus();
loadProducts();
updateTimeSuggestions();
