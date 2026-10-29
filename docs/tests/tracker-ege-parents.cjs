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
    return route.fulfill({json:{ok:true,data:{plans:u.searchParams.has('p')?plans.filter(p=>p.key===u.searchParams.get('p')):plans,reports:[{plan:"ege-test-one",date:"2026-10-29",source:"Отчёт для родителей — Demo one — 07–29.10.2026.pdf",text:"Private fixture"}]}}});
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
  const shared=new URL(await page.locator('#cardBody [data-share-url]').getAttribute('data-share-url'));
  assert.equal(shared.searchParams.get('p'),plans[0].key);
  assert.equal(shared.searchParams.get('parent'),'1');
  assert.deepEqual([...shared.searchParams.keys()].sort(),['a','p','parent']);
  await page.locator('#cardBody [data-parent-link]').click();
  await page.waitForFunction(()=>document.querySelector('#cardBody [data-parent-link]').textContent.includes('Скопировано'));
  const link=await page.evaluate(()=>navigator.clipboard.readText());
  assert.equal(new URL(link).searchParams.get('parent'),'1');assert.equal(new URL(link).searchParams.get('p'),plans[0].key);
  await page.goto(link);await page.locator('[data-report-pdf]').waitFor();
  assert.match(await page.locator('#view').innerText(),/Demo one/);assert.doesNotMatch(await page.locator('#view').innerText(),/Demo two/);
  const title='Отчёт для родителей — Demo one — 07–29.10.2026';
  assert.equal(await page.locator('.report-title').innerText(),title);
  assert.equal(await page.locator('.report-title').getAttribute('href'),link);
  await page.getByRole('button',{name:'Поделиться',exact:true}).click();
  assert.equal(await page.locator('.share-material').innerText(),title);
  await page.locator('[data-rich-copy]').click();
  await page.waitForFunction(()=>document.querySelector('.share-status').textContent.includes('скопировано'));
  const html=await page.evaluate(async()=>{const items=await navigator.clipboard.read();return (await items[0].getType('text/html')).text()});
  assert(html.includes(title));assert(html.includes('href="'+link.replace(/&/g,'&amp;')+'"'));
  assert(!html.includes('token=')&&!html.includes('fixture%22'));
  await page.locator('[data-share-close]').click();
  assert.equal(await page.locator('[data-tk],[data-addtask],[data-parent-card]').count(),0);
  assert.equal(await page.locator('#tabs button').count(),0);
  assert.equal(writes.length,0,'parent view never flushes the student mutation queue');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(link.replace(plans[0].key,plans[1].key));await page.locator('[data-report-pdf]').waitFor();
  assert.match(await page.locator('#view').innerText(),/Demo two/);assert.doesNotMatch(await page.locator('#view').innerText(),/Demo one/);
  assert.equal(await page.getByRole('button',{name:'Поделиться',exact:true}).count(),0);
  assert.deepEqual(errors,[]);await ctx.close();
  console.log('PASS: EGE teacher parent-card preview and copied parent link; one child only; real progress; report title and rich clipboard link; read-only UI and no queued writes; mobile layout; no JS errors.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
