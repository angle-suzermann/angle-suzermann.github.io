const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('assets/tracker/submission-hook.js','utf8');
async function run(fields,mail={success:true},failTracker=false,legacy=false){
  const calls=[],store=new Map(),nodes=new Map();
  const context={navigator:{},URL,AbortSignal,JSON,Date,Math,FormData,console,setInterval(){},location:{pathname:'/as5/Unit%201/lab/',hash:''},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{title:'Lab',addEventListener(){},querySelectorAll:()=>[],body:{appendChild:e=>nodes.set(e.id,e)},getElementById:k=>nodes.get(k),createElement:()=>({setAttribute(){},style:{}}),querySelector:s=>s.includes('course-id')?{content:'as5'}:s.includes('ws:title')?{content:'05. Lab'}:null}};
  context.window={addEventListener(){},fetch:async(url,o)=>{calls.push({url,body:o?.body});if(url.includes('script.google')){if(failTracker)throw Error('offline');return {ok:true,json:async()=>({ok:true,matched:true})}}return {ok:true,clone:()=>({json:async()=>mail})}}};
  context.Response=Response;
  vm.createContext(context);vm.runInContext(source,context);
  if(legacy)await context.window.fetch('https://script.google.com/macros/s/AKfycbxL4zwd1hopnl_97A_vknNYZJeMhzDa2_wIojqTjAcIiZsgbKVDRWzPXT8xqyv61U30Rg/exec',{method:'POST',body:JSON.stringify({a:'result',student:'Example',pct:100})});
  await context.window.fetch('https://api.web3forms.com/submit',{method:'POST',body:JSON.stringify(fields)});
  await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  return {posts:calls.filter(c=>c.url.includes('script.google')).map(c=>JSON.parse(c.body)),queue:JSON.parse(store.get('angle.pendingSubmissions.v1')||'[]')};
}
(async()=>{
  let r=await run({student:'Example',score:'First: 8/12; corrected: 12/12'});assert.equal(r.posts[0].pct,100);assert.equal(r.posts[0].pts,12);assert.match(r.posts[0].note,/First: 8\/12/);assert.equal(r.queue.length,0);
  r=await run({student_name:'Example',score_fraction:'9 / 10',score_percent:'90%'});assert.equal(r.posts[0].pct,90);
  r=await run({student:'Example',writing:'An open answer'});assert.equal(r.posts[0].pct,null);
  r=await run({student:'Example',score:'8/12'},{success:false});assert.equal(r.posts.length,0);
  r=await run({student:'Example',score:'8/12'},{success:false},false,true);assert.equal(r.posts.length,0);
  r=await run({student:'Example',score:'8/12'},{success:true},false,true);assert.equal(r.posts.length,1);assert.equal(r.posts[0].a,'worksheetSubmission');
  r=await run({student:'Example',score:'8/12'},{success:true},true);assert.equal(r.queue.length,1);
  r=await run({student:'Example',score:'8/12',lesson:'частичная отправка после задания'});assert.equal(r.posts[0].partial,true);
  r=await run({student:'Example',recognition_score:'3 / 6 (отвечено: 6/6)',exercise:'05. Lab — Scenario 2'});assert.equal(r.posts[0].pct,50);assert.equal(r.posts[0].partial,true);assert.match(r.posts[0].hw,/Scenario 2/);
  r=await run({student:'Example',score:'6 / 6',lesson:'05. Lab'});assert.equal(r.posts[0].partial,false);assert.equal(r.posts[0].hw,'05. Lab');
  console.log('PASS: latest (corrected) score, JSON test, unscored writing, failed mail, offline queue, partial submission');
})().catch(e=>{console.error(e);process.exit(1)});
