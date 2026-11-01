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
 function reports(o){return [...(o.reports||[])].filter(r=>r.source&&r.text).sort((a,b)=>String(b.date).localeCompare(String(a.date)))}
 function reportBody(text){
  const groups=[],known=/^(?:Что получается(?: хорошо)?|Над чем работаем|Работа на уроке|Как можно помочь дома|Домашние задания.*|Что дальше|Главное|Что изменилось.*|Ближайшие шаги.*|С чего начали.*|Первый учебный блок.*|Урок(?: и домашние работы)?.*|Сильные стороны|Рекомендации|Итоги.*)$/i;
  let current={title:'',lines:[]};groups.push(current);
  for(const raw of String(text).replace(/\r\n?/g,'\n').split('\n')){
   const line=raw.trim(),heading=line.match(/^#{2,4}\s+(.+)$/);
   if(/^#\s+/.test(line))continue;
   if(heading||(line&&line.length<110&&known.test(line))){current={title:heading?heading[1]:line,lines:[]};groups.push(current)}
   else current.lines.push(raw);
  }
  const paragraph=lines=>lines.join('\n').trim().split(/\n\s*\n/).filter(Boolean).map(p=>{
   const lines=p.split('\n');
   if(lines.every(l=>/^\s*[-•]\s+/.test(l)))return '<ul>'+lines.map(l=>'<li>'+esc(l.replace(/^\s*[-•]\s+/,''))+'</li>').join('')+'</ul>';
   return '<p>'+esc(p)+'</p>';
  }).join('');
  return groups.map(g=>{const body=paragraph(g.lines);if(!body)return '';return g.title?`<details class="report-section ${/^(?:Что изменилось|Что получается|Главное)/i.test(g.title)?'report-overview':/^(?:Ближайшие|Что дальше)/i.test(g.title)?'report-next':''}"${/^(?:Что изменилось|Что получается|Главное|Ближайшие|Что дальше)/i.test(g.title)?' open':''}><summary>${esc(g.title)}<span aria-hidden="true">+</span></summary><div class="report-section-body">${body}</div></details>`:`<div class="report-intro">${body}</div>`}).join('');
 }
 function webReport(o,r,index){
  const heading=String(r.text).match(/^#\s+(.+)$/m),title=heading?heading[1]:String(r.source).split(/[\\/]/).pop().replace(/\.pdf$/i,'');
  const period=String(r.text).match(/(?:^|\n)Период:\s*(.+?)(?:\.\s+(?:Курс|Данные)|$)/im);
  const date=String(r.date).slice(0,10),logo=new URL('../../brand/angle-wordmark.svg',assetBase).href;
  return `<article class="report-paper"><header class="report-band"><img src="${esc(logo)}" alt="ANGLE" width="156" height="46"><div class="report-by">by Viktoria Syuzyova</div><div class="report-band-meta"><b>Отчёт для родителей</b><span>${esc(o.course)}</span><span>${esc(date)}</span></div><div class="report-title-tag">${o.shareUrl?`<a class="report-title" href="${esc(o.shareUrl)}">${esc(title)}</a>`:esc(title)}<small>Итоги занятий</small></div></header><div class="report-paper-body"><div class="report-info"><div><b>Ученик</b>${esc(o.name)}</div><div><b>Курс</b>${esc(o.course)}</div><div><b>${period?'Период':'Дата отчёта'}</b>${esc(period?period[1]:date)}</div></div><div class="report-text">${reportBody(r.text)}</div><footer class="report-paper-actions">${o.shareUrl?`<button type="button" class="btn ghost" data-share-url="${esc(o.shareUrl)}" data-share-title="${esc(title)}">Поделиться</button>`:''}<button type="button" class="btn" data-report-pdf="${esc(o.id)}" data-report-index="${index}">Скачать отчёт PDF</button></footer></div></article>`;
 }
 function panel(o){
  entries.set(o.id,o);
  const all=reports(o),title='Карточка для родителей — '+o.name;
  const share=o.shareUrl?`<a class="report-title" href="${esc(o.shareUrl)}">${esc(title)}</a><button type="button" class="btn ghost" data-share-url="${esc(o.shareUrl)}" data-share-title="${esc(title)}">Поделиться</button>`:'';
  const content=all.length?all.map((r,i)=>i?`<details class="report-history"><summary>Отчёт от ${esc(String(r.date).slice(0,10))}</summary>${webReport(o,r,i)}</details>`:webReport(o,r,i)).join(''):`${share}<button type="button" class="btn" data-report-pdf="${esc(o.id)}">Скачать отчёт PDF</button>`;
  return `<div class="parent-report" data-report="${esc(o.id)}">${content}<p class="report-feedback" role="status" aria-live="polite">${all.length?'':'Отчёт пока не добавлен. Здесь появится готовый PDF.'}</p></div>`;
 }
 async function originalPdf(r){
  const material=JSON.stringify(['ANGLE original parent PDF v1',String(r.date).slice(0,10),String(r.source).normalize('NFC').trim(),String(r.text).replace(/\r\n?/g,'\n').normalize('NFC').trim()]);
  const rawKey=await crypto.subtle.digest('SHA-256',bytes(material));
  // The asset name is a separate hash, never the AES key itself.
  const location=hex(await crypto.subtle.digest('SHA-256',bytes('ANGLE original PDF location v1\0'+hex(rawKey))));
  const assetUrl=new URL(location+'.bin',assetBase);assetUrl.searchParams.set('v','20261028-rings');
  const response=await fetch(assetUrl);
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
   const report=button.dataset.reportIndex===undefined?latest(o):reports(o)[Number(button.dataset.reportIndex)];
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
