const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 for(const [width,scale,teacher] of [[390,3,false],[1280,2,true]]){
  const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:scale});
  await ctx.addInitScript(()=>{
   let cb;const answer=Array(160).fill('A student sentence.').join('\n');
   const data={mode:'blocks',blocks:Object.fromEntries(Array.from({length:9},(_,i)=>['s'+i,{uid:'s'+i,name:'Student '+i,text:answer,ts:i,feedback:{text:'Teacher feedback'}}]))};
   window.__testRoom=data;
   localStorage.setItem('angle-collab-uid','s0');localStorage.setItem('angle-collab-name-gwb1-u1-email','Student 0');
   const patch=(p,value)=>{const keys=p.split('/').slice(2);let obj=data;for(const key of keys.slice(0,-1))obj=obj[key]||(obj[key]={});obj[keys.at(-1)]=value;cb(data);return Promise.resolve()};
   window.ANGLE_COLLAB_ADAPTER={status(fn){fn(true)},on(p,fn){cb=fn;setTimeout(()=>cb(data),10)},set:patch,update(p,value){const keys=p.split('/').slice(2);let obj=data;for(const key of keys)obj=obj[key];Object.assign(obj,value);cb(data);return Promise.resolve()},remove(){return Promise.resolve()}};
  });
  await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='page.test')return route.abort();
   if(u.pathname==='/assets/collab-config.js')return route.fulfill({body:'window.ANGLE_FIREBASE={teacherKey:"fixture"}',contentType:'application/javascript'});
   let f=path.join(process.cwd(),u.pathname.startsWith('/assets/')?'':'_site',decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))f=path.join(f,'index.html');
   if(!fs.existsSync(f))return route.fulfill({status:404});return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'});
  });
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));let crashed=false;p.on('crash',()=>crashed=true);
  await p.goto('https://page.test/gateway/gateway-to-the-world-b1/Unit%201/informal-email-classwork/'+(teacher?'?teacher=fixture':''));
  await p.locator('.page-dot').nth(5).click();await p.locator('.cb-card').first().waitFor();
  await p.waitForTimeout(1200);
  const metrics=await p.evaluate(()=>({height:document.querySelector('#scrollArea').scrollHeight,canvases:[...document.querySelectorAll('#wtInk,#wtLaser')].map(c=>({width:c.width,height:c.height})),cards:document.querySelectorAll('.cb-card').length}));
  assert.equal(metrics.cards,9);assert(metrics.height>10000,'exercise includes long collaborative answers');
  for(const c of metrics.canvases){assert(c.width*c.height<=4000000,'backing buffer bounded');assert(c.width<=8192&&c.height<=8192)}
  if(teacher){await p.getByRole('button',{name:'Изменить комментарий'}).first().click();await p.locator('.cb-feedback-editor:visible').fill('Updated comment');await p.getByRole('button',{name:'Сохранить комментарий'}).click();}
  else{await p.locator('.cb-ta').fill('My new answer');await p.waitForTimeout(450);assert.equal(await p.locator('.cb-feedback-text').first().innerText(),'Teacher feedback');}
  await p.locator('.page-dot').nth(0).click();assert(await p.locator('[data-page="0"] .card').first().isVisible());
  await p.locator('.page-dot').nth(5).click();assert(await p.locator('.collab').isVisible());
  assert(!crashed);assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log('PASS: full Informal Email worksheet at phone DPR3/desktop DPR2, nine long answers, bounded ink/laser memory, page navigation, live answer/feedback editing, no renderer crash.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
