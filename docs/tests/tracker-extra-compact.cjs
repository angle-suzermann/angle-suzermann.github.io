const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  const data={courses:{Flyers:{students:[{id:'s1',name:'Demo A'},{id:'s2',name:'Demo B'},{id:'s3',name:'Demo C'}],units:[],sections:[],phonics:[],extras:[]}},progress:{},act:[],mee:[],reports:[]},writes=[];
  await ctx.addInitScript(()=>{localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/exec',token:'fixture'}));localStorage.setItem('angleTracker.ui',JSON.stringify({course:'Flyers',tab:'ex',student:null}))});
  await ctx.route('**/*',route=>{
   if(new URL(route.request().url()).hostname==='sheet.test'){
    if(route.request().method()==='POST'){const op=JSON.parse(route.request().postData());writes.push(op);if(op.a==='addExtra')data.courses.Flyers.extras.push(op.extra);else if(op.a==='updateExtra')data.courses.Flyers.extras.find(x=>x.id===op.id)[op.field]=op.value;else throw new Error('Unexpected '+op.a);return route.fulfill({json:{ok:true}})}
    return route.fulfill({json:{ok:true,data}});
   }
   const u=new URL(route.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname.slice(1)),u.pathname.endsWith('/')?'index.html':'');
   if(u.hostname==='tracker.test'&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.json')?'application/json':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'});
   return route.abort();
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://tracker.test/as5/0-homework-tracker/');await page.locator('[data-tab="ex"]').click();
  await page.locator('#addExtra').click();
  await page.locator('[data-xf="topic"]').fill('Unit 1 — Classwork');
  await page.locator('[data-xf="link"]').fill('https://example.com/classwork');
  await page.locator('[data-xf="points"]').fill('10');
  await page.locator('[data-xf="note"]').fill('Remember this');
  await page.locator('[data-extra-save]').click();
  assert.equal(await page.locator('[data-xf]').count(),0);
  assert.equal(await page.locator('.extra-compact a').getAttribute('href'),'https://example.com/classwork');
  assert.match(await page.locator('.extra-compact').innerText(),/10 pts/);
  assert.equal(await page.locator('.xstud .xs').count(),3);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.queue')||'[]').length===0);
  assert.equal(data.courses.Flyers.extras[0].topic,'Unit 1 — Classwork');
  assert.equal(data.courses.Flyers.extras[0].points,10);
  await page.reload();await page.locator('[data-extra-edit]').waitFor();
  assert.equal(await page.locator('[data-xf]').count(),0);
  await page.locator('[data-extra-edit]').click();
  assert.equal(await page.locator('[data-xf="topic"]').inputValue(),'Unit 1 — Classwork');
  await page.locator('[data-xf="topic"]').fill('Unit 1 — Homework');
  await page.locator('[data-extra-save]').click();
  assert.match(await page.locator('.extra-compact').innerText(),/Homework/);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.queue')||'[]').length===0);
  assert.equal(data.courses.Flyers.extras.length,1);assert.equal(data.courses.Flyers.extras[0].topic,'Unit 1 — Homework');
  assert.equal(await page.locator('.xcard').count(),1);assert.deepEqual(errors,[]);
  await ctx.close();
 }
 console.log('PASS: Extra Save collapses fields, title/link/points/note retained, student marks remain, Edit and reload, mobile/desktop no overflow.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
