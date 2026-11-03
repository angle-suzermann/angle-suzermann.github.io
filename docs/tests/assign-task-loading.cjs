const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
 const c=await b.newContext({viewport:{width:390,height:844}});let reads=0,worksheet=0,sent;
 await c.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='sheet.test'){if(route.request().method()==='POST'){sent=JSON.parse(route.request().postData());return route.fulfill({json:{ok:true}})}reads++;await new Promise(r=>setTimeout(r,100));return route.fulfill({json:{ok:true,data:u.searchParams.get('view')==='plans'?{plans:[{id:'gwb2-lena',student:'Demo pupil',title:'B2',key:'PRIVATE_KEY',blocks:['PRIVATE_TASK']}]}:{courses:{B1:{students:[{id:'s1',name:'Demo pupil',group:'Dolphins',key:'PRIVATE_KEY'}]}},reports:['PRIVATE_REPORT']}}})}
 if(u.pathname==='/worksheet/'){worksheet++;return route.fulfill({body:'<h1>Demo worksheet</h1>'})}
 if(u.pathname==='/assign.js')return route.fulfill({body:fs.readFileSync('assets/assign-task.js'),contentType:'application/javascript'});
 return route.fulfill({body:'<meta charset="utf-8"><button data-assign-url="/worksheet/" data-assign-title="Demo" data-assign-course="B1">Assign</button><script>window.AngleAssignmentParts={describe(){return {pages:[{token:"p1",label:"Page 1"}],exercises:[]}}}</script><script src="/assign.js"></script>',contentType:'text/html'});
 });
 await c.addInitScript(()=>localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/exec',token:'fixture'})));
 const p=await c.newPage();await p.goto('https://assignment.test/');await p.getByRole('button',{name:'Assign',exact:true}).click();await p.locator('#assign-course').waitFor();assert.equal(reads,2);assert.equal(worksheet,0,'whole worksheet no longer waits for HTML');
 assert.equal(await p.locator('.assign-pupils:not(.assign-parts) input').count(),1);
 await p.locator('[data-close]').click();await p.getByRole('button',{name:'Assign',exact:true}).click();await p.locator('#assign-course').waitFor();assert.equal(reads,2,'reopen reuses roster');
 await p.locator('#assign-scope').selectOption('pages');await p.getByText('Page 1',{exact:true}).waitFor();assert.equal(worksheet,1);await p.locator('#assign-scope').selectOption('whole');await p.locator('#assign-scope').selectOption('pages');assert.equal(worksheet,1,'parts reused inside same form');
 await p.locator('.assign-parts input').check();await p.locator('#assign-scope').selectOption('whole');await p.locator('.assign-pupils:not(.assign-parts) input').check();await p.locator('#assign-date').fill('2026-11-05');await p.locator('[data-submit]').click();await p.waitForFunction(()=>document.querySelector('.assign-status').textContent.startsWith('Назначено:'));assert.equal(sent.url,'https://assignment.test/worksheet/');assert.equal(sent.title,'Demo');
 await p.reload();await p.getByRole('button',{name:'Assign',exact:true}).click();await p.locator('#assign-course').waitFor();assert.equal(reads,2,'navigation reuses session roster');
 const cache=await p.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('angleAssignment.roster.')));assert.equal(cache.length,1);assert(!cache[0][1].includes('PRIVATE_'));assert(!cache[0][1].includes('fixture'),'raw credentials not persisted in roster');
 await p.evaluate(()=>{for(const k of Object.keys(sessionStorage))if(k.startsWith('angleAssignment.roster.')){const v=JSON.parse(sessionStorage[k]);v.at=Date.now()-360000;sessionStorage[k]=JSON.stringify(v)}});await p.reload();await p.getByRole('button',{name:'Assign',exact:true}).click();await p.locator('#assign-course').waitFor();assert.equal(reads,4,'expired roster refreshed');
 await p.locator('.angle-assign').screenshot({path:path.join(process.env.TEMP,'angle-assignment-fast.png')});
 console.log('PASS: roster reused across reopen/navigation; five-minute expiry; minimal private-safe cache; worksheet pages loaded lazily; no repeated parts requests');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

