/* ANGLE — shared completion-sticker tier logic.
   Load order: assets/sticker-data.js (image pool) -> assets/sticker-logic.js (this file)
   -> the page's own scoring script (test-engine.js, or a legacy/worksheet inline script).
   Exposed as plain globals (not an IIFE) so both TEST-mode engines and WORKSHEET-mode
   inline scripts can call these functions directly. See the angle-worksheet-template
   skill's "Tiered completion sticker" section for the full design rationale.
   Consolidated 2026-09-23 from three previously-duplicated per-file implementations —
   do not hand-edit a copy of this table back into an individual material's <script>.
   renderResultSticker(pct, wrap?, capEl?): wrap defaults to #completionStickers, capEl
   defaults to #resultCaption — both can be overridden (element or id string) for a page
   with more than one result panel (e.g. separate classwork/homework tabs on one file),
   so a multi-panel page still calls this exact same function, never a local copy. Added
   2026-09-27 while unifying the last few pages that had their own copy of this logic. */
const RESULT_TIERS = [
  { min: 90,  stickers: ['eggcellent-a','eggcellent-b','perfect','excellent','amazing_work','i_love_it','awesome','too_cool-a','too_cool-b','vzhukh','youre_a_star'], label: 'Eggcellent!' },
  { min: 75,  stickers: ['fire','great_work','good_job'], label: 'On fire!' },
  { min: 60,  stickers: ['good_vibes','nice','not_bad','hehe'],  label: 'Good vibes!' },
  { min: 40,  stickers: ['strawberry-a','strawberry-b','keep_going','you_tried','loading','strawberry-sparkle'], label: 'Off to a good start', caption: "Not bad! A little more practice and you'll get there." },
  { min: 0,   stickers: ['plain','strawberry-full','no_luck','still_lost','not_hehe'], label: 'Try again!', caption: "Try again! You're just getting started — it only gets better from here." }
];
const SILENT_STICKERS = new Set(['strawberry-a','strawberry-b','strawberry-sparkle','plain','strawberry-full']);
// Added 2026-10-10: stickers whose <img> is missing from a page's hard-coded list are created on demand.
const MEDIUM_STICKERS = new Set(['no_luck','still_lost','youre_a_star','loading','hehe','not_hehe','strawberry-sparkle']);
const ICON_STICKERS = new Set(['plain']);
function pickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function getResultTier(pct){ return RESULT_TIERS.find(t => pct >= t.min); }
function renderResultSticker(pct, wrap, capEl){
  wrap = wrap || document.getElementById('completionStickers');
  if(!wrap || typeof STICKER_DATA === 'undefined') return;
  if(capEl === undefined) capEl = document.getElementById('resultCaption');
  else if(typeof capEl === 'string') capEl = document.getElementById(capEl);
  const tier = getResultTier(pct);
  const chosen = pickRandom(tier.stickers);
  if(!wrap.querySelector('.completion-sticker[data-tier="'+chosen+'"]') && STICKER_DATA[chosen]){
    const n = document.createElement('img');
    n.className = 'completion-sticker' + (MEDIUM_STICKERS.has(chosen) ? ' completion-sticker--medium' : ICON_STICKERS.has(chosen) ? ' completion-sticker--icon' : '');
    n.dataset.tier = chosen; n.alt = ''; n.hidden = true;
    wrap.appendChild(n);
  }
  wrap.querySelectorAll('.completion-sticker').forEach(img=>{
    const show = img.dataset.tier === chosen;
    if(show){ if(STICKER_DATA[img.dataset.tier]) img.src = STICKER_DATA[img.dataset.tier]; img.hidden = false; }
    else { img.hidden = true; }
  });
  if(capEl) capEl.textContent = SILENT_STICKERS.has(chosen) ? (tier.caption || '') : '';
  return tier;
}
