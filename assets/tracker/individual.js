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
const cfg=LS.get('angleTracker.cfg',{url:'',token:''});
const live=!STUDENT&&!!(cfg.url&&cfg.token);
let D={plans:[]};
let ui=LS.get('angleTracker.iui2',{plan:null,tab:null,review:false});
const today=()=>new Date().toISOString().slice(0,10);
const setSync=(s,t)=>{const el=$('#sync');el.className='sync '+s;$('#syncTxt').textContent=t};
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',2600)};
const KINDS={before:'Before the lesson',classwork:'Classwork',homework:'Homework'};

/* ---------- stores ---------- */
const Demo={
  async load(){
    const mk=(b,n)=>({name:'Block '+b,tasks:Array.from({length:n},(_,i)=>({n:i+1,week:'Week '+(Math.floor(i/3)+1),date:'Oct, '+(1+Math.floor(i/3)*7),when:'',unit:'',task:'Demo task '+(i+1),mode:'',link:'',points:5,status:i<n/3?'✓':'',note:'',kind:['homework','classwork','before'][i%3],suggested:i===n-2?today():''}))});
    const plans=WANT.map((id,i)=>({id,student:'Demo student '+(i+1),title:'Demo plan ('+id+')',key:'',blocks:[mk(1,9),mk(2,6)]}));
    const saved=LS.get('angleTracker.idemo2',null);
    if(saved)for(const p of plans){const s=saved[p.id];if(s)p.blocks=s}
    return {plans};
  },
  async write(){LS.set('angleTracker.idemo2',Object.fromEntries(D.plans.map(p=>[p.id,p.blocks])))}
};
const post=async body=>{const r=await fetch(cfg.url||QP.get('a'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});const j=await r.json();if(!j.ok)throw new Error(j.error||'save failed')};
const Sheets={
  async load(){const r=await fetch(cfg.url+'?token='+encodeURIComponent(cfg.token)+'&view=plans');const j=await r.json();if(!j.ok)throw new Error(j.error||'load failed');return j.data},
  async write(op){await post({...op,token:cfg.token})}
};
const StudentStore={
  async load(){const r=await fetch(QP.get('a')+'?view=plans&p='+encodeURIComponent(QP.get('p')));const j=await r.json();if(!j.ok)throw new Error('This link is not valid. Ask your teacher for a new one.');return j.data},
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
const fmtDay=d=>{try{return new Date(d+'T00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}catch{return d}};

/* ---------- views ---------- */
function stBtn(bi,t){
  const s=stateOf(t),icon={ok:'✓',na:'–',sug:'?','':''}[s];
  const label={ok:'Confirmed by teacher',na:'Not assigned',sug:'You said you did it. Waiting for your teacher',"":'Not done yet'}[s];
  const dis=STUDENT&&(s==='ok'||s==='na');
  return `<button class="st ${s}" data-tk="${bi}|${t.n}" aria-label="${label}" title="${label}"${dis?' disabled':''}>${icon}</button>`;
}
function taskCard(pl,bi,t){
  const k=KINDS[t.kind]?t.kind:'homework';
  const l=safeLink(t.link);
  const title=l?`<a href="${esc(l)}" target="_blank" rel="noopener">${esc(t.task)}</a>`:esc(t.task);
  const sub=[t.mode,t.unit,t.points+' pts'].filter(Boolean).map(esc).join(' · ');
  const s=stateOf(t);
  const tag=s==='sug'?`<span class="tag sug">Suggested${t.suggested&&t.suggested.length===10?' · '+esc(fmtDay(t.suggested)):''}</span>`:s==='ok'?'<span class="tag ok">Confirmed</span>':'';
  let note='';
  if(STUDENT)note=t.note?`<div class="tnote">${esc(t.note)}</div>`:'';
  else if(t.note||ui.noteOpen===bi+'|'+t.n)note=`<input type="text" value="${esc(t.note)}" data-tn="${bi}|${t.n}" placeholder="note for the student" class="tnote-in">`;
  const tools=STUDENT?'':`<span class="tools-sm">${s==='sug'?`<button class="lnk" data-ret="${bi}|${t.n}">Return</button>`:''}<button class="lnk" data-en="${bi}|${t.n}">✎</button></span>`;
  return `<div class="task k-${k} s-${s}"><div class="tb"><div class="tt">${title}</div><div class="tm"><span class="kind k-${k}">${KINDS[k]}</span>${sub?`<span class="sub">${sub}</span>`:''}${tag}${tools}</div>${note}</div>${stBtn(bi,t)}</div>`;
}
function groupWeeks(tasks){
  const g=[];for(const t of tasks){const key=(t.week||'')+'|'+(t.date||'');const last=g[g.length-1];if(last&&last.key===key)last.items.push(t);else g.push({key,week:t.week||'',date:t.date||'',items:[t]})}
  return g.reverse();                       // newest week first
}
function viewBlock(pl,bi,only){
  const b=pl.blocks[bi];if(!b)return '';
  const tasks=only?b.tasks.filter(t=>t.suggested&&t.status!=='✓'):b.tasks;
  if(!tasks.length)return '';
  const sc=score(b.tasks);
  const body=groupWeeks(tasks).map(g=>`<div class="wk">${g.date?`<span class="dchip">${esc(g.date)}</span>`:''}${g.week?`<span class="wlab">${esc(g.week)}</span>`:''}</div>${g.items.map(t=>taskCard(pl,bi,t)).join('')}`).join('');
  return `<div class="card blk"><div class="unit-head"><div><h2>${esc(b.name)}</h2><div class="sub">${sc.done} of ${sc.n} confirmed${sc.wait?` · <b class="waitc">${sc.wait} waiting for review</b>`:''} · ${sc.e} of ${sc.p} points</div></div><span class="${pcClass(sc.r)} bigpc">${fmt(sc.r)}</span></div>${body}</div>`;
}
function addForm(pl,bi){
  if(STUDENT)return '';
  const b=pl.blocks[bi];
  return `<details class="card addbox"><summary class="btn ghost">+ Add task</summary>
    <div class="xgrid" style="margin-top:10px"><div style="grid-column:1/-1"><label>Task</label><input type="text" id="ntTask"></div>
    <div><label>Block (new name = new tab)</label><input type="text" id="ntBlock" list="blocks" value="${esc(b?b.name:'Block 1')}"><datalist id="blocks">${pl.blocks.map(x=>`<option value="${esc(x.name)}">`).join('')}</datalist></div>
    <div><label>Kind</label><select id="ntKind"><option value="homework">Homework</option><option value="classwork">Classwork</option><option value="before">Before the lesson</option></select></div>
    <div><label>Week</label><input type="text" id="ntWeek" placeholder="Week 5"></div><div><label>Date</label><input type="text" id="ntDate" placeholder="Oct, 29"></div>
    <div><label>Points</label><input type="number" id="ntPts" value="5" min="0"></div><div><label>Link</label><input type="text" id="ntLink" placeholder="https://"></div></div>
    <p style="margin:10px 0 0"><button class="btn" data-addtask="1">Add</button></p></details>`;
}
function viewSummary(pl){
  const o=planScore(pl);
  const rows=[...pl.blocks].reverse().map(b=>{const s=score(b.tasks);return `<div class="srow"><div class="t">${esc(b.name)}<small>${s.done} of ${s.n} confirmed${s.wait?` · ${s.wait} waiting`:''} · ${s.e} of ${s.p} points</small></div><span class="${pcClass(s.r)} bigpc">${fmt(s.r)}</span></div>`}).join('');
  const link=STUDENT?'':`<p style="margin:14px 0 0"><button class="btn ghost" data-plink="1">Copy student link</button></p>`;
  return `<div class="card"><div class="scard-top">${ring(o.r)}<div class="who"><h3>${esc(pl.student)}</h3><div>${esc(pl.title)}</div><div>${o.e} of ${o.p} points confirmed</div></div></div>${rows}${link}</div>`;
}
const legend=()=>`<div class="legend2"><span><i class="st"></i>not done</span><span><i class="st sug">?</i>${STUDENT?'I did it (tap to suggest)':'student suggests'}</span><span><i class="st ok">✓</i>confirmed by teacher</span><span class="sep"></span><span><i class="kd k-before"></i>before the lesson</span><span><i class="kd k-classwork"></i>classwork</span><span><i class="kd k-homework"></i>homework</span></div>`;
function render(){
  if(!D.plans.length){$('#view').innerHTML='<div class="card empty">No plans found for this page. Add them in the Google Sheet (Plans tab).</div>';return}
  if(!P())ui.plan=D.plans[0].id;
  const pl=P();
  $('#courses').innerHTML=STUDENT||D.plans.length<2?'':D.plans.map(p=>`<button class="pill ${p.id===ui.plan?'on':''}" data-plan="${esc(p.id)}">${esc(p.student)} · ${esc(p.title)}</button>`).join('');
  const order=pl.blocks.map((_,i)=>i).reverse();            // newest block first
  const tabs=[...order.map(i=>({k:'b'+i,l:pl.blocks[i].name})),{k:'sum',l:'Summary',w:1}];
  if(!tabs.find(t=>t.k===ui.tab))ui.tab=tabs[0].k;
  const wait=planScore(pl).wait;
  const rv=STUDENT?'':`<button class="tab wide rv ${ui.review?'on':''} ${wait?'has':''}" data-review="1">To review${wait?` (${wait})`:''}</button>`;
  $('#tabs').innerHTML=tabs.map(t=>`<button class="tab ${t.w?'wide':''} ${!ui.review&&t.k===ui.tab?'on':''}" data-tab="${t.k}">${esc(t.l)}</button>`).join('')+rv;
  $('#sub').textContent=STUDENT?'Homework progress':pl.student+' · teacher panel';
  if(!STUDENT)LS.set('angleTracker.iui2',{plan:ui.plan,tab:ui.tab,review:ui.review});
  let html='';
  if(ui.review&&!STUDENT){
    html=order.map(i=>viewBlock(pl,i,true)).join('')||'<div class="card empty">Nothing waiting for review.</div>';
  }else if(ui.tab==='sum'){html=viewSummary(pl)}
  else{const bi=parseInt(ui.tab.slice(1));html=(STUDENT?`<div class="card hint">Tap the circle when you have done a task. Your teacher will check it and confirm it.</div>`:'')+legend()+viewBlock(pl,bi,false)+addForm(pl,bi)}
  $('#view').innerHTML=html;
}

/* ---------- events ---------- */
const find=s=>{const [bi,n]=s.split('|');const b=P().blocks[+bi];return{b,t:b.tasks.find(x=>x.n===+n)}};
const setF=(b,t,field,value)=>{t[field]=value;send({a:'setTask',plan:P().id,block:b.name,n:t.n,field,value})};
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
  const en=e.target.closest('[data-en]');
  if(en&&!STUDENT){ui.noteOpen=en.dataset.en;render();const i=$('.tnote-in');if(i)i.focus();return}
  const ad=e.target.closest('[data-addtask]');
  if(ad&&!STUDENT){const task=$('#ntTask').value.trim();if(!task){toast('Write the task first');return}
    const bn=$('#ntBlock').value.trim()||'Block 1';let b=P().blocks.find(x=>x.name===bn);
    if(!b){b={name:bn,tasks:[]};P().blocks.push(b)}
    const t={n:(b.tasks.reduce((m,x)=>Math.max(m,x.n),0)||0)+1,week:$('#ntWeek').value.trim(),date:$('#ntDate').value.trim(),when:'',unit:'',task,mode:'',link:$('#ntLink').value.trim(),points:+$('#ntPts').value||0,status:'',note:'',kind:$('#ntKind').value,suggested:''};
    b.tasks.push(t);send({a:'addTask',plan:P().id,block:b.name,task:t});ui.tab='b'+P().blocks.indexOf(b);ui.review=false;render();return}
  if(e.target.closest('[data-plink]')){const pl=P();
    if(!live||!pl.key){toast('Connect the Google Sheet and run makeParentKeys first');return}
    const url=location.origin+location.pathname+'?a='+encodeURIComponent(cfg.url)+'&p='+encodeURIComponent(pl.key);
    const b=e.target.closest('[data-plink]');
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>{toast('Student link copied');b.textContent='Copied ✓'},()=>{prompt('Copy this link',url)});return}
  if(e.target.id==='gear'){$('#cfgUrl').value=cfg.url||'';$('#cfgTok').value=cfg.token||'';$('#setDlg').showModal();return}
  if(e.target.id==='cfgSave'){LS.set('angleTracker.cfg',{url:$('#cfgUrl').value.trim(),token:$('#cfgTok').value.trim()});location.reload();return}
  if(e.target.id==='cfgDemo'){LS.del('angleTracker.idemo2');LS.del('angleTracker.iui2');location.reload();return}
});
document.addEventListener('change',e=>{
  const n=e.target.closest('[data-tn]');
  if(n&&!STUDENT){const {b,t}=find(n.dataset.tn);setF(b,t,'note',n.value)}
});

/* ---------- boot ---------- */
(async function(){
  document.body.classList.add('ind');
  if(STUDENT){document.body.classList.add('parent')}
  else if(!live)$('#banner').innerHTML='<div class="banner">Demo data. Nothing is saved to Google Sheets. Open ⚙ to connect your sheet.</div>';
  try{
    setSync('busy','Loading…');const d=await Store.load();
    D={plans:newestFirst((d.plans||[]).filter(p=>STUDENT||!WANT.length||WANT.includes(p.id)))};
    setSync(live||STUDENT?'ok':'','');$('#syncTxt').textContent=live||STUDENT?'Synced':'Demo';
    if((live||STUDENT)&&pending.length)flush();
  }catch(e){$('#view').innerHTML=`<div class="card empty"><b>Could not load data.</b><br>${esc(e.message)}${STUDENT?'':'<br><br>Check the URL and token in ⚙.'}</div>`;setSync('err','Offline');return}
  render();
})();
