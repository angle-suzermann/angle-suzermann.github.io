/* Successful delivery -> existing group assignment. Never includes teacher credentials.
 * v2 (04.11.2026): first submission's score is kept on resubmission; a task-only (partial) score is
 * recorded under its task label, not as the whole worksheet; a rejected record no longer blocks the queue. */
(function () {
  'use strict';
  if (window.angleSubmissionHook || !window.fetch) return;
  window.angleSubmissionHook = true;
  const endpoint = 'https://script.google.com/macros/s/AKfycbxL4zwd1hopnl_97A_vknNYZJeMhzDa2_wIojqTjAcIiZsgbKVDRWzPXT8xqyv61U30Rg/exec';
  const original = window.fetch;
  const meta = key => document.querySelector('meta[name="ws:' + key + '"]')?.content || '';
  const queueKey = 'angle.pendingSubmissions.v1';
  const firstKey = 'angle.firstSubmissionScores.v1';
  const MAX_REJECTIONS = 5;
  let memoryQueue = [], memoryFirst = {};
  const read = () => { try { return JSON.parse(localStorage.getItem(queueKey) || JSON.stringify(memoryQueue)); } catch (_) { return memoryQueue; } };
  const write = q => { memoryQueue = q; try { localStorage.setItem(queueKey, JSON.stringify(q)); } catch (_) {} };
  const readFirst = () => { try { return JSON.parse(localStorage.getItem(firstKey) || JSON.stringify(memoryFirst)); } catch (_) { return memoryFirst; } };
  const writeFirst = m => { memoryFirst = m; try { localStorage.setItem(firstKey, JSON.stringify(m)); } catch (_) {} };
  const update = (id, change) => write(read().map(x => x.id === id ? Object.assign({}, x, change) : x));
  let flushing = false;
  function message(text) {
    let el = document.getElementById('angleTrackerDelivery');
    if (!el) { el = document.createElement('div'); el.id = 'angleTrackerDelivery'; el.setAttribute('role','status'); el.style.cssText = 'position:fixed;bottom:90px;left:12px;right:12px;z-index:10000;padding:12px;border-radius:12px;background:#fff;color:#453458;box-shadow:0 2px 16px #0003;font:16px sans-serif'; document.body.appendChild(el); }
    el.textContent = text;
  }
  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      for (const item of read()) {
        if ((item.rejected || 0) >= MAX_REJECTIONS) continue;
        let r, result;
        try {
          r = await original(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(item.payload),signal:AbortSignal.timeout(20000)});
          result = await r.json();
        } catch (_) { message('Работа отправлена учителю. Трекер временно недоступен; повторим запись автоматически.'); break; }
        if (!r.ok || !result || !result.ok) {
          /* The tracker answered but refused this record: keep it for the next tries, but go on with the others. */
          const rejected = (item.rejected || 0) + 1;
          update(item.id, {rejected});
          message(rejected >= MAX_REJECTIONS
            ? 'Работа отправлена учителю, но трекер не принял запись. Сообщите учителю.'
            : 'Работа отправлена учителю. Трекер пока не принял запись; повторим автоматически.');
          continue;
        }
        write(read().filter(x => x.id !== item.id));
        message(result.matched ? (result.credited ? 'Сдача подтверждена в трекере. ' : 'Результат сохранён в трекере. ') + 'Открытые ответы проверит учитель.' : 'Работа отправлена учителю. Трекер не нашёл назначение или имя: сообщите учителю.');
      }
    } finally { flushing = false; }
  }
  function payload(body) {
    let data;
    if (body && typeof body.get === 'function') data = Object.fromEntries(body.entries());
    else if (typeof body === 'string') { try { data = JSON.parse(body); } catch (_) { return null; } }
    else return null;
    const student = String(data.student || data.student_name || data.name || document.querySelector('#studentName,#nameInput,input[name="student"]')?.value || '').trim();
    if (!student) return null;
    const score = String(data.score || data.score_fraction || data.result || '');
    const fraction = score.match(/(?:First:\s*)?(\d+)\s*\/\s*(\d+)/i);
    const percent = String(data.score_percent || data.score || '').match(/(\d+(?:\.\d+)?)\s*%/);
    let pts = fraction ? +fraction[1] : null, max = fraction ? +fraction[2] : null;
    let pct = max > 0 ? Math.round(pts / max * 100) : percent ? +percent[1] : null;
    const partsMatch = location.hash.match(/^#angle-parts=([pe]\d+(?:,[pe]\d+)*)$/);
    const parts = partsMatch ? partsMatch[1].split(',') : [];
    const lesson = String(data.lesson || '');
    const partialRe = /\s*\((?:частичн|partial)[^)]*\)\s*$/i;
    const partial = /частичн|partial|this (?:task|exercise)/i.test(lesson + ' ' + String(data.subject || ''));
    const title = meta('title') || document.title;
    /* A task-only send is stored under its own task label, so it never stands in for the whole worksheet's result. */
    let hw = title;
    if (partial) { const label = lesson.replace(partialRe, '').trim(); hw = label && label !== title ? label : title + ' — part'; }
    let note = (score ? 'Submitted score: ' + score + '. ' : '');
    /* First submission's score stays the result; later sends (after corrections) are only noted. */
    if (pct !== null && !partial) {
      const key = location.pathname + '|' + parts.join(',') + '|' + student.toLowerCase().replace(/\s+/g, ' ');
      const firsts = readFirst(), first = firsts[key];
      if (first) {
        note = 'First submission: ' + first.score + '. Latest submission: ' + (score || pct + '%') + '. ';
        pct = first.pct; pts = first.pts; max = first.max;
      } else {
        firsts[key] = {pct, pts, max, score: score || pct + '%', at: new Date().toISOString()};
        const keys = Object.keys(firsts);
        if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(k => delete firsts[k]);
        writeFirst(firsts);
      }
    }
    return {a:'worksheetSubmission',student,courseId:meta('course-id'),hw,url:location.pathname,partial,parts,pct,pts,max,note:note + 'Open answers require teacher review.'};
  }
  window.fetch = function (url, options) {
    const sent = original.apply(this,arguments);
    if (!/https:\/\/(?:api\.web3forms\.com\/submit|formspree\.io\/f\/)/.test(String(url))) return sent;
    const body = options?.body;
    sent.then(async response => {
      if (!response?.ok) return;
      let result; try { result = await response.clone().json(); } catch (_) { return; }
      if (result.success === false || result.ok === false || result.error || result.errors) return;
      if (String(url).includes('web3forms.com') && result.success !== true) return;
      /* Build the record only after delivery succeeded, so a failed mail never becomes the "first" score. */
      const item = payload(body);
      if (!item) return;
      const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      write(read().concat([{id,payload:item}]).slice(-30));
      flush();
    }).catch(() => {});
    return sent;
  };
  window.addEventListener('online',flush);
  setInterval(flush,30000);
  flush();
})();
