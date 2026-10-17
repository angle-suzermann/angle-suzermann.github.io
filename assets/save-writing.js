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

  /* ---------- кнопка ---------- */
  function ui() {
    var css = document.createElement('style');
    css.textContent = [
      '.sw-wrap{position:fixed;left:14px;bottom:max(14px,env(safe-area-inset-bottom));z-index:9998;font-family:inherit}',
      '.sw-main,.sw-opt{font:inherit;font-weight:700;font-size:14px;cursor:pointer;border-radius:999px;border:2px solid ' + PURPLE + ';padding:9px 16px;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
      '.sw-main{background:#ffd400;color:#111;border-color:#ffd400}',
      '.sw-menu{display:none;flex-direction:column;gap:8px;margin:0 0 8px}',
      '.sw-wrap.open .sw-menu{display:flex}',
      '.sw-opt{background:#fff;color:' + PURPLE + '}',
      '.sw-opt:hover{background:' + PURPLE + ';color:#fff}',
      '@media print{.sw-wrap{display:none}}'
    ].join('\n');
    document.head.appendChild(css);
    var w = document.createElement('div'); w.className = 'sw-wrap';
    var m = document.createElement('div'); m.className = 'sw-menu';
    function opt(label, kind) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sw-opt'; b.textContent = label;
      b.addEventListener('click', function () { w.classList.remove('open'); exportAs(kind); });
      m.appendChild(b);
    }
    opt('Word (.doc)', 'doc'); opt('PDF', 'pdf');
    var main = document.createElement('button'); main.type = 'button'; main.className = 'sw-main';
    main.textContent = '⬇ Save my writing';
    main.addEventListener('click', function () { w.classList.toggle('open'); });
    w.appendChild(m); w.appendChild(main);
    document.body.appendChild(w);
  }

  var shown = false;
  function tryShow() { if (!shown && hasCandidates()) { shown = true; ui(); } return shown; }
  function boot() {
    /* поля совместного письма создаются позже загрузки страницы — проверяем несколько раз */
    if (tryShow()) return;
    var n = 0, t = setInterval(function () { if (tryShow() || ++n > 12) clearInterval(t); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
