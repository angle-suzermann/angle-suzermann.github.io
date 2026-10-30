const fs=require('node:fs'),assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
const ctx=await b.newContext({viewport:{width:1000,height:900}});
await ctx.addInitScript(()=>{Object.defineProperty(screen,'width',{get:()=>1000,configurable:true});Object.defineProperty(screen,'height',{get:()=>900,configurable:true})});
await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname==='/assets/ws-tools.js')return route.fulfill({body:fs.readFileSync('assets/ws-tools.js'),contentType:'application/javascript'});if(u.pathname==='/')return route.fulfill({body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}.scroll-area{height:900px;position:relative;overflow:auto}main{height:1800px}</style><div class="scroll-area"><main>Drawing fixture</main></div><script>window.STICKER_DATA={}</script><script src="/assets/ws-tools.js"></script>',contentType:'text/html'});return route.fulfill({status:404})});
const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('https://drawing.test/');

const timer=p.locator('#wtTimerBtn'),panel=p.locator('.wt-timer');await timer.click();
const normal=await panel.boundingBox();assert(normal.width<=195);assert(normal.height<=240);
await panel.locator('[data-sec="120"]').click();assert.equal(await panel.locator('.wt-tm-big').innerText(),'02:00');await panel.locator('.wt-tm-go .main').click();await p.waitForTimeout(350);
const pill=p.locator('.wt-pill');assert(await pill.isVisible());const pillSize=await pill.boundingBox();
const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await p.waitForTimeout(250);
let scale=await p.evaluate(()=>visualViewport.scale),box=await panel.boundingBox(),pb=await pill.boundingBox();assert(Math.abs(box.width*scale-normal.width)<2);assert(Math.abs(pb.width*scale-pillSize.width)<2);
await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await p.waitForTimeout(150);
await p.evaluate(()=>{window.__zoomDPR=1;Object.defineProperty(window,'devicePixelRatio',{get:()=>window.__zoomDPR,configurable:true})});
for(const z of [1.5,2,.8,1]){await p.evaluate(z=>window.__zoomDPR=z,z);await p.setViewportSize({width:Math.round(1000/z),height:Math.round(900/z)});await p.evaluate(()=>dispatchEvent(new Event('resize')));await p.waitForTimeout(150);box=await panel.boundingBox();pb=await pill.boundingBox();assert(Math.abs(box.width*z-normal.width)<2);assert(Math.abs(pb.width*z-pillSize.width)<2);assert(box.x>=0&&box.x+box.width<=1000/z+1)}
await panel.locator('.wt-tm-go .main').click();assert.equal(await panel.locator('.wt-tm-go .main').innerText(),'Продолжить');await timer.click();assert(!await panel.isVisible());await timer.click();assert(await panel.isVisible());
assert.deepEqual(errors,[]);await ctx.close();console.log('PASS: timer compact, starts/pauses/reopens, panel and running pill retain physical size through pinch and desktop zoom.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
