const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
function fixture(){return {courses:{Movers:{students:[{id:'s1',name:'Test Student',key:'test-parent-key'}],units:[{n:1,title:'First unit',active:true},{n:8,title:'Back in time',active:false},{n:9,title:'Future',active:false}],sections:[{id:'v',name:'Vocabulary',points:5}],phonics:[],extras:[]}},progress:{'Movers|s1|u8|v':'✓','Movers|s1|u9|v':'N/A'},act:[],mee:[]}}
async function main(){
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'});
 try{
  const writes=[],errors=[];
  async function setup(width=1280,parent=false,demo=false){
   const ctx=await browser.newContext({viewport:{width,height:900}});
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='sheet.test'){
     if(route.request().method()==='POST'){writes.push(JSON.parse(route.request().postData()));return route.fulfill({json:{ok:true}})}
     return route.fulfill({json:{ok:true,data:fixture()}});
    }
    if(u.hostname==='tracker.test'){
     if(u.pathname.endsWith('/structure.json'))return route.fulfill({json:{Movers:{units:fixture().courses.Movers.units,sections:fixture().courses.Movers.sections,phonics:[]}}});
     const rel=u.pathname==='/'?'as3/0-homework-tracker/index.html':decodeURIComponent(u.pathname.slice(1));
     const f=path.join(root,rel);
     if(fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'});
    }
    return route.abort();
   });
   await ctx.addInitScript(({parent,demo})=>{
    localStorage.setItem('angleTracker.ui',JSON.stringify({course:'Movers',tab:parent?'u1':'u8',student:'s1'}));
    if(!parent&&!demo)localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/exec',token:'test-token'}));
   },{parent,demo});
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://tracker.test/'+(parent?'?a=https%3A%2F%2Fsheet.test%2Fexec&p=test-parent-key':''));
   await page.locator('#view .card').first().waitFor();return {ctx,page};
  }
  let {ctx,page}=await setup();
  await page.evaluate(()=>{
    D.courses.Movers.students.push({id:'s2',name:'Second Test Student'});
    for(let i=3;i<=12;i++)D.courses.Movers.students.push({id:'s'+i,name:'Test Student '+i});
    render();
  });
  await page.locator('.desktop [data-stud="s2"]').scrollIntoViewIfNeeded();
  const beforeStudentSwitch=await page.evaluate(()=>window.scrollY);
  assert(beforeStudentSwitch>100,'regression must exercise a scrolled page');
  await page.locator('.desktop [data-stud="s2"]').click();
  assert(Math.abs(await page.evaluate(()=>window.scrollY)-beforeStudentSwitch)<2,'switching student preserves vertical scroll');
  assert.equal(await page.locator('.desktop [data-stud="s2"]').getAttribute('class'),'chip on');
  await page.locator('.desktop [data-stud="s1"]').click();
  await page.locator('.desktop [data-act="1"]').click();
  assert.equal(await page.locator('#cardDlg').evaluate(el=>el.open),false,'desktop main-page click stays on main page');
  assert.equal(await page.locator('.desktop [data-act="1"]').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.desktop [data-rating-feedback]').innerText(),/activity 1\/3/);
  await page.locator('.desktop [data-card="s1"]').click();
  assert.match(await page.locator('#cardBody').innerText(),/Unit 8 · Back in time/);
  await page.locator('#cardBody [data-act="3"]').click();
  assert.equal(await page.locator('#cardBody [data-act="3"]').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#cardBody [data-rating-feedback]').innerText(),/activity 3\/3/);
  assert.match(await page.locator('#cardBody').innerText(),/Работает стабильно; оценок: 2/);
  assert.match(await page.locator('#cardBody').innerText(),/Unit 8 · Back in time/);
  if(process.env.TRACKER_SCREENSHOTS)await page.screenshot({path:path.join(process.env.TRACKER_SCREENSHOTS,'tracker-desktop-rating.png')});
  await page.locator('#cardBody [data-ctab="s1|1"]').click();
  await page.locator('#cardBody [data-qual="2"]').click();
  assert.equal(await page.locator('#cardBody').getAttribute('data-unit'),'1');
  assert.equal(await page.locator('#cardBody [data-qual="2"]').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('angleTracker.queue')||'[]').length===0);
  assert.equal(writes.filter(w=>w.a==='addActivity').length,3);
  await ctx.close();
  ({ctx,page}=await setup(390));
  await page.locator('.mobile [data-act="2"]').click();
  assert.equal(await page.locator('#cardDlg').evaluate(el=>el.open),false);
  assert.equal(await page.locator('.mobile [data-act="2"]').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.mobile [data-rating-feedback]').innerText(),/activity 2\/3/);
  await ctx.close();
  ({ctx,page}=await setup(1280,true));
  assert.match(await page.locator('#view').innerText(),/Unit 8 · Back in time/);
  assert.equal(await page.locator('[data-ptab="u9"]').count(),0,'future N/A does not select future unit');
  await page.locator('[data-ptab="u1"]').click();
  assert.match(await page.locator('#view').innerText(),/Unit 1 · First unit/);
  assert.equal(await page.locator('[data-act]').count(),0,'parent view stays read-only');
  await ctx.close();
  ({ctx,page}=await setup(390,false,true));
  await page.locator('.mobile [data-act="3"]').click();
  await page.reload();await page.locator('.mobile [data-act="3"]').waitFor();
  assert.equal(await page.locator('.mobile [data-act="3"]').getAttribute('aria-pressed'),'true','demo ratings persist after reload');
  await ctx.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop activity/quality clicks, visible modal feedback, POST writes, preserved card unit, mobile inline feedback, parent Unit 8 with inactive flag, parent navigation, demo persistence; no browser errors');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
