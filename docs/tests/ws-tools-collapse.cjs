const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TRACKER_TEST_BROWSER||'msedge'});
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:true}),errors=[];
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());if(u.hostname!=='drawing.test')return route.abort();
    if(u.pathname==='/')return route.fulfill({body:'<!doctype html><meta charset="utf-8"><style>body{margin:0;font-family:Arial}.scroll-area{position:relative;height:1200px}.page-wrap{max-width:860px;margin:auto;height:1100px}header{height:40px}</style><header>Worksheet</header><div class="scroll-area"><main class="page-wrap">Material remains visible while drawing</main></div><script>window.STICKER_DATA={}</script><script src="/assets/ws-tools.js"></script>',contentType:'text/html'});
    if(u.pathname==='/assets/ws-tools.js')return route.fulfill({body:fs.readFileSync('assets/ws-tools.js'),contentType:'application/javascript'});
    if(u.pathname==='/assets/sticker-data.js')return route.fulfill({body:'var STICKER_DATA={};',contentType:'application/javascript'});
    return route.fulfill({status:404});
   });
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://drawing.test/');
   const panel=page.locator('#wtInkPanel'),button=page.locator('#wtInkBtn');
   const shapes=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('angle_ink::/')||'{}').single||[]);
   const draw=async(x=width*.65,y=220)=>{await page.mouse.move(x,y);await page.mouse.down();assert.equal(await panel.isVisible(),false);await page.mouse.move(x+35,y+25,{steps:4});await page.mouse.up()};
   await button.click();assert(await panel.isVisible());
   await panel.locator('[data-color="#2e6fd6"]').click();await panel.locator('[data-w="8"]').click();
   await draw();let stored=await shapes();assert.equal(stored.length,1);assert.equal(stored[0].w,8);assert.equal(stored[0].color,'#2e6fd6');assert(stored[0].points.length>1);
   assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await button.getAttribute('aria-expanded'),'false');
   await button.click();assert(await panel.isVisible());assert.equal(await button.getAttribute('aria-pressed'),'true','reopening does not turn drawing off');
   await panel.locator('[data-tool="rect"]').click();assert.equal(await panel.isVisible(),false);await draw(width*.5,280);assert.equal((await shapes())[1].tool,'rect');
   await button.click();await panel.getByTitle('Отменить',{exact:true}).click();assert.equal((await shapes()).length,1);
   await panel.getByTitle('Повторить',{exact:true}).click();assert.equal((await shapes()).length,2);
   await panel.locator('[data-emoji="⭐"]').click();assert.equal(await panel.isVisible(),false);
   await page.touchscreen.tap(width*.7,350);assert.equal((await shapes()).length,3);
   await button.click();await panel.locator('[data-tool="pen"]').click();await button.click();
   const box=await panel.boundingBox();await panel.getByRole('button',{name:'Свернуть панель'}).click();
   await draw(Math.min(width-45,box.x+box.width/2),Math.max(70,Math.min(700,box.y+box.height/2)));
   assert.equal((await shapes()).length,4,'drawing works where the panel used to cover the material');
   await button.click();await panel.getByTitle('Готово',{exact:true}).click();assert.equal(await button.getAttribute('aria-pressed'),'false');assert.equal(await panel.isVisible(),false);
   await page.reload();await button.waitFor();assert.equal((await shapes()).length,4,'annotations persist');
   await button.click();await page.locator('#wtNoteBtn').click();assert.equal(await button.getAttribute('aria-pressed'),'false');assert.equal(await panel.isVisible(),false);
   assert.deepEqual(errors,[]);await ctx.close();
  }
  console.log('PASS: palette collapses on drawing/tool/sticker selection; active drawing and chosen settings persist; pencil reopens tools; undo/redo, explicit collapse, drawing over old panel, Done, notes and saved annotations work on mobile/desktop.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
