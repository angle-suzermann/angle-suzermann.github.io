const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const crypto=require('node:crypto');
const original=Buffer.from('%PDF-1.4\noriginal-pdf-fixture-bytes\n%%EOF');
function encryptReport(r){
 const material=JSON.stringify(['ANGLE original parent PDF v1',r.date,r.source,r.text]);
 const key=crypto.createHash('sha256').update(material).digest(),iv=crypto.randomBytes(12);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const name=crypto.createHash('sha256').update('ANGLE original PDF location v1\0'+key.toString('hex')).digest('hex');
 return [name+'.bin',Buffer.concat([iv,cipher.update(original),cipher.final(),cipher.getAuthTag()])];
}
const root=process.cwd(),output=process.env.TRACKER_REPORT_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'angle-parent-'));
fs.mkdirSync(output,{recursive:true});
function fixture(){return {
 courses:{Movers:{students:[{id:'s1',name:'Демо Ученик А'},{id:'s2',name:'Демо Ученик Б'}],units:[{n:1,title:'At school',active:true}],sections:[{id:'sec1',name:'Vocabulary',points:5}],phonics:[],extras:[]}},
 progress:{'Movers|s1|u1|sec1':'✓'},act:[],mee:[],
 reports:[{course:'Movers',studentId:'s1',plan:'',date:'2026-10-24',source:'Отчёт — Демо Ученик А.pdf',text:'Что получается\nУченик уверенно выполняет знакомые задания.'},
  {course:'Movers',studentId:'s2',plan:'',date:'2026-10-25',text:'OTHER_CHILD_PRIVATE_SENTINEL'},
  {course:'B1',studentId:'s1',plan:'',date:'2026-10-25',text:'OTHER_COURSE_PRIVATE_SENTINEL'},
  {plan:'plan-a',course:'',studentId:'',date:'2026-10-16',source:'Индивидуальный отчёт.pdf',text:'Комментарий к индивидуальному плану.'}],
 plans:[{id:'plan-a',student:'Демо Ученик А',title:'Demo course',key:'',blocks:[{name:'Block 1',tasks:[{n:1,task:'Demo task',kind:'homework',points:5,status:'✓'}]}]}]
};}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'}),errors=[],writes=[];
 const encrypted=new Map(fixture().reports.filter(r=>r.source).map(encryptReport));
 try{
  async function setup(parent,individual=false){
   const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='sheet.test'){
     if(route.request().method()==='POST'){writes.push(JSON.parse(route.request().postData()));return route.fulfill({json:{ok:true}})}
     return route.fulfill({json:{ok:true,data:fixture()}});
    }
    if(u.hostname==='tracker.test'){
     if(u.pathname.includes('/report-files/'))return encrypted.has(path.basename(u.pathname))?route.fulfill({body:encrypted.get(path.basename(u.pathname)),contentType:'application/octet-stream'}):route.fulfill({status:404});
     const f=path.join(root,decodeURIComponent(u.pathname.slice(1)));
     if(fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':f.endsWith('.woff2')?'font/woff2':f.endsWith('.html')?'text/html':'application/octet-stream'});
    }
    return route.abort();
   });
   await ctx.addInitScript(({parent})=>{
    if(!parent)localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/exec',token:'fixture-only'}));
    localStorage.setItem('angleTracker.ui',JSON.stringify({course:'Movers',tab:'u1',student:'s1'}));
   },{parent});
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   const location=individual?'ege-2027':'as3';
   await page.goto(`https://tracker.test/${location}/0-homework-tracker/index.html`+(parent?'?a=https%3A%2F%2Fsheet.test%2Fexec&p=fixture-parent':''));
   if(individual&&!parent)throw new Error('Use a parent individual fixture');
   await page.locator('#view .card').first().waitFor();
   return {ctx,page};
  }
  let {ctx,page}=await setup(true);
  assert.match(await page.locator('#view').innerText(),/Сдано заданий/);
  assert.equal(await page.locator('.report-comment,.report-date,[data-report-editor]').count(),0,'full report does not appear on the page');
  assert.doesNotMatch(await page.locator('#view').innerText(),/Ученик уверенно/);
  assert.doesNotMatch(await page.locator('#view').innerText(),/OTHER_CHILD|OTHER_COURSE/);
  assert.equal(await page.locator('[data-report-save]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'report fits mobile viewport');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Скачать отчёт PDF'}).click();
  const download=await pending;assert.match(download.suggestedFilename(),/Демо Ученик А/);
  await download.saveAs(path.join(output,'parent-report.pdf'));
  assert.deepEqual(fs.readFileSync(path.join(output,'parent-report.pdf')),original,'download is the exact original bytes, not a regenerated report');
  await page.screenshot({path:path.join(output,'parent-card-mobile.png'),fullPage:true});
  await ctx.close();
  ({ctx,page}=await setup(false));
  await page.locator('.mobile [data-card="s1"]').click();
  assert.equal(await page.locator('#cardBody [data-report-editor]').count(),0);
  assert.equal(await page.locator('#cardBody [data-report-pdf]').count(),1);
  assert.deepEqual(writes,[],'opening a card never rewrites the source report');
  await ctx.close();
  ({ctx,page}=await setup(true,true));
  assert.equal(await page.locator('.report-comment').count(),0);
  assert.doesNotMatch(await page.locator('#view').innerText(),/OTHER_CHILD|OTHER_COURSE|Ученик уверенно/);
  const individualPending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Скачать отчёт PDF'}).click();
  const individualDownload=await individualPending;
  assert.equal(individualDownload.suggestedFilename(),'Индивидуальный отчёт.pdf');
  await individualDownload.saveAs(path.join(output,'individual-report.pdf'));
  assert.deepEqual(fs.readFileSync(path.join(output,'individual-report.pdf')),original);
  await ctx.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: compact Russian parent card; no full report/editor; exact original PDF bytes for group and individual; course/child/plan isolation; mobile layout; no writes or browser errors. Output: '+output);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
