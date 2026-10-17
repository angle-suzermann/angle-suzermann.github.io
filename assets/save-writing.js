/* ANGLE save-writing — ученик скачивает свои письменные ответы как Word (.doc) и PDF.
   Подключается автоматически при сборке (build.mjs) ко всем материалам, править страницы не нужно.
   Что попадает в файл:
     • все <textarea> с текстом (в том числе свой блок в совместном письме);
     • однострочные поля без data-ans, если в них предложение (от 25 знаков или от 3 слов).
   Однословные пропуски с ключом (data-ans) и списки в файл не попадают.
   PDF собирается прямо в браузере (без библиотек и интернета): текст рисуется на странице шрифтом
   материала, поэтому кириллица и фирменный шрифт не теряются. Текст в таком PDF не выделяется. */
(function () {
  'use strict';
  if (window.__angleSaveWriting) return;
  window.__angleSaveWriting = true;

  var PURPLE = '#5b2e8b';
  var SKIP_ID = /^(studentName|studentGroup|name|group|student|nick)$/i;

  function meta(n) {
    var m = document.querySelector('meta[name="' + n + '"]');
    return m ? (m.getAttribute('content') || '') : '';
  }
  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }

  /* ---------- поиск полей ---------- */
  function isOpenInput(f) {
    if (f.tagName === 'TEXTAREA') return true;
    if (f.tagName !== 'INPUT') return false;
    var t = (f.getAttribute('type') || 'text').toLowerCase();
    if (t !== 'text') return false;
    if (f.hasAttribute('data-ans') || f.hasAttribute('data-ans-list')) return false;
    if (SKIP_ID.test(f.id || '') || SKIP_ID.test(f.name || '')) return false;
    var ml = parseInt(f.getAttribute('maxlength') || '0', 10);
    if (ml && ml < 40) return false;
    return true;
  }
  function hasCandidates() {
    var all = document.querySelectorAll('textarea, input');
    for (var i = 0; i < all.length; i++) if (isOpenInput(all[i])) return true;
    return false;
  }
  function ownText(node) {
    var c = node.cloneNode(true);
    var junk = c.querySelectorAll('textarea,input,select,button,script,style');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    return clean(c.textContent);
  }
  function sectionOf(f) {
    return f.closest('section, .card, .exercise, .ex, [data-name]') || document.body;
  }
  function sectionTitle(sec) {
    if (sec === document.body) return '';
    var dn = sec.getAttribute && sec.getAttribute('data-name');
    if (dn) return clean(dn);
    var h = sec.querySelector('h1,h2,h3,h4,.title,.ex-title');
    return h ? clean(h.textContent) : '';
  }
  function promptFor(f, sec) {
    var col = f.closest('.collab');
    if (col) { var p = col.querySelector('.cb-prompt'); return p ? clean(p.textContent) : ''; }
    var al = f.getAttribute('aria-label');
    if (al) return clean(al);
    if (f.id) {
      var lb = document.querySelector('label[for="' + f.id.replace(/"/g, '') + '"]');
      if (lb) return clean(lb.textContent);
    }
    var node = f, hops = 0;
    while (node && node !== sec && hops < 4) {
      var par = node.parentElement;
      if (par && par !== sec && par.querySelectorAll('textarea,input').length === 1) {
        var ot = ownText(par);
        if (ot.length >= 3 && ot.length <= 320) return ot;
      }
      var sib = node.previousElementSibling;
      while (sib) {
        if (!sib.querySelector('textarea,input') && sib.tagName !== 'TEXTAREA' && sib.tagName !== 'INPUT') {
          var t = clean(sib.textContent);
          if (t.length >= 3 && t.length <= 400) return t;
        }
        sib = sib.previousElementSibling;
      }
      node = par; hops++;
    }
    return '';
  }

  function collect() {
    var groups = [], byTitle = {};
    var all = document.querySelectorAll('textarea, input');
    for (var i = 0; i < all.length; i++) {
      var f = all[i];
      if (!isOpenInput(f)) continue;
      var v = (f.value || '').replace(/\s+$/g, '');
      if (!v.trim()) continue;
      if (f.tagName === 'INPUT') {
        var wc = v.trim().split(/\s+/).length;
        if (v.trim().length < 25 && wc < 3) continue;
      }
      var sec = sectionOf(f);
      var title = sectionTitle(sec);
      var key = title || '·';
      var g = byTitle[key];
      if (!g) { g = byTitle[key] = { title: title, items: [] }; groups.push(g); }
      g.items.push({ q: promptFor(f, sec), a: v });
    }
    return groups;
  }

  function studentName() {
    var el = document.getElementById('studentName');
    var n = el ? (el.value || '').trim() : '';
    if (!n) n = store('angle-sw-name') || '';
    if (!n) {
      n = (window.prompt('Your name (it will be written in the file):') || '').trim();
    }
    if (n) store('angle-sw-name', n);
    return n;
  }

  function fileBase(name) {
    var t = meta('ws:title') || document.title || 'Writing';
    return (t + (name ? ' - ' + name : '')).replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  }
  function download(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- Word ---------- */
  function makeDoc(groups, name) {
    var title = meta('ws:title') || document.title;
    var h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.4}h1{color:' + PURPLE + ';font-size:20pt;margin:0 0 4pt}' +
      'h2{color:' + PURPLE + ';font-size:14pt;margin:16pt 0 4pt}.meta{color:#777;font-size:10pt;margin:0 0 12pt}' +
      '.q{color:' + PURPLE + ';font-weight:bold;margin:10pt 0 2pt}.a{margin:0 0 6pt}</style></head><body>' +
      '<h1>' + esc(title) + '</h1><p class="meta">' + (name ? esc(name) + ' · ' : '') + new Date().toLocaleDateString('en-GB') + ' · ANGLE</p>';
    groups.forEach(function (g) {
      if (g.title) h += '<h2>' + esc(g.title) + '</h2>';
      g.items.forEach(function (it) {
        if (it.q) h += '<p class="q">' + esc(it.q) + '</p>';
        h += '<p class="a">' + esc(it.a).replace(/\n/g, '<br>') + '</p>';
      });
    });
    h += '</body></html>';
    return new Blob(['﻿', h], { type: 'application/msword;charset=utf-8' });
  }

  /* ---------- PDF (без библиотек) ---------- */
  var PW = 595.28, PH = 841.89, SC = 2, MG = 52;

  function fontFamily() {
    var ff = getComputedStyle(document.body).fontFamily || 'Arial, sans-serif';
    return ff;
  }
  function makePages(groups, name) {
    var ff = fontFamily();
    var pages = [], cv, cx, y;
    function newPage() {
      cv = document.createElement('canvas');
      cv.width = Math.round(PW * SC); cv.height = Math.round(PH * SC);
      cx = cv.getContext('2d');
      cx.scale(SC, SC);
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, PW, PH);
      cx.textBaseline = 'alphabetic';
      y = MG;
      pages.push(cv);
    }
    function font(size, bold) { cx.font = (bold ? 'bold ' : '') + size + 'px ' + ff; }
    function wrap(text, size, bold, width) {
      font(size, bold);
      var lines = [];
      String(text).split('\n').forEach(function (para) {
        if (!para.trim()) { lines.push(''); return; }
        var words = para.split(/\s+/), cur = '';
        words.forEach(function (w) {
          while (cx.measureText(w).width > width) {
            var cut = w.length;
            while (cut > 1 && cx.measureText(w.slice(0, cut)).width > width) cut--;
            if (cur) { lines.push(cur); cur = ''; }
            lines.push(w.slice(0, cut)); w = w.slice(cut);
          }
          var test = cur ? cur + ' ' + w : w;
          if (cx.measureText(test).width > width && cur) { lines.push(cur); cur = w; }
          else cur = test;
        });
        lines.push(cur);
      });
      return lines;
    }
    function put(text, size, bold, color, gapBefore, gapAfter) {
      var lh = size * 1.45, width = PW - MG * 2;
      var lines = wrap(text, size, bold, width);
      y += gapBefore;
      lines.forEach(function (ln) {
        if (y + lh > PH - MG) { newPage(); }
        font(size, bold); cx.fillStyle = color;
        y += lh; cx.fillText(ln, MG, y - size * 0.28);
      });
      y += gapAfter;
    }
    newPage();
    put(meta('ws:title') || document.title, 20, true, PURPLE, 0, 2);
    put((name ? name + ' · ' : '') + new Date().toLocaleDateString('en-GB') + ' · ANGLE', 10.5, false, '#777', 0, 8);
    groups.forEach(function (g) {
      if (g.title) put(g.title, 14, true, PURPLE, 12, 2);
      g.items.forEach(function (it) {
        if (it.q) put(it.q, 11.5, true, PURPLE, 8, 0);
        put(it.a, 12, false, '#111', 2, 4);
      });
    });
    /* нумерация */
    pages.forEach(function (p, i) {
      var c = p.getContext('2d');
      c.font = '9px ' + ff; c.fillStyle = '#999';
      c.fillText('ANGLE · ' + (i + 1) + ' / ' + pages.length, MG, PH - 28);
    });
    return pages;
  }

  function b64ToBytes(b64) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function ascii(s) {
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
    return u;
  }
  function buildPdf(pages) {
    var chunks = [], offsets = [], pos = 0;
    function add(u) { chunks.push(u); pos += u.length; }
    function obj(id, parts) {
      offsets[id] = pos;
      add(ascii(id + ' 0 obj\n'));
      parts.forEach(function (p) { add(typeof p === 'string' ? ascii(p) : p); });
      add(ascii('\nendobj\n'));
    }
    var n = pages.length, kids = [];
    add(ascii('%PDF-1.4\n'));
    obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    for (var k = 0; k < n; k++) kids.push((5 + 3 * k) + ' 0 R');
    obj(2, ['<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>']);
    pages.forEach(function (cv, k) {
      var jpg = b64ToBytes(cv.toDataURL('image/jpeg', 0.92).split(',')[1]);
      var img = 3 + 3 * k, ct = 4 + 3 * k, pg = 5 + 3 * k;
      obj(img, ['<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n', jpg, '\nendstream']);
      var cs = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
      obj(ct, ['<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream']);
      obj(pg, ['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 ' + img + ' 0 R >> >> /Contents ' + ct + ' 0 R >>']);
    });
    var total = 3 * n + 3, xref = pos, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var i = 1; i < total; i++) x += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    x += 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    add(ascii(x));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function exportAs(kind) {
    var groups = collect();
    if (!groups.length) { alert('Write your answers first, then save them.'); return; }
    var name = studentName();
    var base = fileBase(name);
    if (kind === 'doc') { download(makeDoc(groups, name), base + '.doc'); return; }
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      download(buildPdf(makePages(groups, name)), base + '.pdf');
    });
  }

  /* ---------- кнопки: под полями письма, не поверх страницы ---------- */
  var cssDone = false;
  /* адрес стикера: рядом со скриптом (учитывает basePath сайта) */
  function stickerUrl() {
    var sc = document.querySelector('script[src*="save-writing.js"]');
    var base = '';
    if (sc) { var m = (sc.getAttribute('src') || '').match(/^(.*)\/assets\/save-writing\.js/); if (m) base = m[1]; }
    return base + '/assets/brand/save-sticker.webp';
  }
  function addCss() {
    if (cssDone) return; cssDone = true;
    var css = document.createElement('style');
    /* вид как у кнопок «Скачать шаблоны» в тренажёрах 37/38: белая таблетка, фиолетовый круг со стрелкой, жёлтое подчёркивание, стикер сбоку */
    css.textContent = [
      '.sw-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:12px 0 22px;font-family:inherit}',
      '.sw-btn{position:relative;display:inline-flex;align-items:center;gap:14px;max-width:100%;box-sizing:border-box;padding:10px 100px 10px 10px;background:#fff;color:#2D2926;border:1px solid rgba(94,72,119,.28);border-radius:999px;box-shadow:0 1px 2px rgba(45,41,38,.05),0 8px 22px rgba(94,72,119,.10);cursor:pointer;font:inherit;text-align:left;transition:border-color .2s,box-shadow .2s,transform .2s}',
      '.sw-btn:hover{border-color:#5E4877;box-shadow:0 2px 4px rgba(45,41,38,.06),0 12px 28px rgba(94,72,119,.18);transform:translateY(-1px)}',
      '.sw-ic{flex:none;width:38px;height:38px;border-radius:50%;background:#5E4877;display:flex;align-items:center;justify-content:center}',
      '.sw-ic svg{width:18px;height:18px;stroke:#FED500;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s}',
      '.sw-btn:hover .sw-ic svg{transform:translateY(2px)}',
      '.sw-k{display:block;font-size:.66rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#5E4877}',
      '.sw-t{display:block;font-size:.98rem;font-weight:700;line-height:1.25}',
      '.sw-t::after{content:"";display:block;width:28px;height:2px;margin-top:4px;background:#FED500;border-radius:2px;transition:width .25s}',
      '.sw-btn:hover .sw-t::after{width:100%}',
      '.sw-stk{position:absolute;right:6px;bottom:-4px;width:88px;height:66px;background:center/contain no-repeat;transform:rotate(-4deg);transform-origin:bottom left;transition:transform .25s;pointer-events:none}',
      '.sw-btn:hover .sw-stk{transform:rotate(4deg) translateY(-4px) scale(1.05)}',
      '@media (max-width:520px){.sw-btn{padding-right:92px}.sw-stk{width:78px;height:58px}}',
      '@media print{.sw-bar{display:none}}'
    ].join('\n');
    css.textContent += '\n.sw-stk{background-image:url(' + stickerUrl() + ')}';
    document.head.appendChild(css);
  }
  var ARROW = '<svg viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
  function makeBar() {
    var bar = document.createElement('div'); bar.className = 'sw-bar';
    [['Word · .doc', 'Save my writing', 'doc'], ['PDF', 'Save my writing', 'pdf']].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sw-btn';
      b.innerHTML = '<span class="sw-ic">' + ARROW + '</span><span><span class="sw-k"></span><span class="sw-t"></span></span><span class="sw-stk"></span>';
      b.querySelector('.sw-k').textContent = o[0];
      b.querySelector('.sw-t').textContent = o[1];
      b.addEventListener('click', function () { exportAs(o[2]); });
      bar.appendChild(b);
    });
    return bar;
  }
  /* на каждый блок (карточку/задание/совместное письмо), где есть поле письма, — одна панель сразу под последним полем */
  function placeBars() {
    var all = document.querySelectorAll('textarea, input'), groups = [];
    for (var i = 0; i < all.length; i++) {
      var f = all[i];
      if (!isOpenInput(f)) continue;
      var box = f.closest('.collab') || sectionOf(f);
      var g = null;
      for (var j = 0; j < groups.length; j++) if (groups[j].box === box) g = groups[j];
      if (!g) { g = { box: box, last: f }; groups.push(g); } else g.last = f;
    }
    var added = 0;
    groups.forEach(function (g) {
      if (g.box.getAttribute('data-sw-bar')) return;
      var anchor = g.last;
      if (g.box.classList && g.box.classList.contains('collab')) anchor = g.box;
      else while (anchor.parentElement && anchor.parentElement !== g.box) anchor = anchor.parentElement;
      addCss();
      g.box.setAttribute('data-sw-bar', '1');
      anchor.insertAdjacentElement('afterend', makeBar());
      added++;
    });
    return added;
  }

  function boot() {
    placeBars();
    /* поля совместного письма создаются позже загрузки страницы — проверяем несколько раз */
    var n = 0, t = setInterval(function () { placeBars(); if (++n > 12) clearInterval(t); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
