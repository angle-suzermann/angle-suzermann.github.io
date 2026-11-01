/* Original parent PDFs are stored encrypted. Only the matching private
   report returned by the existing authenticated backend can unlock a file.
   No report text, personal filenames or decryption keys enter public assets. */
(function(){
 'use strict';
 const entries=new Map(),assetBase=new URL('report-files/',document.currentScript.src);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bytes=s=>new TextEncoder().encode(s);
 const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 function latest(o){return reports(o)[0]}
 function reportUrl(o,r){
  if(!o.shareUrl)return '';
  const url=new URL(o.shareUrl,location.href);url.searchParams.set('report',String(r.id||[r.date,r.source].join('|')));return url.href;
 }
 function shareButton(o,r,title){
  const url=reportUrl(o,r);
  return `<button type="button" class="btn ghost" data-share-kind="report"${url?` data-share-url="${esc(url)}" data-share-title="${esc(title+' · '+String(r.date).slice(0,10))}"`:' disabled title="Ссылка получателя ещё не настроена"'}>Поделиться</button>`;
 }
 function toolbarShare(o){
  const report=latest(o);if(!report)return '';
  const title=String(report.source).split(/[\\/]/).pop().replace(/\.pdf$/i,'');return shareButton(o,report,title);
 }
 function openRequested(o){
  const wanted=new URLSearchParams(location.search).get('report');if(!wanted)return;
  const report=reports(o).find(r=>String(r.id||[r.date,r.source].join('|'))===wanted);if(!report)return;
  for(const root of document.querySelectorAll('[data-report]'))if(root.dataset.report===o.id){
   const article=Array.from(root.querySelectorAll('[data-report-id]')).find(el=>el.dataset.reportId===wanted);if(!article)continue;
   const history=article.closest('.report-history');if(history)history.open=true;
   article.scrollIntoView({block:'start'});break;
  }
 }
 function reports(o){return [...(o.reports||[])].filter(r=>r.source&&r.text&&(r.plan||String(o.id).startsWith('plan|')||String(r.date).slice(0,10)>='2026-11-01')).sort((a,b)=>String(b.date).localeCompare(String(a.date)))}
 function reportBody(text,audience){
  text=String(text).replace(/\\n/g,'\n').replace(/перечитан/g,'пересчитан');
  // PDF metadata already appears in the web report's own information row.
  text=text.replace(/^\s*УЧЕНИ(?:К|ЦА)\s*\n[^\n]+\n\s*КУРС\s*\n[^\n]+\n\s*(?:ПЕРИОД|ДАТА)\s*\n[^\n]+\n*/u,'');
  const groups=[],known=/^(?:Что (?:уже )?получается.*|Что получилось.*|Над чем работаем|Работа на уроке|Как можно помочь дома|Домашние задания.*|Что дальше|Главное.*|Что изменилось.*|Ближайшие шаги.*|С чего начали.*|Первый учебный блок.*|Урок(?: и домашние работы)?.*|Сильные стороны|Рекомендации|Итоги.*|Подтвержд[её]нные работы|Источники и границы отч[её]та|Показатели на.*|Ещё по ходу|Часть \d.*|Говорение.*|Correction code key|Overall|.*corrections.*|Next steps)$/i;
  let current={title:'',lines:[]};groups.push(current);
  for(const raw of String(text).replace(/\r\n?/g,'\n').split('\n')){
   const line=raw.trim(),heading=line.match(/^#{2,4}\s+(.+)$/);
   if(/^#\s+/.test(line))continue;
   if((/^Если есть вопросы/.test(line)||line==='Виктория')&&current.title){current={title:'',lines:[raw]};groups.push(current)}
   else if(heading&&/^#{3,4}\s/.test(line))current.lines.push(raw);
   else if(heading||(line&&line.length<110&&known.test(line))){current={title:heading?heading[1]:line,lines:[]};groups.push(current)}
   else current.lines.push(raw);
  }
  const paragraph=lines=>lines.join('\n').trim().split(/\n\s*\n/).filter(Boolean).filter(p=>audience==='student'||! /^(?:Сдано заданий:|Качество работы:|Работа на уроке:|Текущий трекер перечитан|Показатели пересчитаны)/i.test(p.trim())).map(p=>{
   const lines=p.split('\n');
   if(/^#{3,4}\s+[^\n]+$/.test(p))return '<h3>'+esc(p.replace(/^#{3,4}\s+/,''))+'</h3>';
   if(lines.length>1&&lines.every(l=>/^\s*\|.*\|\s*$/.test(l))){const rows=lines.filter(l=>!/^\s*\|[\s:|\-]+\|\s*$/.test(l)).map(l=>l.trim().slice(1,-1).split('|').map(c=>c.trim()));return '<div class="report-table-wrap"><table class="report-table">'+rows.map((row,i)=>'<tr>'+row.map(c=>`<${i?'td':'th'}>${esc(c)}</${i?'td':'th'}>`).join('')+'</tr>').join('')+'</table></div>'}
   if(lines.every(l=>/^\s*[-•]\s+/.test(l)))return '<ul>'+lines.map(l=>'<li>'+esc(l.replace(/^\s*[-•]\s+/,''))+'</li>').join('')+'</ul>';
   return '<p>'+esc(p)+'</p>';
  }).join('');
  return groups.map(g=>{if(audience!=='student'&&/^(?:Домашние задания|Показатели на)/i.test(g.title))return '';let lines=g.lines;if(audience!=='student'&&/^Источники и границы/i.test(g.title)){const mee=lines.join('\n').match(/Последняя проверка (?:Macmillan Education Everywhere|MEE)\s*[—–-]\s*([\d.]+)/i);lines=[...(mee?['Последняя проверка MEE — '+mee[1]+'.']:[]),'Кольца показывают текущее состояние. Текст и PDF относятся к дате отчёта.'];g={...g,title:'О данных отчёта'}}const body=paragraph(lines);if(!body)return '';return g.title?`<details class="report-section ${/^(?:Что изменилось|Что (?:уже )?получается|Главное)/i.test(g.title)?'report-overview':/^(?:Ближайшие|Что дальше)/i.test(g.title)?'report-next':''}"${/^(?:Что изменилось|Что (?:уже )?получается|Главное|Ближайшие|Что дальше|Overall)/i.test(g.title)?' open':''}><summary>${esc(g.title)}<span aria-hidden="true">+</span></summary><div class="report-section-body">${body}</div></details>`:`<div class="report-intro">${body}</div>`}).join('');
 }
 function webReport(o,r,index){
  const heading=String(r.text).match(/^#\s+(.+)$/m),title=heading?heading[1]:String(r.source).split(/[\\/]/).pop().replace(/\.pdf$/i,'');
  const period=String(r.text).match(/(?:^|\n)Период:\s*(.+?)(?:\.\s+(?:Курс|Данные)|$)/im);
  const date=String(r.date).slice(0,10),logo=new URL('../../brand/angle-wordmark.svg',assetBase).href;
  return `<article class="report-paper" data-report-id="${esc(r.id||[r.date,r.source].join('|'))}"><header class="report-band"><img src="${esc(logo)}" alt="ANGLE" width="156" height="46"><div class="report-by">by Viktoria Syuzyova</div><div class="report-band-meta"><b>${o.audience==='student'?'Личный фидбек':'Отчёт для родителей'}</b><span>${esc(o.course)}</span><span>${esc(date||'Архив без даты')}</span></div><div class="report-title-tag">${o.shareUrl?`<a class="report-title" href="${esc(o.shareUrl)}">${esc(title)}</a>`:esc(title)}<small>Итоги занятий</small></div></header><div class="report-paper-body"><div class="report-actions-top">${shareButton(o,r,title)}</div><div class="report-info"><div><b>Ученик</b>${esc(o.name)}</div><div><b>Курс</b>${esc(o.course)}</div><div><b>${period?'Период':'Дата отчёта'}</b>${esc(period?period[1]:(date||'Не указана'))}</div></div>${o.audience==='student'?'':'<aside class="report-progress-note">Кольца показывают текущие результаты. Выводы и PDF относятся к дате отчёта.</aside>'}<div class="report-text" data-report-web="${index}">${o.webEdition?'<p>Открываем отчёт…</p>':reportBody(r.text,o.audience)}</div><footer class="report-paper-actions">${shareButton(o,r,title)}<button type="button" class="btn" data-report-pdf="${esc(o.id)}" data-report-index="${index}">Скачать отчёт PDF</button></footer></div></article>`;
 }
 function panel(o){
  entries.set(o.id,o);
  setTimeout(()=>openRequested(o),0);
  if(o.webEdition)setTimeout(()=>hydrate(o),0);
  const all=reports(o),title=(o.audience==='student'?'Личный фидбек — ':'Карточка для родителей — ')+o.name;
  const share=o.shareUrl?`<a class="report-title" href="${esc(o.shareUrl)}">${esc(title)}</a><button type="button" class="btn ghost" data-share-url="${esc(o.shareUrl)}" data-share-title="${esc(title)}">Поделиться</button>`:'';
  const content=all.length?all.map((r,i)=>i?`<details class="report-history"><summary>${r.date?'Отчёт от '+esc(String(r.date).slice(0,10)):'Без даты'} · ${esc(String(r.source).replace(/\.pdf$/i,''))}</summary>${webReport(o,r,i)}</details>`:webReport(o,r,i)).join(''):`${share}<button type="button" class="btn" data-report-pdf="${esc(o.id)}">Скачать отчёт PDF</button>`;
  return `<div class="parent-report" data-report="${esc(o.id)}">${content}<p class="report-feedback" role="status" aria-live="polite">${all.length?'':'Отчёт пока не добавлен. Здесь появится готовый PDF.'}</p></div>`;
 }
 async function originalPdf(r,web=false){
  const material=JSON.stringify(['ANGLE original parent PDF v1',String(r.date).slice(0,10),String(r.source).normalize('NFC').trim(),String(r.text).replace(/\r\n?/g,'\n').normalize('NFC').trim()]);
  const rawKey=await crypto.subtle.digest('SHA-256',bytes(material));
  // The asset name is a separate hash, never the AES key itself.
  const location=hex(await crypto.subtle.digest('SHA-256',bytes('ANGLE original PDF location v1\0'+hex(rawKey))));
  const assetUrl=new URL(location+(web?'-web':'')+'.bin',assetBase);assetUrl.searchParams.set('v',web?'20261101-final-web':'20261028-rings');
  const response=await fetch(assetUrl,web?{cache:'no-cache'}:{});
  if(!response.ok)throw new Error('Исходный PDF пока не подключён.');
  const encrypted=new Uint8Array(await response.arrayBuffer());
  if(encrypted.length<29)throw new Error('Файл отчёта повреждён.');
  const key=await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);
  const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.slice(0,12)},key,encrypted.slice(12));
  if(!web&&new TextDecoder().decode(result.slice(0,5))!=='%PDF-')throw new Error('Некорректный файл отчёта.');
  return new Blob([result],{type:web?'application/json':'application/pdf'});
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
 async function hydrate(o){
  for(const [index,report] of reports(o).entries()){
   try{
    const blob=await originalPdf(report,true),edition=JSON.parse(await blob.text());
    if(edition.version!==1||typeof edition.text!=='string'||edition.text.length>100000)throw new Error('Invalid web edition');
    for(const root of document.querySelectorAll('[data-report]'))if(root.dataset.report===o.id){const target=root.querySelector(`[data-report-web="${index}"]`);if(target){target.innerHTML=reportBody(edition.text,o.audience);target.dataset.webLoaded='true'}}
   }catch{for(const root of document.querySelectorAll('[data-report]'))if(root.dataset.report===o.id){const target=root.querySelector(`[data-report-web="${index}"]`);if(target)target.textContent='Не удалось открыть текст отчёта. Попробуйте обновить страницу или скачайте PDF.'}}
  }
 }
 window.AngleParentReports={panel,shareButton:toolbarShare};
})();
