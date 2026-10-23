'use strict';
/* ANGLE individual tracker: weekly task lists (ЕГЭ, Empower, Expert Advanced).
   Shares tracker.css and the same Google Sheet / Apps Script as the course trackers.
   Page config: window.TRACKER_PLANS = ['plan-id', ...] (which plans this folder shows). */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
const WANT=window.TRACKER_PLANS||[];
const QP=new URLSearchParams(location.search);
const PARENT=!!(QP.get('a')&&QP.get('p'));
const cfg=LS.get('angleTracker.cfg',{url:'',token:''});
const live=!PARENT&&!!(cfg.url&&cfg.token);
let D={plans:[]};
let ui=LS.get('angleTracker.iui',{plan:null,tab:'b0'});
const setSync=(s,t)=>{const el=$('#sync');el.className='sync '+s;$('#syncTxt').textContent=t};
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',2600)};

/* ---------- stores ---------- */
const Demo={
  async load(){
    const mk=(b,n)=>({name:'Block '+b,tasks:Array.from({length:n},(_,i)=>({n:i+1,week:'Week '+(Math.floor(i/3)+1),date:'',when:i%2?'After the lesson':'Before the lesson',unit:'',task:'Demo task '+(i+1),mode:'',link:'',points:5,status:i<n/2?'✓':'',note:''}))});
    const plans=WANT.map((id,i)=>({id,student:'Demo student '+(i+1),title:'Demo plan ('+id+')',key:'',blocks:[mk(1,9),mk(2,6)]}));
    const saved=LS.get('angleTracker.idemo',null);
    if(saved)for(const p of plans){const s=saved[p.id];if(s)p.blocks=s}
    return {plans};
  },
  async write(){LS.set('angleTracker.idemo',Object.fromEntries(D.plans.map(p=>[p.id,p.blocks])))}
};
const Sheets={
  async load(){const r=await fetch(cfg.url+'?token='+encodeURIComponent(cfg.token)+'&view=plans');const j=await r.json();if(!j.ok)throw new Error(j.error||'load failed');return j.data},
  async write(op){const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...op,token:cfg.token})});const j=await r.json();if(!j.ok)throw new Error(j.error||'save failed');}
};
const ParentStore={
  async load(){const r=await fetch(QP.get('a')+'?view=plans&p='+encodeURIComponent(QP.get('p')));const j=await r.json();if(!j.ok)throw new Error('This link is not valid. Ask your teacher for a new one.');return j.data},
  async write(){}
};
const Store=PARENT?ParentStore:(live?Sheets:Demo);
let pending=LS.get('angleTracker.iqueue',[]);
async function send(op){
  if(!live){await Demo.write();return}
  pending.push(op);LS.set('angleTracker.iqueue',pending);flush();
}
let flushing=false;
async function flush(){
  if(flushing)return;flushing=true;setSync('busy','Saving…');
  try{while(pending.length){await Sheets.write(pending[0]);pending.shift();LS.set('angleTracker.iqueue',pending)}setSync('ok','Saved')}
  catch(e){setSync('err','Not saved ('+pending.length+')');toast('Could not save: '+e.message+'. Will retry.');setTimeout(flush,8000)}
  flushing=false;
}

