const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});try{for(const mobile of [false,true]){
const ctx=await browser.newContext({viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile});
await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='audio.test')return route.abort();const f=path.join(process.cwd(),'_site',decodeURIComponent(u.pathname.slice(1)),u.pathname.endsWith('/')?'index.html':'');if(!fs.existsSync(f)||!fs.statSync(f).isFile())return route.abort();return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.mp3')?'audio/mpeg':'application/octet-stream'})});
const page=await ctx.newPage();await page.goto('https://audio.test/as3/Unit%208/test/');await page.getByRole('button',{name:'Start →',exact:true}).click();
await page.locator('.page.active audio').evaluate(a=>a.play());await page.waitForFunction(()=>document.querySelector('.page.active audio').currentTime>0.1);
await page.locator('.page.active input').first().fill('Sunday');assert.equal(await page.locator('.page.active audio').evaluate(a=>a.paused),false,'typing keeps playback');
await page.locator('.page.active').getByRole('button',{name:/^(Next|Далее) →$/,exact:true}).click();assert.equal(await page.locator('audio').nth(0).evaluate(a=>a.paused),true,'Next stops page 1 player');
await page.locator('.page.active audio').evaluate(a=>a.play());await page.waitForFunction(()=>document.querySelector('.page.active audio').currentTime>0.1);
await page.locator('.page.active .opt').first().click();assert.equal(await page.locator('.page.active audio').evaluate(a=>a.paused),false,'answer selection keeps playback');
await page.locator('.page-dot').nth(1).click();assert.equal(await page.locator('audio').nth(1).evaluate(a=>a.paused),true,'dots stop page 2 player');
await page.locator('.page.active audio').evaluate(a=>a.play());await page.locator('.page.active').getByRole('button',{name:/^← (Back|Назад)$/,exact:true}).click();assert.equal(await page.locator('audio').nth(0).evaluate(a=>a.paused),true,'Back stops player');
console.log('PASS actual MP3: '+(mobile?'touch/mobile':'desktop')+'; Next, Back, dots pause; typing and answer choice keep playing');await ctx.close();}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
