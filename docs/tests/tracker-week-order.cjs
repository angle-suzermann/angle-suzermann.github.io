const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'}),writes=[];
 const plan={id:'ege-test',student:'Demo Student',title:'Demo plan',key:'fixture-parent-key',blocks:[
  {name:'Block 1',tasks:[{n:1,task:'1. Task A',date:'Oct, 11',kind:'homework',points:5,status:'✓'},{n:2,task:'2. Task B',date:'Oct, 12',kind:'classwork',points:10,status:'',suggested:'2026-10-27'}]},
  {name:'Block 2',tasks:[{n:1,task:'Keep this task',date:'Oct, 22',kind:'homework',points:5,status:'✓'}]}
 ]};
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:900}});
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='sheet.test'){
    if(route.request().method()==='POST'){
     const op=JSON.parse(route.request().postData());writes.push(op);
     const b=plan.blocks.find(b=>b.name===op.block),t=b?.tasks.find(t=>t.n===op.n);
     if(op.a==='setTask'){assert(t);t[op.field]=op.value}
     else if(op.a==='addTask'){assert(b);b.tasks.push(op.task)}
     else if(op.a==='deleteTask'){assert(t);b.tasks=b.tasks.filter(x=>x!==t);if(!b.tasks.length)plan.blocks=plan.blocks.filter(x=>x!==b)}
     else throw new Error('Unexpected write '+op.a);
     return route.fulfill({json:{ok:true}});
    }
    return route.fulfill({json:{ok:true,data:{plans:[plan],reports:[]}}});
   }
   if(u.hostname==='tracker.test'){
    const f=path.join(root,decodeURIComponent(u.pathname.slice(1)),u.pathname.endsWith('/')?'index.html':'');
    if(fs.existsSync(f)&&fs.statSync(f).isFile()){
     let body=fs.readFileSync(f);if(f.endsWith('.html'))body=Buffer.from(body.toString().replace(/window.TRACKER_PLANS=\[[^\]]*\]/,'window.TRACKER_PLANS=["ege-test"]').replace(/window.TRACKER_DATES=\{[^}]*\}/,'window.TRACKER_DATES=3'));
     return route.fulfill({body,contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'});
    }
   }
   return route.abort();
  });
  await ctx.addInitScript(()=>{
   localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/exec',token:'fixture'}));
   localStorage.setItem('angleTracker.iui2',JSON.stringify({plan:'ege-test',tab:'b0',review:false}));
  });
  plan.blocks[0].tasks=['2026-11-16','2026-11-11','2026-11-23','2026-11-04'].map((date,i)=>({n:i+1,task:'Task '+(i+1),date,kind:'homework',points:5,status:''}));
  const page=await ctx.newPage();await page.goto('https://tracker.test/ege-2027/0-homework-tracker/');
  await page.locator('[data-task-date]').first().waitFor();
  const dates=()=>page.locator('.wgrp .dchip').allTextContents();
  assert.deepEqual(await dates(),['November, 23','November, 16','November, 11','November, 4']);
  await page.locator('[data-task-date="0|2"]').click();
  assert.equal(await page.locator('dialog[open] input').count(),1);await page.locator('#moveTaskDate').fill('2026-11-30');await page.locator('dialog[open] button[type=submit]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert(writes.length>0&&writes.every(w=>w.n===2),'only selected task changes');
  assert.deepEqual(await dates(),['November, 30','November, 23','November, 16','November, 4']);
  await page.reload();await page.locator('[data-task-date]').first().waitFor();
  assert.deepEqual(await dates(),['November, 30','November, 23','November, 16','November, 4']);
  for(const width of [390,1100]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');}
  assert.equal(plan.blocks[0].tasks[0].date,'2026-11-16');assert.equal(plan.blocks[0].tasks[2].date,'2026-11-23');
  await ctx.close();console.log('PASS: chronological groups on mobile/desktop; moving one task reorders groups; reload preserves order; neighbours unchanged.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