/* ---------- scoring: points of done tasks / points of tasks not marked N/A ---------- */
const ratio=(e,p)=>p>0?e/p:null;
function score(tasks){let e=0,p=0;for(const t of tasks){if(t.status==='N/A')continue;p+=+t.points||0;if(t.status==='✓')e+=+t.points||0}return{e,p,r:ratio(e,p),done:tasks.filter(t=>t.status==='✓').length,n:tasks.filter(t=>t.status!=='N/A').length}}
const planScore=pl=>score(pl.blocks.flatMap(b=>b.tasks));
const fmt=r=>r==null?'–':Math.round(r*100)+'%';
const pcClass=r=>r==null?'pc-none':r>=.8?'pc-hi':r>=.5?'pc-mid':'pc-lo';
const dotCls=v=>v==='✓'?'d':v==='N/A'?'n':'';
const dotTxt=v=>v==='✓'?'✓':v==='N/A'?'–':'';
const nextS=v=>({'':'✓','✓':'N/A','N/A':''})[v||''];
function ring(r,size=96){const R=size/2-9,C=2*Math.PI*R,v=r==null?0:r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="#e8e3ee" stroke-width="10"/><circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="${v>=.8?'#4f9d52':v>=.5?'#d9a900':'#c7586a'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-v)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg><b>${fmt(r)}</b></div>`}
const P=()=>D.plans.find(p=>p.id===ui.plan);
const safeLink=u=>/^https?:\/\//i.test(u||'')?u:'';

/* ---------- views ---------- */
function taskRow(pl,bi,t){
  const ro=PARENT;
  const dot=ro?`<span class="dot ${dotCls(t.status)}" style="cursor:default">${dotTxt(t.status)}</span>`:`<button class="dot ${dotCls(t.status)}" data-tk="${bi}|${t.n}" aria-label="${t.status||'not done'}">${dotTxt(t.status)}</button>`;
  const l=safeLink(t.link);
  const title=l?`<a href="${esc(l)}" target="_blank" rel="noopener" style="color:inherit">${esc(t.task)} ↗</a>`:esc(t.task);
  const sub=[t.mode,t.unit,t.points+' pts'].filter(Boolean).map(esc).join(' · ');
  const note=ro?(t.note?`<div class="sub" style="margin-top:3px">${esc(t.note)}</div>`:''):`<input type="text" value="${esc(t.note)}" data-tn="${bi}|${t.n}" placeholder="note" style="margin-top:4px;padding:3px 6px;font-size:12.5px;width:100%">`;
  return `<div class="secrow g-lav"><div class="t">${title}<small>${sub}</small>${note}</div>${dot}</div>`;
}
function viewBlock(pl,bi){
  const b=pl.blocks[bi];if(!b)return '<div class="card empty">No such block.</div>';
  const sc=score(b.tasks);
  let html='',last='';
  for(const t of b.tasks){
    const h=[t.week,t.date,t.when].filter(Boolean).join(' · ');
    if(h!==last){html+=`<h3 style="margin:14px 0 6px;font-size:13.5px;color:var(--purple)">${esc(h)||'&nbsp;'}</h3>`;last=h}
    html+=taskRow(pl,bi,t);
  }
  const add=PARENT?'':`<details style="margin-top:14px"><summary class="btn ghost" style="display:inline-block">+ Add task</summary>
    <div class="xcard" style="margin-top:8px"><div class="xgrid"><div class="wide2" style="grid-column:1/-1"><label>Task</label><input type="text" id="ntTask"></div>
    <div><label>Week</label><input type="text" id="ntWeek" placeholder="Week 5"></div><div><label>Date</label><input type="text" id="ntDate" placeholder="Oct, 29"></div>
    <div><label>Points</label><input type="number" id="ntPts" value="5" min="0"></div><div><label>Link</label><input type="text" id="ntLink" placeholder="https://"></div></div>
    <p style="margin:8px 0 0"><button class="btn" data-addtask="${bi}">Add</button></p></div></details>`;
  return `<div class="card"><div class="unit-head"><div><h2>${esc(b.name)}</h2><div class="sub">${sc.done} of ${sc.n} tasks done · ${sc.e} of ${sc.p} points${PARENT?'':' · tap a circle: done → not assigned → empty'}</div></div><span class="pc ${pcClass(sc.r)}" style="font-weight:800">${fmt(sc.r)}</span></div>${html}${add}</div>`;
}
function viewSummary(pl){
  const o=planScore(pl);
  const rows=pl.blocks.map(b=>{const s=score(b.tasks);return `<div class="secrow g-lav"><div class="t">${esc(b.name)}<small>${s.done} of ${s.n} tasks · ${s.e} of ${s.p} points</small></div><span class="${pcClass(s.r)}" style="font-weight:800">${fmt(s.r)}</span></div>`}).join('');
  const link=PARENT?'':`<p style="margin-top:12px"><button class="btn ghost" data-plink="1">Copy parent link</button></p>`;
  return `<div class="card"><div class="scard-top">${ring(o.r)}<div class="who"><h3>${esc(pl.student)}</h3><div>${esc(pl.title)}</div><div>${o.e} of ${o.p} points</div></div></div>${rows}${link}</div>`;
}
function render(){
  if(!D.plans.length){$('#view').innerHTML='<div class="card empty">No plans found for this page. Add them in the Google Sheet (Plans tab).</div>';return}
  if(!P())ui.plan=D.plans[0].id;
  const pl=P();
  $('#courses').innerHTML=PARENT||D.plans.length<2?'':D.plans.map(p=>`<button class="pill ${p.id===ui.plan?'on':''}" data-plan="${esc(p.id)}">${esc(p.student)} · ${esc(p.title)}</button>`).join('');
  const tabs=[...pl.blocks.map((b,i)=>({k:'b'+i,l:b.name})),{k:'sum',l:'Summary',w:1}];
  if(!tabs.find(t=>t.k===ui.tab))ui.tab=PARENT?'sum':'b0';
  $('#tabs').innerHTML=tabs.map(t=>`<button class="tab ${t.w?'wide':''} ${t.k===ui.tab?'on':''}" data-tab="${t.k}">${esc(t.l)}</button>`).join('');
  $('#sub').textContent=PARENT?'Homework progress':pl.student+' · teacher panel';
  if(!PARENT)LS.set('angleTracker.iui',ui);
  $('#view').innerHTML=ui.tab==='sum'?viewSummary(pl):viewBlock(pl,parseInt(ui.tab.slice(1)));
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const pn=e.target.closest('[data-plan]');if(pn){ui.plan=pn.dataset.plan;ui.tab='b0';render();return}
  const tb=e.target.closest('[data-tab]');if(tb){ui.tab=tb.dataset.tab;render();return}
  const tk=e.target.closest('[data-tk]');
  if(tk&&!PARENT){const [bi,n]=tk.dataset.tk.split('|');const t=P().blocks[+bi].tasks.find(x=>x.n===+n);t.status=nextS(t.status);
    send({a:'setTask',plan:P().id,block:P().blocks[+bi].name,n:t.n,field:'status',value:t.status});render();return}
  const ad=e.target.closest('[data-addtask]');
  if(ad&&!PARENT){const b=P().blocks[+ad.dataset.addtask];const task=$('#ntTask').value.trim();if(!task){toast('Write the task first');return}
    const t={n:(b.tasks.reduce((m,x)=>Math.max(m,x.n),0)||0)+1,week:$('#ntWeek').value.trim(),date:$('#ntDate').value.trim(),when:'',unit:'',task,mode:'',link:$('#ntLink').value.trim(),points:+$('#ntPts').value||0,status:'',note:''};
    b.tasks.push(t);send({a:'addTask',plan:P().id,block:b.name,task:t});render();return}
  if(e.target.closest('[data-plink]')){const pl=P();
    if(!live||!pl.key){toast('Connect the Google Sheet and run makeParentKeys first');return}
    const url=location.origin+location.pathname+'?a='+encodeURIComponent(cfg.url)+'&p='+encodeURIComponent(pl.key);
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('Parent link copied'),()=>{prompt('Copy this link',url)});return}
  if(e.target.id==='gear'){$('#cfgUrl').value=cfg.url||'';$('#cfgTok').value=cfg.token||'';$('#setDlg').showModal();return}
  if(e.target.id==='cfgSave'){LS.set('angleTracker.cfg',{url:$('#cfgUrl').value.trim(),token:$('#cfgTok').value.trim()});location.reload();return}
  if(e.target.id==='cfgDemo'){LS.del('angleTracker.idemo');LS.del('angleTracker.iui');location.reload();return}
});
document.addEventListener('change',e=>{
  const n=e.target.closest('[data-tn]');
  if(n&&!PARENT){const [bi,k]=n.dataset.tn.split('|');const t=P().blocks[+bi].tasks.find(x=>x.n===+k);t.note=n.value;
    send({a:'setTask',plan:P().id,block:P().blocks[+bi].name,n:t.n,field:'note',value:t.note})}
});

/* ---------- boot ---------- */
(async function(){
  document.body.classList.add('ind');if(PARENT){document.body.classList.add('parent')}
  else if(!live)$('#banner').innerHTML='<div class="banner">Demo data. Nothing is saved to Google Sheets. Open ⚙ to connect your sheet.</div>';
  try{
    setSync('busy','Loading…');const d=await Store.load();
    D={plans:(d.plans||[]).filter(p=>PARENT||!WANT.length||WANT.includes(p.id))};
    setSync(live?'ok':'','');$('#syncTxt').textContent=live?'Synced':'Demo';
    if(live&&pending.length)flush();
  }catch(e){$('#view').innerHTML=`<div class="card empty"><b>Could not load data.</b><br>${esc(e.message)}${PARENT?'':'<br><br>Check the URL and token in ⚙.'}</div>`;setSync('err','Offline');return}
  render();
})();
