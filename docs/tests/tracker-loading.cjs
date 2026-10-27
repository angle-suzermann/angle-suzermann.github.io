const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd();
function fixture(fresh=false){return {
 courses:{Movers:{students:[{id:'s1',name:fresh?'Fresh Student':'Cached Student'}],units:[{n:1,title:'First',active:true}],sections:[{id:'sec1',name:'Vocabulary',points:5}],phonics:[],extras:[]}},progress:{},act:[],mee:[],reports:[],
 plans:[{id:'ege-ulyana',student:'Test Student',title:'Test plan',blocks:[{name:'Block 1',tasks:[{n:1,task:fresh?'Fresh task':'Cached task',points:5,status:'',kind:'homework'}]}]}]
};}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const individual of [false,true]){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let mode='first',release,gate,writes=0;
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='sheet.test'){
    if(route.request().method()==='POST'){writes++;return route.fulfill({json:{ok:true}});}
    if(mode==='offline')return route.abort();
    if(mode==='hold')await gate;
    return route.fulfill({json:{ok:true,data:fixture(mode!=='first')}});
   }
   if(u.hostname!=='tracker.test')return route.abort();
   let f=path.join(root,decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))f=path.join(f,'index.html');
   if(!fs.existsSync(f))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream'});
  });
  await ctx.addInitScript(()=>{if(!localStorage.getItem('angleTracker.cfg'))localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/api',token:'test-teacher'}));});
  const url='https://tracker.test/'+(individual?'ege-2027':'as3')+'/0-homework-tracker/';
  const oldText=individual?'Cached task':'Cached Student',newText=individual?'Fresh task':'Fresh Student';
  await page.goto(url);await page.getByText(oldText,{exact:true}).first().waitFor();
  mode='hold';gate=new Promise(r=>release=r);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText(oldText,{exact:true}).first().waitFor({timeout:3000});
  assert.equal(await page.locator('#view').evaluate(e=>e.inert),true,'cached preview must be read-only while network is pending');
  assert.match(await page.locator('#banner').innerText(),/сохранённая копия/);
  release();await page.getByText(newText,{exact:true}).first().waitFor();
  assert.equal(await page.locator('#view').evaluate(e=>e.inert),false,'fresh data unlocks editing');
  mode='offline';await page.reload();await page.waitForFunction(()=>document.querySelector('#sync').classList.contains('err'));
  assert.equal(await page.locator('#view').evaluate(e=>e.inert),true);
  assert.match(await page.locator('#banner').innerText(),/Не удалось обновить/);
  await page.evaluate(()=>localStorage.setItem('angleTracker.cfg',JSON.stringify({url:'https://sheet.test/api',token:'different-teacher'})));
  mode='hold';gate=new Promise(r=>release=r);
  const newRequest=page.waitForRequest(r=>r.url().includes('different-teacher'));
  await page.reload({waitUntil:'domcontentloaded'});await newRequest;
  assert.equal(await page.getByText(newText,{exact:true}).count(),0,'different credentials never reuse the previous snapshot');
  release();await page.getByText(newText,{exact:true}).first().waitFor();
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('angleTracker.snapshot.v1.')).length),2,'credentials have separate cache keys');
  assert.equal(writes,0,'loading and preview never modify sheet data');
  assert.deepEqual(errors,[]);await ctx.close();console.log((individual?'individual':'group')+': immediate cached preview, fresh replacement, offline read-only, no writes PASS');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
