const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(process.cwd(),'_site');
const lesson='/ege-2027/2. Высшая школа/02. Чтение/distance-learning-reading-classwork/';
async function main(){
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const [name,width,height,touch] of [['iphone',390,844,true],['android',360,800,true],['ipad',820,1180,true],['macbook',1440,900,false]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch&&width<600});
   const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='angle.test')return route.abort();let f=path.join(root,decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))f=path.join(f,'index.html');if(!f.startsWith(root)||!fs.existsSync(f))return route.fulfill({status:404,body:''});await route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/octet-stream'});});
   await page.goto('https://angle.test/staff-7fk2q9/');
   assert.equal(await page.locator('#recentMaterials').isVisible(),false);
   await page.locator('#searchToggleBtn').click();await page.locator('#q').fill('Distance Learning');
   const total=await page.locator('#staffList .staff-card:not(.personal-card)').count();
   assert((await page.locator('#count').innerText()).includes('из '+total+' в выбранном разделе'),'personal folders must not inflate material total');
   const card=page.locator('#staffList .staff-card:visible').first();
   const title=await card.getAttribute('data-title');
   await card.locator('a.open').first().click();
   await page.waitForFunction(()=>document.querySelector('#recentList').children.length===1);
   assert.equal(await page.locator('#recentList .tile-name').innerText(),title);
   await page.reload();assert.equal(await page.locator('#recentList a').count(),1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' catalog overflow');
   assert(!/из 294/.test(await page.locator('#count').innerText()));
   await page.goto('https://angle.test'+lesson);
   await page.waitForFunction(()=>document.body.classList.contains('angle-worksheet'));
   assert.equal(await page.locator('#restoreNote').isVisible(),false,'blank restore banner');
   assert.equal(await page.locator('.topbar-reset').innerText(),'↺ Сбросить ответы');
   assert.equal(await page.locator('#restoreNote button,.reset-link').count(),0);
   assert.equal(await page.locator('h3').filter({hasText:'План занятия'}).locator('xpath=following-sibling::ol[1]/li').count(),5);
   assert.match(await page.locator('#progressLabel').innerText(),/Страница 1 \/ 5/);
   if(touch)assert.equal(await page.locator('#studentName').evaluate(e=>getComputedStyle(e).fontSize),'16px');
   await page.locator('textarea').first().fill('Saved answer for a test.');
   await page.waitForFunction(()=>/Сохранено в этом браузере/.test(document.querySelector('#saveIndicator').textContent));
   await page.reload();assert.equal(await page.locator('textarea').first().inputValue(),'Saved answer for a test.');
   assert.equal(await page.locator('#restoreNote').isVisible(),true);
   assert.match(await page.locator('#restoreNoteText').innerText(),/Найдена сохранённая работа/);
   page.once('dialog',d=>{assert.match(d.message(),/Удалить все сохранённые ответы/);d.dismiss();});
   await page.locator('.topbar-reset').click();assert.equal(await page.locator('textarea').first().inputValue(),'Saved answer for a test.');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' worksheet overflow');
   if(process.env.UI_SCREENSHOTS){await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,name+'-worksheet.png')});await page.goto('https://angle.test/staff-7fk2q9/');await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,name+'-catalog.png'),fullPage:true});}
   if(name==='macbook'){
    await page.goto('https://angle.test'+lesson);
    await page.route('https://api.web3forms.com/submit',r=>r.fulfill({status:200,json:{success:false,message:'Test failure'}}));
    await page.locator('#studentName').fill('Test Student');
    await page.locator('.page-dot').nth(3).click();
    await page.getByRole('button',{name:'Проверить и отправить',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#submitStatus').textContent.includes('Не удалось отправить'));
    assert.match(await page.locator('#submitStatus').innerText(),/Ответы сохранены в этом браузере/);
   }
   for(const tracker of ['/ege-2027/0-homework-tracker/','/as3/0-homework-tracker/']){
    await page.goto('https://angle.test'+tracker);await page.locator('#view .card').first().waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' tracker overflow');
    if(process.env.UI_SCREENSHOTS)await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,name+(tracker.includes('as3')?'-group-tracker.png':'-individual-tracker.png'))});
   }
   assert.deepEqual(errors,[],name+' JS errors');await context.close();console.log(name+': passed');
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1)});
