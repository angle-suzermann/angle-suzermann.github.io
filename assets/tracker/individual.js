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
const STUDENT=!!(QP.get('a')&&QP.get('p'));
const PARENT=STUDENT&&QP.get('parent')==='1';          // opened with a student link
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
function trackerDateISO(raw){
  const s=String(raw||'').trim();if(!s)return '';
  let y,m,d,hit=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(hit)[,y,m,d]=hit;
  else if((hit=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)))[,d,m,y]=hit;
  else{
    const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    if((hit=s.match(/^([a-z]+)[,\s]+(\d{1,2})(?:[,\s]+(\d{4}))?$/i))){m=months.indexOf(hit[1].slice(0,3).toLowerCase())+1;d=hit[2];y=hit[3]||new Date().getFullYear()}
    else if((hit=s.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/i))){m=months.indexOf(hit[2].slice(0,3).toLowerCase())+1;d=hit[1];y=hit[3]||new Date().getFullYear()}
    else return '';
  }
  const check=new Date(Date.UTC(+y,+m-1,+d));
  return check.getUTCFullYear()===+y&&check.getUTCMonth()===+m-1&&check.getUTCDate()===+d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
}
const dateInputs=(vals,cls)=>Array.from({length:Math.max(ndates(),vals.length)},(_,i)=>`<span class="tracker-date-field"><input type="date" class="${cls}" data-date-picker data-date-original="${esc(vals[i]||'')}" value="${esc(trackerDateISO(vals[i]))}" aria-label="Дата ${i+1}${i?' (необязательно)':''}"><button type="button" class="btn ghost" data-calendar-open aria-label="Открыть календарь">📅</button></span>`).join('');
const readDates=(root,cls)=>[...root.querySelectorAll('.'+cls)].map(i=>i.dataset.dateTouched==='1'?i.value.trim():(i.dataset.dateOriginal||i.value.trim())).filter(Boolean).join(' · ');


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
function taskCard(pl,bi,t,number){
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
    <div class="c-full"><label>Тип задания</label><div class="tracker-kinds">${Object.keys(KINDS).map(kind=>`<label><input type="radio" name="task-kind" data-f="kind" value="${kind}"${kind===k?' checked':''}> ${KINDS[kind]}</label>`).join('')}</div></div><div><label>Points</label><input type="number" data-f="points" min="0" value="${esc(t.points)}"></div>
    <div class="c-grow"><label>Date (move to another block of dates)</label><select data-tgroup>${gopts}</select></div>
    <div class="c-full tnew" style="display:none"><label>Week label</label><input type="text" class="tw" placeholder="Week 5"><label style="margin-top:8px">Dates of the lessons</label><div class="dgrid">${dateInputs([],'td')}</div></div>
    <div class="c-full"><label>Link</label><input type="text" data-f="link" value="${esc(t.link)}" placeholder="https://"></div>
    <div class="c-full"><label>Mode</label><input type="text" data-f="mode" value="${esc(t.mode)}"></div>
    <div class="c-full"><label>Note for the student</label><input type="text" data-f="note" value="${esc(t.note)}"></div></div>
    <p class="erow"><button class="btn" data-tsave="1">Save</button><button class="btn ghost" data-tcancel="1">Cancel</button><button class="btn danger" data-tdel="1">Delete task</button></p></div>`;
  }
  const handle=STUDENT?'':`<button type="button" class="task-drag" data-task-drag="${bi}|${t.n}" aria-label="Изменить порядок: ${esc(t.task)}" title="Перетащите; с клавиатуры — стрелки вверх/вниз">⋮⋮</button>`;
  return `<div class="task k-${k} s-${s}" data-task-row="${bi}|${t.n}">${handle}<div class="tb"><div class="tt"><span class="task-number">${esc(number??t.n)}.</span> ${title}</div><div class="tm"><span class="kind k-${k}">${KINDS[k]}</span>${sub?`<span class="sub">${sub}</span>`:''}${tag}${tools}</div>${note}</div>${stBtn(bi,t)}</div>${ed}`;
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
  const dates=[...new Set(b.tasks.map(t=>t.date||''))];
  const blockTools=canEdit?`<div class="erow" style="margin:8px 0 12px;flex-wrap:wrap"><button type="button" class="btn ghost" data-block-edit="${bi}">Изменить даты блока</button><button type="button" class="btn ghost" data-block-delete="${bi}">Удалить блок</button></div>`:'';
  const blockEdit=canEdit&&ui.blockEdit===bi?`<div class="gedit" data-block-form="${bi}"><p class="sub">Новые даты будут применены ко всем ${b.tasks.length} заданиям блока. Содержание, баллы и отметки сохранятся.</p><label>Даты всего блока</label><div class="dgrid">${dateInputs(dates.length===1?dateParts(dates[0]):[],'block-new-date')}</div><p class="erow"><button type="button" class="btn" data-block-save="${bi}">Применить ко всему блоку</button><button type="button" class="btn ghost" data-block-cancel>Отмена</button></p></div>`:'';
  const body=groupWeeks(tasks).map((g,gi)=>{const gs=score(g.items),gk=bi+'|'+encodeURIComponent(g.key);
    const chips=dateParts(g.date).map(d=>`<span class="dchip">${esc(d)}</span>`).join('')||(g.date?`<span class="dchip">${esc(g.date)}</span>`:'');
    const ge=canEdit&&ui.gedit===gk?`<div class="gedit" data-ge="${gk}"><div class="xgrid"><div><label>Week label</label><input type="text" class="gw" value="${esc(g.week)}" placeholder="Week 5"></div></div><label style="margin-top:8px">Dates of the lessons this block covers</label><div class="dgrid">${dateInputs(dateParts(g.date),'gd')}</div><p class="erow"><button class="btn" data-gsave="1">Save</button><button class="btn ghost" data-gcancel="1">Cancel</button><button class="btn danger" data-gdel="1">Delete all ${g.items.length} tasks of this block</button></p></div>`:'';
    const gadd=canEdit?`<div class="gadd" data-gadd="${gk}"><input type="text" data-gaddt placeholder="+ add a task to this date"><input type="text" data-gaddl placeholder="link (optional)"><select data-gaddk>${kindOpts('homework')}</select><button class="btn ghost" data-gaddgo="1">Add</button></div>`:'';
    return `<section class="wgrp w${gi%2}"><div class="wk">${chips}${g.week?`<span class="wlab">${esc(blockLabel(g.week))}</span>`:''}<span class="wcnt">${STUDENT?`Подтверждено: ${gs.done} из ${gs.n}`:`${gs.done} of ${gs.n} confirmed`}</span>${canEdit?`<button class="lnk gedbtn" data-gedit="${gk}">✎ Edit dates</button>`:''}</div>${ge}${g.items.map((t,i)=>taskCard(pl,bi,t,i+1)).join('')}${gadd}</section>`}).join('');
  return `<div class="card blk"><div class="unit-head"><div><h2>${esc(blockLabel(b.name))}</h2><div class="sub">${STUDENT?`Подтверждено: ${sc.done} из ${sc.n}`:`${sc.done} of ${sc.n} confirmed`}${sc.wait?` · <b class="waitc">${sc.wait} ${STUDENT?'ожидает проверки':'waiting for review'}</b>`:''} · ${STUDENT?`${sc.e} из ${sc.p} баллов`:`${sc.e} of ${sc.p} points`}</div></div><span class="${pcClass(sc.r)} bigpc">${fmt(sc.r)}</span></div>${blockTools}${blockEdit}${body}</div>`;
}
function addBar(pl,bi){
  if(STUDENT)return '';
  const b=pl.blocks[bi],open=ui.addOpen||!pl.blocks.length;
  const groups=b?groupWeeks(b.tasks):[];
  const opts=groups.map((g,i)=>`<option value="${esc(g.key)}"${i===0?' selected':''}>${esc([g.week,g.date].filter(Boolean).join(' · ')||'(no date)')}</option>`).join('')+`<option value="__new"${groups.length?'':' selected'}>New date…</option>`;
  const form=open?`<div class="card addbox"><div class="xgrid">
    <div style="grid-column:1/-1"><label>Tasks (one per line; numbered automatically)</label><textarea id="ntTask" rows="3" placeholder="First task&#10;Second task"></textarea></div>
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
function parentProgressCard(pl){
  const o=planScore(pl),pc=fmt(o.r),radius=38,circumference=2*Math.PI*radius;
  const svg=`<svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="Сдано заданий: ${esc(pc)}"><circle cx="50" cy="50" r="${radius}" fill="none" stroke="#6b21a8" stroke-opacity=".18" stroke-width="10"/><circle cx="50" cy="50" r="${radius}" fill="none" stroke="#6b21a8" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circumference*(o.r||0)} ${circumference}" transform="rotate(-90 50 50)"/><text x="50" y="55" text-anchor="middle" fill="#5E4877" font-size="18" font-weight="700">${pc}</text></svg>`;
  const rows=[...pl.blocks].reverse().map(b=>{const s=score(b.tasks);return `<div class="srow"><div class="t">${esc(b.name.replace(/^Block\s+/,'Блок '))}<small>Подтверждено: ${s.done} из ${s.n} заданий · ${s.e} из ${s.p} баллов${s.wait?` · ожидает проверки: ${s.wait}`:''}</small></div><span class="${pcClass(s.r)} bigpc">${fmt(s.r)}</span></div>`}).join('');
  return `<div class="scard-top">${svg}<div class="who"><h3>${esc(pl.student)}</h3><div>${esc(pl.title)}</div><div>Сдано заданий: <b>${pc}</b></div><div>Подтверждено преподавателем: ${o.done} из ${o.n}</div></div></div><p class="sub">Прогресс учитывает подтверждённые задания. Работы, ожидающие проверки, пока не засчитываются.</p>${rows||'<p class="sub">Задания пока не добавлены.</p>'}${individualReport(pl)}`;
}
function openParentProgress(pl){
  const dialog=$('#cardDlg');
  $('#cardBody').innerHTML=`<button class="iconbtn close" onclick="cardDlg.close()" aria-label="Закрыть">✕</button><div class="brandline"><b>ANGLE · HOMEWORK PROGRESS</b></div>${parentProgressCard(pl)}<p><button class="btn ghost" data-parent-link="${esc(pl.id)}">Копировать ссылку родителям</button></p>`;
  if(!dialog.open)dialog.showModal();
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
  if(PARENT){
    $('#courses').innerHTML='';$('#tabs').innerHTML='';$('#sub').textContent='Homework progress';
    $('#view').innerHTML=`<div class="card">${parentProgressCard(pl)}</div>`;return;
  }
  $('#courses').innerHTML=STUDENT||D.plans.length<2?'':D.plans.map(p=>`<button class="pill ${p.id===ui.plan?'on':''}" data-plan="${esc(p.id)}">${esc(p.student)} · ${esc(p.title)}</button>`).join('');
  const order=pl.blocks.map((_,i)=>i).reverse();            // newest block first
  const tabs=[...order.map(i=>({k:'b'+i,l:blockLabel(pl.blocks[i].name)})),{k:'sum',l:STUDENT?'Отчёт':'Summary',w:1}];
  if(!tabs.find(t=>t.k===ui.tab))ui.tab=tabs[0].k;
  if(!pl.blocks.length)ui.tab='sum';
  const wait=planScore(pl).wait;
  const rv=STUDENT?'':`<button class="tab wide rv ${ui.review?'on':''} ${wait?'has':''}" data-review="1">To review${wait?` (${wait})`:''}</button>`;
  $('#tabs').innerHTML=tabs.map(t=>`<button class="tab ${t.w?'wide':''} ${!ui.review&&t.k===ui.tab?'on':''}" data-tab="${t.k}">${esc(t.l)}</button>`).join('')+rv;
  $('#sub').textContent=STUDENT?'Homework progress':pl.student+' · teacher panel';
  if(!STUDENT)LS.set('angleTracker.iui2',{plan:ui.plan,tab:ui.tab,review:ui.review});
  let html='';
  if(ui.review&&!STUDENT){
    html=order.map(i=>viewBlock(pl,i,true)).join('')||'<div class="card empty">Nothing waiting for review.</div>';
  }else if(ui.tab==='sum'){html=(STUDENT?'':addBar(pl,-1))+viewSummary(pl)}
  else{const bi=parseInt(ui.tab.slice(1));html=(STUDENT?`<div class="card hint">Нажмите на кружок после выполнения задания. Преподаватель проверит работу и подтвердит сдачу.</div>`:addBar(pl,bi))+legend()+viewBlock(pl,bi,false)}
  if(!STUDENT&&pl.id.startsWith('ege-'))html=`<p><button class="btn ghost" data-parent-card>Карточка для родителей</button> <button class="btn ghost" data-parent-link="${esc(pl.id)}">Копировать ссылку родителям</button></p>`+html;
  $('#view').innerHTML=html+(STUDENT&&ui.tab!=='sum'?`<div class="card" style="margin-top:14px">${individualReport(pl)}</div>`:'');
}

/* ---------- events ---------- */
const find=s=>{const [bi,n]=s.split('|');const b=P().blocks[+bi];return{b,t:b.tasks.find(x=>x.n===+n)}};
const setF=(b,t,field,value)=>{t[field]=value;send({a:'setTask',plan:P().id,block:b.name,n:t.n,field,value})};
function mkTask(b,o){const t={n:(b.tasks.reduce((m,x)=>Math.max(m,x.n),0)||0)+1,week:o.week||'',date:o.date||'',when:'',unit:'',task:o.task,mode:'',link:o.link||'',points:o.points==null?5:o.points,status:'',note:'',kind:o.kind||'homework',suggested:''};
  b.tasks.push(t);send({a:'addTask',plan:P().id,block:b.name,task:t});return t}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-parent-card]')){if(!STUDENT)openParentProgress(P());return}
  const parentLink=e.target.closest('[data-parent-link]');
  if(parentLink&&!STUDENT){
    const pl=D.plans.find(p=>p.id===parentLink.dataset.parentLink);
    if(!live||!pl?.key){toast('Подключите таблицу и создайте родительский ключ.');return}
    const url=new URL(location.pathname,location.origin);url.searchParams.set('a',cfg.url);url.searchParams.set('p',pl.key);url.searchParams.set('parent','1');
    (navigator.clipboard?navigator.clipboard.writeText(url.href):Promise.reject()).then(()=>{toast('Ссылка для родителей скопирована');parentLink.textContent='Скопировано ✓'},()=>prompt('Ссылка для родителей',url.href));return;
  }
  if(PARENT)return; // Parent presentation has no task mutations or suggestions.
  const calendarButton=e.target.closest('[data-calendar-open]');
  if(calendarButton){openTrackerCalendar(calendarButton.parentElement.querySelector('[data-date-picker]'));return}
  const picker=e.target.closest('input[data-date-picker]');
  if(picker){try{picker.showPicker?.()}catch{}return}
  const blockEdit=e.target.closest('[data-block-edit]');
  if(blockEdit&&!STUDENT){ui.blockEdit=Number(blockEdit.dataset.blockEdit);render();return}
  if(e.target.closest('[data-block-cancel]')&&!STUDENT){ui.blockEdit=null;render();return}
  const blockSave=e.target.closest('[data-block-save]');
  if(blockSave&&!STUDENT){
    const box=blockSave.closest('[data-block-form]'),b=P().blocks[Number(blockSave.dataset.blockSave)];if(!b)return;
    const date=readDates(box,'block-new-date');if(!date){toast('Укажите новую дату блока.');return}
    b.tasks.forEach(task=>{if((task.date||'')!==date)setF(b,task,'date',date)});
    ui.blockEdit=null;ui.gedit=null;render();toast('Даты изменены у всех заданий блока.');return;
  }
  const blockDelete=e.target.closest('[data-block-delete]');
  if(blockDelete&&!STUDENT){
    const pl=P(),b=pl.blocks[Number(blockDelete.dataset.blockDelete)];if(!b)return;
    if(!confirm('Удалить весь блок «'+b.name+'» и все '+b.tasks.length+' заданий? Отменить удаление в трекере нельзя.'))return;
    pl.blocks=pl.blocks.filter(x=>x!==b);ui.blockEdit=null;ui.gedit=null;ui.tab=null;
    b.tasks.forEach(task=>send({a:'deleteTask',plan:pl.id,block:b.name,n:task.n}));render();toast('Блок заданий удалён.');return;
  }
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
    box.querySelectorAll('[data-f]').forEach(inp=>{if(inp.type==='radio'&&!inp.checked)return;const f=inp.dataset.f;let v=inp.value.trim();if(f==='points')v=+v||0;if(f==='task'&&!v){toast('The task cannot be empty');return}if(String(t[f]??'')!==String(v))setF(b,t,f,v)});
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
  if(e.target.matches('[data-date-picker]'))e.target.dataset.dateTouched='1';
  if(e.target.matches('[data-tgroup]')){const nb=e.target.closest('.tedit').querySelector('.tnew');nb.style.display=e.target.value==='__new'?'':'none'}
  if(e.target.id==='ntGroup'){const nb=$('#ntNewBox');if(nb)nb.style.display=e.target.value==='__new'?'':'none'}
});
document.addEventListener('input',e=>{if(e.target.matches('[data-date-picker]'))e.target.dataset.dateTouched='1'});

