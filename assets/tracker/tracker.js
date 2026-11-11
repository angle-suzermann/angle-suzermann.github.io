'use strict';
const SRC=document.currentScript.src;
const STRUCTURE_URL=new URL('structure.json',SRC);
STRUCTURE_URL.search=new URL(SRC).search;
const LOCK=window.TRACKER_COURSE||null;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};

/* ---------- storage ---------- */
/* connect another device: open a link with ?s=<code>, or paste the link/code in the settings (gear) */
const setupCode=c=>btoa(unescape(encodeURIComponent(JSON.stringify({u:c.url,t:c.token})))).replace(/\+/g,'-').replace(/\//g,'_');
function readSetup(x){try{x=String(x||'').trim();const m=x.match(/[?&]s=([^&#\s]+)/);if(m)x=m[1];x=x.replace(/-/g,'+').replace(/_/g,'/');const o=JSON.parse(decodeURIComponent(escape(atob(x))));return o.u&&o.t?{url:o.u,token:o.t}:null}catch{return null}}
(function(){const s=new URLSearchParams(location.search).get('s');if(s){const c=readSetup(s);if(c)LS.set('angleTracker.cfg',c);try{history.replaceState(null,'',location.pathname)}catch{}}})();
function addSetupUI(){if($('#cfgLink'))return;const sh=document.querySelector('#setDlg .sheet');if(!sh)return;const d=document.createElement('div');
  d.innerHTML='<hr style="border:0;border-top:1px solid #e4e0e8;margin:14px 0"><p class="sub">Connect another device (phone, Telegram, home-screen app):</p><p><button class="btn ghost" id="cfgLink">Copy setup link</button></p><label>Paste a setup link or code here</label><input type="text" id="cfgCode" placeholder="https://…?s=…" autocomplete="off"><p><button class="btn" id="cfgCodeGo">Connect with this code</button></p><p class="sub">The link contains your access token. Send it only to yourself and delete the message afterwards.</p>';
  sh.appendChild(d)}
const cfg=LS.get('angleTracker.cfg',{url:'',token:''});
const live=!!(cfg.url&&cfg.token);
let D={courses:{},progress:{},mee:[],act:[]};
let ui=LS.get('angleTracker.ui',{course:null,tab:'u1',student:null});
const setSync=(s,t)=>{const el=$('#sync');el.className='sync '+s;$('#syncTxt').textContent=t};
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',2600)};

const Demo={
  async load(){
    const st=await (await fetch(STRUCTURE_URL)).json();
    const demoNames={Starters:['Demo A.','Demo B.'],Movers:['Demo C.','Demo D.'],Flyers:['Demo E.','Demo F.','Demo G.'],B1:['Demo H. 🐬','Demo I. 🐬','Demo J. 🐼','Demo K. 🐙']};
    const courses={};
    for(const [c,v] of Object.entries(st)){
      courses[c]={students:demoNames[c].map((n,i)=>({id:c.slice(0,2).toLowerCase()+(i+1),name:n,group:''})),units:v.units,sections:v.sections,phonics:v.phonics.map(p=>({...p})),extras:[]};
    }
    const saved=LS.get('angleTracker.demo',null);
    if(saved){for(const c in courses){if(saved.courses?.[c]){courses[c].phonics=saved.courses[c].phonics||courses[c].phonics;courses[c].extras=saved.courses[c].extras||[];courses[c].units=saved.courses[c].units||courses[c].units}}}
    return {courses,progress:saved?.progress||{},act:saved?.act||[],mee:saved?.mee||[],reports:saved?.reports||[]};
  },
  async write(op){LS.set('angleTracker.demo',{courses:Object.fromEntries(Object.entries(D.courses).map(([c,v])=>[c,{phonics:v.phonics,extras:v.extras,units:v.units}])),progress:D.progress,act:D.act||[],mee:D.mee||[],reports:D.reports||[]})}
};
const Sheets={
  async load(){
    const r=await fetchT(cfg.url+'?token='+encodeURIComponent(cfg.token));
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'load failed'); return j.data;
  },
  async write(op){
    const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...op,token:cfg.token})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'save failed');
  }
};
const QP=new URLSearchParams(location.search);
const PARENT=!!(QP.get('a')&&QP.get('p'));
let parentTab=QP.get('u')?'u'+Number(QP.get('u')):null;
/* data requests: 45 s limit, one automatic retry, then a clear error with a Try again button */
async function fetchT(url,opts,ms){ms=ms||45000;let err;
  for(let i=0;i<2;i++){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);
    try{const r=await fetch(url,{...(opts||{}),signal:ac.signal});clearTimeout(t);return r}
    catch(e){clearTimeout(t);err=e.name==='AbortError'?new Error('The server did not answer in time.'):new Error('No connection to the server.')}}
  throw err}
const retryBtn='<p style="margin-top:12px"><button class="btn" onclick="location.reload()">Try again</button></p>';

const ParentStore={
  async load(){
    const r=await fetchT(QP.get('a')+'?p='+encodeURIComponent(QP.get('p')));
    const j=await r.json(); if(!j.ok) throw new Error('This link is not valid. Ask your teacher for a new one.'); return j.data;
  },
  async write(){}
};
// Textbook section labels apply to live, demo and parent data alike.
// Keep backend IDs (and therefore existing ticks); the former 10-point
// Revision Test remains Unit test. Revision is a new independent item.
const baseStore=PARENT?ParentStore:(live?Sheets:Demo);
const Store={
  async load(){
    if(baseStore===Demo)return baseStore.load();
    const [data,structure]=await Promise.all([baseStore.load(),fetch(STRUCTURE_URL).then(r=>{if(!r.ok)throw new Error('Could not load course structure');return r.json()})]);
    // Keep an offline/failed deletion hidden on reload until its queued write succeeds.
    for(const op of PARENT?[]:pending){
      if(op.a!=='updateExtra'||op.field!=='purpose'||!String(op.value||'').startsWith(EXTRA_DELETED_PREFIX))continue;
      const x=data.courses[op.course]?.extras.find(x=>x.id===op.id);if(x)x.purpose=op.value;
    }
    for(const course of ['Starters','Movers','Flyers']){
      const cc=data.courses[course],template=structure[course];
      if(!cc||!template)continue;
      const old=new Map(cc.sections.map(s=>[s.id,s]));
      const protectedSection=s=>/more|extra/i.test(s.name);
      cc.sections=template.sections.map(s=>{
        const previous=old.get(s.id);
        return previous?{...previous,name:protectedSection(previous)?previous.name:s.name}:{...s};
      });
      // Retain custom sections supplied by the sheet. sec9 in levels 2/3
      // was the separate speaking half of Listening and speaking.
      for(const s of old.values()){
        if(template.sections.some(x=>x.id===s.id))continue;
        if(course!=='Flyers'&&s.id==='sec9'){
          const hasHistory=Object.keys(data.progress||{}).some(k=>k.startsWith(course+'|')&&k.endsWith('|sec9'));
          if(hasHistory)cc.sections.splice(cc.sections.findIndex(x=>x.id==='sec8')+1,0,s);
        }else cc.sections.push(s);
      }
    }
    return data;
  },
  write(op){return baseStore.write(op)}
};
let pending=LS.get('angleTracker.queue',[]);
async function send(op){
  if(!live){await Demo.write(op);return}
  pending.push(op);LS.set('angleTracker.queue',pending);flush();
}
let flushing=false;
async function flush(){
  if(flushing)return;flushing=true;setSync('busy','Saving…');
  try{
    while(pending.length){await Sheets.write(pending[0]);pending.shift();LS.set('angleTracker.queue',pending)}
    setSync('ok','Saved');scheduleRewardRefresh();
  }catch(e){setSync('err','Not saved ('+pending.length+')');toast('Could not save: '+e.message+'. Will retry.');setTimeout(flush,8000)}
  flushing=false;
}

/* ---------- scoring (same rules as the Excel workbooks) ---------- */
const pk=(c,s,scope,item)=>[c,s,scope,item].join('|');
const st=(c,s,scope,item)=>D.progress[pk(c,s,scope,item)]||'';
const C=()=>D.courses[ui.course];
function ratio(e,p){return p>0?e/p:null}
// A unit counts when switched on, explicitly assigned/confirmed in the teacher table,
// or supported by a handed-in/overdue online task (ahead of the course switch).
const unitNo=hw=>{const m=String(hw||'').match(/\bunit\s*[-:#]?\s*(\d+)\b/i);return m?Number(m[1]):null};
// Teacher instruction, 06.11.2026: Movers mo1/mo2 start their overall record at Unit 7.
const firstScoredUnit=(c,sid)=>c==='Movers'&&['mo1','mo2'].includes(sid)?7:null;
function unitOn(c,sid,n){
  const cc=D.courses[c],u=cc&&cc.units.find(x=>x.n===n);if(!u)return false;if(u.active)return true;
  if(cc.sections.some(sec=>['Assigned','Done','✓'].includes(st(c,sid,'u'+n,sec.id))))return true;
  const s=cc.students.find(x=>x.id===sid);if(!s)return false;const nm=String(s.name).toLowerCase();
  return (D.mee||[]).some(r=>String(r.course)===c&&String(r.student).toLowerCase()===nm&&(r.status==='done'||r.status==='missing')&&unitNo(r.hw)===n);
}
function unitScore(c,sid,n){
  const cc=D.courses[c],u=cc.units.find(x=>x.n===n);if(!u||!unitOn(c,sid,n))return{e:0,p:0,r:null};
  let e=0,p=0;for(const s of cc.sections){const v=st(c,sid,'u'+n,s.id);if(v==='N/A')continue;p+=s.points;if(v==='✓')e+=s.points}
  return{e,p,r:ratio(e,p)};
}
function phScore(c,sid){
  const cc=D.courses[c];let e=0,p=0;for(const l of cc.phonics){const v=st(c,sid,'ph',l.id);if(!l.date&&!['Assigned','Done','✓'].includes(v))continue;if(v==='N/A')continue;p+=l.points;if(v==='✓')e+=l.points}
  return{e,p,r:ratio(e,p)};
}
// Soft deletion uses the existing Purpose column, preserving the original
// purpose after the prefix and all student marks for recovery. No server migration.
const EXTRA_DELETED_PREFIX='[ANGLE:deleted] ';
const extraDeleted=x=>String(x.purpose||'').startsWith(EXTRA_DELETED_PREFIX);
function extraAssigned(x,sid){if(extraDeleted(x))return false;if(!x.students)return true;try{return JSON.parse(x.students).includes(sid)}catch{return false}}
function exScore(c,sid){
  const cc=D.courses[c];let e=0,p=0;for(const x of cc.extras){if(!x.date||!extraAssigned(x,sid))continue;const v=st(c,sid,'ex',x.id);if(v==='N/A')continue;p+=x.points;if(v==='✓')e+=x.points}
  return{e,p,r:ratio(e,p)};
}
function overall(c,sid){
  let e=0,p=0;const cc=D.courses[c];
  for(const u of cc.units){const s=unitScore(c,sid,u.n);e+=s.e;p+=s.p}
  const a=phScore(c,sid),b=exScore(c,sid);e+=a.e+b.e;p+=a.p+b.p;
  return{e,p,r:ratio(e,p)};
}
const fmt=r=>r==null?'–':Math.round(r*100)+'%';
const pcClass=r=>r==null?'pc-none':r>=.8?'pc-hi':r>=.5?'pc-mid':'pc-lo';

/* ---------- helpers ---------- */
function grp(name){const n=name.toLowerCase();
  const m=[[/phon/,'pink'],[/speak/,'pink'],[/vocab/,'lav'],[/writ/,'lav'],[/read/,'sage'],[/extra|more/,'sage'],[/gramm|must/,'peach'],[/test|revis/,'peach'],[/language|use|great/,'sky'],[/listen/,'butter']];
  for(const [r,g] of m) if(r.test(n)) return g; return 'lav'}
function next(cur,kind){const cyc=kind==='ex'?['','Assigned','Done','✓','N/A']:['','Assigned','✓','N/A'];return cyc[(cyc.indexOf(cur)+1)%cyc.length]}
const dotCls=v=>v==='✓'?'d':v==='N/A'?'n':v==='Done'||v==='Assigned'?'p':'';
const dotTxt=v=>v==='✓'?'✓':v==='N/A'?'–':v==='Assigned'?'…':v==='Done'?'sent?':'';
const statusLabel=v=>v==='✓'?'Выполнено':v==='Assigned'?'Задано, ещё не выполнено':v==='Done'?'Отправлено, ожидает проверки':v==='N/A'?'Не задано':'Пока не назначено';
function worksheetPercent(r){
  if(!r||r.source!=='worksheet'||r.status!=='done'||r.pct==null||String(r.pct).trim()==='')return null;
  const n=Number(r.pct);return Number.isFinite(n)&&n>=0&&n<=100?Math.round(n):null;
}
function worksheetScore(c,sid,item){
  const cc=D.courses[c],student=cc?.students.find(s=>s.id===sid),extra=cc?.extras.find(x=>x.id===item);
  if(!student||!extra||!extraAssigned(extra,sid))return null;
  const norm=x=>String(x||'').trim().replace(/^\d+[.)]\s*/,'').replace(/\s+/g,' ').toLowerCase();
  // Do not guess across worksheets sharing a title, or across pupils/courses.
  if(cc.extras.filter(x=>!extraDeleted(x)&&norm(x.topic)===norm(extra.topic)).length!==1)return null;
  const rows=(D.mee||[]).filter(r=>String(r.course)===c&&norm(r.student)===norm(student.name)&&norm(r.hw)===norm(extra.topic)&&worksheetPercent(r)!==null);
  if(rows.length!==1)return null;
  return worksheetPercent(rows[0]);
}
function worksheetScoreAttrs(pct){return `class="worksheet-score" style="--p:${pct};--rc:${pct>=80?'#4f9d52':pct>=50?'#d9a900':'#c7586a'}" title="Результат воркшита: ${pct}%" aria-label="Результат воркшита: ${pct}%"`}
/* MEE result on a unit circle (08.11.2026, Viktoria): the MEE assignment name is matched
   to unit sections by the same rules agents use for ticks (vocab -> Vocabulary, developing vocab ->
   Developing Vocabulary, grammar 2 / past cont / conditionals -> Grammar 2 ...). Display only:
   rings and counts are unchanged. A percentage is shown only when every mapped MEE task of this
   pupil in this unit and section is handed in with a score; several tasks are combined only as
   points earned / points possible, never by averaging percentages. */
function meeSections(c,hw){
  const cc=D.courses[c];if(!cc)return[];const h=String(hw||'').toLowerCase();
  if(/backlog/.test(h))return[];
  const by=re=>cc.sections.filter(sec=>re.test(String(sec.name).toLowerCase())).map(sec=>sec.id);
  // 08.11.2026: a unit test maps only to the unit's test section ("Test", "Unit test").
  if(/\btest\b/.test(h))return by(/^(unit )?test$/);
  const out=new Set(),add=a=>a.forEach(x=>out.add(x));
  const devVoc=/\bdev(elop\w*)?\.?\s+voc/.test(h);
  if(devVoc)add(by(/^developing vocab/));
  else if(/\bvoc(ab\w*)?\b/.test(h)&&!/\bvoc\w*\s+(and|\+|&)\s+listening/.test(h))add(by(/^vocab/));
  if(/listening/.test(h))add(by(/listening/));
  if(/reading/.test(h))add(by(/^reading/));
  if(/grammar/.test(h))add(/grammar\s*2|past cont|relative|conditional|used to/.test(h)?by(/^grammar 2/):by(/^grammar( 1)?$/));
  if(/speaking/.test(h))add(by(/^speaking/));
  if(/writing/.test(h))add(by(/^writing/));
  if(/review|revision/.test(h))add(by(/^revision/));
  return[...out];
}
function sectionMeeScore(c,sid,n,secId){
  const cc=D.courses[c],s=cc&&cc.students.find(x=>x.id===sid);if(!s||!Number.isFinite(n))return null;
  const nm=x=>String(x||'').toLowerCase().replace(/^\d+[.)]\s*/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const rows=meeFor(c,s).filter(r=>!(cc.extras||[]).some(x=>nm(x.topic)===nm(r.hw))&&r.status!=='na'&&unitNo(r.hw)===n&&meeSections(c,r.hw).includes(secId));
  if(!rows.length)return null;
  const num=v=>v!==''&&v!=null&&Number.isFinite(Number(v));
  if(!rows.every(r=>r.status==='done'&&num(r.pct)&&Number(r.pct)>=0&&Number(r.pct)<=100))return null;
  if(rows.length===1)return{pct:Math.round(Number(rows[0].pct)),src:[rows[0].hw]};
  if(!rows.every(r=>num(r.pts)&&num(r.max)&&Number(r.max)>0))return null;
  const pts=rows.reduce((a,r)=>a+Number(r.pts),0),max=rows.reduce((a,r)=>a+Number(r.max),0);
  return{pct:Math.round(100*pts/max),src:rows.map(r=>r.hw)};
}
function dot(c,sid,scope,item,kind,missing,readonly=false){
  const v=st(c,sid,scope,item),ws=scope==='ex'&&v!=='N/A'?worksheetScore(c,sid,item):null;
  const ms=ws===null&&/^u\d+$/.test(scope)&&v!=='N/A'?sectionMeeScore(c,sid,Number(scope.slice(1)),item):null;
  const pct=ws!==null?ws:ms?ms.pct:null,what=ms?'Результат MEE ('+ms.src.join(', ')+')':'Результат воркшита';
  const classes=`dot ${dotCls(v)}`;
  const score=pct===null?'':` worksheet-score`;
  const attrs=pct===null?'':` style="--p:${pct};--rc:${pct>=80?'#4f9d52':pct>=50?'#d9a900':'#c7586a'}" title="${esc(what)}: ${pct}%; ${v||'не подтверждено'}"`;
  const label=pct===null?statusLabel(v):`${what}: ${pct}%; ${statusLabel(v)}`;
  const content=pct===null?dotTxt(v):pct+'%';
  return readonly?`<span class="${classes}${score}"${attrs} aria-label="${esc(label)}">${content}</span>`:`<button class="${classes}${score}"${attrs} data-t="${esc([c,sid,scope,item,kind||''].join('\u0001'))}" aria-label="${esc(label)}">${content}</button>`;
}
function ring(r,size=96){const R=size/2-9,C=2*Math.PI*R,v=r==null?0:r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="#e8e3ee" stroke-width="10"/><circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="${v>=.8?'#4f9d52':v>=.5?'#d9a900':'#c7586a'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-v)}"/></svg><b>${fmt(r)}</b></div>`}

/* ---------- views ---------- */
function renderCourses(){
  $('#courses').innerHTML=LOCK?'':Object.keys(D.courses).map(c=>`<button class="pill ${c===ui.course?'on':''}" data-course="${esc(c)}">${esc(c)}</button>`).join('');
}
function tabList(){
  const cc=C();const t=cc.units.map(u=>({k:'u'+u.n,l:String(u.n),t:'Unit '+u.n+': '+u.title}));
  if(cc.phonics.length)t.push({k:'ph',l:'Phonics',w:1});
  t.push({k:'ex',l:'Extras',w:1},{k:'sum',l:'Summary',w:1});return t;
}
function renderTabs(){
  $('#tabs').innerHTML=tabList().map(t=>`<button class="tab ${t.w?'wide':''} ${t.k===ui.tab?'on':''}" data-tab="${t.k}" title="${esc(t.t||'')}">${esc(t.l)}</button>`).join('');
  const tabs=$('#tabs'),a=$('#tabs .on');
  // Reveal the selected unit horizontally without scrolling the page vertically.
  if(a){const box=tabs.getBoundingClientRect(),item=a.getBoundingClientRect();
    if(item.left<box.left||item.right>box.right)tabs.scrollLeft+=item.left-box.left-(tabs.clientWidth-item.width)/2;}
}
function curStudent(){const cc=C();if(!cc.students.find(s=>s.id===ui.student))ui.student=cc.students[0]?.id||null;return cc.students.find(s=>s.id===ui.student)}
function selector(){return `<div class="sel">${C().students.map(s=>`<button class="chip ${s.id===ui.student?'on':''}" data-stud="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>`}
const legend=`<div class="legend"><span><i class="dot p">…</i>Задано</span><span><i class="dot d">✓</i>Выполнено</span><span><i class="dot n">–</i>Не задано</span><span><i class="dot"></i>Пока не назначено</span></div>`;

function viewUnit(n){
  const cc=C(),c=ui.course,u=cc.units.find(x=>x.n===n);if(!u)return '<div class="card empty">No such unit.</div>';
  const head=`<div class="unit-head"><div><h2>Unit ${n} · ${esc(u.title)}</h2><div class="sub">${esc(c)} · Нажмите на кружок: задано → выполнено → не задано → пусто. Во внешнее кольцо входят только заданные и выполненные работы.</div></div>
    <label class="switch"><input type="checkbox" data-active="${n}" ${u.active?'checked':''}>Unit started</label></div>`;
  if(!cc.students.length)return `<div class="card">${head}<div class="empty">No students yet. Add them in the Google Sheet (Students tab).</div></div>`;
  const dim=u.active?'':'<div class="sub" style="margin:0 0 8px;color:#8d6a00">Юнит не отмечен как начатый. Внешнее кольцо учитывает явно заданные и выполненные работы независимо от этого переключателя.</div>';
  const rows=cc.students.map(s=>{const sc=unitScore(c,s.id,n);
    return `<tr><td class="name"><button data-show-report="${esc(s.id)}" title="Открыть отчёт">${esc(s.name)}</button></td>${cc.sections.map(x=>`<td class="tc g-${grp(x.name)}">${dot(c,s.id,'u'+n,x.id,'u',unitOn(c,s.id,n))}</td>`).join('')}<td class="pct ${pcClass(sc.r)}">${fmt(sc.r)}<div class="sub" style="font-weight:400;font-size:10.5px">${sc.e}/${sc.p}</div></td></tr>`}).join('');
  const foot=`<tr><td class="name" style="background:#faf8fc">Class % done</td>${cc.sections.map(x=>{let d=0,t=0;for(const s of cc.students){const v=st(c,s.id,'u'+n,x.id);if(v==='N/A')continue;t++;if(v==='✓')d++}return `<td class="tc g-${grp(x.name)}">${t?Math.round(d/t*100)+'%':'–'}</td>`}).join('')}<td></td></tr>`;
  const s=curStudent();
  const desktop=`<div class="desktop"><div class="matrix"><table class="fx" style="min-width:${160+84+cc.sections.length*74}px"><colgroup><col style="width:160px">${cc.sections.map(()=>'<col>').join('')}<col style="width:84px"></colgroup><thead><tr><th class="name">Student</th>${cc.sections.map(x=>`<th class="g-${grp(x.name)}">${esc(x.name)}<small>${x.points} pts</small></th>`).join('')}<th>Unit %</th></tr></thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div><div class="desktop-ratings" style="margin-top:18px"><h2 style="font-size:16px">Class activity and quality of work</h2>${selector()}${s?ringsTop(c,s,overall(c,s.id))+rateBlock(s):''}</div></div>`;
  const mobile=`<div class="mobile">${selector()}${s?studentCardBody(s,n,false):''}</div>`;
  return `<div class="card">${head}${dim}${legend}${desktop}${mobile}</div>`;
}

// Current-unit selection is independent of the scoring switch "Unit started".
function cardUnits(sid){
  return C().units.filter(u=>unitOn(ui.course,sid,u.n)||C().sections.some(sec=>st(ui.course,sid,'u'+u.n,sec.id)==='✓'));
}
function cardUnit(sid,preferred){
  if(C().units.some(u=>u.n===preferred))return preferred;
  const known=cardUnits(sid);
  return known.length?Math.max(...known.map(u=>u.n)):(C().units[0]?.n||1);
}
function refreshRatings(s,message){
  const modal=$('#cardDlg').open,n=modal?Number($('#cardBody').dataset.unit):null;
  render();
  if(modal)openCard(s.id,n);
  const area=modal?$('#cardBody'):$('#view');
  area.querySelectorAll('[data-rating-feedback]').forEach(el=>{if(el.dataset.ratingFeedback===s.id)el.textContent=message});
  toast(message);
}
function homeworkInUnit(row,n){
 let url='';try{url=decodeURIComponent(String(row.url||row.link||''))}catch(_){}
 const pathUnit=url.match(/\/Unit[\s_-]*(\d+)(?:\/|$)/i);
 const label=String(row.title||row.topic||row.hw||'');
 if(!pathUnit&&row.unit!==undefined&&/^\d+$/.test(String(row.unit)))return Number(row.unit)===Number(n);
 const unit=pathUnit||label.match(/\bUnit[\s_-]*(\d+)\b/i);
 return !!unit&&Number(unit[1])===Number(n);
}
function studentCardBody(s,n,readonly){
  const c=ui.course,cc=C(),u=cc.units.find(x=>x.n===n)||cc.units[0],o=overall(c,s.id);
  const minis=cc.units.filter(x=>!readonly||unitOn(c,s.id,x.n)||x.n===u.n||cardUnits(s.id).some(k=>k.n===x.n)).map(x=>{const sc=unitScore(c,s.id,x.n);return `<span class="${pcClass(sc.r)}"><em>${readonly?'Unit ':'U'}${x.n}</em>${fmt(sc.r)}</span>`}).join('');
  const extra=[];
  if(cc.phonics.length){const p=phScore(c,s.id);extra.push(`<span class="${pcClass(p.r)}"><em>Phonics</em>${fmt(p.r)}</span>`)}
  const x=exScore(c,s.id);extra.push(`<span class="${pcClass(x.r)}"><em>Extras</em>${fmt(x.r)}</span>`);
  const rows=cc.sections.map(sec=>{const v=st(c,s.id,'u'+u.n,sec.id);
    return `<div class="secrow g-${grp(sec.name)}"><div class="t">${esc(sec.name)}<small>${sec.points} ${readonly?'баллов':'pts'}</small></div>${readonly?`<span class="dot ${dotCls(v)}" style="cursor:default">${dotTxt(v)}</span>`:dot(c,s.id,'u'+u.n,sec.id,'u',unitOn(c,s.id,u.n))}</div>`}).join('');
  return `${window.AngleRewards?.panel(window.AngleRewards.fromRows(D.rewards,c,s.id,D.rewardVersion))||''}${ringsTop(c,s,o,readonly)}
   <div class="mini">${extra.join('')}</div>
   <h2 style="font-size:16px;margin:6px 0 8px;color:var(--purple)">Unit ${u.n} · ${esc(u.title)}${unitOn(c,s.id,u.n)?'':` <span class="sub">${readonly?'(юнит не отмечен как начатый)':'(not started)'}</span>`}</h2>${rows}
   ${cc.extras.filter(x=>x.date&&extraAssigned(x,s.id)&&homeworkInUnit(x,u.n)).length?`<h2 style="font-size:16px;margin-top:18px">Назначенные задания</h2>${cc.extras.filter(x=>x.date&&extraAssigned(x,s.id)&&homeworkInUnit(x,u.n)).map(x=>`<div class="secrow"><div class="t"><a href="${esc(homeworkLinkFor(x,s))}" target="_blank" rel="noopener">${esc(x.topic)}</a><small>${esc(x.date)}${x.due?' · Сдать до '+esc(homeworkDay(x.due)):''} · ${esc(({homework:'Homework',classwork:'Classwork',before:'Before the lesson'})[x.kind]||'Worksheet')}</small></div>${dot(c,s.id,'ex',x.id,'ex',true,readonly)}</div>`).join('')}`:''}
   ${homeworkAssignedCards(s,readonly,u.n)}${meeBlock(meeFor(c,s).filter(x=>homeworkInUnit(x,u.n)),s,!readonly)}
   ${readonly?homeworkStudentStatus(s,u.n)+parentReport(s):''}
   ${readonly?'':`<p style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 0"><button class="btn" data-show-report="${esc(s.id)}">Посмотреть отчёт</button>${parentShare(s)}<button class="btn ghost" data-card="${esc(s.id)}">Open parent card (for screenshot)</button><button class="btn ghost" data-plink="${esc(s.id)}">Copy parent link</button></p>`}`;
}
function openReport(sid){
  if(PARENT)return;
  const student=C().students.find(s=>s.id===sid);if(!student)return;
  $('#cardBody').innerHTML=`<button class="iconbtn close" onclick="cardDlg.close()" aria-label="Закрыть">✕</button><h2>Отчёт · ${esc(student.name)}</h2>${parentReport(student)}<p><button class="btn ghost" data-card="${esc(student.id)}">Карточка ученика</button></p>`;
  if(!$('#cardDlg').open)$('#cardDlg').showModal();
}
function parentReportOptions(s){
  const course=ui.course;
  const url=new URL(location.pathname,location.origin),api=PARENT?QP.get('a'):cfg.url,key=PARENT?QP.get('p'):s.key;
  if(api&&key){url.searchParams.set('a',api);url.searchParams.set('p',key)}
  return {id:course+'|'+s.id,name:s.name,course,
    webEdition:true,
    shareUrl:api&&key?url.href:'',
    reports:(D.reports||[]).filter(r=>r.course===course&&r.studentId===s.id&&!r.plan)
  };
}
function parentReport(s){return window.AngleParentReports?AngleParentReports.panel(parentReportOptions(s)):''}
function parentShare(s){return window.AngleParentReports?.shareButton?AngleParentReports.shareButton(parentReportOptions(s)):''}
function openCard(sid,n){
  const s=C().students.find(x=>x.id===sid);if(!s)return;
  n=cardUnit(sid,n==null?(/^u\d+$/.test(ui.tab)?Number(ui.tab.slice(1)):null):n);
  const started=C().units.filter(u=>u.n===n||cardUnits(sid).some(k=>k.n===u.n));
  $('#cardBody').dataset.unit=String(n);
  const nav=started.length>1?`<div class="sel">${started.map(u=>`<button class="chip ${u.n===n?'on':''}" data-ctab="${esc(sid)}|${u.n}">Unit ${u.n}</button>`).join('')}</div>`:'';
  $('#cardBody').innerHTML=`<button class="iconbtn close" onclick="cardDlg.close()">\u2715</button><div class="brandline"><b>ANGLE \u00b7 HOMEWORK PROGRESS</b></div>${nav}${studentCardBody(s,n,true)}${PARENT?'':`<div class="ttools" id="ttools"><b>Teacher tools</b> <button class="chip" data-hidett="1">Hide for screenshot</button>${rateBlock(s)}</div>`}<div class="foot">${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} \u00b7 ANGLE English studio</div><p style="margin:10px 0 0;text-align:center"><button class="btn ghost" data-plink="${esc(sid)}">Copy parent link</button></p>`;
  if(!$('#cardDlg').open)$('#cardDlg').showModal();
}

function viewPhonics(){
  const cc=C(),c=ui.course;if(!cc.phonics.length)return '<div class="card empty">This course has no phonics tracking.</div>';
  const head=`<div class="unit-head"><div><h2>Phonics</h2><div class="sub">One row = one lesson. A lesson counts once a date is entered.</div></div></div>`;
  const stu=cc.students;
  const rows=cc.phonics.map(l=>`<tr><td class="name" style="font-size:13px"><b>${esc(l.unit)}</b> · ${esc(l.lesson)}</td><td><input type="date" value="${esc(l.date)}" data-pdate="${esc(l.id)}" style="min-width:128px"></td>${stu.map(s=>`<td>${dot(c,s.id,'ph',l.id,'p',!!l.date)}</td>`).join('')}</tr>`).join('');
  const tot=`<tr><th class="name" style="background:#faf8fc">Phonics %</th><th></th>${stu.map(s=>{const p=phScore(c,s.id);return `<th class="${pcClass(p.r)}">${fmt(p.r)}</th>`}).join('')}</tr>`;
  const desk=`<div class="desktop"><div class="matrix" style="max-height:70vh"><table class="fx" style="min-width:${230+150+stu.length*90}px"><colgroup><col style="width:230px"><col style="width:150px">${stu.map(()=>'<col>').join('')}</colgroup><thead><tr><th class="name">Lesson</th><th>Date taught</th>${stu.map(s=>`<th class="g-pink">${esc(s.name)}</th>`).join('')}</tr>${tot}</thead><tbody>${rows}</tbody></table></div></div>`;
  const s=curStudent();
  const mrows=s?cc.phonics.map(l=>`<div class="secrow g-pink"><div class="t">${esc(l.unit)} · ${esc(l.lesson)}<small><input type="date" value="${esc(l.date)}" data-pdate="${esc(l.id)}" style="margin-top:3px;padding:3px 6px;font-size:13px"></small></div>${dot(c,s.id,'ph',l.id,'p',!!l.date)}</div>`).join(''):'';
  const p=s?phScore(c,s.id):null;
  const mob=`<div class="mobile">${selector()}${s?`<div class="scard-top">${ring(p.r)}<div class="who"><h3>${esc(s.name)}</h3><div>Phonics · ${p.e} of ${p.p} points</div></div></div>${mrows}`:''}</div>`;
  return `<div class="card">${head}${legend}${desk}${mob}</div>`;
}

const extraLink=value=>{if(!/^(https?:\/\/|\/)/i.test(String(value||'')))return '';try{const u=new URL(value,location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const extraDrafts=new Map();
const extraDraftKey=id=>ui.course+'|'+id;
const PURPOSES=['Reinforcement','Checking understanding','Error correction','Clarification'];
function viewExtras(){
  const cc=C(),c=ui.course,extras=cc.extras.filter(x=>!extraDeleted(x));
  const head=`<div class="unit-head"><div><h2>Extra worksheets</h2><div class="sub">Нажмите на кружок: задано → отправлено, ожидает проверки → выполнено ✓ → не задано → пусто. Внешнее кольцо учитывает заданные работы; сданной считается подтверждённая ✓.</div></div><button class="btn" id="addExtra">+ Add worksheet</button></div>`;
  if(!extras.length)return `<div class="card">${head}<div class="empty">No extra worksheets yet.</div></div>`;
  const list=[...extras].reverse().map(saved=>{const draft=extraDrafts.get(extraDraftKey(saved.id)),x=draft||saved;return `<div class="xcard" data-x="${esc(x.id)}">${draft?`<div class="xgrid">
    <div><label>Дата занятия</label><input type="date" value="${esc(x.date)}" data-xf="date"></div><div><label>Срок сдачи</label><input type="date" value="${esc(x.due||'')}" data-xf="due"></div>
    <div class="wide2"><label>Topic</label><input type="text" value="${esc(x.topic)}" data-xf="topic" placeholder="e.g. Present perfect vs past simple"></div>
    <div><label>Purpose</label><select data-xf="purpose"><option value=""></option>${PURPOSES.map(p=>`<option ${p===x.purpose?'selected':''}>${p}</option>`).join('')}</select></div>
    <div><label>Points</label><input type="number" min="0" value="${x.points}" data-xf="points"></div>
    <div class="wide2" style="grid-column:1/3"><label>Worksheet (name or link)</label><input type="text" value="${esc(x.link)}" data-xf="link"></div>
    <div class="wide2" style="grid-column:3/-1"><label>Notes / follow-up</label><textarea data-xf="note">${esc(x.note)}</textarea></div></div><p><button type="button" class="btn" data-extra-save="${esc(x.id)}">Save</button> <button type="button" class="btn danger" data-extra-delete="${esc(x.id)}">Удалить</button></p>`:`<div class="extra-compact"><div><div class="tt">${extraLink(x.link)?`<a href="${esc(extraLink(x.link))}" target="_blank" rel="noopener">${esc(x.topic||x.link||'Worksheet')}</a>`:esc(x.topic||x.link||'Worksheet')}</div><div class="sub">${[x.date,x.due?'Сдать до '+homeworkDay(x.due):'',({homework:'Homework',classwork:'Classwork',before:'Before the lesson'})[x.kind],x.purpose,x.points+' pts'].filter(Boolean).map(esc).join(' · ')}</div>${x.note?`<div class="tnote">${esc(x.note)}</div>`:''}</div><div class="extra-actions"><button type="button" class="btn ghost" data-extra-edit="${esc(x.id)}">Edit</button><button type="button" class="btn danger" data-extra-delete="${esc(x.id)}">Удалить</button></div></div>`}
    <div class="xstud">${cc.students.filter(s=>extraAssigned(x,s.id)).map(s=>`<span class="xs">${dot(c,s.id,'ex',x.id,'ex',!!x.date)}${esc(s.name)}</span>`).join('')}</div></div>`}).join('');
  return `<div class="card">${head}${list}</div>`;
}

function viewSummary(){
  const cc=C(),c=ui.course;if(!cc.students.length)return '<div class="card empty">No students.</div>';
  const th=cc.units.map(u=>`<th title="${esc(u.title)}">U${u.n}</th>`).join('')+(cc.phonics.length?'<th>Phonics</th>':'')+'<th>Extras</th><th>Overall</th>';
  const rows=cc.students.map(s=>{
    const cell=r=>`<td class="pct ${pcClass(r)}">${fmt(r)}</td>`;
    const o=overall(c,s.id);
    return `<tr><td class="name"><button data-show-report="${esc(s.id)}" title="Открыть отчёт">${esc(s.name)}</button></td>${cc.units.map(u=>cell(unitScore(c,s.id,u.n).r)).join('')}${cc.phonics.length?cell(phScore(c,s.id).r):''}${cell(exScore(c,s.id).r)}<td class="pct ${pcClass(o.r)}" style="font-size:15px">${fmt(o.r)}</td></tr>`}).join('');
  const imp=live?`<div class="card" style="margin-top:12px"><h2 style="font-size:16px">Import MEE homework</h2><div class="sub">Paste the JSON that Claude produced from MEE. It replaces this course's MEE rows.</div><textarea id="meeJson" rows="4" style="width:100%;margin:8px 0"></textarea><button class="btn" id="meeGo">Import</button></div>`:'';
  return `<div class="card"><div class="unit-head"><div><h2>${esc(c)} · Summary</h2><div class="sub">Weighted: points earned ÷ points possible (started units, dated phonics lessons, dated extras).</div></div></div><div class="matrix"><table><thead><tr><th class="name">Student</th>${th}</tr></thead><tbody>${rows}</tbody></table></div></div>${imp}`;
}

function render(){
  if(LOCK&&D.courses[LOCK])ui.course=LOCK;
  if(!ui.course||!D.courses[ui.course])ui.course=Object.keys(D.courses)[0];
  if(!tabList().find(t=>t.k===ui.tab))ui.tab='u1';
  LS.set('angleTracker.ui',ui);
  renderCourses();renderTabs();
  $('#sub').textContent=ui.course+' · teacher panel';
  const t=ui.tab;
  $('#view').innerHTML=rewardOverview()+homeworkQueue()+(t==='ph'?viewPhonics():t==='ex'?viewExtras():t==='sum'?viewSummary():viewUnit(parseInt(t.slice(1))));
}

/* Universal for ALL groups/pupils: outer = handed in / all assigned, including future
   deadlines. Never substitute the unit checklist, syllabus size or weighted points.
   No assigned list = unknown (–), not 0% or 100%. */
const isTest=r=>/\btest\b/i.test(String(r.hw||''));
function meeFor(c,s){const n=String(s.name).toLowerCase(),byTask=new Map();for(const r of D.mee||[]){if(String(r.course)===c&&String(r.student).toLowerCase()===n)byTask.set(String(r.hw||'').trim().toLowerCase(),r)}return [...byTask.values()]}
function assignedWorkFor(c,s){
  const first=firstScoredUnit(c,s.id);
  return meeFor(c,s).filter(r=>{const n=unitNo(r.hw);return first===null||n===null||n>=first});
}
function groupSubmission(c,s){
  const cc=D.courses[c],first=firstScoredUnit(c,s.id),tasks=new Map();
  const eligible=n=>first===null||n===null||n>=first;
  const norm=x=>String(x||'').toLowerCase().replace(/^\d+[.)]\s*/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const add=(key,v)=>{if(['✓','Assigned','Done'].includes(v))tasks.set(key,v==='✓')};
  // 08.11.2026 (Viktoria): one piece of work = one task. When MEE work of this pupil maps to a
  // unit section (meeSections, same rules as the circle percentage), the MEE tasks are counted
  // and the circle itself is not counted again. A ✓ on the circle confirms its mapped MEE work
  // as done (paper or checked work); N/A on every mapped circle excludes the MEE task.
  const mapped=new Map(),covered=new Set();
  for(const r of assignedWorkFor(c,s)){
    if(!['done','missing','pending'].includes(r.status))continue;
    if((cc.extras||[]).some(x=>norm(x.topic)===norm(r.hw)))continue;
    const n=unitNo(r.hw);if(n===null||!eligible(n))continue;
    const keys=meeSections(c,r.hw).map(id=>'u'+n+'|'+id);if(!keys.length)continue;
    mapped.set(r,{n,ids:meeSections(c,r.hw)});keys.forEach(k=>covered.add(k));
  }
  for(const u of cc.units)if(eligible(u.n))for(const sec of cc.sections){const k='u'+u.n+'|'+sec.id;if(!covered.has(k))add(k,st(c,s.id,'u'+u.n,sec.id))}
  for(const ph of cc.phonics||[])if(eligible(unitNo(ph.unit)))add('ph|'+ph.id,st(c,s.id,'ph',ph.id));
  for(const x of cc.extras||[])if(extraAssigned(x,s.id)&&eligible(unitNo(x.topic)))add('ex|'+x.id,st(c,s.id,'ex',x.id));
  for(const r of assignedWorkFor(c,s)){
    if(!['done','missing','pending'].includes(r.status))continue;
    const mp=mapped.get(r);
    if(mp){const states=mp.ids.map(id=>st(c,s.id,'u'+mp.n,id));if(states.every(v=>v==='N/A'))continue;
      tasks.set('online|'+norm(r.hw),r.status==='done'||states.includes('✓'));continue;}
    // Merge only an exact, unique task identity. Do not guess that Grammar 1 is
    // the same assignment as a whole Grammar section.
    const extras=(cc.extras||[]).filter(x=>norm(x.topic)===norm(r.hw));
    let key=null,scope=null,item=null;
    if(extras.length===1){const x=extras[0];if(!extraAssigned(x,s.id))continue;key='ex|'+x.id;scope='ex';item=x.id;}
    else{const n=unitNo(r.hw),sections=cc.sections.filter(sec=>norm('Unit '+n+' '+sec.name)===norm(r.hw));if(n!==null&&sections.length===1){scope='u'+n;item=sections[0].id;key=scope+'|'+item;}}
    if(key&&st(c,s.id,scope,item)==='N/A')continue;
    if(key&&tasks.has(key))continue;
    tasks.set(key||'online|'+norm(r.hw),r.status==='done');
  }
  const assigned=tasks.size,done=[...tasks.values()].filter(Boolean).length;
  return{assigned,done,sub:assigned?done/assigned:null};
}
function meeSum(rows){
  const assigned=rows.filter(r=>['done','missing','pending'].includes(r.status)),done=assigned.filter(r=>r.status==='done');
  const sc=done.filter(r=>r.pct!==''&&r.pct!=null),q=sc.length?sc.reduce((a,r)=>a+Number(r.pct),0)/sc.length/100:null;
  return {assigned:assigned.length,due:assigned.length,done:done.length,sub:assigned.length?done.length/assigned.length:null,q};
}
function ring2(r,R,col,w){const C2=2*Math.PI*R,v=Math.max(0,Math.min(1,r||0));
  return `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${col}" stroke-opacity=".18" stroke-width="${w}"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(C2*v).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 60 60)"/>`}
const ACT_LABELS={1:'Needs encouragement',2:'Steady',3:'Very active'};
function actFor(c,s,kind='activity'){const n=String(s.name).toLowerCase();return (D.act||[]).filter(r=>String(r.course)===c&&String(r.student).toLowerCase()===n&&(r.kind||'activity')===kind)}
function actAvg(a){return a.length?a.reduce((x,r)=>x+Number(r.score),0)/a.length/3:null}
const Q_LABELS={1:'Needs more care',2:'Good',3:'Excellent'};
const pcT=v=>v==null?'–':Math.round(v*100)+'%';
function lvl(a,L){return a.length?L[Math.max(1,Math.min(3,Math.round(a.reduce((x,r)=>x+Number(r.score),0)/a.length)))]+' ('+a.length+' check'+(a.length>1?'s':'')+')':'not rated yet'}
/* three rings for every course: outer = handed in, middle = quality of work, inner = activity in class */
function ringsTop(c,s,o,ru=false){
  const allAssigned=groupSubmission(c,s),rows=meeFor(c,s).filter(r=>!isTest(r)),m=meeSum(rows),act=actFor(c,s,'activity'),qa=actFor(c,s,'quality');
  const registered=c==='Flyers',sub=allAssigned.sub,subTxt=sub!=null?`${allAssigned.done} of ${allAssigned.assigned} assigned tasks, including future deadlines`:'assigned task list not recorded';
  const teacherQuality=registered&&qa.length>0,qual=teacherQuality?actAvg(qa):(m.q!=null?m.q:actAvg(qa)),qTxt=teacherQuality?lvl(qa,Q_LABELS):(m.q!=null?'average score of handed-in online work':lvl(qa,Q_LABELS));
  const actRu={1:'Нужна поддержка и помощь во включении в работу',2:'Работает стабильно',3:'Активно участвует в работе'};
  const qualRu={1:'Нужно внимательнее проверять работу',2:'Хороший результат',3:'Отличный результат'};
  const levelRu=(a,labels)=>a.length?labels[Math.max(1,Math.min(3,Math.round(a.reduce((x,r)=>x+Number(r.score),0)/a.length)))]+`; оценок: ${a.length}`:'оценка пока не добавлена';
  const ruSub=sub!=null?`${allAssigned.done} из ${allAssigned.assigned} заданных работ, включая будущие сроки`:'список заданных работ пока не внесён';
  const ruQuality=teacherQuality?levelRu(qa,qualRu):(m.q!=null?'средний результат сданных онлайн-заданий':levelRu(qa,qualRu));
  const svg=`<svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="${ru?'Показатели прогресса':'Progress rings'}">${ring2(sub,50,'#6b21a8',11)}${ring2(qual,36,'#eab308',10)}${ring2(actAvg(act),22,'#0f766e',10)}</svg>`;
  return `<div class="scard-top">${svg}<div class="who"><h3>${esc(s.name)}</h3><div><b style="color:#6b21a8">●</b> ${ru?'Сдано заданий':'Handed in'}: <b>${pcT(sub)}</b> (${ru?ruSub:subTxt})</div><div><b style="color:#eab308">●</b> ${ru?'Качество работы':'Quality of work'}: <b>${pcT(qual)}</b> (${ru?ruQuality:qTxt})</div><div><b style="color:#0f766e">●</b> ${ru?'Работа на занятиях':'Activity in class'}: <b>${pcT(actAvg(act))}</b> (${ru?levelRu(act,actRu):lvl(act,ACT_LABELS)})</div></div></div>`}
function rateBlock(s){
  const activity=actFor(ui.course,s).slice(-1)[0],quality=actFor(ui.course,s,'quality').slice(-1)[0];
  return `<div class="sub" style="margin:14px 0 4px">Class activity (once per 2–4 lessons): 1 = ${ACT_LABELS[1]} · 2 = ${ACT_LABELS[2]} · 3 = ${ACT_LABELS[3]}</div><div class="sel activity-rating" data-actfor="${esc(s.id)}">${[1,2,3].map(v=>`<button type="button" class="chip ${+activity?.score===v?'on':''}" aria-pressed="${+activity?.score===v}" data-act="${v}">${v} · ${ACT_LABELS[v]}</button>`).join('')}<label class="activity-lessons">Lessons covered <select class="chip" data-actles>${[2,3,4].map(v=>`<option ${+activity?.lessons===v?'selected':''}>${v}</option>`).join('')}</select></label></div>
   <div class="sub" style="margin:12px 0 4px">Quality of work (teacher's rating of checked homework; online scores are used automatically when they exist): 1 = ${Q_LABELS[1]} · 2 = ${Q_LABELS[2]} · 3 = ${Q_LABELS[3]}</div><div class="sel" data-actfor="${esc(s.id)}">${[1,2,3].map(v=>`<button type="button" class="chip ${+quality?.score===v?'on':''}" aria-pressed="${+quality?.score===v}" data-qual="${v}">${v} · ${Q_LABELS[v]}</button>`).join('')}</div>
   <div class="sub" style="margin:12px 0 4px">Photo homework (handwritten work you checked): task name and score in percent</div><div class="sel" data-photofor="${esc(s.id)}"><input type="text" class="chip" data-phw placeholder="Task, e.g. Unit 2 Grammar 1" style="min-width:200px"><input type="number" class="chip" data-ppct min="0" max="100" placeholder="%" style="width:70px"><button class="chip" data-photo>Save photo homework</button></div><p class="sub" role="status" aria-live="polite" data-rating-feedback="${esc(s.id)}"></p>`}
// Group by the unit named in the assignment, never by its due date.
function meeUnitGroups(rows,renderRow){
  const groups=new Map();
  for(const r of rows){
    const match=String(r.hw||'').match(/\bunit\s*[-:#]?\s*(\d+)\b/i);
    const unit=match?Number(match[1]):null;
    if(!groups.has(unit))groups.set(unit,[]);
    groups.get(unit).push(r);
  }
  const keys=[...groups.keys()].sort((a,b)=>a===null?1:b===null?-1:b-a);
  const tabs=keys.map((unit,i)=>`<button type="button" class="chip ${i===0?'on':''}" data-mee-tab="${unit===null?'other':unit}" aria-pressed="${i===0}">${unit===null?'Другие работы':'Unit '+unit}</button>`).join('');
  const panels=keys.map((unit,i)=>{
    const items=groups.get(unit).slice().sort((a,b)=>String(b.due||'').localeCompare(String(a.due||'')));
    return `<section class="mee-unit" data-mee-unit="${unit===null?'other':unit}"${i===0?'':' hidden'}><h3>${unit===null?'Другие работы / Other work':'Unit '+unit}</h3>${items.map(renderRow).join('')}</section>`;
  }).join('');
  return keys.length?`<div class="mee-tabs-block"><div class="sel mee-tabs" aria-label="Выбрать юнит">${tabs}</div>${panels}</div>`:'';
}
function meeBlock(allRows,s,teacher){
  const rows=allRows.filter(r=>!isTest(r)),tests=allRows.filter(isTest);
  const list=meeUnitGroups(rows,r=>{const lab=r.status==='done'?(r.pct===''||r.pct==null?(teacher?'done':'сдано'):Math.round(r.pct)+'%'):r.status==='missing'?(teacher?'not handed in':'не сдано'):r.status==='pending'?(teacher?'not due yet':'срок ещё не наступил'):r.status==='na'?(teacher?'not required':'не требуется'):'–';
    const src=r.source==='photo'?(teacher?' · photo':' · письменная работа'):r.source==='worksheet'?(teacher?' · worksheet':' · интерактивное задание'):'';return `<div class="secrow"><div class="t">${esc(r.hw)}<small>${esc(String(r.due||''))}${src}</small>${teacher&&r.note?`<small style="display:block;white-space:pre-line;opacity:.75">${esc(String(r.note).slice(0,400))}</small>`:''}</div>${worksheetPercent(r)!==null?`<span ${worksheetScoreAttrs(worksheetPercent(r))}>${worksheetPercent(r)}%</span>`:`<span class="tag">${lab}</span>`}</div>`});
  const rate=teacher&&s?rateBlock(s):'';
  const tlist=tests.length?`<h2 style="font-size:16px;margin:14px 0 8px;color:var(--purple)">${teacher?'Unit tests':'Тесты по юнитам'}</h2>${meeUnitGroups(tests,r=>`<div class="secrow"><div class="t">${esc(String(r.hw).replace(/^\d+\.\s*/,''))}<small>${esc(String(r.due||''))}</small></div>${worksheetPercent(r)!==null?`<span ${worksheetScoreAttrs(worksheetPercent(r))}>${worksheetPercent(r)}%</span>`:`<span class="tag">${r.pct===''||r.pct==null?'–':Math.round(r.pct)+'%'}</span>`}</div>`)}`:'';
  return (rows.length?`<h2 style="font-size:16px;margin:14px 0 8px;color:var(--purple)">${teacher?'Online homework (MEE)':'Онлайн-задания и проверенные работы'}</h2>${list}`:'')+tlist+rate}

function renderParent(){
  const c=Object.keys(D.courses)[0];ui.course=c;const cc=C(),st=cc.students[0];
  const n=cardUnit(st.id,parentTab?Number(parentTab.slice(1)):null);
  ui.tab='u'+n;
  const started=cc.units.filter(u=>u.n===n||cardUnits(st.id).some(k=>k.n===u.n));
  const nav=started.length?`<div class="sel">${started.map(u=>`<button class="chip ${'u'+u.n===ui.tab?'on':''}" data-ptab="u${u.n}">Unit ${u.n}</button>`).join('')}</div>`:'';
  $('#sub').textContent='Homework progress';
  document.documentElement.lang='ru';document.title='ANGLE · Homework progress';
  if($('.title')?.firstChild)$('.title').firstChild.textContent='Homework tracker';
  $('#view').innerHTML=`<div class="card">${nav}${studentCardBody(st,n,true)}<div class="foot" style="margin-top:12px;font-size:12px;opacity:.7">Данные обновляет преподаватель · ANGLE English studio</div></div>`;
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const reportButton=e.target.closest('[data-show-report]');
  if(reportButton){openReport(reportButton.dataset.showReport);return}
  if(e.target.closest('[data-hidett]')){const t=$('#ttools');if(t)t.style.display='none';toast('Tools hidden. Close and reopen the card to show them again');return}
  const pb=e.target.closest('[data-photo]');
  if(pb){const box=pb.closest('[data-photofor]'),st4=C().students.find(x=>x.id===box.dataset.photofor),hw=box.querySelector('[data-phw]').value.trim(),pc=box.querySelector('[data-ppct]').value;
    if(!hw||pc===''||+pc<0||+pc>100){toast('Enter the task name and a score from 0 to 100');return}
    const row={course:ui.course,student:st4.name,hw,due:new Date().toISOString().slice(0,10),status:'done',pct:+pc,source:'photo'};
    D.mee=(D.mee||[]).filter(r=>!(String(r.course)===row.course&&r.student===row.student&&r.hw===hw)).concat([row]);send({a:'addResult',...row});toast('Saved: '+st4.name+' · '+hw+' '+pc+'%');openCard(st4.id);return}
  const qb=e.target.closest('[data-qual]');
  if(qb){const box=qb.closest('[data-actfor]'),st3=C().students.find(x=>x.id===box.dataset.actfor);
    const row={course:ui.course,student:st3.name,date:new Date().toISOString().slice(0,10),lessons:'',score:+qb.dataset.qual,note:'',kind:'quality'};
    (D.act=D.act||[]).push(row);send({a:'addActivity',...row});refreshRatings(st3,'Saved: '+st3.name+' quality '+row.score+'/3');return}
  const ab=e.target.closest('[data-act]');
  if(ab){const box=ab.closest('[data-actfor]'),st2=C().students.find(x=>x.id===box.dataset.actfor);const les=+box.querySelector('[data-actles]').value;
    const row={course:ui.course,student:st2.name,date:new Date().toISOString().slice(0,10),lessons:les,score:+ab.dataset.act,note:''};
    (D.act=D.act||[]).push(row);send({a:'addActivity',...row});refreshRatings(st2,'Saved: '+st2.name+' activity '+row.score+'/3 over '+les+' lessons');return}
  if(e.target.id==='meeGo'){let j;try{j=JSON.parse($('#meeJson').value)}catch{toast('That is not valid JSON');return}
    if(Array.isArray(j.act)){j.act.forEach(r=>{const row={course:r.course,student:r.student,date:r.date||new Date().toISOString().slice(0,10),lessons:r.lessons||'',score:+r.score,note:r.note||'',kind:r.kind==='quality'?'quality':'activity'};(D.act=D.act||[]).push(row);send({a:'addActivity',...row})});toast('Saving '+j.act.length+' ratings…');setTimeout(async()=>{try{D=await Store.load();render()}catch{}},4000);return}
    if(!j.course||!Array.isArray(j.rows)){toast('JSON needs course and rows');return}
    send({a:'importMee',course:j.course,rows:j.rows});toast('Importing '+j.rows.length+' rows…');setTimeout(async()=>{try{D=await Store.load();render()}catch{}},4000);return}
  const pl=e.target.closest('[data-plink]');
  if(pl){const st=C().students.find(x=>x.id===pl.dataset.plink);
    if(!live||!st||!st.key){toast('Connect the Google Sheet and run makeParentKeys first');pl.textContent='No key yet';return}
    const url=location.origin+location.pathname+'?a='+encodeURIComponent(cfg.url)+'&p='+encodeURIComponent(st.key);
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>{toast('Parent link copied: '+st.name);pl.textContent='Copied ✓'},()=>{prompt('Copy this link',url)});return}
  const ct=e.target.closest('[data-ctab]');
  if(ct){const [i,n]=ct.dataset.ctab.split('|');openCard(i,+n);return}
  const pt=e.target.closest('[data-ptab]');
  if(pt){parentTab=pt.dataset.ptab;renderParent();return}
  const d=e.target.closest('.dot[data-t]');
  if(d){const [c,sid,scope,item,kind]=d.dataset.t.split('\u0001');const k=pk(c,sid,scope,item);const nv=next(D.progress[k]||'',kind);
    if(nv)D.progress[k]=nv;else delete D.progress[k];
    send({a:'setStatus',course:c,student:sid,scope,item,status:nv});
    const y=window.scrollY,tx=$('.matrix')?.scrollLeft,ty=$('.matrix')?.scrollTop;render();window.scrollTo(0,y);const m=$('.matrix');if(m){m.scrollLeft=tx;m.scrollTop=ty}
    return}
  const co=e.target.closest('[data-course]');if(co){ui.course=co.dataset.course;ui.tab='u1';ui.student=null;render();return}
  const tb=e.target.closest('[data-tab]');if(tb){ui.tab=tb.dataset.tab;render();window.scrollTo(0,0);return}
  const sd=e.target.closest('[data-stud]');if(sd){
    const x=window.scrollX,y=window.scrollY;
    const scrollers=[...document.querySelectorAll('#view .matrix,#view .sel')].map(el=>({left:el.scrollLeft,top:el.scrollTop}));
    ui.student=sd.dataset.stud;render();
    document.querySelectorAll('#view .matrix,#view .sel').forEach((el,i)=>{if(scrollers[i]){el.scrollLeft=scrollers[i].left;el.scrollTop=scrollers[i].top;}});
    window.scrollTo(x,y);return}
  const cd=e.target.closest('[data-card]');if(cd){openCard(cd.dataset.card);return}
  const extraDelete=e.target.closest('[data-extra-delete]');
  if(extraDelete){
    if(PARENT)return;
    const x=C().extras.find(x=>x.id===extraDelete.dataset.extraDelete);if(!x||extraDeleted(x))return;
    if(!confirm('Удалить задание «'+(x.topic||x.link||'Без названия')+'»? Оно исчезнет из списка и расчёта баллов.'))return;
    x.purpose=EXTRA_DELETED_PREFIX+(x.purpose||'');
    extraDrafts.delete(extraDraftKey(x.id));
    send({a:'updateExtra',course:ui.course,id:x.id,field:'purpose',value:x.purpose});
    render();toast('Задание удалено');return;
  }
  const extraEdit=e.target.closest('[data-extra-edit]');
  if(extraEdit){const x=C().extras.find(x=>x.id===extraEdit.dataset.extraEdit);if(x){extraDrafts.set(extraDraftKey(x.id),{...x});render()}return}
  const extraSave=e.target.closest('[data-extra-save]');
  if(extraSave){const box=extraSave.closest('[data-x]'),x=C().extras.find(x=>x.id===box.dataset.x);if(!x)return;
    box.querySelectorAll('[data-xf]').forEach(inp=>{const field=inp.dataset.xf,value=field==='points'?Math.max(0,+inp.value||0):inp.value;if(String(x[field]??'')!==String(value)){x[field]=value;send({a:'updateExtra',course:ui.course,id:x.id,field,value})}});
    extraDrafts.delete(extraDraftKey(x.id));render();return;
  }
  if(e.target.id==='addExtra'){
    const x={id:'x'+Date.now().toString(36),date:new Date().toISOString().slice(0,10),topic:'',purpose:'',link:'',points:5,note:''};
    C().extras.push(x);extraDrafts.set(extraDraftKey(x.id),{...x});send({a:'addExtra',course:ui.course,extra:x});render();return}
  if(e.target.id==='cfgLink'){const c=LS.get('angleTracker.cfg',{url:'',token:''});if(!c.url||!c.token){toast('Connect the sheet first');return}const link=location.origin+location.pathname+'?s='+setupCode(c);(navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>toast('Setup link copied. Send it to yourself.'),()=>{prompt('Copy this link',link)});return}
  if(e.target.id==='cfgCodeGo'){const c=readSetup($('#cfgCode').value);if(!c){toast('This is not a valid setup link or code');return}LS.set('angleTracker.cfg',c);location.reload();return}
  if(e.target.id==='gear'){addSetupUI();$('#cfgUrl').value=cfg.url||'';$('#cfgTok').value=cfg.token||'';$('#setDlg').showModal();return}
  if(e.target.id==='cfgSave'){LS.set('angleTracker.cfg',{url:$('#cfgUrl').value.trim(),token:$('#cfgTok').value.trim()});location.reload();return}
  if(e.target.id==='cfgDemo'){LS.del('angleTracker.demo');LS.del('angleTracker.ui');location.reload();return}
});
document.addEventListener('change',e=>{
  const a=e.target.closest('[data-active]');
  if(a){const n=+a.dataset.active,u=C().units.find(x=>x.n===n);u.active=a.checked;send({a:'setUnitActive',course:ui.course,unit:n,active:a.checked});render();return}
  const p=e.target.closest('[data-pdate]');
  if(p){const l=C().phonics.find(x=>x.id===p.dataset.pdate);l.date=p.value;send({a:'setPhonicsDate',course:ui.course,id:l.id,date:l.date});render();return}
  const f=e.target.closest('[data-xf]');
  if(f){const id=f.closest('[data-x]').dataset.x,x=C().extras.find(z=>z.id===id),fld=f.dataset.xf;
    const draft=extraDrafts.get(extraDraftKey(id));if(draft)draft[fld]=fld==='points'?(+f.value||0):f.value;}
});

/* ---------- boot ---------- */
(async function(){
  if(PARENT){document.body.classList.add('parent')}
  else if(!live)$('#banner').innerHTML='<div class="banner">Demo data. Nothing is saved to Google Sheets. Open ⚙ to connect your sheet.</div>';
  try{
    setSync('busy','Loading…');const slow=setTimeout(()=>setSync('busy','Still loading…'),6000);try{
      const initialRequest=Store.load();initialRequest.catch(()=>{});
      if(!live&&!PARENT)D=await initialRequest;
      else{
        const {loadWithPreview}=await import('/assets/tracker/loading.js?v=1');
        D=await loadWithPreview({identity:['group',PARENT?'parent':'teacher',PARENT?QP.get('a'):cfg.url,PARENT?QP.get('p'):cfg.token,LOCK],load:()=>initialRequest,preview:d=>{D=d;if(PARENT)renderParent();else render();}});
      }
    }finally{clearTimeout(slow)}
    setSync(live?'ok':'','' );$('#syncTxt').textContent=live?'Synced':'Demo';
    if(live&&!PARENT&&pending.length)flush();
  }catch(e){
    if(e.previewShown){setSync('err','Offline · saved copy');return}
    $('#view').innerHTML=`<div class="card empty"><b>Could not load data.</b><br>${esc(e.message)}${PARENT?"":"<br><br>Check the URL and token in ⚙."}${retryBtn}</div>`;setSync('err','Offline');return}
  if(PARENT)renderParent();else render();
})();

document.addEventListener('input',e=>{const f=e.target.closest('[data-xf]');if(!f)return;const draft=extraDrafts.get(extraDraftKey(f.closest('[data-x]').dataset.x));if(draft)draft[f.dataset.xf]=f.dataset.xf==='points'?(+f.value||0):f.value});

// New submissions arrive independently of this teacher/parent tab.
// Never replace local edits or an open student/settings dialog.
let submissionRefreshBusy=false;
function canRefreshSubmissions(){
  return (live||PARENT)&&!document.hidden&&!flushing&&!pending.length&&!extraDrafts.size&&!document.querySelector('.hw-review-item[open]')
    &&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
}
async function refreshSubmissions(){
  if(submissionRefreshBusy||!canRefreshSubmissions())return;
  submissionRefreshBusy=true;
  try{
    const fresh=await Store.load();
    if(!canRefreshSubmissions())return;
    if(JSON.stringify(fresh)!==JSON.stringify(D)){
      D=fresh;if(PARENT)renderParent();else render();
    }
    setSync('ok','Synced');
  }catch(_){/* Keep the current view and local edits on a temporary read failure. */}
  finally{submissionRefreshBusy=false;}
}
setInterval(refreshSubmissions,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSubmissions()});
window.addEventListener('focus',refreshSubmissions);

document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-mee-tab]');if(!tab)return;
  const root=tab.closest('.mee-tabs-block');
  root.querySelectorAll('[data-mee-tab]').forEach(b=>{const active=b===tab;b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active))});
  root.querySelectorAll('[data-mee-unit]').forEach(panel=>panel.hidden=panel.dataset.meeUnit!==tab.dataset.meeTab);
});

// Stable homework parts: no learner claim becomes a green tick without teacher review.
function homeworkTargetOptions(r){const cc=D.courses[r.course];if(!cc)return [];const out=[],add=(scope,item,label)=>{if(st(r.course,r.studentId,scope,item)!=='N/A')out.push({scope,item,label});};for(const x of cc.extras||[])if(x.date&&extraAssigned(x,String(r.studentId)))add('ex',x.id,'Extras · '+x.topic);for(const u of cc.units||[])for(const sec of cc.sections||[])add('u'+u.n,sec.id,'Unit '+u.n+' · '+sec.name);for(const p of cc.phonics||[])add('ph',p.id,'Phonics · '+p.unit+' · '+p.lesson);return out;}
const homeworkDay=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x).split('-').reverse().join('.'):String(x||'');
const homeworkSubmitted=x=>{const value=String(x||'');return value.includes('T')&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):homeworkDay(value);};
const homeworkToday=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const homeworkCanonical=x=>{try{return decodeURIComponent(String(x||'').replace(/^https?:\/\/[^/]+/,'').split(/[?#]/)[0]).replace(/\/index\.html$/,'').replace(/\/+$/,'');}catch(_){return '';}};
function homeworkPartsOf(r){return Array.isArray(r.parts)&&r.parts.length?r.parts:[{partId:'legacy',label:'Домашняя работа',status:r.status,targets:r.targets||[],note:r.reviewNote||''}];}
function homeworkQueue(){
 const all=(D.homework||[]).filter(r=>r.course===ui.course);if(!all.length)return '';if(ui.homeworkStudent&&!C().students.some(s=>String(s.id)===ui.homeworkStudent))ui.homeworkStudent='';const filter=ui.homeworkFilter||'pending',sort=ui.homeworkSort||'oldest',student=ui.homeworkStudent||'',today=homeworkToday(),needs=r=>homeworkPartsOf(r).some(p=>p.status==='pending');
 const options=[['pending','Требует проверки'],['returned','Есть доработка'],['partial','Принято частично'],['confirmed','Всё принято'],['overdue','Просрочено'],['all','Все заявки']];
 let list=all.filter(r=>(!student||String(r.studentId)===student)&&(filter==='all'||filter==='pending'&&needs(r)||filter==='returned'&&homeworkPartsOf(r).some(p=>p.status==='returned')||filter==='partial'&&homeworkPartsOf(r).some(p=>p.status==='confirmed')&&r.status!=='confirmed'||filter==='confirmed'&&r.status==='confirmed'||filter==='overdue'&&r.due&&r.due<today&&r.status!=='confirmed'));
 list.sort((a,b)=>sort==='due'?String(a.due||'9999').localeCompare(String(b.due||'9999')):sort==='newest'?String(b.submitted).localeCompare(String(a.submitted)):String(a.submitted).localeCompare(String(b.submitted)));
 const selected=(name,value,items)=>'<label>'+name+'<select data-hw-filter="'+value+'">'+items.map(([v,t])=>'<option value="'+esc(v)+'"'+(ui[value]===v||(!ui[value]&&v===(value==='homeworkFilter'?'pending':value==='homeworkSort'?'oldest':''))?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
 const controls='<div class="hw-review-filters">'+selected('Показать','homeworkFilter',options)+selected('Порядок','homeworkSort',[['oldest','Сначала давние'],['newest','Сначала новые'],['due','По сроку сдачи']])+selected('Ученик','homeworkStudent',[['','Все ученики'],...C().students.map(s=>[String(s.id),s.name])])+'<button type="button" class="btn ghost" data-hw-reload>Обновить</button></div>';
 return '<section class="card hw-review-queue" data-sw-skip><h2>📨 Домашняя работа · на проверку '+all.filter(needs).length+'</h2><p class="sub">Выберите решение для каждой отправленной части. Связанные пункты уже подставлены; принятые части не нужно принимать повторно.</p>'+controls+(list.length?list.map(r=>{
 const parts=homeworkPartsOf(r),targets=homeworkTargetOptions(r),cc=D.courses[r.course],matching=(cc.extras||[]).filter(x=>extraAssigned(x,String(r.studentId))&&homeworkCanonical(x.link)===homeworkCanonical(r.url)),pendingParts=parts.filter(p=>p.status==='pending');
 const link=String(r.comment||'').match(/https:\/\/[^\s<>"']+/)?.[0];
 const rows=parts.map(p=>{const binding=(D.homeworkBindings||[]).find(x=>x.cardId===r.cardId&&x.partId===p.partId),chosen=p.targets?.length?p.targets:binding?.targets?.length?binding.targets:matching.length===1?[{scope:'ex',item:matching[0].id}]:[];const names=chosen.map(t=>targets.find(x=>x.scope===t.scope&&String(x.item)===String(t.item))?.label||t.scope+' · '+t.item);return '<div class="hw-review-part" data-hw-part="'+esc(p.partId)+'"><div class="hw-part-top"><b>'+esc(p.label||p.partId)+'</b><span class="hw-chip '+esc(p.status)+'">'+esc(({pending:'Ждёт проверки',confirmed:'Принято',returned:'Нужно исправить'})[p.status]||p.status)+'</span></div>'+(p.status==='pending'?'<div class="hw-part-controls"><label>Решение<select data-hw-part-decision><option value="pending">Пока не проверено</option><option value="confirmed">Принять</option><option value="returned">Вернуть на доработку</option></select></label><label>Комментарий<textarea data-hw-part-note rows="2" maxlength="2000"></textarea></label></div><p class="sub">'+(names.length?esc(names.join('; ')):'Связь с трекером пока не настроена.')+'</p><details class="hw-target-editor"'+(!names.length?' open':'')+'><summary>Изменить пункты трекера</summary><select multiple size="4" data-hw-targets aria-label="Пункты трекера: '+esc(p.label||p.partId)+'">'+targets.map(t=>'<option value="'+esc(JSON.stringify({scope:t.scope,item:t.item}))+'"'+(chosen.some(x=>x.scope===t.scope&&String(x.item)===String(t.item))?' selected':'')+'>'+esc(t.label)+(st(r.course,r.studentId,t.scope,t.item)==='✓'?' · уже ✓':'')+'</option>').join('')+'</select></details>':p.note?'<p class="hw-part-note">'+esc(p.note)+'</p>':'')+'</div>';}).join('');
 return '<details class="hw-review-item" data-homework="'+esc(r.id)+'" data-hw-version="'+(Number(r.version)||1)+'"><summary><span><b>'+esc(r.student)+'</b> · '+esc(r.title)+'</span><span class="hw-review-meta">Отправлено '+esc(homeworkSubmitted(r.submitted))+(r.due?' · Сдать до '+esc(homeworkDay(r.due)):'')+'</span></summary><div class="hw-review-body"><p><a href="'+esc(r.url)+'" target="_blank" rel="noopener">Карточка ↗</a>'+(Array.isArray(r.photoMailIds)&&r.photoMailIds.length?' · <a target="_blank" rel="noopener" href="https://mail.google.com/mail/u/?authuser=angle.assign%40gmail.com#search/'+encodeURIComponent(r.photoMailIds.slice(-1)[0])+'">Фото в почте ('+(Number(r.photoCount)||0)+') ↗</a>':'')+(link?' · <a href="'+esc(link)+'" target="_blank" rel="noopener">Фото / работа ↗</a>':'')+'</p>'+(r.comment?'<p class="hw-review-comment">'+esc(r.comment)+'</p>':'')+rows+(pendingParts.length?'<label class="hw-save-binding"><input type="checkbox" data-hw-save-bindings checked> Запомнить выбранные связи карточки</label><div class="hw-review-actions"><button type="button" class="btn ghost" data-hw-accept-all>Принять все отправленные части</button><button type="button" class="btn" data-hw-save>Сохранить проверку</button></div>':'')+'<p data-hw-review-status role="status"></p></div></details>';
 }).join(''):'<p class="sub">Заявок по этому фильтру нет.</p>')+'</section>';
}
async function reviewHomeworkClick(button){
 if(PARENT||!live)return;const box=button.closest('[data-homework]'),message=box.querySelector('[data-hw-review-status]');if(pending.length||flushing){message.textContent='Дождитесь сохранения предыдущих изменений.';return;}
 const decisions=[...box.querySelectorAll('[data-hw-part]')].filter(p=>p.querySelector('[data-hw-part-decision]')?.value!=='pending'&&p.querySelector('[data-hw-part-decision]')).map(p=>({partId:p.dataset.hwPart,status:p.querySelector('[data-hw-part-decision]').value,note:p.querySelector('[data-hw-part-note]').value,targets:[...p.querySelector('[data-hw-targets]').selectedOptions].map(o=>JSON.parse(o.value))}));
 if(!decisions.length){message.textContent='Выберите решение хотя бы для одной части.';return;}if(decisions.some(d=>d.status==='confirmed'&&!d.targets.length)){message.textContent='Для принимаемых частей выберите пункты трекера.';return;}
 box.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='Сохраняем…';
 try{const response=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({a:'reviewHomework',token:cfg.token,id:box.dataset.homework,expectedVersion:Number(box.dataset.hwVersion),saveBindings:box.querySelector('[data-hw-save-bindings]').checked,decisions}),signal:AbortSignal.timeout(45000)});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Не удалось сохранить');D=await Store.load();render();toast('Проверка сохранена. Принятые части подтверждены в трекере.');}catch(e){message.textContent=e.message;box.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
function homeworkAssignmentsFor(s){return (D.homeworkAssignments||[]).filter(a=>a.course===ui.course&&String(a.studentId)===String(s.id));}
function homeworkLinkFor(x,s){return homeworkAssignmentsFor(s).find(a=>homeworkCanonical(a.url)===homeworkCanonical(x.link))?.accessUrl||x.link;}
function homeworkAssignedCards(s,readonly,n){const list=homeworkAssignmentsFor(s).filter(a=>homeworkInUnit(a,n));if(!list.length)return '';return '<h2 style="font-size:16px">Домашние карточки</h2>'+list.map(a=>'<div class="secrow"><div class="t"><a href="'+esc(a.accessUrl)+'" target="_blank" rel="noopener">'+esc(a.title)+'</a><small>Урок '+esc(homeworkDay(a.date))+(a.due?' · Сдать до '+esc(homeworkDay(a.due)):'')+' · Частей: '+(a.partIds||[]).length+'</small></div>'+(!readonly?'<button type="button" class="btn ghost" data-hw-copy="'+esc(a.id)+'">Ссылка ребёнку</button>':'')+'</div>').join('');}
function homeworkStudentStatus(s,n){const list=(D.homework||[]).filter(r=>r.course===ui.course&&String(r.studentId)===String(s.id)&&homeworkInUnit(r,n));if(!list.length)return '';return '<h2 style="font-size:16px">Отправленная домашняя работа</h2>'+list.map(r=>'<div class="secrow"><div class="t">'+esc(r.title)+homeworkPartsOf(r).map(p=>'<small>'+esc(p.label||p.partId)+' · '+esc(({pending:'Ждёт проверки',confirmed:'Принято',returned:'Нужно исправить'})[p.status]||p.status)+(p.note?' · '+esc(p.note):'')+'</small>').join('')+'</div></div>').join('');}
document.addEventListener('change',e=>{const filter=e.target.closest('[data-hw-filter]');if(filter){ui[filter.dataset.hwFilter]=filter.value;LS.set('angleTracker.ui',ui);render();}});
document.addEventListener('click',async e=>{
 const all=e.target.closest('[data-hw-accept-all]');if(all){const box=all.closest('[data-homework]');box.querySelectorAll('[data-hw-part-decision]').forEach(s=>s.value='confirmed');await reviewHomeworkClick(box.querySelector('[data-hw-save]'));return;}
 const save=e.target.closest('[data-hw-save]');if(save){reviewHomeworkClick(save);return;}
 const reload=e.target.closest('[data-hw-reload]');if(reload){reload.disabled=true;try{D=await Store.load();render();}catch(err){toast(err.message);reload.disabled=false;}return;}
 const copy=e.target.closest('[data-hw-copy]');if(copy){if(PARENT)return;const a=(D.homeworkAssignments||[]).find(a=>a.id===copy.dataset.hwCopy&&a.course===ui.course);if(a)(navigator.clipboard?navigator.clipboard.writeText(a.accessUrl):Promise.reject()).then(()=>toast('Персональная ссылка скопирована'),()=>prompt('Ссылка ребёнку',a.accessUrl));}
});

/* Rewards use the authoritative ledger, never inferred from client-side ticks. */
let rewardMeeUnmatched=null;
function rewardMeeDiagnostics(){if(PARENT||!live||rewardMeeUnmatched===null)return '';const rows=rewardMeeUnmatched.filter(x=>x.course===ui.course),reasons={no_unit:'нет номера юнита',no_section:'не определён раздел',no_date:'нет срока и даты подтверждения',status_na:'статус na',backlog:'backlog',extra:'учитывается через Extra'};if(!rows.length)return '<div class="reward-mee-note" role="status">MEE: нераспознанных заданий нет.</div>';return '<details class="reward-mee-note"><summary>MEE · не учтено автоматически: '+rows.length+'</summary><ul>'+rows.map(x=>'<li><b>'+esc(x.course)+' · '+esc(x.hw)+'</b><span>'+esc(reasons[x.reason]||'не удалось сопоставить')+'</span></li>').join('')+'</ul><small>Это список для проверки связи. Данные и оценки не изменяются.</small></details>';}

function rewardOverview(){if(!D.rewardVersion||!window.AngleRewards)return '';return '<div class="reward-roster">'+C().students.map(s=>{const r=window.AngleRewards.fromRows(D.rewards,ui.course,s.id,1);return '<button data-card="'+esc(s.id)+'" title="Открыть коллекцию ученика" data-reward-roster="'+esc(s.id)+'">'+esc(s.name)+' · '+r.stars+' ★</button>';}).join('')+(live?'<button data-reward-sync>Обновить награды</button>':'')+'</div>'+rewardMeeDiagnostics();}
let rewardRefreshTimer;
function scheduleRewardRefresh(){if(!live||!D.rewardVersion)return;clearTimeout(rewardRefreshTimer);rewardRefreshTimer=setTimeout(async()=>{if(pending.length||flushing){scheduleRewardRefresh();return;}try{const fresh=await Store.load();D.rewards=fresh.rewards;D.rewardVersion=fresh.rewardVersion;for(const s of C().students){const summary=window.AngleRewards?.fromRows(D.rewards,ui.course,s.id,D.rewardVersion);window.AngleRewards?.refresh(summary);const b=document.querySelector('[data-reward-roster="'+CSS.escape(s.id)+'"]');if(b)b.textContent=s.name+' · '+summary.stars+' ★';}}catch(e){toast('Награды обновятся при следующей загрузке.');}},700);}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-reward-sync]');if(!b||!live||PARENT)return;if(pending.length||flushing){toast('Дождитесь сохранения изменений.');return;}b.disabled=true;try{const response=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({a:'syncHomeworkRewards',token:cfg.token})}),result=await response.json();if(!result.ok)throw Error(result.error||'Ошибка синхронизации');rewardMeeUnmatched=Array.isArray(result.meeUnmatched)?result.meeUnmatched:[];D=await Store.load();render();toast('Награды обновлены: '+result.added);}catch(e){toast(e.message);b.disabled=false;}});
