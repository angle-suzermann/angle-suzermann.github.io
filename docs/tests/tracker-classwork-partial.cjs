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


  plan.blocks=[{name:'Block 1',tasks:[{n:1,task:'Classwork task',kind:'classwork',date:'2026-10-30',points:5,status:'',note:'Worksheet 80% (4/5)'},{n:2,task:'Homework task',kind:'homework',date:'2026-10-30',points:5,status:''}]}];
  const page=await ctx.newPage();await page.goto('https://tracker.test/ege-2027/0-homework-tracker/');await page.locator('[data-tk="0|1"]').waitFor();
  const flush=()=>page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.iqueue')||'[]').length===0);
  await page.locator('[data-tk="0|1"]').click();await flush();assert.equal(plan.blocks[0].tasks[0].status,'In progress');
  assert.equal(await page.locator('[data-tk="0|1"]').innerText(),'◐');assert.match(await page.locator('.tag.partial').innerText(),/Начато/);assert.match(await page.locator('.blk .unit-head .sub').innerText(),/0 of 10 points/);
  assert(!(await page.locator('[data-tk="0|1"]').getAttribute('class')).includes(' pr'),'partial icon is not hidden by worksheet score ring');
  await page.reload();await page.locator('.st.partial[data-tk="0|1"]').waitFor();
  await page.locator('[data-tk="0|1"]').click();await flush();assert.equal(plan.blocks[0].tasks[0].status,'✓');assert.match(await page.locator('.blk .unit-head .sub').innerText(),/5 of 10 points/);
  await page.locator('[data-tk="0|1"]').click();await flush();assert.equal(plan.blocks[0].tasks[0].status,'N/A');await page.locator('[data-tk="0|1"]').click();await flush();assert.equal(plan.blocks[0].tasks[0].status,'');
  await page.locator('[data-tk="0|2"]').click();await flush();assert.equal(plan.blocks[0].tasks[1].status,'✓','homework keeps original cycle');
  await page.locator('[data-tk="0|1"]').click();await flush();
  await page.goto('https://tracker.test/ege-2027/0-homework-tracker/?a=https%3A%2F%2Fsheet.test%2Fexec&p=fixture-parent-key');await page.locator('button.st.partial').waitFor();assert.match(await page.locator('.tag.partial').innerText(),/Начато/);
  console.log('PASS: Classwork empty→partial→confirmed→not assigned→empty, persisted reload, visible to student, incomplete earns zero points, score ring cannot obscure partial icon; homework unchanged.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
