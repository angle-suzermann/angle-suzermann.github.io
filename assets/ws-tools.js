/* ANGLE — «док» инструментов для всех материалов: заметки + рисование.
   Подключается build.mjs автоматически (раньше рисование и заметки были вшиты в 101 страницу).
   Две круглые кнопки стоят над бейджем ANGLE, их можно перетащить. Панели открываются прямо над кнопками
   и не двигают страницу. Хранение — те же ключи localStorage, что и раньше (angle_ink::путь, angle_notes::путь). */
(function () {
  'use strict';
  if (window.__wsTools || document.getElementById('inkToggle')) return;   // старая вшитая версия на странице — не дублируем
  window.__wsTools = true;

  var PURPLE = '#5E4877', YELLOW = '#FED500', BLACK = '#2D2926', RED = '#d6342c';
  var base = (function () {
    var sc = document.querySelector('script[src*="ws-tools.js"]');
    var m = sc && (sc.getAttribute('src') || '').match(/^(.*)\/assets\/ws-tools\.js/);
    return m ? m[1] : '';
  })();

  /* ---------- стили ---------- */
  var st = document.createElement('style');
  st.textContent = [
    '.scroll-area{overflow-x:hidden}',
    '#wtInk,#wtLaser{position:absolute;top:0;left:0;touch-action:none;pointer-events:none}',
    '#wtInk{z-index:500}#wtLaser{z-index:501}',
    '.wt-dock{position:fixed;z-index:9999;display:flex;flex-direction:column;gap:8px;touch-action:none;user-select:none;-webkit-user-select:none}',
    '.wt-btn{width:40px;height:40px;border-radius:50%;border:none;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(45,25,60,.35);touch-action:none;-webkit-tap-highlight-color:transparent}',
    '.wt-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}',
    '#wtNoteBtn{background:' + YELLOW + ';color:' + BLACK + '}#wtNoteBtn.on{background:' + PURPLE + ';color:#fff}',
    '#wtInkBtn{background:' + PURPLE + ';color:#fff}#wtInkBtn.on{background:' + YELLOW + ';color:' + BLACK + '}',
    '.wt-panel{position:fixed;z-index:9998;background:#fff;border:1.5px solid ' + PURPLE + ';border-radius:12px;padding:8px;box-shadow:0 8px 24px rgba(45,25,60,.3);display:flex;flex-direction:column;gap:7px;overflow-y:auto;max-width:calc(100vw - 16px);font-family:inherit}',
    '.wt-panel[hidden]{display:none}',
    '.wt-collapse{border:0;border-radius:7px;background:#f3eef8;color:' + PURPLE + ';padding:6px 8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}',
    '.wt-grid{display:grid;gap:5px}',
    '.wt-tools{grid-template-columns:repeat(5,32px)}',
    '.wt-colors{grid-template-columns:repeat(5,32px);justify-items:center}',
    '.wt-stk{grid-template-columns:repeat(5,32px)}',
    '.wt-acts{grid-template-columns:repeat(5,32px)}',
    '.wt-t,.wt-s,.wt-a{width:32px;height:32px;border-radius:8px;border:1.5px solid #e4e0e8;background:#fff;font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:' + BLACK + ';font-family:inherit}',
    '.wt-t.on,.wt-s.on{border-color:' + PURPLE + ';background:#f3eef8}',
    '.wt-s{background-size:contain;background-repeat:no-repeat;background-position:center;font-size:.95rem}',
    '.wt-a{border-color:' + PURPLE + ';color:' + PURPLE + ';font-weight:700}',
    '.wt-a:disabled{opacity:.35;cursor:default}',
    '.wt-c{width:22px;height:22px;border-radius:50%;border:2px solid #fff;outline:1.5px solid #e4e0e8;cursor:pointer;padding:0}',
    '.wt-c.on{outline:2.5px solid ' + BLACK + '}',
    '.wt-note{background:#fffbe6;border-color:#e8d36a;width:230px;height:210px;min-width:170px;min-height:150px;padding:0;gap:0;resize:both;overflow:hidden}',
    '.wt-nh{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;font-size:.78rem;font-weight:700;color:#8c6f00;border-bottom:1px solid #e8d36a;flex:0 0 auto}',
    '.wt-nx{border:none;background:none;cursor:pointer;font-size:.85rem;color:#8c6f00;padding:0 2px}',
    '.wt-nt{flex:1 1 auto;border:none;background:transparent;resize:none;padding:8px;font-family:inherit;font-size:16px;color:#4a3b00;min-height:0}',
    '.wt-nt:focus{outline:none}',
    '.wt-nf{display:flex;align-items:center;justify-content:space-between;padding:3px 8px;font-size:.66rem;color:#a08d3f;flex:0 0 auto}',
    '.wt-nf button{border:none;background:none;cursor:pointer;font-size:.78rem;padding:0 2px}',
    '.wt-saved{opacity:0;transition:opacity .3s}.wt-saved.show{opacity:1}',
    /* толщина линии */
    '.wt-widths{grid-template-columns:repeat(5,32px)}',
    '.wt-w{width:32px;height:26px;border-radius:8px;border:1.5px solid #e4e0e8;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
    '.wt-w i{display:block;width:20px;border-radius:99px;background:' + BLACK + '}',
    '.wt-w.on{border-color:' + PURPLE + ';background:#f3eef8}',
    /* таймер */
    '#wtTimerBtn{background:#fff;color:' + PURPLE + ';border:2px solid ' + PURPLE + '}#wtTimerBtn.on{background:' + PURPLE + ';color:#fff}',
    '.wt-timer{width:232px;align-items:stretch}',
    '.wt-tm-modes{display:grid;grid-template-columns:1fr 1fr;gap:5px}',
    '.wt-tm-modes button,.wt-tm-pre button,.wt-tm-go button{border:1.5px solid #e4e0e8;background:#fff;border-radius:8px;cursor:pointer;font:inherit;font-size:.82rem;padding:6px 4px;color:' + BLACK + '}',
    '.wt-tm-modes button.on{border-color:' + PURPLE + ';background:#f3eef8;font-weight:700}',
    '.wt-tm-pre{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}',
    '.wt-tm-pre button{padding:6px 0;font-size:.76rem}.wt-tm-pre button.on{border-color:' + PURPLE + ';background:#f3eef8;font-weight:700}',
    '.wt-tm-cust{display:flex;align-items:center;gap:6px;font-size:.8rem;color:#6b6475}',
    '.wt-tm-cust input{width:64px;border:1.5px solid #e4e0e8;border-radius:8px;padding:5px 6px;font:inherit;font-size:16px}',
    '.wt-tm-big{font-size:2.1rem;font-weight:800;text-align:center;color:' + PURPLE + ';font-variant-numeric:tabular-nums;letter-spacing:.02em;line-height:1.1}',
    '.wt-tm-go{display:grid;grid-template-columns:2fr 1fr;gap:5px}',
    '.wt-tm-go button.main{background:' + PURPLE + ';border-color:' + PURPLE + ';color:#fff;font-weight:700}',
    '.wt-pill{position:fixed;z-index:9997;background:' + PURPLE + ';color:#fff;border-radius:99px;padding:5px 13px;font-size:.95rem;font-weight:800;font-variant-numeric:tabular-nums;box-shadow:0 3px 10px rgba(45,25,60,.35);cursor:pointer;user-select:none;-webkit-user-select:none;font-family:inherit;display:none}',
    '.wt-pill.show{display:block}.wt-pill.paused{background:#7b6a8e}',
    '.wt-pill.done{background:#d6342c;animation:wtBlink .8s steps(2,start) infinite}',
    '@keyframes wtBlink{50%{opacity:.45}}'
  ].join('\n');
  document.head.appendChild(st);

  /* ---------- разметка ---------- */
  var host = document.querySelector('.scroll-area') || document.body;
  var ink = document.createElement('canvas'); ink.id = 'wtInk';
  var laserCv = document.createElement('canvas'); laserCv.id = 'wtLaser';
  host.appendChild(ink); host.appendChild(laserCv);
  var ctx = ink.getContext('2d'), lctx = laserCv.getContext('2d');

  var TOOLS = [
    ['select', '✥', 'Двигать нарисованное (страница прокручивается как обычно)'], ['pen', '✏️', 'Ручка'], ['highlighter', '🖍️', 'Маркер'],
    ['line', '╱', 'Линия'], ['arrow', '➔', 'Стрелка'], ['rect', '▭', 'Прямоугольник'], ['ellipse', '◯', 'Овал'],
    ['triangle', '△', 'Треугольник'], ['eraser', '🧹', 'Ластик'], ['laser', '🔴', 'Лазерная указка'], ['text', 'T', 'Текст']
  ];
  var COLORS = [['#2D2926', 'Чёрный'], ['#d6342c', 'Красный'], ['#2e6fd6', 'Синий'], ['#3fa66b', 'Зелёный'], ['#FED500', 'Жёлтый'],
    ['#5E4877', 'Фиолетовый'], ['#e8578c', 'Розовый'], ['#1f9e94', 'Бирюзовый'], ['#e8762c', 'Оранжевый'], ['#8a5a3f', 'Коричневый']];
  var EGG = ['strawberry-sparkle', 'vzhukh', 'nice', 'not_bad', 'angle-flower', 'angle-stars', 'fire', 'hehe', 'imagination-a', 'not_hehe'];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var dock = el('div', 'wt-dock');
  var noteBtn = el('button', 'wt-btn', '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>');
  noteBtn.id = 'wtNoteBtn'; noteBtn.type = 'button'; noteBtn.title = 'Заметки (перетащи, чтобы передвинуть)';
  var inkBtn = el('button', 'wt-btn', '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>');
  inkBtn.id = 'wtInkBtn'; inkBtn.type = 'button'; inkBtn.title = 'Рисование (перетащи, чтобы передвинуть)';
  var timerBtn = el('button', 'wt-btn', '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>');
  timerBtn.id = 'wtTimerBtn'; timerBtn.type = 'button'; timerBtn.title = 'Таймер (перетащи, чтобы передвинуть)';
  dock.appendChild(noteBtn); dock.appendChild(inkBtn); dock.appendChild(timerBtn);
  document.body.appendChild(dock);

  var panel = el('div', 'wt-panel'); panel.hidden = true;
  panel.id = 'wtInkPanel'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Инструменты рисования');
  inkBtn.setAttribute('aria-controls', panel.id); inkBtn.setAttribute('aria-expanded', 'false');
  inkBtn.setAttribute('aria-pressed', 'false');
  var collapseB = el('button', 'wt-collapse', 'Свернуть панель'); collapseB.type = 'button';
  collapseB.title = 'Продолжить рисование без панели';
  collapseB.addEventListener('click', hideInkPanel);
  var gTools = el('div', 'wt-grid wt-tools');
  TOOLS.forEach(function (t, i) {
    var b = el('button', 'wt-t' + (t[0] === 'pen' ? ' on' : ''), t[1]); b.type = 'button'; b.dataset.tool = t[0]; b.title = t[2]; gTools.appendChild(b);
  });
  var fillBtn = el('button', 'wt-t', '◧'); fillBtn.type = 'button'; fillBtn.title = 'Прозрачная заливка у фигур'; gTools.appendChild(fillBtn);
  var gWidths = el('div', 'wt-grid wt-widths');
  [2, 3, 5, 8, 12].forEach(function (w) {
    var b = el('button', 'wt-w' + (w === 3 ? ' on' : ''), '<i style="height:' + Math.min(w, 12) + 'px"></i>'); b.type = 'button'; b.dataset.w = w; b.title = 'Толщина ' + w; gWidths.appendChild(b);
  });
  var gColors = el('div', 'wt-grid wt-colors');
  COLORS.forEach(function (c, i) {
    var b = el('button', 'wt-c' + (i === 0 ? ' on' : '')); b.type = 'button'; b.dataset.color = c[0]; b.title = c[1]; b.style.background = c[0]; gColors.appendChild(b);
  });
  var gStk = el('div', 'wt-grid wt-stk');
  var crossBtn = el('button', 'wt-s', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="' + RED + '" stroke-width="3.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>');
  crossBtn.type = 'button'; crossBtn.title = 'Красный крест (неверно)'; crossBtn.dataset.cross = '1'; gStk.appendChild(crossBtn);
  [['❤️', 'Сердце'], ['⭐', 'Звезда'], ['✅', 'Галочка'], ['🔥', 'Огонь']].forEach(function (e) {
    var b = el('button', 'wt-s', e[0]); b.type = 'button'; b.title = e[1]; b.dataset.emoji = e[0]; gStk.appendChild(b);
  });
  var gActs = el('div', 'wt-grid wt-acts');
  var undoB = el('button', 'wt-a', '↶'), redoB = el('button', 'wt-a', '↷'), clearB = el('button', 'wt-a', '🗑️'), doneB = el('button', 'wt-a', '✓');
  [undoB, redoB, clearB, doneB].forEach(function (b, i) { b.type = 'button'; b.title = ['Отменить', 'Повторить', 'Стереть всё на странице', 'Готово'][i]; gActs.appendChild(b); });
  panel.appendChild(collapseB); panel.appendChild(gTools); panel.appendChild(gWidths); panel.appendChild(gColors); panel.appendChild(gStk); panel.appendChild(gActs);
  document.body.appendChild(panel);

  var notePanel = el('div', 'wt-panel wt-note'); notePanel.hidden = true;
  notePanel.innerHTML = '<div class="wt-nh"><span>Заметки</span><button type="button" class="wt-nx" title="Закрыть">✕</button></div>' +
    '<textarea class="wt-nt" placeholder="Пиши здесь..."></textarea>' +
    '<div class="wt-nf"><span class="wt-saved">✓ сохранено</span><button type="button" title="Очистить заметки">🗑️</button></div>';
  document.body.appendChild(notePanel);

  var tmPanel = el('div', 'wt-panel wt-timer'); tmPanel.hidden = true;
  tmPanel.innerHTML = '<div class="wt-tm-modes"><button type="button" data-m="down">Таймер</button><button type="button" data-m="up">Секундомер</button></div>' +
    '<div class="wt-tm-pre">' + [[30, '30 с'], [60, '1 мин'], [120, '2 мин'], [180, '3 мин'], [300, '5 мин']].map(function (p) { return '<button type="button" data-sec="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
    '<label class="wt-tm-cust">Своё время: <input type="number" min="1" max="180" inputmode="numeric" placeholder="мин"></label>' +
    '<div class="wt-tm-big">01:00</div>' +
    '<div class="wt-tm-go"><button type="button" class="main">Старт</button><button type="button" data-reset>Сброс</button></div>';
  document.body.appendChild(tmPanel);
  var pill = el('div', 'wt-pill'); pill.title = 'Таймер: нажми, чтобы открыть'; document.body.appendChild(pill);

  /* ---------- положение дока: над бейджем ANGLE, можно перетащить ---------- */
  var DOCK_KEY = 'angle_dock_v2';
  function headerBottom() { var h = document.querySelector('.topbar,header'); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function placeDock(left, top) {
    var w = dock.offsetWidth || 40, h = dock.offsetHeight || 136;
    left = clamp(left, 6, window.innerWidth - w - 6);
    top = clamp(top, headerBottom() + 6, window.innerHeight - h - 6);
    dock.style.left = left + 'px'; dock.style.top = top + 'px';
    if (pill) placePill();
    return [left, top];
  }
  function defaultDock() {
    var badge = document.querySelector('.angle-badge');
    var bTop = badge ? badge.getBoundingClientRect().top : window.innerHeight - 14;
    var h = dock.offsetHeight || 136;
    var left = badge ? Math.max(8, badge.getBoundingClientRect().left) : 14;
    placeDock(left, bTop - h - 10);
  }
  var userMoved = false;
  try { var sp = JSON.parse(localStorage.getItem(DOCK_KEY) || 'null'); if (sp) { userMoved = true; placeDock(sp[0], sp[1]); } } catch (e) { }
  if (!userMoved) defaultDock();
  window.addEventListener('resize', function () {
    if (userMoved) placeDock(parseFloat(dock.style.left), parseFloat(dock.style.top)); else defaultDock();
    reposition();
  });
  window.addEventListener('load', function () { if (!userMoved) defaultDock(); });

  var drag = null, dragMoved = false;
  dock.addEventListener('pointerdown', function (e) {
    var r = dock.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, l: r.left, t: r.top }; dragMoved = false;
  });
  dock.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragMoved = true;
      try { dock.setPointerCapture(e.pointerId); } catch (x) { }   // захват только когда реально тянем: иначе обычный клик по кнопке не дойдёт до неё
    }
    if (dragMoved) { placeDock(drag.l + dx, drag.t + dy); reposition(); }
  });
  function endDock() {
    if (drag && dragMoved) { userMoved = true; try { localStorage.setItem(DOCK_KEY, JSON.stringify([parseFloat(dock.style.left), parseFloat(dock.style.top)])); } catch (e) { } }
    drag = null;
  }
  dock.addEventListener('pointerup', endDock); dock.addEventListener('pointercancel', endDock);
  dock.addEventListener('click', function (e) { if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; } }, true);

  /* панель открывается над доком (или под ним, если док в верхней половине); не залезает под шапку */
  function attach(p, anchorBtn) {
    p.style.maxHeight = ''; p.style.visibility = 'hidden'; p.hidden = false;
    var d = anchorBtn.getBoundingClientRect(), dk = dock.getBoundingClientRect();
    var pw = p.offsetWidth, ph = p.offsetHeight, top0 = headerBottom() + 6;
    var left = clamp(dk.left, 8, window.innerWidth - pw - 8);
    var above = dk.top - top0 > window.innerHeight - dk.bottom;
    var maxH, top;
    if (above) { maxH = dk.top - top0 - 8; top = Math.max(top0, dk.top - 8 - Math.min(ph, maxH)); }
    else { maxH = window.innerHeight - dk.bottom - 14; top = dk.bottom + 8; }
    p.style.maxHeight = Math.max(120, maxH) + 'px';
    p.style.left = left + 'px'; p.style.top = top + 'px'; p.style.visibility = '';
  }
  function reposition() {
    if (!panel.hidden) attach(panel, inkBtn);
    if (!notePanel.hidden) attach(notePanel, noteBtn);
    if (!tmPanel.hidden) attach(tmPanel, timerBtn);
  }

  /* ---------- заметки ---------- */
  var NOTE_KEY = 'angle_notes::' + location.pathname;
  var nt = notePanel.querySelector('.wt-nt'), saved = notePanel.querySelector('.wt-saved');
  try { var sv = localStorage.getItem(NOTE_KEY); if (sv) nt.value = sv; } catch (e) { }
  var nTimer, hTimer;
  nt.addEventListener('input', function () {
    clearTimeout(nTimer);
    nTimer = setTimeout(function () {
      try { localStorage.setItem(NOTE_KEY, nt.value); } catch (e) { }
      saved.classList.add('show'); clearTimeout(hTimer); hTimer = setTimeout(function () { saved.classList.remove('show'); }, 1500);
    }, 400);
  });
  function setNote(on) { noteBtn.classList.toggle('on', on); if (on) { setInk(false); setTimerPanel(false); attach(notePanel, noteBtn); } else notePanel.hidden = true; }
  noteBtn.addEventListener('click', function () { setNote(notePanel.hidden); });
  notePanel.querySelector('.wt-nx').addEventListener('click', function () { setNote(false); });
  notePanel.querySelector('.wt-nf button').addEventListener('click', function () {
    if (!nt.value || confirm('Очистить заметки?')) { nt.value = ''; try { localStorage.removeItem(NOTE_KEY); } catch (e) { } }
  });

  /* ---------- рисование: данные ---------- */
  var INK_KEY = 'angle_ink::' + location.pathname;
  var all = {}, hist = {}, redo = {};
  try { all = JSON.parse(localStorage.getItem(INK_KEY) || '{}') || {}; } catch (e) { }
  function persist() { try { localStorage.setItem(INK_KEY, JSON.stringify(all)); } catch (e) { } }
  function pageKey() {
    var p = document.querySelector('.page.active[data-page]');
    if (p) return 'p' + p.getAttribute('data-page');
    var pages = document.querySelectorAll('.page');
    if (pages.length > 1) for (var i = 0; i < pages.length; i++) if (pages[i].classList.contains('active')) return i === 0 ? 'single' : 'p' + i;
    return 'single';
  }
  function list() { var k = pageKey(); return all[k] || (all[k] = []); }
  function hs(k) { if (!hist[k]) { hist[k] = (all[k] || []).map(function (s) { return { k: 'add', s: s }; }); } return hist[k]; }
  function push(op) { var k = pageKey(); hs(k).push(op); redo[k] = []; persist(); refreshActs(); }
  function refreshActs() { var k = pageKey(); undoB.disabled = !hs(k).length; redoB.disabled = !(redo[k] && redo[k].length); }

  function move(s, dx, dy) {
    if (s.points) s.points.forEach(function (p) { p[0] += dx; p[1] += dy; });
    else if (s.x1 != null) { s.x1 += dx; s.x2 += dx; s.y1 += dy; s.y2 += dy; }
    else { s.x += dx; s.y += dy; }
  }
  function apply(op, undo) {
    var l = list();
    if (op.k === 'add') { if (undo) { var i = l.indexOf(op.s); if (i >= 0) l.splice(i, 1); } else l.push(op.s); }
    else if (op.k === 'move') { move(op.s, undo ? -op.dx : op.dx, undo ? -op.dy : op.dy); }
    else if (op.k === 'del') { if (undo) l.splice(Math.min(op.i, l.length), 0, op.s); else { var j = l.indexOf(op.s); if (j >= 0) l.splice(j, 1); } }
    else if (op.k === 'clear') { if (undo) { l.length = 0; op.list.forEach(function (s) { l.push(s); }); } else l.length = 0; }
  }
  undoB.addEventListener('click', function () {
    var k = pageKey(), h = hs(k); if (!h.length) return;
    var op = h.pop(); apply(op, true); (redo[k] = redo[k] || []).push(op); sel = null; persist(); refreshActs(); draw();
  });
  redoB.addEventListener('click', function () {
    var k = pageKey(), r = redo[k]; if (!r || !r.length) return;
    var op = r.pop(); apply(op, false); hs(k).push(op); persist(); refreshActs(); draw();
  });
  clearB.addEventListener('click', function () {
    if (!list().length) return;
    if (!confirm('Стереть пометки на этой странице?')) return;
    cancelText();
    var old = list().slice(); list().length = 0; sel = null; push({ k: 'clear', list: old }); draw();
  });
  doneB.addEventListener('click', function () { setInk(false); });

  /* ---------- рисование: отрисовка ---------- */
  var dpr = 1;
  function measure() {
    ink.style.width = '0'; ink.style.height = '0'; laserCv.style.width = '0'; laserCv.style.height = '0';   // свои размеры не должны раздувать прокрутку
    return { w: host.clientWidth, h: host.scrollHeight };
  }
  var SZ = { w: 0, h: 0 };
  /* Масштаб страницы (Ctrl +/−) и ширина окна меняют, где стоит колонка с заданиями. Поэтому координаты рисунка хранятся
     от левого края колонки (а не от края окна), и пометки остаются на тех же словах при любом масштабе. */
  var AX = 0;
  function calcAX() {
    var a = document.querySelector('.page.active') || document.querySelector('.page-wrap, main, .wrap, .container');
    var ir = ink.getBoundingClientRect();
    AX = a && a.offsetWidth ? a.getBoundingClientRect().left - ir.left : SZ.w / 2;
  }
  function resize() {
    SZ = measure();
    // Live writing can make a page tens of thousands of CSS pixels tall.
    // Two full-height retina bitmaps otherwise exhaust the renderer's memory.
    // Keep CSS coordinates/annotation data intact; bound only backing buffers.
    var w = Math.max(1, SZ.w), h = Math.max(1, SZ.h);
    dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), 2,
      Math.sqrt(4000000 / (w * h)), 8192 / w, 8192 / h);
    [ink, laserCv].forEach(function (cv) {
      cv.style.width = SZ.w + 'px'; cv.style.height = SZ.h + 'px';
      cv.width = Math.max(1, Math.floor(w * dpr)); cv.height = Math.max(1, Math.floor(h * dpr));
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    calcAX(); draw(); refreshActs();
  }
  var imgs = {};
  function stickerImg(key) {
    if (imgs[key]) return imgs[key];
    if (typeof STICKER_DATA === 'undefined' || !STICKER_DATA[key]) return null;
    var im = new Image(); im.onload = draw; im.src = STICKER_DATA[key]; imgs[key] = im; return im;
  }
  function pathStyle(tool, w) {
    w = w || 3;
    if (tool === 'highlighter') return { w: w * 5, a: .35, cap: 'butt', comp: 'source-over' };
    if (tool === 'eraser') return { w: w * 7, a: 1, cap: 'round', comp: 'destination-out' };
    return { w: w, a: 1, cap: 'round', comp: 'source-over' };
  }
  function drawOne(s) {
    ctx.save();
    if (s.type === 'path') {
      if (s.points && s.points.length > 1) {
        var ps = pathStyle(s.tool, s.w);
        ctx.globalCompositeOperation = ps.comp; ctx.globalAlpha = ps.a; ctx.strokeStyle = s.color; ctx.lineWidth = ps.w; ctx.lineCap = ps.cap; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(s.points[0][0], s.points[0][1]);
        for (var i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
        ctx.stroke();
      }
    } else if (s.type === 'stamp') {
      if (s.cross) {
        var r = s.size * .34;
        ctx.strokeStyle = RED; ctx.lineWidth = Math.max(4, s.size / 6); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x - r, s.y - r); ctx.lineTo(s.x + r, s.y + r); ctx.moveTo(s.x + r, s.y - r); ctx.lineTo(s.x - r, s.y + r); ctx.stroke();
      } else if (s.img) {
        var im = stickerImg(s.img);
        if (im && im.complete && im.naturalWidth) {
          var k = Math.min(s.size / im.naturalWidth, s.size / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k;
          ctx.drawImage(im, s.x - dw / 2, s.y - dh / 2, dw, dh);
        }
      } else if (s.emoji) {
        ctx.font = Math.round(s.size * .9) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.emoji, s.x, s.y);
      }
    } else if (s.type === 'text') {
      var size = s.size || 20; ctx.fillStyle = s.color; ctx.font = size + 'px "Apercu Pro","Helvetica Neue",Arial,sans-serif'; ctx.textBaseline = 'top';
      String(s.text || '').split('\n').forEach(function (ln, i) { ctx.fillText(ln, s.x, s.y + i * Math.round(size * 1.25)); });
    } else {  // shape
      ctx.strokeStyle = s.color; ctx.lineWidth = s.w || 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2), w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
      if (s.tool === 'rect') { shapeFill(s, function () { ctx.beginPath(); ctx.rect(x, y, w, h); }); ctx.strokeRect(x, y, w, h); }
      else if (s.tool === 'ellipse') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2); shapeFillNow(s); ctx.stroke(); }
      else if (s.tool === 'triangle') { ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); shapeFillNow(s); ctx.stroke(); }
      else {
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        if (s.tool === 'arrow') {
          var a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), ah = 10 + (s.w || 3) * 1.6;
          ctx.beginPath(); ctx.moveTo(s.x2, s.y2); ctx.lineTo(s.x2 - ah * Math.cos(a - Math.PI / 7), s.y2 - ah * Math.sin(a - Math.PI / 7));
          ctx.moveTo(s.x2, s.y2); ctx.lineTo(s.x2 - ah * Math.cos(a + Math.PI / 7), s.y2 - ah * Math.sin(a + Math.PI / 7)); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  function shapeFill(s, mk) { if (!s.fill) return; mk(); shapeFillNow(s); }
  function shapeFillNow(s) { if (!s.fill) return; ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = s.color; ctx.fill(); ctx.restore(); }

  var cur = null, sel = null;
  function bbox(s) {
    if (s.points) {
      var xs = s.points.map(function (p) { return p[0]; }), ys = s.points.map(function (p) { return p[1]; });
      var pd = 8 + (s.w || 3) * (s.tool === 'highlighter' ? 2.5 : .5);
      return [Math.min.apply(0, xs) - pd, Math.min.apply(0, ys) - pd, Math.max.apply(0, xs) + pd, Math.max.apply(0, ys) + pd];
    }
    if (s.x1 != null) return [Math.min(s.x1, s.x2) - 6, Math.min(s.y1, s.y2) - 6, Math.max(s.x1, s.x2) + 6, Math.max(s.y1, s.y2) + 6];
    if (s.type === 'text') {
      ctx.save(); var sz = s.size || 20; ctx.font = sz + 'px "Apercu Pro","Helvetica Neue",Arial,sans-serif';
      var ls = String(s.text || '').split('\n'), w = 0; ls.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); }); ctx.restore();
      return [s.x - 4, s.y - 4, s.x + w + 4, s.y + ls.length * Math.round(sz * 1.25) + 4];
    }
    var r = (s.size || 40) / 2; return [s.x - r, s.y - r, s.x + r, s.y + r];
  }
  function draw() {
    ctx.clearRect(0, 0, SZ.w, SZ.h);
    ctx.save(); ctx.translate(AX, 0);
    list().forEach(drawOne);
    if (cur) drawOne(cur);
    if (sel && list().indexOf(sel) >= 0) {
      var b = bbox(sel);
      ctx.save(); ctx.strokeStyle = PURPLE; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); ctx.setLineDash([]);
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(b[2], b[1], 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b[2] - 4, b[1] - 4); ctx.lineTo(b[2] + 4, b[1] + 4); ctx.moveTo(b[2] + 4, b[1] - 4); ctx.lineTo(b[2] - 4, b[1] + 4); ctx.stroke();
      ctx.restore();
    } else sel = null;
    ctx.restore();
  }

  /* ---------- рисование: ввод ---------- */
  var tool = 'pen', color = '#2D2926', fill = false, stamp = null, drawing = false, textTa = null, lw = 3;
  try { var sw = parseInt(localStorage.getItem('angle_ink_w'), 10); if (sw > 0) { lw = sw; gWidths.querySelectorAll('.wt-w').forEach(function (b) { b.classList.toggle('on', +b.dataset.w === lw); }); } } catch (e) { }
  gWidths.addEventListener('click', function (e) {
    var b = e.target.closest('.wt-w'); if (!b) return;
    lw = +b.dataset.w; try { localStorage.setItem('angle_ink_w', lw); } catch (x) { }
    gWidths.querySelectorAll('.wt-w').forEach(function (x) { x.classList.toggle('on', x === b); });
  });
  function pt(e) { var r = ink.getBoundingClientRect(); return [e.clientX - r.left - AX, e.clientY - r.top]; }

  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function hit(s, p) {
    if (s.points) { for (var i = 1; i < s.points.length; i++) if (segDist(p, s.points[i - 1], s.points[i]) <= 12) return true; return false; }
    if (s.x1 != null && (s.tool === 'line' || s.tool === 'arrow')) return segDist(p, [s.x1, s.y1], [s.x2, s.y2]) <= 12;
    var b = bbox(s); return p[0] >= b[0] - 4 && p[0] <= b[2] + 4 && p[1] >= b[1] - 4 && p[1] <= b[3] + 4;
  }
  function pick(p) { var l = list(); for (var i = l.length - 1; i >= 0; i--) if (l[i].tool !== 'eraser' && hit(l[i], p)) return l[i]; return null; }

  /* двигать нарисованное: мышь и касания обрабатываем на самой странице, чтобы пустое место прокручивалось как обычно */
  var mv = null;
  function mvStart(cx, cy, ev) {
    if (tool !== 'select' || ink.style.pointerEvents === 'auto') return false;
    if (ev.target && ev.target.closest('.wt-dock,.wt-panel')) return false;
    var p = pt({ clientX: cx, clientY: cy });
    if (sel && list().indexOf(sel) >= 0) {
      var b = bbox(sel);
      if (Math.hypot(p[0] - b[2], p[1] - b[1]) <= 14) { var i = list().indexOf(sel), s = sel; list().splice(i, 1); sel = null; push({ k: 'del', s: s, i: i }); draw(); if (ev.cancelable) ev.preventDefault(); return true; }
    }
    var s2 = pick(p);
    sel = s2; draw();
    if (!s2) return false;
    hideInkPanel();
    mv = { s: s2, x: cx, y: cy, dx: 0, dy: 0 };
    if (ev.cancelable) ev.preventDefault();
    return true;
  }
  function mvMove(cx, cy, ev) {
    if (!mv) return;
    var dx = cx - mv.x - mv.dx, dy = cy - mv.y - mv.dy;
    move(mv.s, dx, dy); mv.dx += dx; mv.dy += dy; draw();
    if (ev.cancelable) ev.preventDefault();
  }
  function mvEnd() {
    if (!mv) return;
    if (mv.dx || mv.dy) push({ k: 'move', s: mv.s, dx: mv.dx, dy: mv.dy });
    mv = null;
  }
  host.addEventListener('touchstart', function (e) { if (e.touches.length === 1) mvStart(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
  host.addEventListener('touchmove', function (e) { if (mv) mvMove(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
  host.addEventListener('touchend', mvEnd); host.addEventListener('touchcancel', mvEnd);
  host.addEventListener('mousedown', function (e) { if (e.button === 0) mvStart(e.clientX, e.clientY, e); });
  window.addEventListener('mousemove', function (e) { mvMove(e.clientX, e.clientY, e); });
  window.addEventListener('mouseup', mvEnd);

  function commitText(save) {
    if (!textTa) return;
    var ta = textTa, p = ta.__pt, val = ta.value; textTa = null;
    if (ta.parentNode) ta.parentNode.removeChild(ta);
    if (save && val.trim()) { var s = { type: 'text', x: p[0], y: p[1], text: val, color: color, size: 20 }; list().push(s); push({ k: 'add', s: s }); }
    draw();
  }
  function cancelText() { commitText(false); }
  function startText(p) {
    commitText(true);
    var ta = document.createElement('textarea'); ta.rows = 1; ta.__pt = p;
    ta.style.cssText = 'position:absolute;left:' + (p[0] + AX) + 'px;top:' + p[1] + 'px;min-width:120px;max-width:60vw;font:20px "Apercu Pro","Helvetica Neue",Arial,sans-serif;color:' + color +
      ';background:rgba(255,255,255,.85);border:1.5px dashed ' + color + ';border-radius:4px;padding:2px 4px;z-index:600;resize:none;overflow:hidden;line-height:1.25;';
    host.appendChild(ta); textTa = ta;
    function auto() { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
    ta.addEventListener('input', auto);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); commitText(false); } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(true); }
    });
    ta.addEventListener('blur', function () { commitText(true); });
    auto(); setTimeout(function () { ta.focus(); }, 0);
  }

  ink.addEventListener('pointerdown', function (e) {
    if (ink.style.pointerEvents !== 'auto' || tool === 'select') return;
    hideInkPanel();
    if (tool === 'laser') return;
    var p = pt(e);
    if (tool === 'sticker') {
      if (!stamp) return;
      var s = { type: 'stamp', x: p[0], y: p[1], size: 40 };
      if (stamp.cross) s.cross = true; else if (stamp.emoji) s.emoji = stamp.emoji; else s.img = stamp.img;
      list().push(s); push({ k: 'add', s: s }); draw(); return;
    }
    if (tool === 'text') { startText(p); return; }
    drawing = true;
    cur = (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') ? { type: 'path', tool: tool, color: color, w: lw, points: [p] }
      : { type: 'shape', tool: tool, color: color, w: lw, fill: fill && (tool === 'rect' || tool === 'ellipse' || tool === 'triangle'), x1: p[0], y1: p[1], x2: p[0], y2: p[1] };
    draw();
  });
  var trail = [];
  ink.addEventListener('pointermove', function (e) {
    if (tool === 'laser' && ink.style.pointerEvents === 'auto') { var lp = pt(e); trail.push({ x: lp[0] + AX, y: lp[1], t: Date.now() }); }
    if (!drawing || !cur) return;
    var p = pt(e);
    if (cur.type === 'path') cur.points.push(p); else { cur.x2 = p[0]; cur.y2 = p[1]; }
    draw();
  });
  function up() {
    if (!drawing || !cur) return;
    drawing = false; var s = cur; cur = null;
    list().push(s); push({ k: 'add', s: s }); draw();
  }
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);

  (function laserLoop() {
    lctx.clearRect(0, 0, SZ.w, SZ.h);
    var now = Date.now(); trail = trail.filter(function (p) { return now - p.t < 450; });
    trail.forEach(function (p) {
      var age = (now - p.t) / 450;
      lctx.beginPath(); lctx.fillStyle = 'rgba(214,52,44,' + ((1 - age) * .85) + ')'; lctx.arc(p.x, p.y, Math.max(8 * (1 - age * .5), 1), 0, Math.PI * 2); lctx.fill();
    });
    requestAnimationFrame(laserLoop);
  })();

  /* ---------- панель: выбор инструментов ---------- */
  function setTool(t) {
    commitText(true); tool = t; stamp = null;
    gTools.querySelectorAll('.wt-t[data-tool]').forEach(function (b) { b.classList.toggle('on', b.dataset.tool === t); });
    gStk.querySelectorAll('.wt-s').forEach(function (b) { b.classList.remove('on'); });
    if (t !== 'select') sel = null;
    // пока выбран «двигать», холст не перехватывает касания: страница прокручивается, а нарисованное цепляется само
    ink.style.pointerEvents = (inkOn && t !== 'select') ? 'auto' : 'none';
    hideInkPanel();
    draw();
  }
  gTools.addEventListener('click', function (e) { var b = e.target.closest('.wt-t[data-tool]'); if (b) setTool(b.dataset.tool); });
  fillBtn.addEventListener('click', function () { fill = !fill; fillBtn.classList.toggle('on', fill); });
  gColors.addEventListener('click', function (e) {
    var b = e.target.closest('.wt-c'); if (!b) return;
    gColors.querySelectorAll('.wt-c').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); color = b.dataset.color;
  });
  function pickStamp(s, btn) {
    commitText(true); tool = 'sticker'; stamp = s; sel = null;
    gTools.querySelectorAll('.wt-t[data-tool]').forEach(function (b) { b.classList.remove('on'); });
    gStk.querySelectorAll('.wt-s').forEach(function (b) { b.classList.remove('on'); }); btn.classList.add('on');
    ink.style.pointerEvents = inkOn ? 'auto' : 'none'; draw();
    hideInkPanel();
  }
  crossBtn.addEventListener('click', function () { pickStamp({ cross: true }, crossBtn); });
  gStk.querySelectorAll('.wt-s[data-emoji]').forEach(function (b) { b.addEventListener('click', function () { pickStamp({ emoji: b.dataset.emoji }, b); }); });
  function addEgg() {
    if (typeof STICKER_DATA === 'undefined') return;
    EGG.forEach(function (key) {
      if (!STICKER_DATA[key]) return;
      var b = el('button', 'wt-s'); b.type = 'button'; b.title = 'eggdog'; b.style.backgroundImage = 'url(' + STICKER_DATA[key] + ')';
      b.addEventListener('click', function () { pickStamp({ img: key }, b); }); gStk.appendChild(b);
    });
    reposition();
  }
  function haveAllEgg() { return typeof STICKER_DATA !== 'undefined' && EGG.every(function (k) { return STICKER_DATA[k]; }); }
  if (haveAllEgg()) addEgg();
  else if (typeof STICKER_DATA !== 'undefined' && window.fetch) {
    /* на странице вшит старый, неполный набор стикеров (аудирование ЕГЭ): докладываем недостающие из общего файла */
    fetch(base + '/assets/sticker-data.js').then(function (r) { return r.text(); }).then(function (t) {
      var o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      for (var k in o) if (!STICKER_DATA[k]) STICKER_DATA[k] = o[k];
      addEgg();
    }).catch(addEgg);
  } else { var sd = document.createElement('script'); sd.src = base + '/assets/sticker-data.js'; sd.onload = addEgg; document.head.appendChild(sd); }

  var inkOn = false;
  function hideInkPanel() {
    panel.hidden = true; inkBtn.setAttribute('aria-expanded', 'false');
    if (inkOn) inkBtn.title = 'Открыть инструменты рисования';
  }
  function showInkPanel() {
    attach(panel, inkBtn); inkBtn.setAttribute('aria-expanded', 'true');
    inkBtn.title = 'Выключить рисование';
  }
  function setInk(on) {
    if (!on) commitText(true);
    inkOn = on; inkBtn.classList.toggle('on', on);
    inkBtn.setAttribute('aria-pressed', String(on));
    if (on) { setNote(false); setTimerPanel(false); showInkPanel(); }
    else { hideInkPanel(); inkBtn.title = 'Рисование (перетащи, чтобы передвинуть)'; }
    ink.style.pointerEvents = (on && tool !== 'select') ? 'auto' : 'none';
  }
  inkBtn.addEventListener('click', function () {
    if (inkOn && panel.hidden) showInkPanel(); else setInk(!inkOn);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) {
      var i = list().indexOf(sel); if (i >= 0) { var s = sel; list().splice(i, 1); sel = null; push({ k: 'del', s: s, i: i }); draw(); e.preventDefault(); }
    }
  });

  /* ---------- таймер: обратный отсчёт и секундомер; состояние переживает перезагрузку страницы ---------- */
  var TM_KEY = 'angle_timer::' + location.pathname;
  var tm = { mode: 'down', total: 60000, running: false, t0: 0, acc: 0, done: false };
  try { var ts = JSON.parse(localStorage.getItem(TM_KEY) || 'null'); if (ts) for (var tk in ts) tm[tk] = ts[tk]; } catch (e) { }
  var tmBig = tmPanel.querySelector('.wt-tm-big'), tmMain = tmPanel.querySelector('.wt-tm-go .main'), tmCust = tmPanel.querySelector('.wt-tm-cust input');
  function tmSave() { try { localStorage.setItem(TM_KEY, JSON.stringify(tm)); } catch (e) { } }
  function tmElapsed() { return tm.acc + (tm.running ? Date.now() - tm.t0 : 0); }
  function tmFmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return (h ? h + ':' + z(m) : z(m)) + ':' + z(x);
  }
  var ac = null;
  function tmUnlock() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { } }
  function tmBeep() {
    try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) { }
    if (!ac) return;
    [0, .35, .7].forEach(function (d) {
      var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = .18; o.connect(g); g.connect(ac.destination);
      o.start(ac.currentTime + d); o.stop(ac.currentTime + d + .22);
    });
  }
  function placePill() {
    if (!pill.classList.contains('show')) return;
    var d = dock.getBoundingClientRect(), pw = pill.offsetWidth, ph = pill.offsetHeight;
    var left = d.right + 8; if (left + pw > window.innerWidth - 6) left = d.left - pw - 8;
    pill.style.left = Math.max(6, left) + 'px'; pill.style.top = (d.bottom - 40 + (40 - ph) / 2) + 'px';
  }
  function tmRender() {
    var up = tm.mode === 'up', el_ = tmElapsed(), shown = up ? el_ : Math.max(0, tm.total - el_);
    var txt = tmFmt(shown);
    tmBig.textContent = txt; pill.textContent = txt;
    tmMain.textContent = tm.running ? 'Пауза' : (tm.acc > 0 && !tm.done ? 'Продолжить' : 'Старт');
    tmMain.disabled = tm.done;
    tmPanel.querySelectorAll('[data-m]').forEach(function (b) { b.classList.toggle('on', b.dataset.m === tm.mode); });
    tmPanel.querySelector('.wt-tm-pre').style.display = tmCust.parentNode.style.display = up ? 'none' : '';
    tmPanel.querySelectorAll('[data-sec]').forEach(function (b) { b.classList.toggle('on', +b.dataset.sec * 1000 === tm.total); });
    var vis = tm.running || tm.acc > 0 || tm.done;
    pill.classList.toggle('show', vis); pill.classList.toggle('paused', vis && !tm.running && !tm.done); pill.classList.toggle('done', tm.done);
    timerBtn.classList.toggle('on', !tmPanel.hidden);
    placePill();
  }
  function tmTick() {
    if (tm.running && tm.mode === 'down' && tmElapsed() >= tm.total) { tm.running = false; tm.acc = tm.total; tm.done = true; tmSave(); tmBeep(); }
    tmRender();
  }
  function tmReset() { tm.running = false; tm.acc = 0; tm.t0 = 0; tm.done = false; tmSave(); tmRender(); }
  tmMain.addEventListener('click', function () {
    tmUnlock();
    if (tm.running) { tm.acc = tmElapsed(); tm.running = false; }
    else { tm.t0 = Date.now(); tm.running = true; tm.done = false; }
    tmSave(); tmRender();
  });
  tmPanel.querySelector('[data-reset]').addEventListener('click', tmReset);
  tmPanel.querySelector('.wt-tm-modes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-m]'); if (!b || b.dataset.m === tm.mode) return; tm.mode = b.dataset.m; tmReset();
  });
  tmPanel.querySelector('.wt-tm-pre').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sec]'); if (!b) return; tm.total = +b.dataset.sec * 1000; tmCust.value = ''; tmReset();
  });
  tmCust.addEventListener('input', function () {
    var v = parseInt(tmCust.value, 10); if (v > 0 && v <= 180) { tm.total = v * 60000; tmReset(); }
  });
  function setTimerPanel(on) {
    if (on) { setNote(false); setInk(false); tmRender(); attach(tmPanel, timerBtn); } else tmPanel.hidden = true;
    timerBtn.classList.toggle('on', on);
  }
  timerBtn.addEventListener('click', function () { setTimerPanel(tmPanel.hidden); });
  pill.addEventListener('click', function () { if (tm.done) tmReset(); else setTimerPanel(tmPanel.hidden); });
  setInterval(tmTick, 250); tmRender();

  var rt; function later() { clearTimeout(rt); rt = setTimeout(resize, 150); }
  window.addEventListener('resize', later);
  if (window.ResizeObserver) new ResizeObserver(later).observe(host);
  new MutationObserver(function (m) { for (var i = 0; i < m.length; i++) if (m[i].attributeName === 'class') { later(); return; } }).observe(host, { attributes: true, attributeFilter: ['class'], subtree: true });
  resize();
})();
