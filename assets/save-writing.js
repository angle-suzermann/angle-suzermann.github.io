/* ANGLE save-writing — ученик скачивает свои письменные ответы как PDF.
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

  var PURPLE = '#5E4877';
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
  /* служебные поля (заметки, рисование, шапка с именем) — не письменные ответы */
  function isTool(f) {
    return !!f.closest('.note-panel,.wt-panel,.ink-panel,header,.topbar,[data-sw-skip]') || /(^|\s)ink-text-input(\s|$)/.test(f.className || '');
  }
  function isOpenInput(f) {
    if (isTool(f)) return false;
    if (f.tagName === 'TEXTAREA') return true;
    if (f.tagName !== 'INPUT') return false;
    var t = (f.getAttribute('type') || 'text').toLowerCase();
    if (t !== 'text') return false;
    /* поля с ключом ответа (data-ans, data-answer, data-answers, data-ans-list…) и пропуски .fib — это упражнения, не письмо */
    for (var ai = 0; ai < f.attributes.length; ai++) if (/^data-(ans|answer|correct)/i.test(f.attributes[ai].name)) return false;
    if (f.classList.contains('fib')) return false;
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

  /* ---------- общее для PDF: фирменный бланк ANGLE ---------- */
  var PURPLE_D = '#453458', YEL = '#FED500', LAV = '#f6f2fa', LINE = '#e2dbea';
  function assetBase() {
    var sc = document.querySelector('script[src*="save-writing.js"]');
    var m = sc && (sc.getAttribute('src') || '').match(/^(.*)\/assets\/save-writing\.js/);
    return m ? m[1] : '';
  }
  function dateLong() { return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function courseLine() {
    var c = meta('ws:course'), u = meta('ws:unit');
    return [c, u && u !== c ? u : ''].filter(Boolean).join(' · ');
  }
  function countWords(groups) {
    var n = 0;
    groups.forEach(function (g) { g.items.forEach(function (it) { var t = it.a.trim(); if (t) n += t.split(/\s+/).length; }); });
    return n;
  }
  function loadImg(url) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = url;
    });
  }

  /* ---------- PDF (без библиотек) ---------- */
  var PW = 595.28, PH = 841.89, SC = 2, MG = 44;

  function fontFamily() {
    var ff = getComputedStyle(document.body).fontFamily || 'Arial, sans-serif';
    return ff;
  }
  function makePages(groups, name, logos) {
    var ff = fontFamily();
    var pages = [], cv, cx, y;
    var CW = PW - MG * 2;
    function mark(img, x, yy, h) {
      var w = h * 2190 / 640;
      if (img) cx.drawImage(img, x, yy, w, h);
      else { cx.fillStyle = YEL; font(h * .8, true); cx.fillText('ANGLE', x, yy + h * .8); }
      return w;
    }
    function newPage(first) {
      cv = document.createElement('canvas');
      cv.width = Math.round(PW * SC); cv.height = Math.round(PH * SC);
      cx = cv.getContext('2d');
      cx.scale(SC, SC);
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, PW, PH);
      cx.textBaseline = 'alphabetic';
      pages.push(cv);
      if (first) return;
      cx.fillStyle = YEL; cx.fillRect(0, 0, PW, 5);
      y = MG - 4;
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
    function rrect(x, yy, w, h, r, fill, stroke) {
      cx.beginPath(); cx.moveTo(x + r, yy); cx.arcTo(x + w, yy, x + w, yy + h, r); cx.arcTo(x + w, yy + h, x, yy + h, r);
      cx.arcTo(x, yy + h, x, yy, r); cx.arcTo(x, yy, x + w, yy, r); cx.closePath();
      if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = .8; cx.stroke(); }
    }
    function room(h) { if (y + h > PH - 62) newPage(false); }

    /* первая страница: фиолетовая шапка, логотип, подпись под ним, метка с названием */
    newPage(true);
    var g0 = cx.createLinearGradient(0, 0, PW, 110);
    g0.addColorStop(0, '#3a2a4a'); g0.addColorStop(1, PURPLE);
    cx.fillStyle = g0; cx.fillRect(0, 0, PW, 112);
    mark(logos.yellow, MG, 24, 34);
    font(8.5, false); cx.fillStyle = '#e9dff5'; cx.fillText('by Viktoria Syuzyova', MG + 1, 74);
    cx.textAlign = 'right';
    font(8, true); cx.fillStyle = YEL; cx.fillText('WRITTEN ANSWERS', PW - MG, 34);
    font(9, false); cx.fillStyle = '#e9dff5';
    var cl = courseLine(); if (cl) cx.fillText(cl, PW - MG, 49);
    cx.fillText(dateLong(), PW - MG, cl ? 63 : 49);
    cx.textAlign = 'left';
    var title = meta('ws:title') || document.title;
    var tl = wrap(title, 14, true, CW - 48), tH = tl.length * 19 + 14, ty = 112 - 14;
    var tw = 0; tl.forEach(function (l) { font(14, true); tw = Math.max(tw, cx.measureText(l).width); });
    tw = Math.min(CW, tw + 48);
    cx.fillStyle = YEL; cx.beginPath(); cx.moveTo(MG, ty); cx.lineTo(MG + tw, ty); cx.lineTo(MG + tw - 12, ty + tH); cx.lineTo(MG, ty + tH); cx.closePath(); cx.fill();
    font(14, true); cx.fillStyle = PURPLE;
    tl.forEach(function (l, i) { cx.fillText(l, MG + 14, ty + 21 + i * 19); });
    y = ty + tH + 26;
    /* имя / дата / слова */
    var cols = [['NAME', name || ''], ['DATE', dateLong()], ['WORDS', String(countWords(groups))]], cw = (CW - 28) / 3;
    cols.forEach(function (c, i) {
      var x = MG + i * (cw + 14);
      font(7.5, true); cx.fillStyle = PURPLE; cx.fillText(c[0], x, y);
      font(11, false); cx.fillStyle = '#2D2926'; cx.fillText(c[1], x, y + 15);
      cx.strokeStyle = '#cfc4dc'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x, y + 21); cx.lineTo(x + cw, y + 21); cx.stroke();
    });
    y += 34;

    var qn = 0;
    groups.forEach(function (g) {
      if (g.title) {
        var hl = wrap(g.title, 14, true, CW - 14);
        room(hl.length * 19 + 40);
        y += 12;
        cx.fillStyle = YEL; cx.fillRect(MG, y - 2, 4, hl.length * 19 + 2);
        font(14, true); cx.fillStyle = PURPLE;
        hl.forEach(function (l, i) { cx.fillText(l, MG + 12, y + 13 + i * 19); });
        y += hl.length * 19 + 10;
      }
      g.items.forEach(function (it) {
        var ql = it.q ? wrap(it.q, 11, true, CW) : [];
        var al = wrap(it.a, 11.5, false, CW - 22), lh = 16;
        room((ql.length ? 14 + ql.length * 15 : 0) + Math.min(al.length, 3) * lh + 22);
        if (it.q) {
          qn++;
          font(7.5, true); cx.fillStyle = PURPLE; cx.fillText('QUESTION ' + qn, MG, y + 8);
          font(11, true); cx.fillStyle = '#2D2926';
          ql.forEach(function (l, i) { cx.fillText(l, MG, y + 22 + i * 15); });
          y += 14 + ql.length * 15;
        }
        var i = 0;
        while (i < al.length) {
          var fit = Math.max(1, Math.floor((PH - 62 - y - 16) / lh)), take = Math.min(fit, al.length - i);
          var bh = take * lh + 14;
          rrect(MG, y, CW, bh, 6, LAV, LINE);
          cx.fillStyle = PURPLE; cx.fillRect(MG, y + 3, 3, bh - 6);
          font(11.5, false); cx.fillStyle = '#2D2926';
          for (var k = 0; k < take; k++) cx.fillText(al[i + k], MG + 14, y + 7 + lh * (k + 1) - 4);
          y += bh + 8; i += take;
          if (i < al.length) newPage(false);
        }
        y += 6;
      });
    });
    /* нижний колонтитул на каждой странице: жёлтая линия, логотип с подписью под ним, номер страницы */
    pages.forEach(function (p, idx) {
      cx = p.getContext('2d'); cx.setTransform(SC, 0, 0, SC, 0, 0);
      cx.fillStyle = YEL; cx.fillRect(MG, PH - 50, CW, 2.5);
      if (logos.purple) cx.drawImage(logos.purple, MG, PH - 42, 12 * 2190 / 640, 12);
      else { font(10, true); cx.fillStyle = PURPLE; cx.fillText('ANGLE', MG, PH - 32); }
      font(7.5, false); cx.fillStyle = '#7a7288'; cx.fillText('by Viktoria Syuzyova', MG, PH - 22);
      cx.textAlign = 'right'; font(8.5, false); cx.fillText('Page ' + (idx + 1) + ' / ' + pages.length, PW - MG, PH - 30); cx.textAlign = 'left';
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

  function exportAs() {
    var groups = collect();
    if (!groups.length) { alert('Write your answers first, then save them.'); return; }
    var name = studentName();
    var base = fileBase(name);
    exportPdf(groups, name, base);
  }
  function exportPdf(groups, name, base) {
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var ab = assetBase();
    ready.then(function () {
      return Promise.all([loadImg(ab + '/assets/brand/angle-wordmark.svg'), loadImg(ab + '/assets/brand/angle-wordmark-purple.svg')]);
    }).then(function (im) {
      download(buildPdf(makePages(groups, name, { yellow: im[0], purple: im[1] })), base + '.pdf');
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
    var b = document.createElement('button'); b.type = 'button'; b.className = 'sw-btn';
    b.innerHTML = '<span class="sw-ic">' + ARROW + '</span><span><span class="sw-k"></span><span class="sw-t"></span></span><span class="sw-stk"></span>';
    b.querySelector('.sw-k').textContent = 'PDF';
    b.querySelector('.sw-t').textContent = 'Save my writing';
    b.addEventListener('click', function () { exportAs(); });
    bar.appendChild(b);
    return bar;
  }
  /* Где стоит кнопка:
     • в задании на письмо — сразу под последним полем (карточка / совместное письмо);
     • в постраничных воркшитах — ещё и внизу каждой страницы без такого поля (в прокручиваемой области);
     • если страниц нет и кнопки ещё нет, — в конце содержимого. Никогда не в шапке и не поверх бейджа. */
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
    if (!groups.length) return 0;
    var added = 0;
    groups.forEach(function (g) {
      if (g.box.getAttribute('data-sw-bar')) return;
      var anchor = g.last;
      if (g.box.classList && g.box.classList.contains('collab')) anchor = g.box;
      else if (g.box === document.body) anchor = g.last.closest('p,div,li') || g.last;
      else while (anchor.parentElement && anchor.parentElement !== g.box) anchor = anchor.parentElement;
      addCss();
      g.box.setAttribute('data-sw-bar', '1');
      anchor.insertAdjacentElement('afterend', makeBar());
      added++;
    });
    var pages = document.querySelectorAll('.page');
    if (pages.length) {
      for (var k = 0; k < pages.length; k++) {
        var pg = pages[k];
        if (pg.getAttribute('data-sw-page') || pg.querySelector('.sw-bar')) continue;
        addCss();
        pg.setAttribute('data-sw-page', '1');
        pg.appendChild(makeBar());
        added++;
      }
    } else if (!document.querySelector('.sw-bar')) {
      var wrap = document.querySelector('.page-wrap, main, .wrap') || document.body;
      addCss(); wrap.appendChild(makeBar()); added++;
    }
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
