const fs=require('node:fs'),assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
const ctx=await b.newContext({viewport:{width:1000,height:900}});
await ctx.addInitScript(()=>{Object.defineProperty(screen,'width',{get:()=>1000,configurable:true});Object.defineProperty(screen,'height',{get:()=>900,configurable:true})});
await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname==='/assets/ws-tools.js')return route.fulfill({body:fs.readFileSync('assets/ws-tools.js'),contentType:'application/javascript'});if(u.pathname==='/')return route.fulfill({body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}.scroll-area{height:900px;position:relative;overflow:auto}main{height:1800px}</style><div class="scroll-area"><main>Drawing fixture</main></div><script>window.STICKER_DATA={}</script><script src="/assets/ws-tools.js"></script>',contentType:'text/html'});return route.fulfill({status:404})});
const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('https://drawing.test/');
const pencil=p.locator('#wtInkBtn'),settings=p.locator('#wtInkSettings'),panel=p.locator('#wtInkPanel');
await pencil.click();assert(await panel.isVisible());let size=await panel.boundingBox();assert(size.width<=205,'palette compact width');assert(size.height<=300,'stickers collapsed by default');
await panel.locator('[data-w="8"]').click();await panel.getByRole('button',{name:'Свернуть панель'}).click();assert(!await panel.isVisible());
await pencil.click();assert.equal(await pencil.getAttribute('aria-pressed'),'false');assert(!await panel.isVisible());assert(!await settings.isVisible());assert.equal(await p.locator('#wtInk').evaluate(e=>e.style.pointerEvents),'none');
await pencil.click();assert(await panel.isVisible());assert.equal(await panel.locator('.wt-w.on').getAttribute('data-w'),'8');await settings.click();assert(!await panel.isVisible());await settings.click();assert(await panel.isVisible());
// A real pinch zoom: visualViewport changes independently of layout viewport.
const cdp=await ctx.newCDPSession(p);const normal=await panel.boundingBox(),dock=await pencil.boundingBox();
await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await p.waitForTimeout(300);
let factor=await p.evaluate(()=>visualViewport.scale),scaled=await panel.boundingBox(),scaledDock=await pencil.boundingBox();assert(Math.abs(scaled.width*factor-normal.width)<2);assert(Math.abs(scaledDock.width*factor-dock.width)<2);
await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await p.waitForTimeout(200);
// Desktop full-page zoom changes the CSS viewport and devicePixelRatio.
await p.evaluate(()=>{window.__zoomDPR=1;Object.defineProperty(window,'devicePixelRatio',{get:()=>window.__zoomDPR,configurable:true})});
for(const zoom of [1.5,2,.8,1]){await p.evaluate(z=>{window.__zoomDPR=z},zoom);await p.setViewportSize({width:Math.round(1000/zoom),height:Math.round(900/zoom)});await p.evaluate(()=>dispatchEvent(new Event('resize')));await p.waitForTimeout(200);scaled=await panel.boundingBox();scaledDock=await pencil.boundingBox();assert(Math.abs(scaled.width*zoom-normal.width)<2,`panel physical size at zoom ${zoom}`);assert(Math.abs(scaledDock.width*zoom-dock.width)<2);assert(scaled.x>=0&&scaled.x+scaled.width<=1000/zoom+1)}
await p.addInitScript(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>Number(localStorage.getItem('test.dpr'))||1,configurable:true})});
await p.evaluate(()=>localStorage.setItem('test.dpr','2'));await p.setViewportSize({width:500,height:450});await p.reload();await pencil.click();scaled=await panel.boundingBox();assert(Math.abs(scaled.width*2-normal.width)<2,'UI zoom baseline survives reload');
assert.deepEqual(errors,[]);await ctx.close();console.log('PASS: compact palette, collapsed stickers, pencil always toggles drawing, separate settings/collapse, settings retained; real pinch and desktop zoom compensation keep controls the same physical size.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