document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-gaddt],[data-gaddl]')){e.preventDefault();e.target.closest('[data-gadd]').querySelector('[data-gaddgo]').click()}});

/* ---------- boot ---------- */
(async function(){
  document.body.classList.add('ind');
  if(STUDENT){document.body.classList.add('parent');document.documentElement.lang='ru';document.title='ANGLE · Homework progress';if($('.title')?.firstChild)$('.title').firstChild.textContent='Homework tracker';}
  else if(!live)$('#banner').innerHTML='<div class="banner">Demo data. Nothing is saved to Google Sheets. Open ⚙ to connect your sheet.</div>';
  try{
    setSync('busy','Loading…');const slow=setTimeout(()=>setSync('busy','Still loading…'),6000);let d;try{
      const initialRequest=Store.load();initialRequest.catch(()=>{});
      if(!live&&!STUDENT)d=await initialRequest;
      else{
        const {loadWithPreview}=await import('/assets/tracker/loading.js?v=1');
        d=await loadWithPreview({identity:['individual',STUDENT?'student':'teacher',STUDENT?QP.get('a'):cfg.url,STUDENT?QP.get('p'):cfg.token,WANT],load:()=>initialRequest,preview:data=>{D={reports:data.reports||[],plans:newestFirst((data.plans||[]).filter(p=>STUDENT||!WANT.length||WANT.includes(p.id)))};render();}});
      }
    }finally{clearTimeout(slow)}
    d.plans=d.plans||[];
    if(live&&!STUDENT)for(const np of (window.TRACKER_NEW_PLANS||[]))if(!d.plans.some(p=>p.id===np.id)){d.plans.push({id:np.id,student:np.student,title:np.title,key:'',blocks:[]});send({a:'addPlan',id:np.id,student:np.student,title:np.title,folder:np.folder||''})}
    D={reports:d.reports||[],plans:newestFirst((d.plans||[]).filter(p=>STUDENT||!WANT.length||WANT.includes(p.id)))};
    setSync(live||STUDENT?'ok':'','');$('#syncTxt').textContent=live||STUDENT?'Synced':'Demo';
    if(!PARENT&&(live||STUDENT)&&pending.length)flush();
  }catch(e){if(e.previewShown){setSync('err','Offline · saved copy');return}$('#view').innerHTML=`<div class="card empty"><b>Could not load data.</b><br>${esc(e.message)}${STUDENT?'':'<br><br>Check the URL and token in ⚙.'}${retryBtn}</div>`;setSync('err','Offline');return}
  render();
})();
// Independent of Safari showPicker support: an explicit, touch-friendly month grid.
function openTrackerCalendar(input){
  let cursor=new Date((input.value||today())+'T12:00:00');
  const dialog=document.createElement('dialog');dialog.className='tracker-calendar';dialog.setAttribute('aria-label','Выбор даты');
  const close=()=>{dialog.close();dialog.remove();input.focus()};
  function draw(){
    const year=cursor.getFullYear(),month=cursor.getMonth(),count=new Date(year,month+1,0).getDate(),offset=(new Date(year,month,1).getDay()+6)%7;
    const iso=day=>`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    dialog.innerHTML=`<div class="calendar-head"><button type="button" data-month="-1" aria-label="Предыдущий месяц">‹</button><strong>${cursor.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</strong><button type="button" data-month="1" aria-label="Следующий месяц">›</button></div><div class="calendar-days">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<span>${d}</span>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({length:count},(_,i)=>`<button type="button" data-day="${iso(i+1)}" aria-pressed="${iso(i+1)===input.value}">${i+1}</button>`).join('')}</div><button type="button" class="btn ghost" data-calendar-close>Закрыть</button>`;
  }
  dialog.addEventListener('click',e=>{
    const day=e.target.closest('[data-day]');if(day){input.value=day.dataset.day;input.dataset.dateTouched='1';input.dispatchEvent(new Event('change',{bubbles:true}));close();return}
    const month=e.target.closest('[data-month]');if(month){cursor=new Date(cursor.getFullYear(),cursor.getMonth()+Number(month.dataset.month),1);draw();return}
    if(e.target.closest('[data-calendar-close]'))close();
  });
  dialog.addEventListener('cancel',e=>{e.preventDefault();close()});draw();document.body.appendChild(dialog);dialog.showModal();
}

// Tasks.n is the existing persisted sort key. Move one row with a unique numeric
// rank, addressing the write by its OLD key; all other fields stay on that row.
function moveTrackerTask(sourceKey,targetKey,after){
  if(STUDENT||sourceKey===targetKey)return;
  const {b,t}=find(sourceKey),target=find(targetKey);
  if(!b||!t||b!==target.b||!target.t||gKey(t)!==gKey(target.t))return;
  const items=b.tasks.filter(x=>gKey(x)===gKey(t)&&x!==t).sort((a,c)=>a.n-c.n);
  const at=items.indexOf(target.t)+(after?1:0);items.splice(at,0,t);
  const original=b.tasks.filter(x=>gKey(x)===gKey(t)).sort((a,c)=>a.n-c.n);
  if(items.every((x,i)=>x===original[i]))return;
  const otherRanks=b.tasks.filter(x=>x!==t).map(x=>x.n);
  const low=at?items[at-1].n:Math.max(items[1].n-2,...otherRanks.filter(n=>n<items[1].n));
  const high=at<items.length-1?items[at+1].n:Math.min(items[at-1].n+2,...otherRanks.filter(n=>n>items[at-1].n));
  let rank=low+(high-low)/2;
  while(b.tasks.some(x=>x.n===rank)&&rank>low&&rank<high)rank=low+(rank-low)/2;
  if(!(rank>low&&rank<high)){toast('Не удалось изменить порядок: обновите страницу.');return}
  const old=t.n;t.n=rank;b.tasks.sort((a,c)=>a.n-c.n);ui.tedit=null;
  send({a:'setTask',plan:P().id,block:b.name,n:old,field:'n',value:rank});
  render();toast('Порядок заданий сохранён');
  document.querySelector(`[data-task-drag="${sourceKey.split('|')[0]}|${rank}"]`)?.focus({preventScroll:true});
}
let taskDrag=null;
function clearTaskDrag(){
  if(!taskDrag)return;
  taskDrag.row.classList.remove('task-dragging');
  document.querySelectorAll('.task-drop-before,.task-drop-after').forEach(x=>x.classList.remove('task-drop-before','task-drop-after'));
  cancelAnimationFrame(taskDrag.frame);taskDrag=null;
}
document.addEventListener('pointerdown',e=>{
  const handle=e.target.closest('[data-task-drag]');
  if(!handle||STUDENT||e.button!==0)return;
  e.preventDefault();handle.setPointerCapture(e.pointerId);
  taskDrag={handle,row:handle.closest('[data-task-row]'),group:handle.closest('.wgrp'),key:handle.dataset.taskDrag,pointer:e.pointerId,x:e.clientX,y:e.clientY,startY:e.clientY,target:null,after:false,active:false};
  function scroll(){
    if(!taskDrag)return;
    if(taskDrag.active){const y=taskDrag.y,edge=80;window.scrollBy(0,y<edge?-12:y>innerHeight-edge?12:0)}
    taskDrag.frame=requestAnimationFrame(scroll);
  }
  taskDrag.frame=requestAnimationFrame(scroll);
});
document.addEventListener('pointermove',e=>{
  const d=taskDrag;if(!d||e.pointerId!==d.pointer)return;
  d.x=e.clientX;d.y=e.clientY;
  if(!d.active&&Math.abs(e.clientY-d.startY)<5)return;
  d.active=true;d.row.classList.add('task-dragging');e.preventDefault();
  document.querySelectorAll('.task-drop-before,.task-drop-after').forEach(x=>x.classList.remove('task-drop-before','task-drop-after'));
  const rows=[...d.group.querySelectorAll('[data-task-row]')].filter(x=>x!==d.row);
  d.target=rows.reduce((best,row)=>{const r=row.getBoundingClientRect(),distance=Math.abs(e.clientY-(r.top+r.height/2));return !best||distance<best.distance?{row,distance}:best},null)?.row;
  if(d.target){const r=d.target.getBoundingClientRect();d.after=e.clientY>r.top+r.height/2;d.target.classList.add(d.after?'task-drop-after':'task-drop-before')}
},{passive:false});
document.addEventListener('pointerup',e=>{
  const d=taskDrag;if(!d||e.pointerId!==d.pointer)return;
  const target=d.active&&d.target?.dataset.taskRow,after=d.after;clearTaskDrag();
  if(target)moveTrackerTask(d.key,target,after);
});
document.addEventListener('pointercancel',clearTaskDrag);
document.addEventListener('lostpointercapture',e=>{if(taskDrag&&e.pointerId===taskDrag.pointer)clearTaskDrag()});
document.addEventListener('keydown',e=>{
  const handle=e.target.closest('[data-task-drag]');if(!handle||STUDENT)return;
  if(e.key==='Escape'){clearTaskDrag();return}
  if(!['ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();const rows=[...handle.closest('.wgrp').querySelectorAll('[data-task-row]')],at=rows.indexOf(handle.closest('[data-task-row]')),next=rows[at+(e.key==='ArrowUp'?-1:1)];
  if(next)moveTrackerTask(handle.dataset.taskDrag,next.dataset.taskRow,e.key==='ArrowDown');
});
