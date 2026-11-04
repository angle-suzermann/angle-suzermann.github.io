/* Successful delivery -> existing group assignment. Never includes teacher credentials. */
(function () {
  'use strict';
  if (window.angleSubmissionHook || !window.fetch) return;
  window.angleSubmissionHook = true;
  const endpoint = 'https://script.google.com/macros/s/AKfycbxL4zwd1hopnl_97A_vknNYZJeMhzDa2_wIojqTjAcIiZsgbKVDRWzPXT8xqyv61U30Rg/exec';
  const original = window.fetch;
  const meta = key => document.querySelector('meta[name="ws:' + key + '"]')?.content || '';
  const queueKey = 'angle.pendingSubmissions.v1';
  let memoryQueue = [];
  const read = () => { try { return JSON.parse(localStorage.getItem(queueKey) || JSON.stringify(memoryQueue)); } catch (_) { return memoryQueue; } };
  const write = q => { memoryQueue = q; try { localStorage.setItem(queueKey, JSON.stringify(q)); } catch (_) {} };
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
        try {
          const r = await original(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(item.payload),signal:AbortSignal.timeout(20000)});
          const result = await r.json();
          if (!r.ok || !result.ok) throw Error('tracker');
          write(read().filter(x => x.id !== item.id));
          message(result.matched ? (result.credited ? 'Сдача подтверждена в трекере. ' : 'Результат сохранён в трекере. ') + 'Открытые ответы проверит учитель.' : 'Работа отправлена учителю. Трекер не нашёл назначение или имя: сообщите учителю.');
        } catch (_) { message('Работа отправлена учителю. Трекер временно недоступен; повторим запись автоматически.'); break; }
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
    const pts = fraction ? +fraction[1] : null, max = fraction ? +fraction[2] : null;
    const pct = max > 0 ? Math.round(pts / max * 100) : percent ? +percent[1] : null;
    const partsMatch = location.hash.match(/^#angle-parts=([pe]\d+(?:,[pe]\d+)*)$/);
    const partial = /частичн|partial|this (?:task|exercise)/i.test(String(data.lesson || '') + ' ' + String(data.subject || ''));
    return {a:'worksheetSubmission',student,courseId:meta('course-id'),hw:meta('title') || document.title,url:location.pathname,partial,parts:partsMatch ? partsMatch[1].split(',') : [],pct,pts,max,note:(score ? 'Submitted score: ' + score + '. ' : '') + 'Open answers require teacher review.'};
  }
  window.fetch = function (url, options) {
    const sent = original.apply(this,arguments);
    if (!/https:\/\/(?:api\.web3forms\.com\/submit|formspree\.io\/f\/)/.test(String(url))) return sent;
    const item = payload(options?.body);
    if (!item) return sent;
    sent.then(async response => {
      if (!response?.ok) return;
      let result; try { result = await response.clone().json(); } catch (_) { return; }
      if (result.success === false || result.ok === false || result.error || result.errors) return;
      if (String(url).includes('web3forms.com') && result.success !== true) return;
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
