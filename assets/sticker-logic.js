/* ANGLE — shared completion-sticker tier logic.
   Load order: assets/sticker-data.js (image pool) -> assets/sticker-logic.js (this file)
   -> the page's own scoring script (test-engine.js, or a legacy/worksheet inline script).
   Exposed as plain globals (not an IIFE) so both TEST-mode engines and WORKSHEET-mode
   inline scripts can call these functions directly. See the angle-worksheet-template
   skill's "Tiered completion sticker" section for the full design rationale.
   Consolidated 2026-09-23 from three previously-duplicated per-file implementations —
   do not hand-edit a copy of this table back into an individual material's <script>. */
const RESULT_TIERS = [
  { min: 100, stickers: ['eggcellent-a','eggcellent-b','perfect','excellent','amazing_work','i_love_it','awesome','too_cool-a','too_cool-b','vzhukh'], bonus: true, label: 'Eggcellent! (100%)' },
  { min: 90,  stickers: ['eggcellent-a','eggcellent-b','perfect','excellent','amazing_work','i_love_it','awesome','too_cool-a','too_cool-b','vzhukh'], label: 'Eggcellent!' },
  { min: 75,  stickers: ['fire','great_work','good_job'], label: 'On fire!' },
  { min: 60,  stickers: ['good_vibes','nice','not_bad'],  label: 'Good vibes!' },
  { min: 40,  stickers: ['strawberry-a','strawberry-b','keep_going','you_tried'], label: 'Off to a good start', caption: "Not bad! A little more practice and you'll get there." },
  { min: 0,   stickers: ['plain','strawberry-full'], label: 'Try again!', caption: "Try again! You're just getting started — it only gets better from here." }
];
const SILENT_STICKERS = new Set(['strawberry-a','strawberry-b','plain','strawberry-full']);
function pickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function getResultTier(pct){ return RESULT_TIERS.find(t => pct >= t.min); }
function renderResultSticker(pct, wrap){
  wrap = wrap || document.getElementById('completionStickers');
  if(!wrap || typeof STICKER_DATA === 'undefined') return;
  const tier = getResultTier(pct);
  const chosen = pickRandom(tier.stickers);
  wrap.querySelectorAll('.completion-sticker').forEach(img=>{
    const isBonus = img.dataset.tier === 'awesome_is_banned';
    const show = isBonus ? !!tier.bonus : (img.dataset.tier === chosen);
    if(show){ if(STICKER_DATA[img.dataset.tier]) img.src = STICKER_DATA[img.dataset.tier]; img.hidden = false; }
    else { img.hidden = true; }
  });
  const capEl = document.getElementById('resultCaption');
  if(capEl) capEl.textContent = SILENT_STICKERS.has(chosen) ? (tier.caption || '') : '';
  return tier;
}
