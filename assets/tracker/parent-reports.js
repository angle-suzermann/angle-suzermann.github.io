/* Personal report contents come only from the authenticated tracker response.
   Never put pupil reports or a name-to-report index in public site assets. */
(function(){
 'use strict';
 const entries=new Map();
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const shownDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.split('-').reverse().join('.'):String(d||'');
 function panel(o){
  entries.set(o.id,o);
  const report=[...(o.reports||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  const body=report?`<p class="report-date">Комментарий учителя · ${esc(shownDate(report.date))}</p><div class="report-comment">${esc(report.text)}</div>`:'<p class="report-date">Индивидуальный комментарий учителя пока не добавлен.</p>';
  return `<section class="parent-report" data-report="${esc(o.id)}"><h2>Отчёт для родителей</h2>${body}<p><button type="button" class="btn" data-report-pdf="${esc(o.id)}">Скачать отчёт PDF</button></p>${o.onSave?`<details class="report-editor" data-report-editor><summary>Редактировать комментарий для родителей</summary><label>Дата комментария <input type="date" data-report-date value="${esc(report?.date||date())}"></label><label>Комментарий на русском языке<textarea rows="9" data-report-text maxlength="45000">${esc(report?.text||'')}</textarea></label><button type="button" class="btn ghost" data-report-save="${esc(o.id)}">Сохранить комментарий</button></details>`:''}<p class="report-feedback" role="status" aria-live="polite"></p></section>`;
 }
 // Image-backed A4 PDF keeps Cyrillic and the local ANGLE font without
 // uploading children's data or loading third-party conversion services.
 async function pagesFor(o){
  await document.fonts.ready;
  const pages=[],W=1240,H=1754,M=92,bottom=H-100;
  let cv,ctx,y;
  function page(){
   cv=document.createElement('canvas');cv.width=W;cv.height=H;ctx=cv.getContext('2d');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
   ctx.fillStyle='#5E4877';ctx.fillRect(0,0,W,100);
   ctx.fillStyle='#fff';ctx.font='bold 32px "Apercu Pro", Arial';ctx.fillText('ANGLE · English studio',M,62);
   ctx.fillStyle='#FED500';ctx.fillRect(M,119,W-M*2,9);
   ctx.fillStyle='#6b6475';ctx.font='20px "Apercu Pro", Arial';
   ctx.fillText('Отчёт для родителей · '+o.name,M,H-45);
   ctx.fillText(String(pages.length+1),W-M-25,H-45);
   pages.push(cv);y=168;
  }
  function line(text,bold=false,size=25){
   if(y+size*1.5>bottom)page();
   ctx.fillStyle=bold?'#5E4877':'#2D2926';ctx.font=(bold?'bold ':'')+size+'px "Apercu Pro", Arial';
   ctx.fillText(text,M,y);y+=size*1.5;
  }
  function para(text,bold=false,size=25){
   for(const paragraph of String(text||'').split(/\n/)){
    ctx.font=(bold?'bold ':'')+size+'px "Apercu Pro", Arial';let buf='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
     // Split exceptionally long words/URLs instead of letting them clip.
     let chunk='';
     for(const ch of word){if(ctx.measureText(chunk+ch).width>W-M*2){if(buf){line(buf,bold,size);buf=''}line(chunk,bold,size);chunk=''}chunk+=ch}
     const candidate=buf?buf+' '+chunk:chunk;
     if(ctx.measureText(candidate).width>W-M*2&&buf){line(buf,bold,size);buf=chunk}else buf=candidate;
    }
    if(buf)line(buf,bold,size);y+=10;
   }
  }
  page();para('Отчёт для родителей',true,36);para(o.name,true,31);para(o.course);para('Состояние трекера на '+shownDate(date()),false,22);
  for(const s of o.summary||[])para(s);
  const reports=[...(o.reports||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(reports.length){
   const r=reports[0];y+=15;para('Комментарий учителя · '+shownDate(r.date),true,28);para(r.text);
  }else para('Индивидуальный комментарий учителя пока не добавлен.');
  if(o.rows?.length){y+=15;para(o.detailTitle||'Выполнение заданий',true,28);for(const r of o.rows)para(r,false,23)}
  return pages;
 }
 function pdf(pages){
  const chunks=[],offsets=[];let pos=0;
  const ascii=s=>Uint8Array.from(s,c=>c.charCodeAt(0)&255);
  const add=b=>{chunks.push(b);pos+=b.length};
  const obj=(id,parts)=>{offsets[id]=pos;add(ascii(id+' 0 obj\n'));for(const p of parts)add(typeof p==='string'?ascii(p):p);add(ascii('\nendobj\n'))};
  add(ascii('%PDF-1.4\n'));
  obj(1,['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2,['<< /Type /Pages /Kids ['+pages.map((_,k)=>(5+3*k)+' 0 R').join(' ')+'] /Count '+pages.length+' >>']);
  pages.forEach((cv,k)=>{
   const jpg=Uint8Array.from(atob(cv.toDataURL('image/jpeg',.94).split(',')[1]),c=>c.charCodeAt(0));
   const image=3+3*k,content=image+1,page=image+2,stream='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
   obj(image,['<< /Type /XObject /Subtype /Image /Width '+cv.width+' /Height '+cv.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n',jpg,'\nendstream']);
   obj(content,['<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream']);
   obj(page,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 '+image+' 0 R >> >> /Contents '+content+' 0 R >>']);
  });
  const n=3*pages.length+3,start=pos;
  let tail='xref\n0 '+n+'\n0000000000 65535 f \n';
  for(let i=1;i<n;i++)tail+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  add(ascii(tail+'trailer\n<< /Size '+n+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF'));
  return new Blob(chunks,{type:'application/pdf'});
 }
 document.addEventListener('click',async e=>{
  const download=e.target.closest('[data-report-pdf]'),save=e.target.closest('[data-report-save]');
  if(!download&&!save)return;
  const button=download||save,o=entries.get(button.dataset.reportPdf||button.dataset.reportSave),root=button.closest('[data-report]');
  if(!o||!root)return;
  const feedback=root.querySelector('.report-feedback');button.disabled=true;
  try{
   if(download){
    feedback.textContent='Готовим PDF…';
    const blob=pdf(await pagesFor(o)),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ANGLE — '+o.name.replace(/[\\/:*?"<>|]/g,'')+' — '+date()+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    feedback.textContent='PDF готов.';
   }else{
    const text=root.querySelector('[data-report-text]').value.trim(),d=root.querySelector('[data-report-date]').value;
    if(!text||!d)throw new Error('Заполните дату и комментарий.');
    await o.onSave({date:d,text});
    for(const el of document.querySelectorAll('[data-report]'))if(el.dataset.report===o.id)el.querySelector('.report-feedback').textContent='Комментарий сохранён.';
   }
  }catch(err){feedback.textContent=save?'Не удалось сохранить комментарий. '+err.message:'Не удалось подготовить PDF. Попробуйте ещё раз.'}
  finally{button.disabled=false}
 });
 window.AngleParentReports={panel};
})();
