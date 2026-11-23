/* Successful delivery -> existing group assignment or individual-plan task. Never includes teacher credentials.
 * v3 (04.11.2026): observes every transport the site uses (fetch, XHR, sendBeacon) to Web3Forms and Formspree;
 * partial sends are recognised from the clicked "send this task" button, the label or the exercise name;
 * a record the tracker rejects is parked with its reason and can be re-sent; the latest scored attempt is recorded (first one kept in the note)
 * here and, authoritatively, on the server (so it survives reloads and other devices). */
(function () {
  'use strict';
  if (window.angleSubmissionHook || !window.fetch) return;
  window.angleSubmissionHook = true;
  const endpoint = 'https://script.google.com/macros/s/AKfycbxL4zwd1hopnl_97A_vknNYZJeMhzDa2_wIojqTjAcIiZsgbKVDRWzPXT8xqyv61U30Rg/exec';
  const MAIL = /^https:\/\/(?:api\.web3forms\.com\/submit|formspree\.io\/f\/)/;
  const original = window.fetch;
  const meta = key => document.querySelector('meta[name="ws:' + key + '"]')?.content || '';
  const queueKey = 'angle.pendingSubmissions.v1', rejectedKey = 'angle.rejectedSubmissions.v1', firstKey = 'angle.firstSubmissionScores.v1';
  const MAX_REJECTIONS = 5;
  const mem = {}, load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || (mem[k] !== undefined ? mem[k] : d); } catch (_) { return mem[k] !== undefined ? mem[k] : d; } };
  const save = (k, v) => { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const read = () => load(queueKey, []), write = q => save(queueKey, q);
  const rejected = () => load(rejectedKey, []), writeRejected = q => save(rejectedKey, q.slice(-60));
  const update = (id, change) => write(read().map(x => x.id === id ? Object.assign({}, x, change) : x));
  let flushing = false;

  function message(text, retry) {
    let el = document.getElementById('angleTrackerDelivery');
    if (!el) { el = document.createElement('div'); el.id = 'angleTrackerDelivery'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;bottom:90px;left:12px;right:12px;max-width:520px;margin:0 auto;z-index:10000;padding:12px;border-radius:12px;background:#fff;color:#453458;box-shadow:0 2px 16px #0003;font:16px sans-serif'; document.body.appendChild(el); }
    el.textContent = text;
    el.style.pointerEvents = retry ? 'auto' : 'none';   // a plain notice never blocks taps on the page
    clearTimeout(el._angleTimer);
    if (!retry) el._angleTimer = setTimeout(() => { el.remove(); }, 6000);   // notices go away by themselves; the retry notice stays until handled
    if (retry) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Отправить ещё раз'; b.style.cssText = 'margin-left:10px;padding:8px 12px;border-radius:10px;border:1px solid #5E4877;background:#fff;color:#5E4877;font:16px sans-serif';
      b.onclick = () => { requeueRejected(); b.remove(); };
      el.appendChild(b);
    }
  }
  /* A parked record keeps its payload and the reason; "send again" puts every parked record back into the queue. */
  function park(item, reason) {
    writeRejected(rejected().filter(x => x.id !== item.id).concat([{ id: item.id, payload: item.payload, reason: String(reason || 'unknown'), at: new Date().toISOString() }]));
    write(read().filter(x => x.id !== item.id));
  }
  function requeueRejected() {
    const back = rejected();
    writeRejected([]);
    write(read().concat(back.map(x => ({ id: x.id, payload: x.payload }))).slice(-60));
    flush();
  }
  window.angleRetryRejectedSubmissions = requeueRejected;

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      for (const item of read()) {
        let r, result;
        try {
          r = await original(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(item.payload), signal: AbortSignal.timeout(20000) });
          result = await r.json();
        } catch (_) { message('Работа отправлена учителю. Трекер временно недоступен; повторим запись автоматически.'); break; }   // network problem: keep everything, try later
        if (!r.ok || !result || !result.ok) {
          const count = (item.rejected || 0) + 1;
          if (count >= MAX_REJECTIONS) { park(item, (result && result.error) || 'HTTP ' + r.status); message('Работа отправлена учителю, но трекер не принял запись. Она сохранена на этом устройстве.', true); }
          else { update(item.id, { rejected: count, reason: (result && result.error) || 'HTTP ' + r.status }); message('Работа отправлена учителю. Трекер пока не принял запись; повторим автоматически.'); }
          continue;   // one problem record never blocks the others
        }
        if (result.matched) {
          write(read().filter(x => x.id !== item.id));
          message((result.credited ? 'Сдача подтверждена в трекере. ' : 'Результат сохранён в трекере. ') + 'Открытые ответы проверит учитель.');
        } else if (result.reason === 'no_assignment' || result.reason === 'no_plan_task') {
          write(read().filter(x => x.id !== item.id));   // the page is simply not assigned to anybody: nothing to record
        } else {
          park(item, result.reason || 'not_matched');
          message('Работа отправлена учителю. Трекер не нашёл ваше имя в списке: сообщите учителю.', true);
        }
      }
    } finally { flushing = false; }
  }

  /* "Send this task" buttons mark the next delivery as partial (even when the page's label does not say so). */
  let partialMark = null;
  document.addEventListener('click', e => {
    const el = e.target && e.target.closest && e.target.closest('button,[onclick],a,input[type=button],input[type=submit]');
    if (!el) return;
    const code = el.getAttribute('onclick') || '';
    const m = code.match(/submitPartial\s*\(\s*[\w.]+\s*,\s*(["'`])([\s\S]*?)\1/);
    if (m) partialMark = { label: m[2], at: Date.now() };
    else if (/submit|check|finish|send/i.test(code + ' ' + el.id + ' ' + el.className)) partialMark = null;   // a final send clears an earlier unfinished partial click
  }, true);

  function toData(body) {
    if (body && typeof body.get === 'function' && typeof body.entries === 'function') return Object.fromEntries(Array.from(body.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : '']));
    if (typeof body === 'string') { try { return JSON.parse(body); } catch (_) { try { return Object.fromEntries(new URLSearchParams(body)); } catch (e) { return null; } } }
    if (body && typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return Object.fromEntries(body);
    return null;
  }
  function payload(body) {
    const data = toData(body);
    if (!data) return null;
    const student = String(data.student || data.student_name || data.name || document.querySelector('#studentName,#nameInput,input[name="student"]')?.value || '').trim();
    if (!student) return null;
    const score = String(data.score || data.score_fraction || data.recognition_score || data.result || '');
    /* Latest attempt is the result (Viktoria, 08.11.2026): "First: 8/12; corrected: 12/12" records 12/12. */
    const corrected = score.match(/(?:corrected|исправлен\w*)\s*:?\s*(\d+)\s*\/\s*(\d+)/i);
    const fraction = corrected || score.match(/(?:First:\s*)?(\d+)\s*\/\s*(\d+)/i);
    const percent = String(data.score_percent || data.score || '').match(/(\d+(?:\.\d+)?)\s*%/);
    let pts = fraction ? +fraction[1] : null, max = fraction ? +fraction[2] : null;
    let pct = max > 0 ? Math.round(pts / max * 100) : percent ? +percent[1] : null;
    const partsMatch = location.hash.match(/^#angle-parts=([pe]\d+(?:,[pe]\d+)*)$/);
    const parts = partsMatch ? partsMatch[1].split(',') : [];
    const title = meta('title') || document.title;
    const lesson = String(data.lesson || data.exercise || '');
    const labelled = /частичн|partial|this (?:task|exercise)/i.test(lesson + ' ' + String(data.subject || ''));
    const clicked = partialMark && Date.now() - partialMark.at < 120000 ? partialMark : null;
    const subExercise = lesson.length > title.length && lesson.indexOf(title) === 0 && /^\s*[—–-]\s*\S/.test(lesson.slice(title.length)) && !/(classwork|homework)\s*$/i.test(lesson);
    const partial = labelled || !!clicked || subExercise;
    if (clicked) partialMark = null;
    let hw = title;
    if (partial) {
      const label = (clicked && clicked.label) || lesson.replace(/\s*\((?:частичн|partial)[^)]*\)\s*$/i, '').replace(title, '').replace(/^\s*[—–-]\s*/, '').trim();
      hw = label ? title + ' — ' + label : title + ' — part';
    }
    const open = Array.from(document.querySelectorAll('textarea')).some(t => t.value.trim().length > 20) || Object.keys(data).some(k => /written|essay|story|answer_text|text$/i.test(k) && String(data[k]).trim().length > 20);
    let note = score ? 'Submitted score: ' + score + '. ' : '';
    /* The latest scored attempt is the result (Viktoria, 08.11.2026); the first one is kept in the note. */
    if (pct !== null && !partial) {
      const key = location.pathname + '|' + parts.join(',') + '|' + student.toLowerCase().replace(/\s+/g, ' ');
      const firsts = load(firstKey, {}), first = firsts[key];
      if (first) { note = 'First submission: ' + first.score + '. Latest submission: ' + (score || pct + '%') + '. '; }
      else {
        firsts[key] = { pct, pts, max, score: score || pct + '%', at: new Date().toISOString() };
        const keys = Object.keys(firsts);
        if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(k => delete firsts[k]);
        save(firstKey, firsts);
      }
    }
    return { a: 'worksheetSubmission', student, courseId: meta('course-id'), hw, url: location.pathname, partial, parts, pct, pts, max, open, note: note + (open ? 'Open answers require teacher review.' : '') };
  }

  /* delivered(): called once per mail send that the provider accepted */
  function delivered(body) {
    if (body && typeof body.text === 'function' && !(typeof body.get === 'function')) { body.text().then(delivered, () => {}); return; }   // Blob from sendBeacon
    const item = payload(body);
    if (!item) return;
    /* Confetti for the child once the teacher's copy was accepted; skipped if it already fired in the last minute (test result). */
    try {
      const pop = () => { if (window.AngleConfetti && !window.AngleConfetti.recent(60000)) window.AngleConfetti.burst(); };
      if (window.AngleConfetti) pop(); else { const cs = document.createElement('script'); cs.src = '/assets/confetti.js?v=4'; cs.onload = pop; document.head.appendChild(cs); }
    } catch (_) {}
    write(read().concat([{ id: String(Date.now()) + '-' + Math.random().toString(36).slice(2), payload: item }]).slice(-60));
    flush();
  }
  function accepted(url, response) {
    return response.clone().json().then(result => {
      if (!result || typeof result !== 'object') return !/formspree|web3forms/.test(url);
      if (result.success === false || result.ok === false || result.error || result.errors) return false;
      if (url.indexOf('web3forms.com') > -1 && result.success !== true) return false;
      return true;
    }, () => !/web3forms|formspree/.test(url));   // JSON is required for the providers we use
  }

  window.fetch = function (url, options) {
    const target = String(url && url.url || url);
    // Older pages send result before/after mail, without reliable delivery or partial scope.
    // The successful-mail path below is now the only automatic writer on these pages.
    if (target === endpoint && toData(options && options.body)?.a === 'result') {
      return Promise.resolve(new Response(JSON.stringify({ok:true,deferred:true}),{status:200,headers:{'Content-Type':'application/json'}}));
    }
    if (!MAIL.test(target)) return original.apply(this, arguments);
    const body = options && options.body;
    // v5 (23.11.2026): a send that never reaches the mail service, or that the service does not accept, must not look sent.
    // The page gets a rejected promise (its own "not sent" branch runs) and the student gets a way to copy the result.
    let opts = options;
    if (!(options && options.signal) && window.AbortSignal && AbortSignal.timeout) opts = Object.assign({}, options, { signal: AbortSignal.timeout(30000) });
    return original.call(this, url, opts).then(async response => {
      if (response && response.ok && await accepted(target, response)) { delivered(body); hideSendFallback(); return response; }
      const status = response ? response.status : 0;
      showSendFallback(body, 'server', status);
      const err = new Error('сервис не принял результат (код ' + status + ')');
      err.angleDelivery = 'server'; err.angleStatus = status;
      throw err;
    }, error => {
      showSendFallback(body, 'network', 0);
      if (error && typeof error === 'object') { try { error.angleDelivery = 'network'; } catch (_) {} }
      throw error;
    });
  };

  /* Fallback when the result could not be delivered: the answers stay on the page; the student can copy them for Telegram.
     Pages with their own copy button set window.angleOwnSendFallback = true. */
  function sendText(body) {
    const skip = /^(access_key|botcheck|redirect|from_name|replyto|apikey|_.*)$/i, lines = [];
    const add = (k, v) => { if (!skip.test(k) && v != null && typeof v !== 'object') lines.push(k + ': ' + String(v)); };
    try {
      if (body && typeof body.forEach === 'function' && typeof body.get === 'function') body.forEach((v, k) => add(k, v));
      else if (typeof body === 'string' && body.trim().charAt(0) === '{') { const j = JSON.parse(body); Object.keys(j).forEach(k => add(k, j[k])); }
      else if (typeof body === 'string') new URLSearchParams(body).forEach((v, k) => add(k, v));
    } catch (_) {}
    return [document.title, location.href, ''].concat(lines).join('\n');
  }
  function hideSendFallback() { const el = document.getElementById('angleSendFallback'); if (el) el.remove(); }
  function showSendFallback(body, kind, status) {
    if (window.angleOwnSendFallback) return;
    hideSendFallback();
    const text = sendText(body);
    const el = document.createElement('div');
    el.id = 'angleSendFallback'; el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;z-index:10001;padding:14px 16px;border-radius:14px;background:#fff;color:#2D2926;border:2px solid #5E4877;box-shadow:0 8px 28px rgba(45,25,60,.28);font:15px/1.4 "Apercu Pro",system-ui,sans-serif';
    const why = kind === 'network'
      ? 'This browser could not reach the result service. · Браузер не смог связаться с сервисом отправки.'
      : 'The result service did not accept it (code ' + status + '). · Сервис не принял результат (код ' + status + ').';
    el.innerHTML = '<b style="color:#5E4877">The result was not sent · Результат не отправлен</b><div style="margin:6px 0 10px"></div>';
    el.children[1].textContent = why + ' Your answers are still on this page: try again on Wi-Fi or in another browser, or copy the result and send it to your teacher in Telegram. · Ответы остались на странице: попробуйте ещё раз через Wi-Fi или в другом браузере либо скопируйте результат и отправьте учителю в Telegram.';
    const copy = document.createElement('button'), close = document.createElement('button');
    copy.type = close.type = 'button';
    copy.textContent = '📋 Copy result · Скопировать';
    copy.style.cssText = 'padding:9px 14px;border-radius:10px;border:0;background:#FED500;color:#2D2926;font:700 16px system-ui,sans-serif;cursor:pointer';
    close.textContent = '✕'; close.setAttribute('aria-label', 'Close');
    close.style.cssText = 'margin-left:8px;padding:9px 12px;border-radius:10px;border:1px solid #5E4877;background:#fff;color:#5E4877;font:16px system-ui,sans-serif;cursor:pointer';
    copy.onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
        const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (__) {} ta.remove();
      }
      copy.textContent = ok ? '✓ Copied · Скопировано' : 'Take a screenshot · Сделайте скриншот';
    };
    close.onclick = hideSendFallback;
    el.appendChild(copy); el.appendChild(close);
    document.body.appendChild(el);
  }
  if (window.XMLHttpRequest) {
    const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) { this.__angleUrl = String(url); return open.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (body) {
      if (MAIL.test(this.__angleUrl || '')) this.addEventListener('load', () => { if (this.status >= 200 && this.status < 300 && !/"(?:success|ok)"\s*:\s*false|"error"/.test(String(this.responseText || ''))) delivered(body); });
      return send.apply(this, arguments);
    };
  }
  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, body) { const ok = beacon(url, body); if (ok && MAIL.test(String(url))) delivered(body); return ok; };
  }
  window.addEventListener('online', flush);
  setInterval(flush, 30000);
  flush();
  if (rejected().length) message('Есть неотправленные записи сдачи на этом устройстве.', true);
})();
