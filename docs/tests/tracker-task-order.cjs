const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'}),writes=[];
 const plan={id:'ege-test',student:'Demo Student',title:'Demo plan',key:'fixture-parent-key',blocks:[
  {name:'Block 1',tasks:[{n:1,task:'Task A',date:'Oct, 11',kind:'homework',points:5,status:'✓'},{n:2,task:'Task B',date:'Oct, 12',kind:'classwork',points:10,status:'',suggested:'2026-10-27'}]},
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

  const page=await ctx.newPage();
  plan.blocks[0].tasks=[
    {n:1,task:'A',date:'2026-10-28',kind:'homework',points:5,status:'✓',link:'https://example.com/a'},
    {n:2,task:'B',date:'2026-10-28',kind:'classwork',points:10,status:'',note:'Keep note'},
    {n:3,task:'C',date:'2026-10-28',kind:'before',points:5,status:''},
    {n:4,task:'Other date',date:'2026-11-01',kind:'homework',points:5,status:''}
  ];
  await page.goto('https://tracker.test/ege-2027/0-homework-tracker/');
  await page.locator('[data-task-drag]').first().waitFor();
  const names=()=>page.locator('.wgrp').filter({has:page.locator('[data-task-row="0|1"]')}).locator('.tt').allTextContents();
  page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
  await page.locator('[data-task-drag="0|3"]').scrollIntoViewIfNeeded();
  const source=await page.locator('[data-task-drag="0|3"]').boundingBox(),target=await page.locator('[data-task-row="0|1"]').boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
  await page.mouse.move(target.x+10,target.y+4,{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert.deepEqual((await names()).map(x=>x.trim()),['1. C','2. A','3. B']);
  assert.equal(writes.length,1);assert.equal(writes[0].n,3);assert.equal(writes[0].field,'n');
  assert.equal(plan.blocks[0].tasks.find(x=>x.task==='A').status,'✓');
  assert.equal(plan.blocks[0].tasks.find(x=>x.task==='B').note,'Keep note');
  assert.equal(plan.blocks[0].tasks.find(x=>x.task==='Other date').date,'2026-11-01');
  plan.blocks[0].tasks.sort((a,b)=>a.n-b.n);
  await page.reload();await page.locator('[data-task-drag]').first().waitFor();
  assert.deepEqual((await names()).map(x=>x.trim()),['1. C','2. A','3. B']);
  await page.locator('.wgrp').filter({has:page.locator('[data-task-row="0|1"]')}).locator('[data-task-drag]').first().focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert.deepEqual((await names()).map(x=>x.trim()),['1. A','2. C','3. B']);
  // Touch Pointer Events use the same captured handle; cancellation writes nothing.
  const handle=page.locator('[data-task-drag="0|2"]');
  const h=await handle.boundingBox(),a=await page.locator('[data-task-row="0|1"]').boundingBox();
  await handle.evaluate(el=>el.setPointerCapture=()=>{});
  await handle.dispatchEvent('pointerdown',{pointerId:9,pointerType:'touch',button:0,clientX:h.x+10,clientY:h.y+10});
  await page.dispatchEvent('body','pointermove',{pointerId:9,pointerType:'touch',clientX:a.x+10,clientY:a.y+2});
  await page.dispatchEvent('body','pointerup',{pointerId:9,pointerType:'touch'});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert.deepEqual((await names()).map(x=>x.trim()),['1. B','2. A','3. C']);
  await page.goto('https://tracker.test/ege-2027/0-homework-tracker/?a=https%3A%2F%2Fsheet.test%2Fexec&p=fixture-parent-key');await page.locator('.blk').waitFor();
  assert.equal(await page.locator('[data-task-drag]').count(),0);
  console.log('PASS: pointer drag, keyboard reorder, touch pointer reorder, persisted server rank, task fields preserved, date group unchanged, students cannot reorder.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
