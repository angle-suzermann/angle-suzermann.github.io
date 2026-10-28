const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const mode of ['blocks','shared']){
  const kind=mode==='blocks'?'blocks':'paras',id='s1',pages=[],contexts=[];
  let db={mode,[kind]:{[id]:{uid:'s1',name:'Student A',text:'Original student answer',ts:1}}},failNext=false,delayFeedbackSnapshot=false;
  const copy=()=>JSON.parse(JSON.stringify(db));
  async function broadcast(){for(const p of pages)if(!p.isClosed())await p.evaluate(v=>window.__roomListener?.(v),copy())}
  async function setup(teacher){
   const ctx=await browser.newContext({viewport:{width:390,height:844}});contexts.push(ctx);
   await ctx.exposeBinding('roomCall',async(_,{action,p,value})=>{
    if(action==='load')return copy();
    if(action==='set'&&p.includes('/feedback')&&failNext){failNext=false;throw new Error('Test offline')}
    const parts=p.split('/').slice(2);let node=db;
    for(const key of parts.slice(0,-1))node=node[key]||(node[key]={});
    if(action==='set')node[parts.at(-1)]=value;else if(action==='update')Object.assign(node[parts.at(-1)],value);else delete node[parts.at(-1)];
    if(p.endsWith('/feedback')&&delayFeedbackSnapshot){delayFeedbackSnapshot=false;return null}
    await broadcast();return null;
   });
   await ctx.addInitScript(({teacher})=>{
    localStorage.setItem('angle-collab-uid',teacher?'teacher':'s1');localStorage.setItem('angle-collab-name-test','Student A');
    window.ANGLE_FIREBASE={teacherKey:'fixture'};
    window.ANGLE_COLLAB_ADAPTER={
     on(p,cb){window.__roomListener=cb;window.roomCall({action:'load'}).then(cb)},
     status(cb){cb(true)},update(p,value){return window.roomCall({action:'update',p,value})},set(p,value){return window.roomCall({action:'set',p,value})},remove(p){return window.roomCall({action:'remove',p})}
    };
   },{teacher});
   await ctx.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/assets/collab.js')return route.fulfill({body:fs.readFileSync('assets/collab.js'),contentType:'application/javascript'});
    if(u.hostname==='collab.test')return route.fulfill({body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div class="collab" data-room="test" data-mode="${mode}"></div><script src="/assets/collab.js"></script>`,contentType:'text/html'});
    return route.abort();
   });
   const page=await ctx.newPage();page.on('pageerror',e=>console.error('PAGE ERROR',e.message));pages.push(page);await page.goto('https://collab.test/'+(teacher?'?teacher=fixture':''));
   await page.locator('.cb-card').first().waitFor();return page;
  }
  const teacher=await setup(true),student=await setup(false);
  assert.equal(await student.locator('.cb-feedback:visible').count(),0);
  assert.equal(await student.locator('.cb-feedback-editor').count(),0);
  await teacher.getByRole('button',{name:'Добавить комментарий'}).click();
  const comment='Проверь времена. <img src=x onerror=alert(1)>';
  await teacher.locator('.cb-feedback-editor').fill(comment);
  await student.locator('.cb-ta').fill('Student continues writing');
  const editor=await student.locator('.cb-ta').elementHandle();
  await teacher.getByRole('button',{name:'Сохранить комментарий'}).click();
  await student.locator('.cb-feedback-text').filter({hasText:'Проверь времена.'}).waitFor();
  assert.equal(await student.locator('.cb-feedback-text').innerText(),comment);
  assert.equal(await student.locator('.cb-feedback-text img').count(),0);
  assert(await editor.evaluate(el=>el===document.activeElement),'incoming feedback preserves student focus');
  await student.waitForTimeout(450);
  assert.equal(db[kind][id].text,'Student continues writing');assert.equal(db[kind][id].feedback.text,comment);
  await student.reload();await student.locator('.cb-feedback-text:visible').waitFor();
  assert.equal(await student.locator('.cb-feedback-text').innerText(),comment);
  await teacher.getByRole('button',{name:'Изменить комментарий'}).click();
  await teacher.locator('.cb-feedback-editor').fill('Добавь заключение.');
  // Incoming answer updates do not overwrite a focused teacher comment draft.
  await teacher.locator('.cb-feedback-editor').focus();db[kind][id].text+=' More.';await broadcast();
  assert.equal(await teacher.locator('.cb-feedback-editor').inputValue(),'Добавь заключение.');
  assert(await teacher.locator('.cb-feedback-editor').evaluate(el=>el===document.activeElement));
  failNext=true;await teacher.getByRole('button',{name:'Сохранить комментарий'}).click();
  await teacher.getByRole('status').filter({hasText:'Не удалось сохранить'}).waitFor();
  assert.equal(await teacher.locator('.cb-feedback-editor').inputValue(),'Добавь заключение.');
  assert.equal(db[kind][id].feedback.text,comment);
  delayFeedbackSnapshot=true;
  await teacher.getByRole('button',{name:'Сохранить комментарий'}).click();
  await teacher.locator('.cb-feedback-text:visible').filter({hasText:'Добавь заключение.'}).waitFor();
  assert(await teacher.getByRole('button',{name:'Изменить комментарий'}).isVisible());
  assert(await teacher.getByRole('button',{name:'Удалить комментарий',exact:true}).isVisible());
  await broadcast();
  await student.locator('.cb-feedback-text').filter({hasText:'Добавь заключение.'}).waitFor();
  teacher.once('dialog',d=>d.accept());await teacher.getByRole('button',{name:'Удалить комментарий',exact:true}).click();
  await student.waitForFunction(()=>document.querySelector('.cb-feedback').hidden);
  assert(db[kind][id].text.includes('Student continues writing'));
  assert(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const ctx of contexts)await ctx.close();
 }
 console.log('PASS: teacher comments live to student in blocks/shared; reload; edit/delete; answer writes preserve feedback; focus/drafts stable; save failure retains draft; HTML escaped; mobile fits.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
