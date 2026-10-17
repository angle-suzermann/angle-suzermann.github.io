/* ANGLE collaborative writing — совместное письмо в реальном времени.
   Подключение: см. _templates/collab-snippet.html.
   Хранилище: Firebase Realtime Database (адрес — в assets/collab-config.js).

   Разметка на странице:
     <div class="collab" data-room="unit9-story"
          data-mode="blocks"                 blocks | shared (по умолчанию blocks)
          data-prompt="Write a story…"></div>

   Режимы (учитель переключает на странице, выбор хранится в комнате):
     blocks — у каждого свой блок, остальные видят его вживую, но не правят;
     shared — общий текст из абзацев: каждый правит только свои, новые добавляются кнопкой.
   Учитель: ссылка с ?teacher=<teacherKey из collab-config.js>. Это удобство, а не защита. */
(function () {
  'use strict';

  var CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var SEND_DELAY = 300;
  var MAX_TEXT = 5000;

  /* ---------- стили ---------- */
  var css = [
    '.collab{--c-p:var(--purple,#5b2e8b);--c-y:var(--yellow,#ffd400);--c-b:var(--neutral-border,#d9d2e6);font-family:inherit;color:inherit}',
    '.collab *{box-sizing:border-box}',
    '.cb-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 12px;font-size:14px}',
    '.cb-dot{width:10px;height:10px;border-radius:50%;background:#bbb;flex:none}',
    '.cb-dot.on{background:#2e9e5b}.cb-dot.err{background:#d6453d}',
    '.cb-spacer{flex:1}',
    '.cb-btn{font:inherit;font-weight:700;border:2px solid var(--c-p);background:#fff;color:var(--c-p);border-radius:10px;padding:6px 12px;cursor:pointer}',
    '.cb-btn:hover{background:var(--c-p);color:#fff}',
    '.cb-btn.on{background:var(--c-p);color:#fff}',
    '.cb-btn.main{background:var(--c-y);border-color:var(--c-y);color:#000}',
    '.cb-prompt{margin:0 0 12px;font-weight:700}',
    '.cb-join{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}',
    '.cb-join input{font:inherit;padding:8px 10px;border:2px solid var(--c-b);border-radius:10px;min-width:200px;flex:1}',
    '.cb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}',
    '.cb-card{border:2px solid var(--c-b);border-radius:14px;background:#fff;padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
    '.cb-card.mine{border-color:var(--c-p)}',
    '.cb-head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700}',
    '.cb-head .cb-meta{margin-left:auto;font-weight:400;opacity:.65}',
    '.cb-x{border:0;background:none;cursor:pointer;font-size:16px;opacity:.5;padding:0 2px}.cb-x:hover{opacity:1}',
    '.cb-ta,.cb-ro{font:inherit;width:100%;min-height:150px;border:1px solid var(--c-b);border-radius:10px;padding:8px 10px;line-height:1.45;resize:vertical}',
    '.cb-ro{background:#f6f3fb;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.cb-empty{opacity:.55;font-style:italic}',
    '.cb-list{display:flex;flex-direction:column;gap:10px}',
    '.cb-list .cb-ta,.cb-list .cb-ro{min-height:70px}',
    '.cb-note{font-size:13px;opacity:.7;margin:10px 0 0}',
    '.cb-msg{padding:12px;border:2px dashed var(--c-b);border-radius:12px;font-size:14px}',
    '@media (hover:none) and (pointer:coarse){.cb-ta,.cb-join input{font-size:16px}}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- адаптер хранилища ---------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function getAdapter() {
    if (window.ANGLE_COLLAB_ADAPTER) return Promise.resolve(window.ANGLE_COLLAB_ADAPTER);
    var cfg = window.ANGLE_FIREBASE;
    if (!cfg || !cfg.databaseURL || /ВСТАВЬ|PASTE/i.test(cfg.databaseURL)) {
      return Promise.reject(new Error('config'));
    }
    return loadScript(CDN + 'firebase-app-compat.js')
      .then(function () { return loadScript(CDN + 'firebase-database-compat.js'); })
      .then(function () {
        var app = window.firebase.initializeApp({ databaseURL: cfg.databaseURL, apiKey: cfg.apiKey, projectId: cfg.projectId });
        var db = window.firebase.database(app);
        return {
          on: function (p, cb) { db.ref(p).on('value', function (s) { cb(s.val()); }); },
          status: function (cb) { db.ref('.info/connected').on('value', function (s) { cb(!!s.val()); }); },
          set: function (p, v) { return db.ref(p).set(v); },
          remove: function (p) { return db.ref(p).remove(); }
        };
      });
  }

  /* ---------- утилиты ---------- */
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function wc(n) { return n + (n === 1 ? ' word' : ' words'); }
  function words(t) { t = (t || '').trim(); return t ? t.split(/\s+/).length : 0; }
  function rid() { return Math.random().toString(36).slice(2, 10); }
  function safeKey(s) { return String(s).replace(/[.#$\[\]\/]/g, '_'); }

  /* ---------- компонент ---------- */
  function init(root) {
    var room = safeKey(root.getAttribute('data-room') || 'default');
    var defMode = root.getAttribute('data-mode') === 'shared' ? 'shared' : 'blocks';
    var prompt = root.getAttribute('data-prompt') || '';
    var cfg = window.ANGLE_FIREBASE || {};
    var q = new URLSearchParams(location.search);
    var isTeacher = !!q.get('teacher') && q.get('teacher') === (cfg.teacherKey || 'angle');
    var base = 'rooms/' + room;
    var uid = store('angle-collab-uid') || ('u' + rid() + rid());
    store('angle-collab-uid', uid);
    var name = isTeacher ? 'Teacher' : (store('angle-collab-name-' + room) || '');
    var data = { mode: defMode, blocks: {}, paras: {} };
    var adapter = null;
    var timers = {};

    root.textContent = '';
    var bar = el('div', 'cb-bar');
    var dot = el('span', 'cb-dot');
    var status = el('span', '', 'Connecting…');
    bar.appendChild(dot); bar.appendChild(status); bar.appendChild(el('span', 'cb-spacer'));
    root.appendChild(bar);
    if (prompt) root.appendChild(el('p', 'cb-prompt', prompt));
    var join = el('div', 'cb-join');
    var body = el('div');
    var foot = el('p', 'cb-note');
    root.appendChild(join); root.appendChild(body); root.appendChild(foot);

    var btnBlocks, btnShared, btnCopy, btnClear;
    function mkBtn(label, cls, fn) {
      var b = el('button', 'cb-btn ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', fn); return b;
    }
    if (isTeacher) {
      btnBlocks = mkBtn('Блок на каждого', '', function () { setMode('blocks'); });
      btnShared = mkBtn('Общий текст', '', function () { setMode('shared'); });
      bar.appendChild(btnBlocks); bar.appendChild(btnShared);
    }
    btnCopy = mkBtn('Скопировать всё', '', copyAll);
    bar.appendChild(btnCopy);
    if (isTeacher) {
      btnClear = mkBtn('Очистить комнату', '', function () {
        if (confirm('Удалить все тексты в этой комнате?')) {
          adapter.remove(base + '/blocks'); adapter.remove(base + '/paras');
        }
      });
      bar.appendChild(btnClear);
    }

    function setMode(m) { if (adapter) adapter.set(base + '/mode', m); }

    /* участник появляется у остальных сразу после входа, ещё до первой буквы */
    function announce() {
      if (!adapter || !name || isTeacher || data.mode !== 'blocks' || data.blocks[uid]) return;
      var obj = { uid: uid, name: name, text: '', ts: Date.now() };
      data.blocks[uid] = obj;
      adapter.set(base + '/blocks/' + uid, obj);
    }

    function buildJoin() {
      join.textContent = '';
      if (name || isTeacher) { join.style.display = 'none'; return; }
      join.style.display = '';
      var inp = el('input'); inp.type = 'text'; inp.maxLength = 40; inp.placeholder = 'Your name';
      var go = mkBtn('Join', 'main', function () {
        var v = inp.value.trim().slice(0, 40);
        if (!v) { inp.focus(); return; }
        name = v; store('angle-collab-name-' + room, name);
        buildJoin(); announce(); render(true);
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
      join.appendChild(inp); join.appendChild(go);
    }

    function queueSend(path, obj) {
      clearTimeout(timers[path]);
      timers[path] = setTimeout(function () {
        if (adapter) adapter.set(path, obj);
      }, SEND_DELAY);
    }
    function own(path, textarea, extra, metaEl) {
      textarea.addEventListener('input', function () {
        var t = textarea.value.slice(0, MAX_TEXT);
        metaEl.textContent = wc(words(t));
        var obj = { uid: uid, name: name, text: t, ts: Date.now() };
        for (var k in extra) obj[k] = extra[k];
        queueSend(path, obj);
      });
    }

    /* keyed-DOM: чужие блоки обновляем на месте, свои textarea не трогаем во время набора */
    var cards = {};
    var shell = { mode: null, node: null };
    var addBtn = null;

    function ensureShell() {
      if (shell.mode === data.mode) return;
      body.textContent = ''; cards = {}; addBtn = null;
      shell.mode = data.mode;
      shell.node = el('div', data.mode === 'blocks' ? 'cb-grid' : 'cb-list');
      body.appendChild(shell.node);
      if (data.mode === 'shared' && !isTeacher) {
        addBtn = mkBtn('+ Add paragraph', 'main', function () {
          if (!name) { return; }
          var id = 'p' + Date.now().toString(36) + rid().slice(0, 3);
          adapter.set(base + '/paras/' + id, { uid: uid, name: name, text: '', ts: Date.now() });
          pendingFocus = id;
        });
        body.appendChild(addBtn);
      }
      if (btnBlocks) {
        btnBlocks.className = 'cb-btn' + (data.mode === 'blocks' ? ' on' : '');
        btnShared.className = 'cb-btn' + (data.mode === 'shared' ? ' on' : '');
      }
    }
    var pendingFocus = null;

    function cardFor(key, item, path, canEdit, extra) {
      var c = cards[key];
      if (!c) {
        var wrap = el('div', 'cb-card' + (canEdit ? ' mine' : ''));
        var head = el('div', 'cb-head');
        var who = el('span', '', item.name || '—');
        var meta = el('span', 'cb-meta', '');
        head.appendChild(who); head.appendChild(meta);
        if (isTeacher || canEdit && data.mode === 'shared') {
          var x = el('button', 'cb-x', '✕'); x.type = 'button'; x.title = 'Delete';
          x.addEventListener('click', function () { adapter.remove(path); });
          head.appendChild(x);
        }
        wrap.appendChild(head);
        var field;
        if (canEdit) {
          field = el('textarea', 'cb-ta'); field.maxLength = MAX_TEXT;
          field.placeholder = 'Write here…';
          own(path, field, extra || {}, meta);
          field.value = item.text || '';
        } else {
          field = el('div', 'cb-ro');
        }
        wrap.appendChild(field);
        c = cards[key] = { wrap: wrap, who: who, meta: meta, field: field, canEdit: canEdit };
        shell.node.appendChild(wrap);
      }
      c.who.textContent = item.name || '—';
      if (c.canEdit) {
        if (document.activeElement !== c.field && !timers[path] && c.field.value !== (item.text || '')) c.field.value = item.text || '';
      } else {
        var t = item.text || '';
        if (t) { c.field.classList.remove('cb-empty'); c.field.textContent = t; }
        else { c.field.classList.add('cb-empty'); c.field.textContent = '…'; }
      }
      c.meta.textContent = wc(words(c.canEdit ? c.field.value : item.text));
      return c;
    }

    function render(force) {
      if (!adapter) return;
      ensureShell();
      var seen = {};
      if (data.mode === 'blocks') {
        var blocks = data.blocks || {};
        var ids = Object.keys(blocks).sort(function (a, b) { return (blocks[a].ts || 0) - (blocks[b].ts || 0); });
        if (name && !isTeacher && !blocks[uid]) blocks[uid] = { uid: uid, name: name, text: '', ts: 0 };
        ids = Object.keys(blocks);
        ids.sort(function (a, b) {
          if (a === uid) return -1; if (b === uid) return 1;
          return String(blocks[a].name).localeCompare(String(blocks[b].name));
        });
        ids.forEach(function (id) {
          var it = blocks[id]; seen[id] = 1;
          var c = cardFor(id, it, base + '/blocks/' + id, id === uid && !isTeacher && !!name, {});
          shell.node.appendChild(c.wrap);
        });
      } else {
        var paras = data.paras || {};
        Object.keys(paras).sort().forEach(function (id) {
          var it = paras[id]; seen[id] = 1;
          var mine = it.uid === uid && !isTeacher;
          var c = cardFor(id, it, base + '/paras/' + id, mine, {});
          shell.node.appendChild(c.wrap);
          if (pendingFocus === id && mine) { c.field.focus(); pendingFocus = null; }
        });
      }
      Object.keys(cards).forEach(function (k) {
        if (!seen[k]) { cards[k].wrap.remove(); delete cards[k]; }
      });
      if (addBtn) addBtn.style.display = name ? '' : 'none';
      foot.textContent = isTeacher
        ? 'Teacher view: you see everything live. Switch the mode at the top.'
        : (data.mode === 'blocks' ? 'You edit only your own box. Everyone else sees it live.' : 'You edit only your own paragraphs. Add a new one to continue the text.');
    }

    function copyAll() {
      var out = [];
      if (data.mode === 'blocks') {
        Object.keys(data.blocks || {}).forEach(function (k) {
          var b = data.blocks[k]; if (b.text) out.push(b.name + ':\n' + b.text);
        });
      } else {
        Object.keys(data.paras || {}).sort().forEach(function (k) {
          var p = data.paras[k]; if (p.text) out.push(p.text + '  (' + p.name + ')');
        });
      }
      var txt = out.join('\n\n');
      function done() { btnCopy.textContent = 'Скопировано'; setTimeout(function () { btnCopy.textContent = 'Скопировать всё'; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done);
      else done();
    }

    buildJoin();
    getAdapter().then(function (a) {
      adapter = a;
      if (a.status) a.status(function (ok) {
        dot.className = 'cb-dot ' + (ok ? 'on' : 'err');
        status.textContent = ok ? 'Live · ' + room : 'Offline — reconnecting…';
      });
      else { dot.className = 'cb-dot on'; status.textContent = 'Live · ' + room; }
      a.on(base, function (v) {
        v = v || {};
        data = { mode: v.mode || defMode, blocks: v.blocks || {}, paras: v.paras || {} };
        announce();
        render();
      });
      render();
    }).catch(function (e) {
      dot.className = 'cb-dot err';
      status.textContent = e && e.message === 'config' ? 'Not configured' : 'Connection error';
      body.appendChild(el('div', 'cb-msg', e && e.message === 'config'
        ? 'Совместное письмо не подключено: заполни адрес базы в assets/collab-config.js.'
        : 'Не удалось подключиться к базе. Проверь интернет и обнови страницу.'));
    });
  }

  function boot() {
    var roots = document.querySelectorAll('.collab[data-room]');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
