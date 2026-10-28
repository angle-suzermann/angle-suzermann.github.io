const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
const plans=['one','two'].map((s,i)=>({id:'ege-test-'+s,student:'Demo '+s,title:'ЕГЭ 2027',key:'parent-fixture-key-'+s,blocks:[{name:'Block 1',tasks:[{n:1,task:'Reading',kind:'homework',points:5,status:'✓'},{n:2,task:'Writing',kind:'homework',points:5,status:'',suggested:'2026-10-27'}]}]}));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'}),writes=[],errors=[];
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='sheet.test'){
    if(route.request().method()==='POST'){writes.push(JSON.parse(route.request().postData()));return route.fulfill({json:{ok:true}})}
    return route.fulfill({json:{ok:true,data:{plans:u.searchParams.has('p')?plans.filter(p=>p.key===u.searchParams.get('p')):plans,reports:[]}}});
   }
   if(u.hostname==='tracker.test'){
    const f=path.join(root,decodeURIComponent(u.pathname.slice(1)),u.pathname.endsWith('/')?'index.html':'');
    if(fs.existsSync(f)&&fs.statSync(f).isFile()){
     let body=fs.readFileSync(f);if(f.endsWith('.html'))body=Buffer.from(body.toString().replace(/window.TRACKER_PLANS=\[[^\]]*\]/,'window.TRACKER_PLANS=["ege-test-one","ege-test-two"]'));
     return route.fulfill({body,contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'});
    }
   }
   return route.abort();
  });
  await ctx.addInitScript(()=>{
   localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/exec',token:'fixture'}));
   localStorage.setItem('angleTracker.iqueueS',JSON.stringify([{a:'suggest',plan:'old-fixture',block:'Block 1',n:1,value:'2026-10-27'}]));
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://tracker.test/ege-2027/0-homework-tracker/');
  await page.getByRole('button',{name:'Карточка для родителей',exact:true}).click();
  assert.match(await page.locator('#cardBody').innerText(),/Demo one/);
  assert.match(await page.locator('#cardBody').innerText(),/50%/);
  await page.locator('#cardBody [data-parent-link]').click();
  await page.waitForFunction(()=>document.querySelector('#cardBody [data-parent-link]').textContent.includes('Скопировано'));
  const link=await page.evaluate(()=>navigator.clipboard.readText());
  assert.equal(new URL(link).searchParams.get('parent'),'1');assert.equal(new URL(link).searchParams.get('p'),plans[0].key);
  await page.goto(link);await page.locator('[data-report-pdf]').waitFor();
  assert.match(await page.locator('#view').innerText(),/Demo one/);assert.doesNotMatch(await page.locator('#view').innerText(),/Demo two/);
  assert.match(await page.locator('.report-feedback').innerText(),/Отчёт пока не добавлен/);
  assert.equal(await page.locator('[data-tk],[data-addtask],[data-parent-card]').count(),0);
  assert.equal(await page.locator('#tabs button').count(),0);
  assert.equal(writes.length,0,'parent view never flushes the student mutation queue');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('button',{name:'Скачать отчёт PDF'}).click();
  assert.match(await page.locator('.report-feedback').innerText(),/пока не добавлен/);
  await page.goto(link.replace(plans[0].key,plans[1].key));await page.locator('[data-report-pdf]').waitFor();
  assert.match(await page.locator('#view').innerText(),/Demo two/);assert.doesNotMatch(await page.locator('#view').innerText(),/Demo one/);
  assert.deepEqual(errors,[]);await ctx.close();
  console.log('PASS: EGE teacher parent-card preview and copied parent link; one child only; real progress; report placeholder; read-only UI and no queued writes; mobile layout; no JS errors.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
