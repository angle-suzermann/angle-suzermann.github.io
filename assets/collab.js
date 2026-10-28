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
    '.cb-feedback{border-top:1px solid var(--c-b);margin-top:6px;padding-top:10px;font-size:14px}',
    '.cb-feedback[hidden]{display:none}.cb-feedback-title{font-weight:700;color:var(--c-p);margin-bottom:6px}',
    '.cb-feedback-text{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff9df;border-left:3px solid var(--c-y);border-radius:8px;padding:10px;line-height:1.45}',
    '.cb-feedback-editor{font:inherit;font-size:16px;width:100%;min-height:85px;resize:vertical;border:1px solid var(--c-b);border-radius:10px;padding:8px;line-height:1.45}',
    '.cb-feedback-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.cb-feedback-actions[hidden]{display:none}.cb-feedback-status{font-size:12px;margin-top:6px}',
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
          update: function (p, v) { return db.ref(p).update(v); },
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
    var qs = new URLSearchParams(location.search);
    var room = safeKey(qs.get('room') || root.getAttribute('data-room') || 'default');
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

    var btnBlocks, btnShared, btnCopy, btnClear, btnSend;
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
    btnSend = mkBtn(isTeacher ? 'Отправить итог на почту' : 'Send to teacher', 'main', sendResult);
    bar.appendChild(btnSend);
    if (isTeacher) {
      btnClear = mkBtn('Очистить комнату', '', function () {
        if (confirm('Удалить все тексты в этой комнате?')) {
          Promise.all([removeText(base + '/blocks'), removeText(base + '/paras')]).catch(showDeleteError);
        }
      });
      bar.appendChild(btnClear);
    }

    function showDeleteError() {
      status.textContent = 'Could not delete. Check your connection and try again.';
    }
    function removeText(path) {
      if (!adapter) return Promise.reject(new Error('Not connected'));
      Object.keys(timers).forEach(function (p) {
        if (p === path || p.indexOf(path + '/') === 0) {
          clearTimeout(timers[p]); delete timers[p];
        }
      });
      return Promise.resolve(adapter.remove(path));
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
        delete timers[path];
        if (adapter) {
          // Patch answer fields, preserving the teacher's feedback on this record.
          var write = adapter.update ? adapter.update(path, obj) : Promise.all(Object.keys(obj).map(function (k) { return adapter.set(path + '/' + k, obj[k]); }));
          Promise.resolve(write).catch(function () { status.textContent = 'Could not save your answer. Check your connection.'; });
        }
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
          x.addEventListener('click', function () { removeText(path).catch(showDeleteError); });
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
        c = cards[key] = { wrap: wrap, who: who, meta: meta, field: field, canEdit: canEdit, path: path };
        makeFeedback(c, path);
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
      updateFeedback(c);
      return c;
    }

    // Answer writes patch fields and leave feedback intact. Using the existing
    // blocks/paras paths also works with the deployed room database rules.
    function feedbackValue(c) {
      var parts = c.path.slice(base.length + 1).split('/');
      return ((data[parts[0]] || {})[parts[1]] || {}).feedback || {};
    }
    function makeFeedback(c) {
      var section = el('div', 'cb-feedback');
      section.appendChild(el('div', 'cb-feedback-title', 'Комментарий учителя'));
      var text = el('div', 'cb-feedback-text');section.appendChild(text);
      c.feedback = { section: section, text: text, editing: false, path: c.path + '/feedback' };
      if (isTeacher) {
        var f = c.feedback;
        var edit = mkBtn('Добавить комментарий', '', function () {
          f.editing = true;f.editor.value = feedbackValue(c).text || '';updateFeedback(c);f.editor.focus();
        });
        var editor = el('textarea', 'cb-feedback-editor');editor.maxLength = MAX_TEXT;
        editor.placeholder = 'Ваши замечания к ответу ученика…';editor.setAttribute('aria-label', 'Комментарий к ответу ' + c.who.textContent);
        var actions = el('div', 'cb-feedback-actions');
        var result = el('div', 'cb-feedback-status');result.setAttribute('role', 'status');
        var save = mkBtn('Сохранить комментарий', 'main', function () {
          var value = editor.value.trim().slice(0, MAX_TEXT);
          if (!value) { result.textContent = 'Напишите комментарий или нажмите «Удалить».';return; }
          save.disabled = true;result.textContent = 'Сохранение…';
          adapter.set(f.path, { text: value, updatedAt: Date.now() }).then(function () {
            f.editing = false;save.disabled = false;updateFeedback(c);result.textContent = 'Сохранено — ученик видит комментарий.';
          }).catch(function () { save.disabled = false;result.textContent = 'Не удалось сохранить. Попробуйте ещё раз.'; });
        });
        var cancel = mkBtn('Отмена', '', function () { f.editing = false;result.textContent = '';updateFeedback(c); });
        var remove = mkBtn('Удалить', '', function () {
          if (!confirm('Удалить комментарий учителя?'))return;
          remove.disabled = true;
          adapter.remove(f.path).then(function () { remove.disabled = false;f.editing = false;updateFeedback(c);result.textContent = 'Комментарий удалён.'; })
            .catch(function () { remove.disabled = false;result.textContent = 'Не удалось удалить. Попробуйте ещё раз.'; });
        });
        actions.appendChild(save);actions.appendChild(cancel);actions.appendChild(remove);
        section.appendChild(edit);section.appendChild(editor);section.appendChild(actions);section.appendChild(result);
        f.edit = edit;f.editor = editor;f.actions = actions;f.remove = remove;
      }
      c.wrap.appendChild(section);
    }
    function updateFeedback(c) {
      var f = c.feedback, value = feedbackValue(c).text || '';
      f.section.hidden = !isTeacher && !value;
      f.text.textContent = value;f.text.hidden = !value || f.editing;
      if (isTeacher) {
        f.edit.textContent = value ? 'Изменить комментарий' : 'Добавить комментарий';
        f.edit.hidden = f.editing;f.editor.hidden = !f.editing;f.actions.hidden = !f.editing;
        f.remove.hidden = !value;
      }
    }

    function render(force) {
      if (!adapter) return;
      ensureShell();
      var seen = {};
      var ordered = [];
      if (data.mode === 'blocks') {
        var blocks = Object.assign({}, data.blocks || {});
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
          ordered.push(c.wrap);
        });
      } else {
        var paras = data.paras || {};
        Object.keys(paras).sort().forEach(function (id) {
          var it = paras[id]; seen[id] = 1;
          var mine = it.uid === uid && !isTeacher;
          var c = cardFor(id, it, base + '/paras/' + id, mine, {});
          ordered.push(c.wrap);
          if (pendingFocus === id && mine) { c.field.focus(); pendingFocus = null; }
        });
      }
      Object.keys(cards).forEach(function (k) {
        if (!seen[k]) { cards[k].wrap.remove(); delete cards[k]; }
      });
      // Moving a focused textarea's ancestor blurs it and closes mobile keyboards.
      // Keep that card attached; reorder only the surrounding cards when needed.
      var anchor = null;
      for (var i = ordered.length - 1; i >= 0; i--) {
        var wrap = ordered[i];
        if (!wrap.contains(document.activeElement) && wrap.nextSibling !== anchor) {
          shell.node.insertBefore(wrap, anchor);
        }
        anchor = wrap;
      }
      if (addBtn) addBtn.style.display = name ? '' : 'none';
      foot.textContent = isTeacher
        ? 'Teacher view: you see everything live. Switch the mode at the top.'
        : (data.mode === 'blocks' ? 'You edit only your own box. Everyone else sees it live.' : 'You edit only your own paragraphs. Add a new one to continue the text.');
    }

    function meta(n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute('content') : ''; }
    function compile(onlyMine) {
      var out = [];
      if (data.mode === 'blocks') {
        Object.keys(data.blocks || {}).forEach(function (k) {
          var b = data.blocks[k];
          if (b.text && (!onlyMine || k === uid)) out.push(b.name + ':\n' + b.text);
        });
      } else {
        Object.keys(data.paras || {}).sort().forEach(function (k) {
          var p = data.paras[k];
          if (p.text && (!onlyMine || p.uid === uid)) out.push(p.text + '  (' + p.name + ')');
        });
      }
      return out.join('\n\n');
    }
    function sendResult() {
      var label = btnSend.textContent;
      var mine = isTeacher ? compile(false) : compile(true);
      if (!isTeacher && !name) { status.textContent = 'Enter your name first'; return; }
      if (!mine) { status.textContent = isTeacher ? 'Комната пока пустая' : 'Write something first'; return; }
      var course = meta('ws:course'), title = meta('ws:title') || document.title;
      var who = isTeacher ? 'вся комната' : name;
      var payload = {
        access_key: '8af30ecf-0d8b-4e1f-aa4b-2b3b76fe8234',
        course: course,
        course_id: meta('ws:formspree'),
        subject: (course ? course + ' — ' : '') + title + ' — ' + who,
        test: title,
        student_name: who,
        group: room,
        mode: data.mode === 'shared' ? 'общий текст' : 'блок на каждого',
        text: mine,
        whole_room: compile(false),
        submitted_at: new Date().toLocaleString('ru-RU')
      };
      btnSend.disabled = true; btnSend.textContent = '…';
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (r.ok) { btnSend.textContent = isTeacher ? 'Отправлено ✓' : 'Sent ✓'; setTimeout(function () { btnSend.textContent = label; btnSend.disabled = false; }, 2500); return; }
        return r.json().then(function (d) { throw new Error((d && d.error) || 'error'); });
      }).catch(function (e) {
        btnSend.textContent = label; btnSend.disabled = false;
        status.textContent = 'Could not send: ' + e.message;
      });
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
      var firstSnapshot = true;
      a.on(base, function (v) {
        v = v || {};
        // A remote deletion must discard the old editor and its unsent draft.
        // Otherwise its DOM value or debounce timer can resurrect the deleted text.
        ['blocks', 'paras'].forEach(function (kind) {
          Object.keys(data[kind] || {}).forEach(function (id) {
            if (v[kind] && v[kind][id]) return;
            var p = base + '/' + kind + '/' + id;
            clearTimeout(timers[p]); delete timers[p];
            var c = cards[id];
            if (c && c.path === p) { c.wrap.remove(); delete cards[id]; }
          });
        });
        data = { mode: v.mode || defMode, blocks: v.blocks || {}, paras: v.paras || {} };
        if (firstSnapshot) { firstSnapshot = false; announce(); }
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
