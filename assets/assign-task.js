/* Teacher-only worksheet assignment; credentials stay in this browser. */
(()=>{'use strict';
 let cfg;try{cfg=JSON.parse(localStorage.getItem('angleTracker.cfg')||'null')}catch{}if(!cfg?.url||!cfg?.token||new URLSearchParams(location.search).has('p'))return;
 document.querySelectorAll('[data-assign-url]').forEach(b=>b.hidden=false);
 if(window.angleAssignmentReady)return;window.angleAssignmentReady=true;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const kinds={homework:'Homework',classwork:'Classwork',before:'Before the lesson'};let dialog,material,groups,plans,requestId,busy=false,parts=null,openId=0;
 const css=document.createElement('style');css.textContent='.angle-assign-button{border:1px solid #6b5289;border-radius:12px;padding:9px 14px;background:#fff;color:#5d467b;font:inherit;font-weight:700;cursor:pointer}.angle-assign{width:min(540px,calc(100vw - 40px));max-height:85vh;overflow:auto;border:2px solid #70568c;border-radius:20px;padding:22px;background:#fffdf9;color:#29242d;font:16px Arial,sans-serif}.angle-assign::backdrop{background:#20142b99}.angle-assign label{display:block;margin:15px 0 6px;font-weight:700}.angle-assign input[type=date],.angle-assign select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cfc5da;border-radius:10px;background:white;font:inherit}.angle-assign .assign-pupils{max-height:240px;overflow:auto;border:1px solid #e1d8eb;border-radius:12px;padding:8px}.angle-assign .assign-pupils label{margin:0;padding:10px;display:flex;gap:12px;align-items:center;font-weight:400}.angle-assign input[type=checkbox]{width:20px;height:20px}.angle-assign .assign-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.angle-assign .assign-status{white-space:pre-line;line-height:1.5}.angle-assign button:disabled{opacity:.55;cursor:wait}.angle-assign h2{margin:0 0 10px;font-size:22px}';document.head.append(css);
 const ttl=5*60*1000;let roster=null,rosterTime=0,rosterPending=null;
 const cacheKey=crypto.subtle.digest('SHA-256',new TextEncoder().encode(cfg.url+'\n'+cfg.token)).then(b=>'angleAssignment.roster.v1:'+Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join(''));
 function compact(g,p){return {groups:{courses:Object.fromEntries(Object.entries(g.courses||{}).map(([id,c])=>[id,{students:(c.students||[]).map(s=>({id:s.id,name:s.name,group:s.group}))}]))},plans:{plans:(p.plans||[]).map(p=>({id:p.id,student:p.student,title:p.title}))}}}
 async function loadRoster(){
  if(roster&&Date.now()-rosterTime<ttl)return roster;
  if(rosterPending)return rosterPending;
  rosterPending=(async()=>{
   const key=await cacheKey;try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&Date.now()-saved.at<ttl){rosterTime=saved.at;return roster=saved.data}}catch{}
   const read=async view=>{const u=new URL(cfg.url);u.searchParams.set('token',cfg.token);if(view)u.searchParams.set('view',view);const r=await fetch(u,{signal:AbortSignal.timeout(30000)});const j=await r.json();if(!j.ok)throw Error(j.error||'Нет доступа к трекеру');return j.data};
   const [g,p]=await Promise.all([read(''),read('plans')]);roster=compact(g,p);rosterTime=Date.now();try{sessionStorage.setItem(key,JSON.stringify({at:rosterTime,data:roster}))}catch{}return roster;
  })();try{return await rosterPending}finally{rosterPending=null}
 }
 // Warm the same deduplicated request when the teacher approaches a button.
 for(const event of ['pointerover','focusin'])document.addEventListener(event,e=>{if(e.target.closest('[data-assign-url]'))loadRoster().catch(()=>{})});
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-assign-url]');if(!b)return;e.preventDefault();if(busy)return;
  const url=new URL(b.dataset.assignUrl,location.href);url.search='';url.hash='';if(url.origin!==location.origin)return;
  material={url:url.href,title:(b.dataset.assignTitle||document.title).replace(/^\s*\d{1,3}[.)]\s+/, ''),course:b.dataset.assignCourse||''};requestId=crypto.randomUUID();const current=++openId;
  if(!dialog){dialog=document.createElement('dialog');dialog.className='angle-assign';dialog.setAttribute('aria-label','Назначить задание');document.body.append(dialog);dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else openId++})}
  dialog.innerHTML='<h2>Назначить задание</h2><p class="assign-title"></p><p role="status" class="assign-status">Загружаем учеников…</p><div class="assign-form" hidden></div><div class="assign-actions"><button type="button" class="angle-assign-button" data-close>Закрыть</button></div>';dialog.querySelector('.assign-title').textContent=material.title;dialog.querySelector('[data-close]').onclick=()=>{if(!busy){openId++;dialog.close()}};dialog.showModal();
  try{const data=await loadRoster();if(current!==openId||!dialog.open)return;groups=data.groups;plans=data.plans;parts=null;showForm()}catch(err){if(current===openId&&dialog.open)status('Не удалось загрузить учеников. Проверьте подключение трекера и откройте окно ещё раз.');}
 });
 function status(s){dialog.querySelector('.assign-status').textContent=s}
 function showForm(){
  const choices=[];const add=(id,name,recipients)=>{if(recipients.length)choices.push({id,name,recipients})};
  const individual=plans.plans||[];
  add('empower-b1','Empower B1+ · Полина',individual.filter(p=>/^emp-/.test(p.id)).sort((a,b)=>b.id.localeCompare(a.id)).slice(0,1).map(p=>({value:'plan:'+p.id,label:p.student+' · '+p.title})));
  add('ege-2027','ЕГЭ · Мария и Ульяна',individual.filter(p=>/^ege-/.test(p.id)).map(p=>({value:'plan:'+p.id,label:p.student})));
  for(const [id,c] of Object.entries(groups.courses||{}))add('group:'+id,id,(c.students||[]).map(s=>({value:'group:'+id+':'+s.id,label:s.name+(s.group?' · '+s.group:'')})));
  const rest=individual.filter(p=>!/^emp-|^ege-/.test(p.id));for(const p of rest)add('plan:'+p.id,p.student+' · '+p.title,[{value:'plan:'+p.id,label:p.student}]);
  const map={as2:'group:Starters',as3:'group:Movers',as5:'group:Flyers','gateway/gateway-to-the-world-b1':'group:B1','gateway/gw-b2':'plan:gwb2-lena','gateway/gateway-to-the-world-b2':'plan:gwb2-lena','expert-advanced':'plan:expert'};
  const chosen=choices.find(c=>c.id===(map[material.course]||material.course))||choices[0];if(!chosen){status('Нет доступных учеников в трекере.');return}
  const form=dialog.querySelector('.assign-form');form.hidden=false;form.innerHTML='<label for="assign-course">Курс / группа</label><select id="assign-course">'+choices.map(c=>`<option value="${esc(c.id)}"${c===chosen?' selected':''}>${esc(c.name)}</option>`).join('')+'</select><div class="assign-actions"><button type="button" class="angle-assign-button" data-all>Выбрать всех / Choose all</button><button type="button" class="angle-assign-button" data-none>Снять выбор</button></div><label>Ученики</label><div class="assign-pupils"></div><label for="assign-scope">Что назначить</label><select id="assign-scope"><option value="whole">Весь воркшит</option><option value="pages">Отдельные страницы</option><option value="exercises">Отдельные упражнения / разделы</option></select><div class="assign-parts assign-pupils" hidden></div><label for="assign-date">Дата занятия</label><input id="assign-date" type="date" required><label for="assign-kind">Тип работы</label><select id="assign-kind">'+Object.entries(kinds).map(([id,title])=>`<option value="${id}">${title}</option>`).join('')+'</select><div class="assign-actions"><button type="button" class="angle-assign-button" data-submit>Назначить</button></div>';
  form.addEventListener('change',()=>{requestId=crypto.randomUUID()});
  const populate=()=>{const c=choices.find(c=>c.id===form.querySelector('#assign-course').value);form.querySelector('.assign-pupils').innerHTML=c.recipients.map(r=>`<label><input type="checkbox" value="${esc(r.value)}">${esc(r.label)}</label>`).join('');status('Выберите учеников, дату и тип работы.');requestId=crypto.randomUUID()};populate();
  form.querySelector('#assign-course').onchange=populate;form.querySelector('[data-all]').onclick=()=>form.querySelectorAll('.assign-pupils:not(.assign-parts) [type=checkbox]').forEach(i=>i.checked=true);form.querySelector('[data-none]').onclick=()=>form.querySelectorAll('.assign-pupils:not(.assign-parts) [type=checkbox]').forEach(i=>i.checked=false);
  const scope=form.querySelector('#assign-scope'),partBox=form.querySelector('.assign-parts');
  const materialUrl=material.url,current=openId;let partsPending;
  const drawParts=()=>{const list=parts?.[scope.value]||[];partBox.innerHTML=list.length?list.map(x=>`<label><input type="checkbox" value="${x.token}">${esc(x.label)}</label>`).join(''):'<p>Не удалось найти страницы или упражнения в этом материале. Назначьте весь воркшит.</p>'};
  scope.onchange=async()=>{partBox.hidden=scope.value==='whole';requestId=crypto.randomUUID();if(scope.value==='whole')return;if(parts){drawParts();return}partBox.textContent='Загружаем страницы и упражнения…';
   try{if(!partsPending)partsPending=(async()=>{const response=await fetch(materialUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Worksheet unavailable');return AngleAssignmentParts.describe(new DOMParser().parseFromString(await response.text(),'text/html'))})();const loaded=await partsPending;if(current!==openId||!dialog.open)return;parts=loaded;if(scope.value!=='whole')drawParts()}
   catch{partsPending=null;if(current===openId&&dialog.open&&scope.value!=='whole')partBox.textContent='Не удалось загрузить разделы. Попробуйте выбрать их ещё раз или назначьте весь воркшит.'}
  };
  form.querySelector('[data-submit]').onclick=async()=>{
   const targets=Array.from(form.querySelectorAll('.assign-pupils:not(.assign-parts) [type=checkbox]:checked')).map(i=>{const [type,id,studentId]=i.value.split(':');return type==='plan'?{plan:id}:{course:id,studentId}}),date=form.querySelector('#assign-date').value,kind=form.querySelector('#assign-kind').value;
   if(!targets.length){status('Выберите хотя бы одного ученика.');return}if(!date){form.querySelector('#assign-date').reportValidity();return}
   const selected=Array.from(partBox.querySelectorAll('input:checked')).map(i=>i.value);if(scope.value!=='whole'&&!selected.length){status('Выберите хотя бы одну страницу или упражнение.');return}const chosenParts=(parts?.[scope.value]||[]).filter(x=>selected.includes(x.token));const assignmentTitle=material.title+(chosenParts.length?' — '+chosenParts.map(x=>x.label).join('; '):'');if(assignmentTitle.length>500){status('Выбрано слишком много разделов для одного назначения. Разделите его на несколько заданий.');return}const assignmentUrl=material.url+(selected.length?'#angle-parts='+selected.join(','):'');
   busy=true;dialog.querySelectorAll('button,input,select').forEach(i=>i.disabled=true);status('Сохраняем назначение…');
   try{const body={a:'assignWorksheet',token:cfg.token,requestId,title:assignmentTitle,url:assignmentUrl,date,kind,targets};const res=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});const j=await res.json();if(!j.ok)throw Error(j.error||'Ошибка сохранения');status('Назначено: '+targets.length+'. Задание появится в трекере на выбранную дату.');form.querySelector('[data-submit]').remove();}
   catch(err){status('Не удалось подтвердить сохранение: '+err.message+'. Повторите назначение с тем же выбором — повторный запрос не создаст дубликаты.');}
   finally{busy=false;dialog.querySelectorAll('button,input,select').forEach(i=>i.disabled=false)}
  };
 }

})();
