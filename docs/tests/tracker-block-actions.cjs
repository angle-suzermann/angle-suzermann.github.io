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
  const page=await ctx.newPage();await page.goto('https://tracker.test/ege-2027/0-homework-tracker/');
  await page.locator('.task-number').first().waitFor();
  assert.deepEqual(await page.locator('.task-number').allTextContents(),['1.','1.'],'each date block starts from one');
  assert.equal(await page.locator('[data-tk]').first().getAttribute('data-tk'),'0|2','display numbering does not change task IDs');
  await page.locator('[data-en]').first().click();
  await page.locator('[data-f="kind"][value="homework"]').check();
  await page.locator('[data-tgroup]').selectOption('__new');
  await page.locator('.tnew [data-calendar-open]').first().click();
  assert.equal(await page.locator('.tracker-calendar').count(),1);
  await page.locator('.tracker-calendar [data-month="1"]').click();
  const chosen=await page.locator('.tracker-calendar [data-day]').first().getAttribute('data-day');
  await page.locator('.tracker-calendar [data-day]').first().click();
  assert.equal(await page.locator('.td').first().inputValue(),chosen);
  await page.locator('[data-tsave]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert.equal(plan.blocks[0].tasks[1].kind,'homework');
  assert.equal(plan.blocks[0].tasks[1].date,chosen);
  await page.reload();await page.locator('[data-en]').first().waitFor();
  assert.match(await page.locator('.blk').innerText(),/HOMEWORK/i);
  writes.length=0;
  await page.locator('[data-block-edit="0"]').click();
  assert.equal(await page.locator('[data-block-form] input[type=date]').count(),3);
  await page.locator('[data-block-form] input[type=date]').nth(0).fill('2026-10-29');
  await page.locator('[data-block-form] input[type=date]').nth(1).fill('2026-10-30');
  await page.locator('[data-block-save="0"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert.equal(writes.length,2);assert(writes.every(w=>w.block==='Block 1'&&w.field==='date'&&w.value==='2026-10-29 · 2026-10-30'));
  assert.equal(plan.blocks[0].tasks[0].status,'✓');assert.equal(plan.blocks[0].tasks[1].points,10);assert.equal(plan.blocks[1].tasks[0].date,'Oct, 22');
  await page.reload();await page.locator('[data-block-delete="0"]').waitFor();
  assert.match(await page.locator('.blk').innerText(),/2026-10-29/);
  // Date picker can display old labels without silently rewriting their stored values.
  await page.locator('[data-tab="b1"]').click();await page.locator('[data-gedit]').first().click();
  assert.equal(await page.locator('.gd').first().getAttribute('type'),'date');
  assert.match(await page.locator('.gd').first().inputValue(),/^\d{4}-10-22$/);
  await page.locator('[data-gsave]').click();assert.equal(writes.length,2,'unchanged legacy date is preserved');
  await page.locator('[data-tab="b0"]').click();
  page.once('dialog',d=>{assert.match(d.message(),/все 2 заданий/);d.dismiss()});
  await page.locator('[data-block-delete="0"]').click();assert.equal(writes.length,2);
  page.once('dialog',d=>d.accept());await page.locator('[data-block-delete="0"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert.equal(writes.filter(w=>w.a==='deleteTask').length,2);assert.equal(plan.blocks.length,1);assert.equal(plan.blocks[0].name,'Block 2');
  await page.reload();await page.locator('.blk').waitFor();assert.match(await page.locator('.blk').innerText(),/Keep this task/);assert.doesNotMatch(await page.locator('.blk').innerText(),/Task A|Task B/);
  await page.locator('[data-addopen]').click();await page.locator('#ntTask').fill('New task C\nNew task D');await page.locator('[data-addtask]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  assert.deepEqual(writes.filter(w=>w.a==='addTask').map(w=>w.task.n),[2,3]);
  assert.deepEqual(await page.locator('.task-number').allTextContents(),['1.','2.','3.']);
  await page.reload();await page.locator('.task-number').first().waitFor();assert.deepEqual(await page.locator('.task-number').allTextContents(),['1.','2.','3.']);
  await page.goto('https://tracker.test/ege-2027/0-homework-tracker/?a=https%3A%2F%2Fsheet.test%2Fexec&p=fixture-parent-key');await page.locator('.blk').waitFor();
  assert.equal(await page.locator('[data-block-edit],[data-block-delete]').count(),0);
  await ctx.close();console.log('PASS: native calendars and two-date batch update; every task updated; marks/points and other blocks preserved; legacy date not rewritten; cancel/confirm whole-block delete persists; automatic task numbering persists; student has no block controls.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
