const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'});
 try{
  for(const width of [390,1280])for(const slug of ['k-classifier-38','k-classifier-38-hw']){
   const ctx=await browser.newContext({viewport:{width,height:900}}),errors=[];
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());if(u.hostname!=='reference.test')return route.abort();
    const f=path.join(root,decodeURIComponent(u.pathname.slice(1)));
    if(fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.webp')?'image/webp':f.endsWith('.woff2')?'font/woff2':f.endsWith('.pdf')?'application/pdf':'application/octet-stream'});
    return route.fulfill({status:404});
   });
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://reference.test/ege-2027/Тренажеры/Тренажер 38/'+slug+'/index.html');
   const launch=page.getByRole('button',{name:'Справка К1–К5',exact:true});await launch.waitFor();
   assert.equal(await page.locator('#pageDots .page-dot').count(),7,'reference does not alter exercise navigation/progress');
   await page.locator('#pageDots .page-dot').nth(1).click();
   await page.locator('.page.active .kchip[data-k=K1]').first().click();
   await page.waitForFunction(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('angle_progress::')).some(([,v])=>Object.values(JSON.parse(v).ans||{}).some(a=>a.includes('K1'))));
   const before=await page.locator('.page.active').getAttribute('id');
   const selected=await page.locator('.page.active .kchip.sel').count();
   const answers=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('angle_progress::')).map(([k,v])=>[k,JSON.parse(v).ans])));
   await launch.click();assert.equal(await page.locator('#task38Reference').evaluate(d=>d.open),true);
   assert.equal(await page.locator('#ref38Panel0 article').count(),5);
   await page.getByRole('tab',{name:'Кодификатор ФИПИ',exact:true}).click();
   assert.equal(await page.locator('#ref38Panel1 img').count(),5);
   await page.locator('#ref38Panel1 img').first().evaluate(img=>img.decode());
   assert.match(await page.locator('#ref38Panel1 a').first().getAttribute('href'),/fipi-codifier-2027\.pdf$/);
   await page.getByRole('tab',{name:'Критерии оценивания',exact:true}).click();
   assert.equal(await page.locator('#ref38Panel2 img').count(),3);
   await page.locator('#ref38Panel2 img').first().evaluate(img=>img.decode());
   assert.match(await page.locator('#ref38Panel2 a').first().getAttribute('href'),/fipi-task38-criteria-2027\.pdf$/);
   assert.match(await page.locator('.ref38-source').innerText(),/проекты/);
   assert(await page.locator('#task38Reference').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'reference fits viewport');
   if(process.env.REFERENCE_SCREENSHOTS&&slug==='k-classifier-38')await page.screenshot({path:path.join(process.env.REFERENCE_SCREENSHOTS,'reference-'+width+'.png')});
   await page.getByRole('tab',{name:'Критерии оценивания',exact:true}).press('ArrowLeft');
   assert.equal(await page.getByRole('tab',{name:'Кодификатор ФИПИ',exact:true}).getAttribute('aria-selected'),'true');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#task38Reference').evaluate(d=>d.open),false);
   assert.equal(await page.locator('.page.active').getAttribute('id'),before);assert.equal(await page.locator('.page.active .kchip.sel').count(),selected);
   assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('angle_progress::')).map(([k,v])=>[k,JSON.parse(v).ans]))),answers);
   assert.deepEqual(errors,[]);await ctx.close();
  }
  console.log('PASS: Classwork/Homework reference on mobile/desktop; K1–K5 guide, original codifier/criteria images and PDFs; project labels; keyboard navigation and Escape; exercise page, answers and progress preserved.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
