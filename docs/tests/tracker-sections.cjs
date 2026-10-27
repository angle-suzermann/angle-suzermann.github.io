const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd(),structure=JSON.parse(fs.readFileSync('assets/tracker/structure.json','utf8'));
function fixture(){
 const courses={};
 for(const course of ['Starters','Movers','Flyers','B1']){
  const sections=structure[course].sections.filter(s=>!['revision','grammar-time','think-about-it'].includes(s.id)).map(s=>({...s}));
  if(course!=='B1'){
   sections.find(s=>s.id==='sec3').name='Reading and Pronunciation';
   sections.find(s=>s.id==='sec12').name='Revision Test';
   sections.find(s=>s.id==='sec5').name='More Grammar';
   sections.find(s=>s.id==='sec7').name='More Language in Use';
  }
  courses[course]={students:[{id:'s1',name:'Demo Student'}],sections,units:[{n:1,title:'First unit',active:true}],phonics:[],extras:[]};
 }
 return {courses,progress:Object.fromEntries(['Starters','Movers','Flyers'].map(c=>[c+'|s1|u1|sec12','✓'])),act:[],mee:[]};
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'});
 const errors=[];
 try{
  for(const [course,slug] of [['Starters','as2'],['Movers','as3'],['Flyers','as5']]){
   const writes=[],ctx=await browser.newContext({viewport:{width:1280,height:900}});
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='sheet.test'){
     if(route.request().method()==='POST'){writes.push(JSON.parse(route.request().postData()));return route.fulfill({json:{ok:true}})}
     return route.fulfill({json:{ok:true,data:fixture()}});
    }
    if(u.hostname==='tracker.test'){
     const f=path.join(root,decodeURIComponent(u.pathname.slice(1)));
     if(fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':f.endsWith('.html')?'text/html':'application/octet-stream'});
    }
    return route.abort();
   });
   await ctx.addInitScript(course=>{
    localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/exec',token:'fixture'}));
    localStorage.setItem('angleTracker.ui',JSON.stringify({course,tab:'u1',student:'s1'}));
   },course);
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`https://tracker.test/${slug}/0-homework-tracker/index.html`);
   await page.locator('.desktop table').waitFor();
   const headers=await page.locator('.desktop thead').innerText();
   assert.match(headers,/Revision/);assert.match(headers,/Unit test/);assert.doesNotMatch(headers,/Revision Test/);
   assert.match(headers,/More Grammar/);assert.match(headers,/More Language in Use/);assert.match(headers,/Extra/);
   assert.match(headers,course==='Starters'?/Sounds and letters/:/Reading comprehension/);
   if(course==='Starters'){assert.match(headers,/Grammar time/);assert.match(headers,/Grammar focus/)}
   else assert.match(headers,/Think about it!/);
   const testDot=page.locator('.desktop .dot[data-t$="sec12\u0001u"]');
   assert.equal(await testDot.getAttribute('aria-label'),'✓','old test tick survives');
   await page.locator('.desktop .dot[data-t$="revision\u0001u"]').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.queue')||'[]').length===0);
   assert.equal(writes.length,1);assert.equal(writes[0].item,'revision');assert.equal(writes[0].status,'✓');
   assert.equal(await testDot.getAttribute('aria-label'),'✓','Revision write leaves Unit test intact');
   await page.goto(`https://tracker.test/${slug}/0-homework-tracker/index.html?a=https%3A%2F%2Fsheet.test%2Fexec&p=fixture-parent`);
   await page.locator('#view .card').first().waitFor();
   const parentText=await page.locator('#view').innerText();
   assert.match(parentText,/Повторение/);assert.match(parentText,/Тест по юниту/);
   await ctx.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: AS2/3/5 textbook headings in live and parent views; protected extras; existing test ticks; independent Revision writes; no browser errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
