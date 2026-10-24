'use strict';
const SRC=document.currentScript.src;
const LOCK=window.TRACKER_COURSE||null;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};

/* ---------- storage ---------- */
const cfg=LS.get('angleTracker.cfg',{url:'',token:''});
const live=!!(cfg.url&&cfg.token);
let D={courses:{},progress:{},mee:[],act:[]};
let ui=LS.get('angleTracker.ui',{course:null,tab:'u1',student:null});
const setSync=(s,t)=>{const el=$('#sync');el.className='sync '+s;$('#syncTxt').textContent=t};
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',2600)};

const Demo={
  async load(){
    const st=await (await fetch(new URL('structure.json',SRC))).json();
    const demoNames={Starters:['Demo A.','Demo B.'],Movers:['Demo C.','Demo D.'],Flyers:['Demo E.','Demo F.','Demo G.'],B1:['Demo H. 🐬','Demo I. 🐬','Demo J. 🐼','Demo K. 🐙']};
    const courses={};
    for(const [c,v] of Object.entries(st)){
      courses[c]={students:demoNames[c].map((n,i)=>({id:c.slice(0,2).toLowerCase()+(i+1),name:n,group:''})),units:v.units,sections:v.sections,phonics:v.phonics.map(p=>({...p})),extras:[]};
    }
    const saved=LS.get('angleTracker.demo',null);
    if(saved){for(const c in courses){if(saved.courses?.[c]){courses[c].phonics=saved.courses[c].phonics||courses[c].phonics;courses[c].extras=saved.courses[c].extras||[];courses[c].units=saved.courses[c].units||courses[c].units}}}
    return {courses,progress:saved?.progress||{}};
  },
  async write(op){LS.set('angleTracker.demo',{courses:Object.fromEntries(Object.entries(D.courses).map(([c,v])=>[c,{phonics:v.phonics,extras:v.extras,units:v.units}])),progress:D.progress})}
};
const Sheets={
  async load(){
    const r=await fetch(cfg.url+'?token='+encodeURIComponent(cfg.token));
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'load failed'); return j.data;
  },
  async write(op){
    const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...op,token:cfg.token})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'save failed');
  }
};
const QP=new URLSearchParams(location.search);
const PARENT=!!(QP.get('a')&&QP.get('p'));
const ParentStore={
  async load(){
    const r=await fetch(QP.get('a')+'?p='+encodeURIComponent(QP.get('p')));
    const j=await r.json(); if(!j.ok) throw new Error('This link is not valid. Ask your teacher for a new one.'); return j.data;
  },
  async write(){}
};
const Store=PARENT?ParentStore:(live?Sheets:Demo);
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
  const desktop=`<div class="desktop"><div class="matrix"><table class="fx" style="min-width:${160+84+cc.sections.length*74}px"><colgroup><col style="width:160px">${cc.sections.map(()=>'<col>').join('')}<col style="width:84px"></colgroup><thead><tr><th class="name">Student</th>${cc.sections.map(x=>`<th class="g-${grp(x.name)}">${esc(x.name)}<small>${x.points} pts</small></th>`).join('')}<th>Unit %</th></tr></thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div></div>`;
  const s=curStudent();
  const mobile=`<div class="mobile">${selector()}${s?studentCardBody(s,n,false):''}</div>`;
  return `<div class="card">${head}${dim}${legend}${desktop}${mobile}</div>`;
}

