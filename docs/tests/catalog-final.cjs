const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(process.cwd(),'_site');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'});
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:900}});
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());if(u.hostname!=='catalog.test')return route.abort();
    const f=path.join(root,decodeURIComponent(u.pathname.slice(1)),u.pathname.endsWith('/')?'index.html':'');
    if(fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'});
    return route.fulfill({status:404});
   });
   const page=await ctx.newPage();await page.goto('https://catalog.test/staff-7fk2q9/');
   assert.equal(await page.locator('.staff-card .meta').count(),0,'technical row removed from file cards');
   const classifiers=page.locator('.staff-card[data-title*="классификатор ошибок"]');
   assert.equal(await classifiers.count(),2);assert.equal(await classifiers.filter({hasText:'Classwork'}).count(),1);assert.equal(await classifiers.filter({hasText:'Homework'}).count(),1);for(const c of await classifiers.all())assert.equal(await c.getAttribute('data-status'),'published');
   const links=await page.locator('#staffList .staff-card:not(.personal-card) a.open').evaluateAll(as=>as.slice(0,5).map(a=>a.href));
   await page.evaluate(links=>localStorage.setItem('angle.staff.recent.v1',JSON.stringify(links)),links);await page.reload();
   assert.equal(await page.locator('#recentList a.tile').count(),5);
   const tile=await page.locator('#recentList a').first().boundingBox();assert(tile.width<250,'recent items are compact tiles');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await ctx.close();
  }
  console.log('PASS: technical metadata hidden; two classifiers published; compact recent folder-style tiles; mobile and desktop fit.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
