/* ANGLE — общие добавки для всех материалов (подключается build.mjs автоматически).
   1) «Показать ответ» (глаз): рядом с каждым полем/вариантами с известным ответом в воркшитах и разминках.
      В тестах кнопок нет. Если на странице уже есть старый встроенный скрипт с глазом,
      оба используют общий флаг __revealDone, поэтому дублей не будет.
   2) Размер глаза: маленький значок-SVG вместо эмодзи (на iOS эмодзи огромный).
   3) Сопоставление (matching): каждая найденная пара получает свой цвет, а не «всё зелёное». */
(function () {
  'use strict';

  /* ---------- стили ---------- */
  var EYE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235E4877' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E\")";
  var PAL = [
    ['#efe6fa', '#6f45a8'], ['#e1effd', '#1f64ad'], ['#ffeed9', '#b85f00'], ['#fde4ee', '#b82a68'],
    ['#dcf6f2', '#0f7d72'], ['#fff5c2', '#8c6f00'], ['#f6e3d9', '#964a26'], ['#e4e8fd', '#3a4bb0']
  ];
  var css =
    '.reveal-btn-sm{box-sizing:border-box!important;width:22px!important;height:22px!important;min-width:0!important;padding:0!important;' +
    'font-size:0!important;line-height:0!important;color:transparent!important;border-radius:50%!important;flex:0 0 auto;' +
    'background-color:#fff!important;background-image:' + EYE + '!important;background-repeat:no-repeat!important;' +
    'background-position:center!important;background-size:12px 12px!important;margin-left:6px;touch-action:manipulation;' +
    'vertical-align:middle;display:inline-block!important;}' +
    '.reveal-btn-sm:hover{background-color:#f6f2fa!important;}' +
    'input.reveal-filled,select.reveal-filled{background:#e8f7ee!important;border-color:#3fa66b!important;color:#2f8a57!important;}' +
    '.reveal-correct{background:#e8f7ee!important;border-color:#3fa66b!important;color:#2f8a57!important;}';
  PAL.forEach(function (c, i) {
    css += '[data-pc="' + i + '"].matched-correct,[data-pc="' + i + '"].matched{background:' + c[0] + '!important;border-color:' + c[1] +
      '!important;color:' + c[1] + '!important;}';
  });
  var st = document.createElement('style');
  st.setAttribute('data-ws-extras', '');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------- «Показать ответ» ---------- */
  var tm = document.querySelector('meta[name="ws:type"]');
  var type = tm ? (tm.getAttribute('content') || '') : '';
  var REVEAL = type === 'worksheet' || type === 'warmup';

  function norm(s) { return (s || '').trim().toLowerCase().replace(/['’"]/g, '').replace(/\s+/g, ' '); }
  function getAns(el) {
    var d = el.dataset, v = d.answer;
    if (v == null) v = d.answers;
    if (v == null) v = d.ansList;
    if (v == null) v = d.answerList;
    if (v == null) v = d.ans;
    return v == null ? null : v.split('|')[0];
  }
  function mkBtn(fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'reveal-btn-sm';
    b.title = 'Показать ответ';
    b.setAttribute('aria-label', 'Показать ответ');
    b.textContent = '\u{1F441}';
    b.onclick = function () { fn(); b.remove(); };
    return b;
  }
  function fire(el, name) { try { el.dispatchEvent(new Event(name, { bubbles: true })); } catch (e) { } }
  function addInput(inp) {
    if (inp.__revealDone) return;
    var t = (inp.getAttribute('type') || 'text').toLowerCase();
    if (t === 'checkbox' || t === 'radio' || t === 'hidden' || t === 'button' || inp.readOnly) return;
    inp.__revealDone = true;
    inp.insertAdjacentElement('afterend', mkBtn(function () {
      inp.value = getAns(inp);
      inp.classList.add('reveal-filled');
      fire(inp, 'input'); fire(inp, 'change');
    }));
  }
  function addSelect(sel) {
    if (sel.__revealDone) return;
    sel.__revealDone = true;
    sel.insertAdjacentElement('afterend', mkBtn(function () {
      var a = norm(getAns(sel));
      Array.prototype.forEach.call(sel.options, function (o) {
        if (norm(o.value) === a || norm(o.textContent) === a) sel.value = o.value;
      });
      sel.classList.add('reveal-filled');
      fire(sel, 'change');
    }));
  }
  function addGroup(grp, correct) {
    if (grp.__revealDone) return;
    grp.__revealDone = true;
    var btn = mkBtn(function () {
      grp.querySelectorAll('[data-val]').forEach(function (o) {
        if (norm(o.dataset.val) === norm(correct)) o.classList.add('reveal-correct');
      });
    });
    var item = grp.closest('.item');
    var q = item ? item.querySelector('p') : null;
    if (q) q.insertAdjacentElement('afterend', btn); else grp.insertAdjacentElement('afterend', btn);
  }
  /* сопоставление: один глаз на блок, показывает все пары сразу */
  function addMatch(box) {
    if (box.__revealDone) return;
    var els = box.querySelectorAll('[data-id]');
    if (els.length < 2) return;
    box.__revealDone = true;
    var row = document.createElement('div');
    row.style.cssText = 'text-align:right;margin:0 0 6px;';
    var btn = mkBtn(function () {
      var ids = {};
      box.querySelectorAll('[data-id]').forEach(function (e) {
        ids[e.dataset.id] = 1;
        e.classList.remove('selected');
        e.classList.add('matched-correct');
      });
      if (box.hasAttribute('data-total-pairs') || box.id === 'matchContainer') box.dataset.correctCount = String(Object.keys(ids).length);
      try { if (typeof window.updateMatchProgress === 'function') window.updateMatchProgress(); } catch (e) { }
      try { if (typeof window.scheduleSave === 'function') window.scheduleSave(); } catch (e) { }
      row.remove();
    });
    btn.title = btn.title + ' (все пары)';
    row.appendChild(btn);
    box.parentNode.insertBefore(row, box);
  }
  function scanReveal(root) {
    if (!REVEAL || !root || root.nodeType !== 1) return;
    var boxes = [root].concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll('[data-total-pairs],.match-wrap,.match-grid,#matchContainer') : []));
    var up = root.closest ? root.closest('[data-total-pairs],.match-wrap,.match-grid,#matchContainer') : null;
    if (up) boxes.push(up);
    boxes.forEach(function (b) {
      if (b.matches && b.matches('[data-total-pairs],.match-wrap,.match-grid,#matchContainer')) addMatch(b);
    });
    var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll('input,select,[data-correct],[data-ans]') : []));
    all.forEach(function (el) {
      var tag = el.tagName;
      if (tag === 'INPUT') { if (getAns(el) !== null) addInput(el); }
      else if (tag === 'SELECT') { if (getAns(el) !== null) addSelect(el); }
      else if (el.hasAttribute) {
        if (el.hasAttribute('data-correct') && el.querySelector('[data-val]')) addGroup(el, el.dataset.correct);
        else if (el.hasAttribute('data-ans') && el.querySelector('[data-val]')) addGroup(el, el.dataset.ans);
      }
    });
  }

  /* ---------- цвета пар в сопоставлении ---------- */
  var pairCount = 0;
  function colorize(els) {
    els.forEach(function (e) { if (e.dataset && e.dataset.pc && !e.classList.contains('matched-correct')) delete e.dataset.pc; });
    var fresh = els.filter(function (e) { return e.classList.contains('matched-correct') && !e.dataset.pc; });
    if (!fresh.length) return;
    var byId = {}, rest = [];
    fresh.forEach(function (e) {
      var id = e.dataset.id || e.dataset.pair || e.dataset.match;
      if (id != null) (byId[id] = byId[id] || []).push(e); else rest.push(e);
    });
    Object.keys(byId).forEach(function (k) {
      var c = pairCount++ % PAL.length;
      byId[k].forEach(function (e) { e.dataset.pc = c; });
    });
    for (var i = 0; i < rest.length; i += 2) {
      var c2 = pairCount++ % PAL.length;
      rest[i].dataset.pc = c2;
      if (rest[i + 1]) rest[i + 1].dataset.pc = c2;
    }
  }

  function start() {
    scanReveal(document.body);
    /* страницы, которые достраивают разметку (data-total-pairs и т.п.) уже после загрузки */
    window.addEventListener('load', function () { scanReveal(document.body); });
    setTimeout(function () { scanReveal(document.body); }, 600);
    setTimeout(function () { scanReveal(document.body); }, 2000);
    colorize(Array.prototype.slice.call(document.querySelectorAll('.matched-correct')));
    new MutationObserver(function (muts) {
      var changed = [];
      muts.forEach(function (m) {
        if (m.type === 'attributes') { if (changed.indexOf(m.target) < 0) changed.push(m.target); }
        else m.addedNodes.forEach(scanReveal);
      });
      if (changed.length) colorize(changed);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
