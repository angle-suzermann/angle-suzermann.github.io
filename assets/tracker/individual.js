'use strict';
/* ANGLE individual tracker: weekly task lists (ЕГЭ, Empower, Expert Advanced).
   Two levels of status:
     suggested  = the student says "I did it" (never counts)
     status ✓   = the teacher confirmed (the only thing that counts)
   Page config: window.TRACKER_PLANS = ['plan-id', ...]. */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
const WANT=window.TRACKER_PLANS||[];
const QP=new URLSearchParams(location.search);
const STUDENT=!!(QP.get('a')&&QP.get('p'));          // opened with a student link
/* connect another device: open a link with ?s=<code>, or paste the link/code in the settings (gear) */
const setupCode=c=>btoa(unescape(encodeURIComponent(JSON.stringify({u:c.url,t:c.token})))).replace(/\+/g,'-').replace(/\//g,'_');
function readSetup(x){try{x=String(x||'').trim();const m=x.match(/[?&]s=([^&#\s]+)/);if(m)x=m[1];x=x.replace(/-/g,'+').replace(/_/g,'/');const o=JSON.parse(decodeURIComponent(escape(atob(x))));return o.u&&o.t?{url:o.u,token:o.t}:null}catch{return null}}
(function(){const s=new URLSearchParams(location.search).get('s');if(s){const c=readSetup(s);if(c)LS.set('angleTracker.cfg',c);try{history.replaceState(null,'',location.pathname)}catch{}}})();
function addSetupUI(){if($('#cfgLink'))return;const sh=document.querySelector('#setDlg .sheet');if(!sh)return;const d=document.createElement('div');
  d.innerHTML='<hr style="border:0;border-top:1px solid #e4e0e8;margin:14px 0"><p class="sub">Connect another device (phone, Telegram, home-screen app):</p><p><button class="btn ghost" id="cfgLink">Copy setup link</button></p><label>Paste a setup link or code here</label><input type="text" id="cfgCode" placeholder="https://…?s=…" autocomplete="off"><p><button class="btn" id="cfgCodeGo">Connect with this code</button></p><p class="sub">The link contains your access token. Send it only to yourself and delete the message afterwards.</p>';
  sh.appendChild(d)}
const cfg=LS.get('angleTracker.cfg',{url:'',token:''});
const live=!STUDENT&&!!(cfg.url&&cfg.token);
let D={plans:[]};
let ui=LS.get('angleTracker.iui2',{plan:null,tab:null,review:false});
const today=()=>new Date().toISOString().slice(0,10);
const setSync=(s,t)=>{const el=$('#sync');el.className='sync '+s;$('#syncTxt').textContent=t};
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',2600)};
const KINDS=STUDENT?{before:'До урока',classwork:'Работа на уроке',homework:'Домашняя работа'}:{before:'Before the lesson',classwork:'Classwork',homework:'Homework'};
const blockLabel=s=>STUDENT?String(s).replace(/^Block\s+(\d+)/i,'Блок $1').replace(/^Week\s+/i,'Неделя '):s;
/* lessons per week: how many dates a week header can carry. TRACKER_DATES is a number, or {planId: number} */
const ndates=()=>{const t=window.TRACKER_DATES;const v=t&&typeof t==='object'?t[ui.plan]:t;return Math.max(1,+v||1)};
const kindOpts=(sel)=>Object.keys(KINDS).map(k=>`<option value="${k}"${k===sel?' selected':''}>${KINDS[k]}</option>`).join('');
const gKey=t=>(t.week||'')+'|'+(t.date||'');
const dateParts=d=>String(d||'').split(/\s*[·;]\s*/).map(x=>x.trim()).filter(Boolean);
const dateInputs=(vals,cls)=>Array.from({length:Math.max(ndates(),vals.length)},(_,i)=>`<input type="text" class="${cls}" value="${esc(vals[i]||'')}" placeholder="${i<ndates()?'Date '+(i+1)+(i?' (optional)':''):'Date'} · e.g. Oct, 29">`).join('');
const readDates=(root,cls)=>[...root.querySelectorAll('.'+cls)].map(i=>i.value.trim()).filter(Boolean).join(' · ');

/* ---------- stores ---------- */
const Demo={
  async load(){
    const mk=(b,n)=>({name:'Block '+b,tasks:Array.from({length:n},(_,i)=>({n:i+1,week:'Week '+(Math.floor(i/3)+1),date:'Oct, '+(1+Math.floor(i/3)*7),when:'',unit:'',task:'Demo task '+(i+1),mode:'',link:'',points:5,status:i<n/3?'✓':'',note:'',kind:['homework','classwork','before'][i%3],suggested:i===n-2?today():''}))});
    const plans=WANT.map((id,i)=>({id,student:'Demo student '+(i+1),title:'Demo plan ('+id+')',key:'',blocks:[mk(1,9),mk(2,6)]}));
    const saved=LS.get('angleTracker.idemo2',null);
    if(saved)for(const p of plans){const s=saved[p.id];if(s)p.blocks=s}
    return {plans,reports:LS.get('angleTracker.ireports',[])};
  },
  async write(){LS.set('angleTracker.idemo2',Object.fromEntries(D.plans.map(p=>[p.id,p.blocks])))}
};
/* data requests: 45 s limit, one automatic retry, then a clear error with a Try again button */
async function fetchT(url,opts,ms){ms=ms||45000;let err;
  for(let i=0;i<2;i++){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);
    try{const r=await fetch(url,{...(opts||{}),signal:ac.signal});clearTimeout(t);return r}
    catch(e){clearTimeout(t);err=e.name==='AbortError'?new Error('The server did not answer in time.'):new Error('No connection to the server.')}}
  throw err}
const retryBtn='<p style="margin-top:12px"><button class="btn" onclick="location.reload()">Try again</button></p>';
const post=async body=>{const r=await fetch(cfg.url||QP.get('a'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});const j=await r.json();if(!j.ok)throw new Error(j.error||'save failed')};
const Sheets={
  async load(){const r=await fetchT(cfg.url+'?token='+encodeURIComponent(cfg.token)+'&view=plans');const j=await r.json();if(!j.ok)throw new Error(j.error||'load failed');return j.data},
  async write(op){await post({...op,token:cfg.token})}
};
const StudentStore={
  async load(){const r=await fetchT(QP.get('a')+'?view=plans&p='+encodeURIComponent(QP.get('p')));const j=await r.json();if(!j.ok)throw new Error('This link is not valid. Ask your teacher for a new one.');return j.data},
  async write(op){await post({...op,key:QP.get('p')})}
};
const Store=STUDENT?StudentStore:(live?Sheets:Demo);
const QK=STUDENT?'angleTracker.iqueueS':'angleTracker.iqueue';
let pending=LS.get(QK,[]);
async function send(op){
  if(!live&&!STUDENT){await Demo.write();return}
  pending.push(op);LS.set(QK,pending);flush();
}
let flushing=false;
async function flush(){
  if(flushing)return;flushing=true;setSync('busy','Saving…');
  try{while(pending.length){await Store.write(pending[0]);pending.shift();LS.set(QK,pending)}setSync('ok','Saved')}
  catch(e){setSync('err','Not saved ('+pending.length+')');toast('Could not save: '+e.message+'. Will retry.');setTimeout(flush,8000)}
  flushing=false;
}

/* ---------- scoring: only teacher-confirmed ✓ counts ---------- */
const ratio=(e,p)=>p>0?e/p:null;
function score(tasks){let e=0,p=0;for(const t of tasks){if(t.status==='N/A')continue;p+=+t.points||0;if(t.status==='✓')e+=+t.points||0}
  return{e,p,r:ratio(e,p),done:tasks.filter(t=>t.status==='✓').length,n:tasks.filter(t=>t.status!=='N/A').length,wait:tasks.filter(t=>t.suggested&&t.status!=='✓').length}}
const planScore=pl=>score(pl.blocks.flatMap(b=>b.tasks));
const fmt=r=>r==null?'–':Math.round(r*100)+'%';
const pcClass=r=>r==null?'pc-none':r>=.8?'pc-hi':r>=.5?'pc-mid':'pc-lo';
function ring(r,size=88){const R=size/2-8,C=2*Math.PI*R,v=r==null?0:r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="#e8e3ee" stroke-width="9"/><circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="${v>=.8?'#4f9d52':v>=.5?'#d9a900':'#c7586a'}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-v)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg><b>${fmt(r)}</b></div>`}
/* students keep their order; one student's plans go newest first (the Sheet lists them oldest first) */
function newestFirst(plans){
  const names=[];plans.forEach(p=>{if(!names.includes(p.student))names.push(p.student)});
  return names.flatMap(n=>plans.filter(p=>p.student===n).reverse());
}
const P=()=>D.plans.find(p=>p.id===ui.plan);
const safeLink=u=>/^https?:\/\//i.test(u||'')?u:'';
const stateOf=t=>t.status==='✓'?'ok':t.status==='N/A'?'na':t.suggested?'sug':'';
const fmtDay=d=>{try{return new Date(d+'T00:00').toLocaleDateString(STUDENT?'ru-RU':'en-GB',{day:'numeric',month:'short'})}catch{return d}};

/* ---------- views ---------- */
function stBtn(bi,t){
  const s=stateOf(t),icon={ok:'✓',na:'–',sug:'?','':''}[s];
  const label=(STUDENT?{ok:'Подтверждено преподавателем',na:'Не задано',sug:'Выполнено учеником, ожидает проверки',"":'Пока не сдано'}:{ok:'Confirmed by teacher',na:'Not assigned',sug:'You said you did it. Waiting for your teacher',"":'Not done yet'})[s];
  const dis=STUDENT&&(s==='ok'||s==='na');
  /* score ring: the note starts with "Worksheet 87%" or "MEE 87%" (written by the worksheet / the MEE import) */
  const m=String(t.note||'').match(/^(Worksheet|MEE)\s+(\d{1,3})%/i),pc=m?Math.min(100,+m[2]):null;
  const ringAttr=pc==null?'':` style="--p:${pc};--rc:${pc>=80?'#4f9d52':pc>=50?'#d9a900':'#c7586a'}"`;
  const lab2=pc==null?label:label+' · '+m[1]+' '+pc+'%';
  return `<button class="st ${s}${pc==null?'':' pr'}"${ringAttr} data-tk="${bi}|${t.n}" aria-label="${lab2}" title="${lab2}"${dis?' disabled':''}>${icon}</button>`;
}
function taskCard(pl,bi,t){
  const k=KINDS[t.kind]?t.kind:'homework';
  // Students can open assigned tasks; teachers retain access to every task.
  const l=STUDENT&&t.status==='N/A'?'':safeLink(t.link);
  const title=l?`<a href="${esc(l)}" target="_blank" rel="noopener">${esc(t.task)}</a>`:esc(t.task);
  const sub=[t.mode,t.unit,t.points+(STUDENT?' баллов':' pts')].filter(Boolean).map(esc).join(' · ');
  const s=stateOf(t);
  const tag=s==='sug'?`<span class="tag sug">${STUDENT?'Ожидает проверки':'Suggested'}${t.suggested&&t.suggested.length===10?' · '+esc(fmtDay(t.suggested)):''}</span>`:s==='ok'?`<span class="tag ok">${STUDENT?'Подтверждено':'Confirmed'}</span>`:'';
  let note='';
  if(STUDENT)note=t.note?`<div class="tnote">${esc(t.note)}</div>`:'';
  else if(t.note)note=`<div class="tnote">${esc(t.note)}</div>`;
  const tools=STUDENT?'':`<span class="tools-sm">${s==='sug'?`<button class="lnk" data-ret="${bi}|${t.n}">Return</button>`:''}<button class="lnk" data-en="${bi}|${t.n}" title="Edit or delete this task">✎ Edit</button></span>`;
  let ed='';
  if(!STUDENT&&ui.tedit===bi+'|'+t.n){
    const gl=groupWeeks(pl.blocks[bi].tasks),ck=gKey(t);
    const gopts=gl.map(g=>`<option value="${esc(g.key)}"${g.key===ck?' selected':''}>${esc([g.week,g.date].filter(Boolean).join(' · ')||'(no date)')}</option>`).join('')+'<option value="__new">New date…</option>';
    ed=`<div class="tedit" data-te="${bi}|${t.n}"><div class="tegrid"><div class="c-full"><label>Task</label><input type="text" data-f="task" value="${esc(t.task)}"></div>
    <div><label>Kind</label><select data-f="kind">${kindOpts(k)}</select></div><div><label>Points</label><input type="number" data-f="points" min="0" value="${esc(t.points)}"></div>
    <div class="c-grow"><label>Date (move to another block of dates)</label><select data-tgroup>${gopts}</select></div>
    <div class="c-full tnew" style="display:none"><label>Week label</label><input type="text" class="tw" placeholder="Week 5"><label style="margin-top:8px">Dates of the lessons</label><div class="dgrid">${dateInputs([],'td')}</div></div>
    <div class="c-full"><label>Link</label><input type="text" data-f="link" value="${esc(t.link)}" placeholder="https://"></div>
    <div class="c-full"><label>Mode</label><input type="text" data-f="mode" value="${esc(t.mode)}"></div>
    <div class="c-full"><label>Note for the student</label><input type="text" data-f="note" value="${esc(t.note)}"></div></div>
    <p class="erow"><button class="btn" data-tsave="1">Save</button><button class="btn ghost" data-tcancel="1">Cancel</button><button class="btn danger" data-tdel="1">Delete task</button></p></div>`;
  }
  return `<div class="task k-${k} s-${s}"><div class="tb"><div class="tt">${title}</div><div class="tm"><span class="kind k-${k}">${KINDS[k]}</span>${sub?`<span class="sub">${sub}</span>`:''}${tag}${tools}</div>${note}</div>${stBtn(bi,t)}</div>${ed}`;
}
function groupWeeks(tasks){
  const g=[],ix={};for(const t of tasks){const key=gKey(t);if(ix[key]==null){ix[key]=g.length;g.push({key,week:t.week||'',date:t.date||'',items:[]})}g[ix[key]].items.push(t)}
  return g.reverse();                       // newest week first (a task added later joins its date's group)
}
function viewBlock(pl,bi,only){
  const b=pl.blocks[bi];if(!b)return '';
  const tasks=only?b.tasks.filter(t=>t.suggested&&t.status!=='✓'):b.tasks;
  if(!tasks.length)return '';
  const sc=score(b.tasks);
  const canEdit=!STUDENT&&!only;
  const body=groupWeeks(tasks).map((g,gi)=>{const gs=score(g.items),gk=bi+'|'+encodeURIComponent(g.key);
    const chips=dateParts(g.date).map(d=>`<span class="dchip">${esc(d)}</span>`).join('')||(g.date?`<span class="dchip">${esc(g.date)}</span>`:'');
    const ge=canEdit&&ui.gedit===gk?`<div class="gedit" data-ge="${gk}"><div class="xgrid"><div><label>Week label</label><input type="text" class="gw" value="${esc(g.week)}" placeholder="Week 5"></div></div><label style="margin-top:8px">Dates of the lessons this block covers</label><div class="dgrid">${dateInputs(dateParts(g.date),'gd')}</div><p class="erow"><button class="btn" data-gsave="1">Save</button><button class="btn ghost" data-gcancel="1">Cancel</button><button class="btn danger" data-gdel="1">Delete all ${g.items.length} tasks of this block</button></p></div>`:'';
    const gadd=canEdit?`<div class="gadd" data-gadd="${gk}"><input type="text" data-gaddt placeholder="+ add a task to this date"><input type="text" data-gaddl placeholder="link (optional)"><select data-gaddk>${kindOpts('homework')}</select><button class="btn ghost" data-gaddgo="1">Add</button></div>`:'';
    return `<section class="wgrp w${gi%2}"><div class="wk">${chips}${g.week?`<span class="wlab">${esc(blockLabel(g.week))}</span>`:''}<span class="wcnt">${STUDENT?`Подтверждено: ${gs.done} из ${gs.n}`:`${gs.done} of ${gs.n} confirmed`}</span>${canEdit?`<button class="lnk gedbtn" data-gedit="${gk}">✎ Edit dates</button>`:''}</div>${ge}${g.items.map(t=>taskCard(pl,bi,t)).join('')}${gadd}</section>`}).join('');
  return `<div class="card blk"><div class="unit-head"><div><h2>${esc(blockLabel(b.name))}</h2><div class="sub">${STUDENT?`Подтверждено: ${sc.done} из ${sc.n}`:`${sc.done} of ${sc.n} confirmed`}${sc.wait?` · <b class="waitc">${sc.wait} ${STUDENT?'ожидает проверки':'waiting for review'}</b>`:''} · ${STUDENT?`${sc.e} из ${sc.p} баллов`:`${sc.e} of ${sc.p} points`}</div></div><span class="${pcClass(sc.r)} bigpc">${fmt(sc.r)}</span></div>${body}</div>`;
}
function addBar(pl,bi){
  if(STUDENT)return '';
  const b=pl.blocks[bi],open=ui.addOpen||!pl.blocks.length;
  const groups=b?groupWeeks(b.tasks):[];
  const opts=groups.map((g,i)=>`<option value="${esc(g.key)}"${i===0?' selected':''}>${esc([g.week,g.date].filter(Boolean).join(' · ')||'(no date)')}</option>`).join('')+`<option value="__new"${groups.length?'':' selected'}>New date…</option>`;
  const form=open?`<div class="card addbox"><div class="xgrid">
    <div style="grid-column:1/-1"><label>Tasks (one per line)</label><textarea id="ntTask" rows="3" placeholder="First task&#10;Second task"></textarea></div>
    <div><label>Add to</label><select id="ntGroup">${opts}</select></div><div><label>Kind</label><select id="ntKind">${kindOpts('homework')}</select></div>
    <div id="ntNewBox" style="grid-column:1/-1;${groups.length?'display:none':''}"><div class="xgrid"><div><label>Week label</label><input type="text" id="ntWeek" placeholder="Week 5"></div></div><label style="margin-top:8px">Dates of the lessons this block covers</label><div class="dgrid">${dateInputs([], 'nd')}</div></div>
    <div style="grid-column:1/-1"><label>Link (optional; used for every task above that has no link of its own. Or write a link after a | on a line)</label><input type="text" id="ntLink" placeholder="https://"></div>
    <div><label>Points each</label><input type="number" id="ntPts" value="5" min="0"></div>
    <div style="grid-column:1/-1"><label>New block (optional)</label><input type="text" id="ntBlockNew" placeholder="${b?'leave empty: '+esc(b.name):'Block 1'}"></div></div>
    <p class="erow"><button class="btn" data-addtask="1">Add</button>${pl.blocks.length?'<button class="btn ghost" data-addclose="1">Close</button>':''}</p></div>`:'';
  return `<div class="addbar"><button class="btn" data-addopen="1">+ Add task</button></div>${form}`;
}
function individualReport(pl){
  if(!window.AngleParentReports)return '';
  return AngleParentReports.panel({id:'plan|'+pl.id,name:pl.student,course:pl.title,
    reports:(D.reports||[]).filter(r=>r.plan===pl.id)
  });
}
function viewSummary(pl){
  const o=planScore(pl);
  const rows=[...pl.blocks].reverse().map(b=>{const s=score(b.tasks);return `<div class="srow"><div class="t">${esc(blockLabel(b.name))}<small>${STUDENT?`Подтверждено: ${s.done} из ${s.n}`:`${s.done} of ${s.n} confirmed`}${s.wait?` · ${s.wait} ${STUDENT?'ожидает проверки':'waiting'}`:''} · ${STUDENT?`${s.e} из ${s.p} баллов`:`${s.e} of ${s.p} points`}</small></div><span class="${pcClass(s.r)} bigpc">${fmt(s.r)}</span></div>`}).join('');
  const link=STUDENT?'':`<p style="margin:14px 0 0"><button class="btn ghost" data-plink="1">Copy student link</button></p>`;
  return `<div class="card"><div class="scard-top">${ring(o.r)}<div class="who"><h3>${esc(pl.student)}</h3><div>${esc(pl.title)}</div><div>${STUDENT?`${o.e} из ${o.p} баллов подтверждено преподавателем`:`${o.e} of ${o.p} points confirmed`}</div></div></div>${rows}${individualReport(pl)}${link}</div>`;
}
const legend=()=>`<div class="legend2"><span><i class="st"></i>${STUDENT?'не сдано':'not done'}</span><span><i class="st sug">?</i>${STUDENT?'Выполнено учеником, ожидает проверки':'student suggests'}</span><span><i class="st ok">✓</i>${STUDENT?'подтверждено преподавателем':'confirmed by teacher'}</span><span class="sep"></span><span><i class="kd k-before"></i>${STUDENT?'до урока':'before the lesson'}</span><span><i class="kd k-classwork"></i>${STUDENT?'работа на уроке':'classwork'}</span><span><i class="kd k-homework"></i>${STUDENT?'домашняя работа':'homework'}</span></div>`;
function render(){
  if(!D.plans.length){$('#view').innerHTML='<div class="card empty">No plans found for this page. Add them in the Google Sheet (Plans tab).</div>';return}
  if(!P())ui.plan=D.plans[0].id;
  const pl=P();
  $('#courses').innerHTML=STUDENT||D.plans.length<2?'':D.plans.map(p=>`<button class="pill ${p.id===ui.plan?'on':''}" data-plan="${esc(p.id)}">${esc(p.student)} · ${esc(p.title)}</button>`).join('');
  const order=pl.blocks.map((_,i)=>i).reverse();            // newest block first
  const tabs=[...order.map(i=>({k:'b'+i,l:blockLabel(pl.blocks[i].name)})),{k:'sum',l:STUDENT?'Отчёт':'Summary',w:1}];
  if(!tabs.find(t=>t.k===ui.tab))ui.tab=tabs[0].k;
  if(!pl.blocks.length)ui.tab='sum';
  const wait=planScore(pl).wait;
  const rv=STUDENT?'':`<button class="tab wide rv ${ui.review?'on':''} ${wait?'has':''}" data-review="1">To review${wait?` (${wait})`:''}</button>`;
  $('#tabs').innerHTML=tabs.map(t=>`<button class="tab ${t.w?'wide':''} ${!ui.review&&t.k===ui.tab?'on':''}" data-tab="${t.k}">${esc(t.l)}</button>`).join('')+rv;
  $('#sub').textContent=STUDENT?'Отчёт о занятиях':pl.student+' · teacher panel';
  if(!STUDENT)LS.set('angleTracker.iui2',{plan:ui.plan,tab:ui.tab,review:ui.review});
  let html='';
  if(ui.review&&!STUDENT){
    html=order.map(i=>viewBlock(pl,i,true)).join('')||'<div class="card empty">Nothing waiting for review.</div>';
  }else if(ui.tab==='sum'){html=(STUDENT?'':addBar(pl,-1))+viewSummary(pl)}
  else{const bi=parseInt(ui.tab.slice(1));html=(STUDENT?`<div class="card hint">Нажмите на кружок после выполнения задания. Преподаватель проверит работу и подтвердит сдачу.</div>`:addBar(pl,bi))+legend()+viewBlock(pl,bi,false)}
  $('#view').innerHTML=html+(STUDENT&&ui.tab!=='sum'?`<div class="card" style="margin-top:14px">${individualReport(pl)}</div>`:'');
}

/* ---------- events ---------- */
const find=s=>{const [bi,n]=s.split('|');const b=P().blocks[+bi];return{b,t:b.tasks.find(x=>x.n===+n)}};
const setF=(b,t,field,value)=>{t[field]=value;send({a:'setTask',plan:P().id,block:b.name,n:t.n,field,value})};
function mkTask(b,o){const t={n:(b.tasks.reduce((m,x)=>Math.max(m,x.n),0)||0)+1,week:o.week||'',date:o.date||'',when:'',unit:'',task:o.task,mode:'',link:o.link||'',points:o.points==null?5:o.points,status:'',note:'',kind:o.kind||'homework',suggested:''};
  b.tasks.push(t);send({a:'addTask',plan:P().id,block:b.name,task:t});return t}
document.addEventListener('click',e=>{
  const pn=e.target.closest('[data-plan]');if(pn){ui.plan=pn.dataset.plan;ui.tab=null;ui.review=false;render();return}
  if(e.target.closest('[data-review]')){ui.review=!ui.review;render();return}
  const tb=e.target.closest('[data-tab]');if(tb){ui.tab=tb.dataset.tab;ui.review=false;render();return}
  const tk=e.target.closest('[data-tk]');
  if(tk){const {b,t}=find(tk.dataset.tk);
    if(STUDENT){
      if(t.status==='✓'||t.status==='N/A')return;
      const v=t.suggested?'':today();t.suggested=v;
      send({a:'suggest',plan:P().id,block:b.name,n:t.n,value:v});
      toast(v?'Sent to your teacher for checking':'Suggestion removed');render();return}
    if(t.suggested&&t.status!=='✓'){setF(b,t,'status','✓');setF(b,t,'suggested','');render();return}   // confirm
    const nx=({'':'✓','✓':'N/A','N/A':''})[t.status||''];setF(b,t,'status',nx);if(nx==='✓'&&t.suggested)setF(b,t,'suggested','');render();return}
  const rt=e.target.closest('[data-ret]');
  if(rt&&!STUDENT){const {b,t}=find(rt.dataset.ret);setF(b,t,'suggested','');toast('Returned to the student');render();return}
  if(STUDENT){} else {
  const en=e.target.closest('[data-en]');
  if(en){ui.tedit=ui.tedit===en.dataset.en?null:en.dataset.en;render();return}
  if(e.target.closest('[data-tcancel]')){ui.tedit=null;render();return}
  const ts=e.target.closest('[data-tsave]');
  if(ts){const box=ts.closest('[data-te]'),{b,t}=find(box.dataset.te);
    box.querySelectorAll('[data-f]').forEach(inp=>{const f=inp.dataset.f;let v=inp.value.trim();if(f==='points')v=+v||0;if(f==='task'&&!v){toast('The task cannot be empty');return}if(String(t[f]??'')!==String(v))setF(b,t,f,v)});
    const sel=box.querySelector('[data-tgroup]');
    if(sel&&sel.value!==gKey(t)){let w,d;if(sel.value==='__new'){w=box.querySelector('.tw').value.trim();d=readDates(box,'td');if(!d){toast('Enter the date(s) for the new block');return}}else{[w,d]=[sel.value.split('|')[0],sel.value.slice(sel.value.indexOf('|')+1)]}
      if((t.week||'')!==w)setF(b,t,'week',w);if((t.date||'')!==d)setF(b,t,'date',d)}
    ui.tedit=null;toast('Saved');render();return}
  const td=e.target.closest('[data-tdel]');
  if(td){const {b,t}=find(td.closest('[data-te]').dataset.te);if(!confirm('Delete this task? This cannot be undone.'))return;
    b.tasks=b.tasks.filter(x=>x!==t);send({a:'deleteTask',plan:P().id,block:b.name,n:t.n});
    if(!b.tasks.length){P().blocks=P().blocks.filter(x=>x!==b);ui.tab=null}
    ui.tedit=null;toast('Task deleted');render();return}
  const ge=e.target.closest('[data-gedit]');
  if(ge){ui.gedit=ui.gedit===ge.dataset.gedit?null:ge.dataset.gedit;render();return}
  if(e.target.closest('[data-gcancel]')){ui.gedit=null;render();return}
  const gs=e.target.closest('[data-gsave]');
  if(gs){const box=gs.closest('[data-ge]'),[bi,k]=box.dataset.ge.split('|'),b=P().blocks[+bi],key=decodeURIComponent(k);
    const week=box.querySelector('.gw').value.trim(),date=readDates(box,'gd');
    b.tasks.filter(t=>gKey(t)===key).forEach(t=>{if((t.week||'')!==week)setF(b,t,'week',week);if((t.date||'')!==date)setF(b,t,'date',date)});
    ui.gedit=null;toast('Saved');render();return}
  const gd=e.target.closest('[data-gdel]');
  if(gd){const [bi,k]=gd.closest('[data-ge]').dataset.ge.split('|'),b=P().blocks[+bi],key=decodeURIComponent(k),del=b.tasks.filter(t=>gKey(t)===key);
    if(!confirm('Delete all '+del.length+' tasks of this block? This cannot be undone.'))return;
    del.forEach(t=>send({a:'deleteTask',plan:P().id,block:b.name,n:t.n}));b.tasks=b.tasks.filter(t=>gKey(t)!==key);
    if(!b.tasks.length){P().blocks=P().blocks.filter(x=>x!==b);ui.tab=null}
    ui.gedit=null;toast('Deleted');render();return}
  if(e.target.closest('[data-addopen]')){ui.addOpen=!ui.addOpen;render();const i=$('#ntTask');if(i)i.focus();return}
  if(e.target.closest('[data-addclose]')){ui.addOpen=false;render();return}
  const gg=e.target.closest('[data-gaddgo]');
  if(gg){const box=gg.closest('[data-gadd]'),[bi,k]=box.dataset.gadd.split('|'),b=P().blocks[+bi],key=decodeURIComponent(k),src=b.tasks.find(t=>gKey(t)===key),inp=box.querySelector('[data-gaddt]');
    const txt=inp.value.trim();if(!txt){toast('Write the task first');return}
    mkTask(b,{task:txt,kind:box.querySelector('[data-gaddk]').value,points:5,week:src?src.week:'',date:src?src.date:'',link:box.querySelector('[data-gaddl]').value.trim()});render();return}
  const ad=e.target.closest('[data-addtask]');
  if(ad){const lines=$('#ntTask').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!lines.length){toast('Write the task first');return}
    const bnew=$('#ntBlockNew').value.trim();let b=bnew?P().blocks.find(x=>x.name===bnew):(ui.tab&&ui.tab[0]==='b'?P().blocks[parseInt(ui.tab.slice(1))]:null);
    if(!b){b={name:bnew||'Block 1',tasks:[]};P().blocks.push(b)}
    const gv=$('#ntGroup').value;let week='',date='';
    if(gv==='__new'||bnew){week=$('#ntWeek').value.trim();date=readDates(document,'nd')}else{const [w,d]=gv.split('|');week=w;date=d}
    const link0=$('#ntLink').value.trim();
    lines.forEach(line=>{const m=line.split('|'),task=m[0].trim(),lk=(m[1]||'').trim()||link0;if(task)mkTask(b,{task,kind:$('#ntKind').value,points:+$('#ntPts').value||0,week,date,link:lk})});
    ui.tab='b'+P().blocks.indexOf(b);ui.review=false;ui.addOpen=false;toast(lines.length+' task'+(lines.length>1?'s':'')+' added');render();return}
  }
  if(e.target.closest('[data-plink]')){const pl=P();
    if(!live||!pl.key){toast('Connect the Google Sheet and run makeParentKeys first');return}
    const url=location.origin+location.pathname+'?a='+encodeURIComponent(cfg.url)+'&p='+encodeURIComponent(pl.key);
    const b=e.target.closest('[data-plink]');
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>{toast('Student link copied');b.textContent='Copied ✓'},()=>{prompt('Copy this link',url)});return}
  if(e.target.id==='cfgLink'){const c=LS.get('angleTracker.cfg',{url:'',token:''});if(!c.url||!c.token){toast('Connect the sheet first');return}const link=location.origin+location.pathname+'?s='+setupCode(c);(navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>toast('Setup link copied. Send it to yourself.'),()=>{prompt('Copy this link',link)});return}
  if(e.target.id==='cfgCodeGo'){const c=readSetup($('#cfgCode').value);if(!c){toast('This is not a valid setup link or code');return}LS.set('angleTracker.cfg',c);location.reload();return}
  if(e.target.id==='gear'){addSetupUI();$('#cfgUrl').value=cfg.url||'';$('#cfgTok').value=cfg.token||'';$('#setDlg').showModal();return}
  if(e.target.id==='cfgSave'){LS.set('angleTracker.cfg',{url:$('#cfgUrl').value.trim(),token:$('#cfgTok').value.trim()});location.reload();return}
  if(e.target.id==='cfgDemo'){LS.del('angleTracker.idemo2');LS.del('angleTracker.ireports');LS.del('angleTracker.iui2');location.reload();return}
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-tgroup]')){const nb=e.target.closest('.tedit').querySelector('.tnew');nb.style.display=e.target.value==='__new'?'':'none'}
  if(e.target.id==='ntGroup'){const nb=$('#ntNewBox');if(nb)nb.style.display=e.target.value==='__new'?'':'none'}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-gaddt],[data-gaddl]')){e.preventDefault();e.target.closest('[data-gadd]').querySelector('[data-gaddgo]').click()}});

/* ---------- boot ---------- */
(async function(){
  document.body.classList.add('ind');
  if(STUDENT){document.body.classList.add('parent');document.documentElement.lang='ru';document.title='ANGLE · Прогресс занятий';if($('.title')?.firstChild)$('.title').firstChild.textContent='Прогресс занятий';}
  else if(!live)$('#banner').innerHTML='<div class="banner">Demo data. Nothing is saved to Google Sheets. Open ⚙ to connect your sheet.</div>';
  try{
    setSync('busy','Loading…');const slow=setTimeout(()=>setSync('busy','Still loading…'),6000);let d;try{d=await Store.load()}finally{clearTimeout(slow)}
    d.plans=d.plans||[];
    if(live&&!STUDENT)for(const np of (window.TRACKER_NEW_PLANS||[]))if(!d.plans.some(p=>p.id===np.id)){d.plans.push({id:np.id,student:np.student,title:np.title,key:'',blocks:[]});send({a:'addPlan',id:np.id,student:np.student,title:np.title,folder:np.folder||''})}
    D={reports:d.reports||[],plans:newestFirst((d.plans||[]).filter(p=>STUDENT||!WANT.length||WANT.includes(p.id)))};
    setSync(live||STUDENT?'ok':'','');$('#syncTxt').textContent=live||STUDENT?'Synced':'Demo';
    if((live||STUDENT)&&pending.length)flush();
  }catch(e){$('#view').innerHTML=`<div class="card empty"><b>Could not load data.</b><br>${esc(e.message)}${STUDENT?'':'<br><br>Check the URL and token in ⚙.'}${retryBtn}</div>`;setSync('err','Offline');return}
  render();
})();
