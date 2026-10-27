/* Original parent PDFs are stored encrypted. Only the matching private
   report returned by the existing authenticated backend can unlock a file.
   No report text, personal filenames or decryption keys enter public assets. */
(function(){
 'use strict';
 const entries=new Map(),assetBase=new URL('report-files/',document.currentScript.src);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bytes=s=>new TextEncoder().encode(s);
 const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 function latest(o){return [...(o.reports||[])].filter(r=>r.source&&r.text).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]}
 function panel(o){
  entries.set(o.id,o);
  // Keep the original compact progress card: the full report is download-only.
  return `<div class="parent-report" data-report="${esc(o.id)}"><button type="button" class="btn" data-report-pdf="${esc(o.id)}">Скачать отчёт PDF</button><p class="report-feedback" role="status" aria-live="polite"></p></div>`;
 }
 async function originalPdf(r){
  const material=JSON.stringify(['ANGLE original parent PDF v1',String(r.date).slice(0,10),String(r.source).normalize('NFC').trim(),String(r.text).replace(/\r\n?/g,'\n').normalize('NFC').trim()]);
  const rawKey=await crypto.subtle.digest('SHA-256',bytes(material));
  // The asset name is a separate hash, never the AES key itself.
  const location=hex(await crypto.subtle.digest('SHA-256',bytes('ANGLE original PDF location v1\0'+hex(rawKey))));
  const response=await fetch(new URL(location+'.bin',assetBase));
  if(!response.ok)throw new Error('Исходный PDF пока не подключён.');
  const encrypted=new Uint8Array(await response.arrayBuffer());
  if(encrypted.length<29)throw new Error('Файл отчёта повреждён.');
  const key=await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);
  const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.slice(0,12)},key,encrypted.slice(12));
  if(new TextDecoder().decode(result.slice(0,5))!=='%PDF-')throw new Error('Некорректный файл отчёта.');
  return new Blob([result],{type:'application/pdf'});
 }
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-report-pdf]');if(!button)return;
  const o=entries.get(button.dataset.reportPdf),root=button.closest('[data-report]');if(!o||!root)return;
  const feedback=root.querySelector('.report-feedback');button.disabled=true;
  try{
   const report=latest(o);
   if(!report)throw new Error('Исходный PDF для этого ученика пока не добавлен.');
   feedback.textContent='Загружаем отчёт…';
   const blob=await originalPdf(report),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=String(report.source).split(/[\\/]/).pop().replace(/[\/:*?"<>|]/g,'');
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   feedback.textContent='Отчёт скачан.';
  }catch(err){feedback.textContent=err.message.startsWith('Исходный PDF')?err.message:'Не удалось скачать исходный PDF. Попробуйте ещё раз.'}
  finally{button.disabled=false}
 });
 window.AngleParentReports={panel};
})();
