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
    return {courses,progress:saved?.progress||{},act:saved?.act||[],mee:saved?.mee||[]};
  },
  async write(op){LS.set('angleTracker.demo',{courses:Object.fromEntries(Object.entries(D.courses).map(([c,v])=>[c,{phonics:v.phonics,extras:v.extras,units:v.units}])),progress:D.progress,act:D.act||[],mee:D.mee||[]})}
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
    const data=await baseStore.load();
    if(baseStore===Demo)return data;
    const structure=await (await fetch(STRUCTURE_URL)).json();
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
    setSync('ok','Saved');
  }catch(e){setSync('err','Not saved ('+pending.length+')');toast('Could not save: '+e.message+'. Will retry.');setTimeout(flush,8000)}
  flushing=false;
}

/* ---------- scoring (same rules as the Excel workbooks) ---------- */
const pk=(c,s,scope,item)=>[c,s,scope,item].join('|');
const st=(c,s,scope,item)=>D.progress[pk(c,s,scope,item)]||'';
const C=()=>D.courses[ui.course];
function ratio(e,p){return p>0?e/p:null}
function unitScore(c,sid,n){
  const cc=D.courses[c],u=cc.units.find(x=>x.n===n);if(!u||!u.active)return{e:0,p:0,r:null};
  let e=0,p=0;for(const s of cc.sections){const v=st(c,sid,'u'+n,s.id);if(v==='N/A')continue;p+=s.points;if(v==='✓')e+=s.points}
  return{e,p,r:ratio(e,p)};
}
function phScore(c,sid){
  const cc=D.courses[c];let e=0,p=0;for(const l of cc.phonics){if(!l.date)continue;const v=st(c,sid,'ph',l.id);if(v==='N/A')continue;p+=l.points;if(v==='✓')e+=l.points}
  return{e,p,r:ratio(e,p)};
}
function exScore(c,sid){
  const cc=D.courses[c];let e=0,p=0;for(const x of cc.extras){if(!x.date)continue;const v=st(c,sid,'ex',x.id);if(v==='N/A')continue;p+=x.points;if(v==='✓')e+=x.points}
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
function next(cur,kind){const cyc=kind==='ex'?['','Done','✓','N/A']:['','✓','N/A'];return cyc[(cyc.indexOf(cur)+1)%cyc.length]}
const dotCls=v=>v==='✓'?'d':v==='N/A'?'n':v==='Done'?'p':'';
const dotTxt=v=>v==='✓'?'✓':v==='N/A'?'–':v==='Done'?'sent?':'';
function dot(c,sid,scope,item,kind,missing){
  const v=st(c,sid,scope,item);
  return `<button class="dot ${dotCls(v)} ${(!v&&missing)?'miss':''}" data-t="${esc([c,sid,scope,item,kind||''].join('\u0001'))}" aria-label="${v||'not done'}">${dotTxt(v)}</button>`;
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
  const a=$('#tabs .on');if(a)a.scrollIntoView({inline:'center',block:'nearest'});
}
function curStudent(){const cc=C();if(!cc.students.find(s=>s.id===ui.student))ui.student=cc.students[0]?.id||null;return cc.students.find(s=>s.id===ui.student)}
function selector(){return `<div class="sel">${C().students.map(s=>`<button class="chip ${s.id===ui.student?'on':''}" data-stud="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>`}
const legend=`<div class="legend"><span><i class="dot d">✓</i>done</span><span><i class="dot n">–</i>not assigned</span><span><i class="dot"></i>not done</span></div>`;

function viewUnit(n){
  const cc=C(),c=ui.course,u=cc.units.find(x=>x.n===n);if(!u)return '<div class="card empty">No such unit.</div>';
  const head=`<div class="unit-head"><div><h2>Unit ${n} · ${esc(u.title)}</h2><div class="sub">${esc(c)} · tap a circle to cycle: done → not assigned → empty</div></div>
    <label class="switch"><input type="checkbox" data-active="${n}" ${u.active?'checked':''}>Unit started</label></div>`;
  if(!cc.students.length)return `<div class="card">${head}<div class="empty">No students yet. Add them in the Google Sheet (Students tab).</div></div>`;
  const dim=u.active?'':'<div class="sub" style="margin:0 0 8px;color:#8d6a00">This unit is not started: it does not count toward the completion %.</div>';
  const rows=cc.students.map(s=>{const sc=unitScore(c,s.id,n);
    return `<tr><td class="name"><button data-card="${esc(s.id)}">${esc(s.name)}</button></td>${cc.sections.map(x=>`<td class="tc g-${grp(x.name)}">${dot(c,s.id,'u'+n,x.id,'u',u.active)}</td>`).join('')}<td class="pct ${pcClass(sc.r)}">${fmt(sc.r)}<div class="sub" style="font-weight:400;font-size:10.5px">${sc.e}/${sc.p}</div></td></tr>`}).join('');
  const foot=`<tr><td class="name" style="background:#faf8fc">Class % done</td>${cc.sections.map(x=>{let d=0,t=0;for(const s of cc.students){const v=st(c,s.id,'u'+n,x.id);if(v==='N/A')continue;t++;if(v==='✓')d++}return `<td class="tc g-${grp(x.name)}">${t?Math.round(d/t*100)+'%':'–'}</td>`}).join('')}<td></td></tr>`;
  const s=curStudent();
  const desktop=`<div class="desktop"><div class="matrix"><table class="fx" style="min-width:${160+84+cc.sections.length*74}px"><colgroup><col style="width:160px">${cc.sections.map(()=>'<col>').join('')}<col style="width:84px"></colgroup><thead><tr><th class="name">Student</th>${cc.sections.map(x=>`<th class="g-${grp(x.name)}">${esc(x.name)}<small>${x.points} pts</small></th>`).join('')}<th>Unit %</th></tr></thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div><div class="desktop-ratings" style="margin-top:18px"><h2 style="font-size:16px">Class activity and quality of work</h2>${selector()}${s?ringsTop(c,s,overall(c,s.id))+rateBlock(s):''}</div></div>`;
  const mobile=`<div class="mobile">${selector()}${s?studentCardBody(s,n,false):''}</div>`;
  return `<div class="card">${head}${dim}${legend}${desktop}${mobile}</div>`;
}

// Current-unit selection is independent of the scoring switch "Unit started".
function cardUnits(sid){
  return C().units.filter(u=>u.active||C().sections.some(sec=>st(ui.course,sid,'u'+u.n,sec.id)==='✓'));
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
function studentCardBody(s,n,readonly){
  const c=ui.course,cc=C(),u=cc.units.find(x=>x.n===n)||cc.units[0],o=overall(c,s.id);
  const minis=cc.units.filter(x=>!readonly||x.active||x.n===u.n||cardUnits(s.id).some(k=>k.n===x.n)).map(x=>{const sc=unitScore(c,s.id,x.n);return `<span class="${pcClass(sc.r)}"><em>U${x.n}</em>${fmt(sc.r)}</span>`}).join('');
  const extra=[];
  if(cc.phonics.length){const p=phScore(c,s.id);extra.push(`<span class="${pcClass(p.r)}"><em>Phonics</em>${fmt(p.r)}</span>`)}
  const x=exScore(c,s.id);extra.push(`<span class="${pcClass(x.r)}"><em>Extras</em>${fmt(x.r)}</span>`);
  const rows=cc.sections.map(sec=>{const v=st(c,s.id,'u'+u.n,sec.id);
    return `<div class="secrow g-${grp(sec.name)}"><div class="t">${esc(sec.name)}<small>${sec.points} pts</small></div>${readonly?`<span class="dot ${dotCls(v)}" style="cursor:default">${dotTxt(v)}</span>`:dot(c,s.id,'u'+u.n,sec.id,'u',u.active)}</div>`}).join('');
  return `${ringsTop(c,s,o)}
   <div class="mini">${minis}${extra.join('')}</div>
   <h2 style="font-size:16px;margin:6px 0 8px;color:var(--purple)">Unit ${u.n} · ${esc(u.title)}${u.active?'':' <span class="sub">(not started)</span>'}</h2>${rows}
   ${meeBlock(meeFor(c,s),s,!readonly)}
   ${readonly?'':`<p style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 0"><button class="btn ghost" data-card="${esc(s.id)}">Open parent card (for screenshot)</button><button class="btn ghost" data-plink="${esc(s.id)}">Copy parent link</button></p>`}`;
}
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

const PURPOSES=['Reinforcement','Checking understanding','Error correction','Clarification'];
function viewExtras(){
  const cc=C(),c=ui.course;
  const head=`<div class="unit-head"><div><h2>Extra worksheets</h2><div class="sub">Occasional worksheets. They count in the completion %. Tap a circle: sent? → done and submitted ✓ → not given → empty. Only ✓ earns points.</div></div><button class="btn" id="addExtra">+ Add worksheet</button></div>`;
  if(!cc.extras.length)return `<div class="card">${head}<div class="empty">No extra worksheets yet.</div></div>`;
  const list=[...cc.extras].reverse().map(x=>`<div class="xcard" data-x="${esc(x.id)}"><div class="xgrid">
    <div><label>Date given</label><input type="date" value="${esc(x.date)}" data-xf="date"></div>
    <div class="wide2"><label>Topic</label><input type="text" value="${esc(x.topic)}" data-xf="topic" placeholder="e.g. Present perfect vs past simple"></div>
    <div><label>Purpose</label><select data-xf="purpose"><option value=""></option>${PURPOSES.map(p=>`<option ${p===x.purpose?'selected':''}>${p}</option>`).join('')}</select></div>
    <div><label>Points</label><input type="number" min="0" value="${x.points}" data-xf="points"></div>
    <div class="wide2" style="grid-column:1/3"><label>Worksheet (name or link)</label><input type="text" value="${esc(x.link)}" data-xf="link"></div>
    <div class="wide2" style="grid-column:3/-1"><label>Notes / follow-up</label><textarea data-xf="note">${esc(x.note)}</textarea></div></div>
    <div class="xstud">${cc.students.map(s=>`<span class="xs">${dot(c,s.id,'ex',x.id,'ex',!!x.date)}${esc(s.name)}</span>`).join('')}</div></div>`).join('');
  return `<div class="card">${head}${list}</div>`;
}

function viewSummary(){
  const cc=C(),c=ui.course;if(!cc.students.length)return '<div class="card empty">No students.</div>';
  const th=cc.units.map(u=>`<th title="${esc(u.title)}">U${u.n}</th>`).join('')+(cc.phonics.length?'<th>Phonics</th>':'')+'<th>Extras</th><th>Overall</th>';
  const rows=cc.students.map(s=>{
    const cell=r=>`<td class="pct ${pcClass(r)}">${fmt(r)}</td>`;
    const o=overall(c,s.id);
    return `<tr><td class="name"><button data-card="${esc(s.id)}">${esc(s.name)}</button></td>${cc.units.map(u=>cell(unitScore(c,s.id,u.n).r)).join('')}${cc.phonics.length?cell(phScore(c,s.id).r):''}${cell(exScore(c,s.id).r)}<td class="pct ${pcClass(o.r)}" style="font-size:15px">${fmt(o.r)}</td></tr>`}).join('');
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
  $('#view').innerHTML=t==='ph'?viewPhonics():t==='ex'?viewExtras():t==='sum'?viewSummary():viewUnit(parseInt(t.slice(1)));
}

/* MEE homework rings: outer = handed in (done / due), inner = average score of handed-in work */
const isTest=r=>/\btest\b/i.test(String(r.hw||''));
function meeFor(c,s){const n=String(s.name).toLowerCase();return (D.mee||[]).filter(r=>String(r.course)===c&&String(r.student).toLowerCase()===n)}
function meeSum(rows){const due=rows.filter(r=>r.status==='done'||r.status==='missing'),done=due.filter(r=>r.status==='done');
  const sc=done.filter(r=>r.pct!==''&&r.pct!=null);const q=sc.length?sc.reduce((a,r)=>a+Number(r.pct),0)/sc.length/100:null;
  return{due:due.length,done:done.length,sub:due.length?done.length/due.length:null,q}}
function ring2(r,R,col,w){const C2=2*Math.PI*R,v=Math.max(0,Math.min(1,r||0));
  return `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${col}" stroke-opacity=".18" stroke-width="${w}"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(C2*v).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 60 60)"/>`}
const ACT_LABELS={1:'Needs encouragement',2:'Steady',3:'Very active'};
function actFor(c,s,kind='activity'){const n=String(s.name).toLowerCase();return (D.act||[]).filter(r=>String(r.course)===c&&String(r.student).toLowerCase()===n&&(r.kind||'activity')===kind)}
function actAvg(a){return a.length?a.reduce((x,r)=>x+Number(r.score),0)/a.length/3:null}
const Q_LABELS={1:'Needs more care',2:'Good',3:'Excellent'};
const pcT=v=>v==null?'–':Math.round(v*100)+'%';
function lvl(a,L){return a.length?L[Math.max(1,Math.min(3,Math.round(a.reduce((x,r)=>x+Number(r.score),0)/a.length)))]+' ('+a.length+' check'+(a.length>1?'s':'')+')':'not rated yet'}
/* three rings for every course: outer = handed in, middle = quality of work, inner = activity in class */
function ringsTop(c,s,o){
  const rows=meeFor(c,s).filter(r=>!isTest(r)),m=meeSum(rows),act=actFor(c,s,'activity'),qa=actFor(c,s,'quality');
  const sub=m.sub!=null?m.sub:o.r,subTxt=m.sub!=null?`${m.done} of ${m.due} online tasks`:`${o.e} of ${o.p} points`;
  const qual=m.q!=null?m.q:actAvg(qa),qTxt=m.q!=null?'average score of handed-in online work':lvl(qa,Q_LABELS);
  const svg=`<svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="Progress rings">${ring2(sub,50,'#6b21a8',11)}${ring2(qual,36,'#eab308',10)}${ring2(actAvg(act),22,'#0f766e',10)}</svg>`;
  return `<div class="scard-top">${svg}<div class="who"><h3>${esc(s.name)}</h3><div><b style="color:#6b21a8">●</b> Handed in: <b>${pcT(sub)}</b> (${subTxt})</div><div><b style="color:#eab308">●</b> Quality of work: <b>${pcT(qual)}</b> (${qTxt})</div><div><b style="color:#0f766e">●</b> Activity in class: <b>${pcT(actAvg(act))}</b> (${lvl(act,ACT_LABELS)})</div></div></div>`}
function rateBlock(s){
  const activity=actFor(ui.course,s).slice(-1)[0],quality=actFor(ui.course,s,'quality').slice(-1)[0];
  return `<div class="sub" style="margin:14px 0 4px">Class activity (once per 2–4 lessons): 1 = ${ACT_LABELS[1]} · 2 = ${ACT_LABELS[2]} · 3 = ${ACT_LABELS[3]}</div><div class="sel" data-actfor="${esc(s.id)}">${[1,2,3].map(v=>`<button type="button" class="chip ${+activity?.score===v?'on':''}" aria-pressed="${+activity?.score===v}" data-act="${v}">${v} · ${ACT_LABELS[v]}</button>`).join('')}<select class="chip" data-actles>${[2,3,4].map(v=>`<option ${+activity?.lessons===v?'selected':''}>${v}</option>`).join('')}</select><span class="sub"> lessons</span></div>
   <div class="sub" style="margin:12px 0 4px">Quality of work (teacher's rating of checked homework; online scores are used automatically when they exist): 1 = ${Q_LABELS[1]} · 2 = ${Q_LABELS[2]} · 3 = ${Q_LABELS[3]}</div><div class="sel" data-actfor="${esc(s.id)}">${[1,2,3].map(v=>`<button type="button" class="chip ${+quality?.score===v?'on':''}" aria-pressed="${+quality?.score===v}" data-qual="${v}">${v} · ${Q_LABELS[v]}</button>`).join('')}</div>
   <div class="sub" style="margin:12px 0 4px">Photo homework (handwritten work you checked): task name and score in percent</div><div class="sel" data-photofor="${esc(s.id)}"><input type="text" class="chip" data-phw placeholder="Task, e.g. Unit 2 Grammar 1" style="min-width:200px"><input type="number" class="chip" data-ppct min="0" max="100" placeholder="%" style="width:70px"><button class="chip" data-photo>Save photo homework</button></div><p class="sub" role="status" aria-live="polite" data-rating-feedback="${esc(s.id)}"></p>`}
function meeBlock(allRows,s,teacher){
  const rows=allRows.filter(r=>!isTest(r)),tests=allRows.filter(isTest);
  const list=rows.slice().sort((a,b)=>String(b.due).localeCompare(String(a.due))).map(r=>{const lab=r.status==='done'?(r.pct===''||r.pct==null?'done':Math.round(r.pct)+'%'):r.status==='missing'?'not handed in':r.status==='pending'?'not due yet':'–';
    const src=r.source==='photo'?' · photo':r.source==='worksheet'?' · worksheet':'';return `<div class="secrow"><div class="t">${esc(r.hw)}<small>${esc(String(r.due||''))}${src}</small>${teacher&&r.note?`<small style="display:block;white-space:pre-line;opacity:.75">${esc(String(r.note).slice(0,400))}</small>`:''}</div><span class="tag">${lab}</span></div>`}).join('');
  const rate=teacher&&s?rateBlock(s):'';
  const tlist=tests.length?`<h2 style="font-size:16px;margin:14px 0 8px;color:var(--purple)">Unit tests</h2>${tests.map(r=>`<div class="secrow"><div class="t">${esc(String(r.hw).replace(/^\d+\.\s*/,''))}<small>${esc(String(r.due||''))}</small></div><span class="tag">${r.pct===''||r.pct==null?'–':Math.round(r.pct)+'%'}</span></div>`).join('')}`:'';
  return (rows.length?`<h2 style="font-size:16px;margin:14px 0 8px;color:var(--purple)">Online homework (MEE)</h2>${list}`:'')+tlist+rate}

function renderParent(){
  const c=Object.keys(D.courses)[0];ui.course=c;const cc=C(),st=cc.students[0];
  const n=cardUnit(st.id,parentTab?Number(parentTab.slice(1)):null);
  ui.tab='u'+n;
  const started=cc.units.filter(u=>u.n===n||cardUnits(st.id).some(k=>k.n===u.n));
  const nav=started.length?`<div class="sel">${started.map(u=>`<button class="chip ${'u'+u.n===ui.tab?'on':''}" data-ptab="u${u.n}">Unit ${u.n}</button>`).join('')}</div>`:'';
  $('#sub').textContent='Homework progress';
  $('#view').innerHTML=`<div class="card">${nav}${studentCardBody(st,n,true)}<div class="foot" style="margin-top:12px;font-size:12px;opacity:.7">Updated by your teacher · ANGLE English studio</div></div>`;
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
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
  const sd=e.target.closest('[data-stud]');if(sd){ui.student=sd.dataset.stud;render();return}
  const cd=e.target.closest('[data-card]');if(cd){openCard(cd.dataset.card);return}
  if(e.target.id==='addExtra'){
    const x={id:'x'+Date.now().toString(36),date:new Date().toISOString().slice(0,10),topic:'',purpose:'',link:'',points:5,note:''};
    C().extras.push(x);send({a:'addExtra',course:ui.course,extra:x});render();return}
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
    x[fld]=fld==='points'?(+f.value||0):f.value;send({a:'updateExtra',course:ui.course,id,field:fld,value:x[fld]});
    if(fld==='date'||fld==='points')render();}
});

/* ---------- boot ---------- */
(async function(){
  if(PARENT){document.body.classList.add('parent')}
  else if(!live)$('#banner').innerHTML='<div class="banner">Demo data. Nothing is saved to Google Sheets. Open ⚙ to connect your sheet.</div>';
  try{
    setSync('busy','Loading…');const slow=setTimeout(()=>setSync('busy','Still loading…'),6000);try{D=await Store.load()}finally{clearTimeout(slow)}
    setSync(live?'ok':'','' );$('#syncTxt').textContent=live?'Synced':'Demo';
    if(live&&!PARENT&&pending.length)flush();
  }catch(e){
    $('#view').innerHTML=`<div class="card empty"><b>Could not load data.</b><br>${esc(e.message)}${PARENT?"":"<br><br>Check the URL and token in ⚙."}${retryBtn}</div>`;setSync('err','Offline');return}
  if(PARENT)renderParent();else render();
})();