function studentCardBody(s,n,readonly){
  const c=ui.course,cc=C(),u=cc.units.find(x=>x.n===n)||cc.units[0],o=overall(c,s.id);
  const minis=cc.units.filter(x=>!readonly||x.active).map(x=>{const sc=unitScore(c,s.id,x.n);return `<span class="${pcClass(sc.r)}"><em>U${x.n}</em>${fmt(sc.r)}</span>`}).join('');
  const extra=[];
  if(cc.phonics.length){const p=phScore(c,s.id);extra.push(`<span class="${pcClass(p.r)}"><em>Phonics</em>${fmt(p.r)}</span>`)}
  const x=exScore(c,s.id);extra.push(`<span class="${pcClass(x.r)}"><em>Extras</em>${fmt(x.r)}</span>`);
  const rows=cc.sections.map(sec=>{const v=st(c,s.id,'u'+u.n,sec.id);
    return `<div class="secrow g-${grp(sec.name)}"><div class="t">${esc(sec.name)}<small>${sec.points} pts</small></div>${readonly?`<span class="dot ${dotCls(v)}" style="cursor:default">${dotTxt(v)}</span>`:dot(c,s.id,'u'+u.n,sec.id,'u',u.active)}</div>`}).join('');
  return `<div class="scard-top">${ring(o.r)}<div class="who"><h3>${esc(s.name)}</h3><div>${esc(c)} · overall progress</div><div>${o.e} of ${o.p} points</div></div></div>
   <div class="mini">${minis}${extra.join('')}</div>
   <h2 style="font-size:16px;margin:6px 0 8px;color:var(--purple)">Unit ${u.n} · ${esc(u.title)}${u.active?'':' <span class="sub">(not started)</span>'}</h2>${rows}
   ${meeBlock(meeFor(c,s),s,!readonly)}
   ${readonly?'':`<p style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 0"><button class="btn ghost" data-card="${esc(s.id)}">Open parent card (for screenshot)</button><button class="btn ghost" data-plink="${esc(s.id)}">Copy parent link</button></p>`}`;
}
function openCard(sid,n){
  const s=C().students.find(x=>x.id===sid);if(!s)return;
  const started=C().units.filter(u=>u.active);
  if(n==null){const t=parseInt(ui.tab.replace('u',''))||1;n=started.find(u=>u.n===t)?t:(started.length?started[started.length-1].n:t)}
  const nav=started.length>1?`<div class="sel">${started.map(u=>`<button class="chip ${u.n===n?'on':''}" data-ctab="${esc(sid)}|${u.n}">Unit ${u.n}</button>`).join('')}</div>`:'';
  $('#cardBody').innerHTML=`<button class="iconbtn close" onclick="cardDlg.close()">\u2715</button><div class="brandline"><b>ANGLE \u00b7 HOMEWORK PROGRESS</b></div>${nav}${studentCardBody(s,n,true)}<div class="foot">${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} \u00b7 ANGLE English studio</div><p style="margin:10px 0 0;text-align:center"><button class="btn ghost" data-plink="${esc(sid)}">Copy parent link</button></p>`;
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
function meeFor(c,s){const n=String(s.name).toLowerCase();return (D.mee||[]).filter(r=>String(r.course)===c&&String(r.student).toLowerCase()===n)}
function meeSum(rows){const due=rows.filter(r=>r.status==='done'||r.status==='missing'),done=due.filter(r=>r.status==='done');
  const sc=done.filter(r=>r.pct!==''&&r.pct!=null);const q=sc.length?sc.reduce((a,r)=>a+Number(r.pct),0)/sc.length/100:null;
  return{due:due.length,done:done.length,sub:due.length?done.length/due.length:null,q}}
function ring2(r,R,col,w){const C2=2*Math.PI*R,v=Math.max(0,Math.min(1,r||0));
  return `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${col}" stroke-opacity=".18" stroke-width="${w}"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(C2*v).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 60 60)"/>`}
const ACT_LABELS={1:'Needs encouragement',2:'Steady',3:'Very active'};
function actFor(c,s){const n=String(s.name).toLowerCase();return (D.act||[]).filter(r=>String(r.course)===c&&String(r.student).toLowerCase()===n)}
function actAvg(a){return a.length?a.reduce((x,r)=>x+Number(r.score),0)/a.length/3:null}
function meeBlock(rows,s,teacher){const a=s?actFor(ui.course,s):[];if(!rows.length&&!a.length&&!teacher)return'';const m=meeSum(rows),aa=actAvg(a);
  const svg=`<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Homework rings">${ring2(m.sub,50,'#6b21a8',11)}${ring2(m.q,36,'#eab308',10)}${ring2(aa,22,'#0f766e',10)}</svg>`;
  const pc=v=>v==null?'–':Math.round(v*100)+'%';
  const list=rows.slice().sort((a,b)=>String(b.due).localeCompare(String(a.due))).map(r=>{const lab=r.status==='done'?(r.pct===''||r.pct==null?'done':Math.round(r.pct)+'%'):r.status==='missing'?'not handed in':r.status==='pending'?'not due yet':'–';
    return `<div class="secrow"><div class="t">${esc(r.hw)}<small>${esc(String(r.due||''))}</small></div><span class="tag">${lab}</span></div>`}).join('');
  return `<h2 style="font-size:16px;margin:14px 0 8px;color:var(--purple)">Online homework (MEE)</h2>
   <div class="scard-top">${svg}<div class="who"><div><b style="color:#6b21a8">●</b> Handed in: ${pc(m.sub)} (${m.done} of ${m.due} due)</div><div><b style="color:#eab308">●</b> Average score of handed-in work: ${pc(m.q)}</div><div><b style="color:#0f766e">●</b> Activity in class: ${a.length?ACT_LABELS[Math.round(a.reduce((x,r)=>x+Number(r.score),0)/a.length)]+' ('+a.length+' check'+(a.length>1?'s':'')+')':'–'}</div></div></div>${list}${teacher&&s?`<div class="sub" style="margin:10px 0 4px">Rate class activity (once per 2–4 lessons): 1 = ${ACT_LABELS[1]} · 2 = ${ACT_LABELS[2]} · 3 = ${ACT_LABELS[3]}</div><div class="sel" data-actfor="${esc(s.id)}">${[1,2,3].map(v=>`<button class="chip" data-act="${v}">${v} · ${ACT_LABELS[v]}</button>`).join('')}<select class="chip" data-actles><option>2</option><option>3</option><option>4</option></select><span class="sub"> lessons</span></div>`:''}`}

function renderParent(){
  const c=Object.keys(D.courses)[0];ui.course=c;const cc=C(),st=cc.students[0];
  const started=cc.units.filter(u=>u.active);
  if(!started.find(u=>'u'+u.n===ui.tab))ui.tab=started.length?'u'+started[started.length-1].n:'u1';
  const n=parseInt(ui.tab.slice(1))||1;
  const nav=started.length?`<div class="sel">${started.map(u=>`<button class="chip ${'u'+u.n===ui.tab?'on':''}" data-ptab="u${u.n}">Unit ${u.n}</button>`).join('')}</div>`:'';
  $('#sub').textContent='Homework progress';
  $('#view').innerHTML=`<div class="card">${nav}${studentCardBody(st,n,true)}<div class="foot" style="margin-top:12px;font-size:12px;opacity:.7">Updated by your teacher · ANGLE English studio</div></div>`;
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const ab=e.target.closest('[data-act]');
  if(ab){const box=ab.closest('[data-actfor]'),st2=C().students.find(x=>x.id===box.dataset.actfor);const les=+box.querySelector('[data-actles]').value;
    const row={course:ui.course,student:st2.name,date:new Date().toISOString().slice(0,10),lessons:les,score:+ab.dataset.act,note:''};
    (D.act=D.act||[]).push(row);send({a:'addActivity',...row});toast('Saved: '+st2.name+' activity '+row.score+'/3 over '+les+' lessons');openCard(st2.id);return}
  if(e.target.id==='meeGo'){let j;try{j=JSON.parse($('#meeJson').value)}catch{toast('That is not valid JSON');return}
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
  if(pt){ui.tab=pt.dataset.ptab;renderParent();return}
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
  if(e.target.id==='gear'){$('#cfgUrl').value=cfg.url||'';$('#cfgTok').value=cfg.token||'';$('#setDlg').showModal();return}
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
    setSync('busy','Loading…');D=await Store.load();
    setSync(live?'ok':'','' );$('#syncTxt').textContent=live?'Synced':'Demo';
    if(live&&!PARENT&&pending.length)flush();
  }catch(e){
    $('#view').innerHTML=`<div class="card empty"><b>Could not load data.</b><br>${esc(e.message)}${PARENT?"":"<br><br>Check the URL and token in ⚙."}</div>`;setSync('err','Offline');return}
  if(PARENT)renderParent();else render();
})();
