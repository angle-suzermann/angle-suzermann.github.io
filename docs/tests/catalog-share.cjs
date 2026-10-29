const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(process.cwd(),'_site');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850}}),errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='catalog.test')return route.abort();let f=path.join(root,decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))f=path.join(f,'index.html');if(!f.startsWith(root)||!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/octet-stream'});});
  await context.addInitScript(()=>{
   window.shares=[];window.copies=[];
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.shares.push(data)});
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.copies.push(t),write:async items=>{window.richTypes=items[0].types;window.richHtml=await(await items[0].getType('text/html')).text();}}});
  });
  await page.goto('https://catalog.test/staff-7fk2q9/');
  const all=page.locator('#staffList .staff-card:not(.personal-card)');assert.equal(await all.count(),await all.locator('button[data-share-url]').count());
  assert.equal(await all.locator('.name .material-brand-icon').count(),0,'unrelated mascot icons must not replace topic emojis');
  await page.locator('#searchToggleBtn').click();await page.locator('#q').fill('Distance Learning');
  const card=page.locator('#staffList .staff-card:visible').first(),title=await card.locator('[data-share-url]').getAttribute('data-share-title'),url=new URL(await card.locator('a.open').first().getAttribute('href'),'https://catalog.test').href;
  assert.match(title,/^📖 /,'shared title includes topic emoji');assert(!/^📖 \d+[.)]/.test(title),'shared title omits catalogue number');
  assert.match(await card.locator('.name').innerText(),/^📖 /,'reading material retains its reading topic icon');
  await card.locator('[data-share-url]').click();assert.equal(await page.locator('.share-material').innerText(),title);
  const tg=new URL(await page.locator('[data-telegram-share]').getAttribute('href'));assert.equal(tg.searchParams.get('text'),title);assert.equal(tg.searchParams.get('url'),url);
  assert(!(await page.locator('[data-sms-share]').getAttribute('href')).includes('teacher='));
  await page.locator('[data-native-share]').click();assert.deepEqual(await page.evaluate(()=>window.shares[0]),{title,text:title,url});
  await page.locator('[data-rich-copy]').click();await page.waitForFunction(()=>typeof window.richHtml==='string');assert.match(await page.evaluate(()=>window.richHtml),/^<a href=/);assert((await page.evaluate(()=>window.richHtml)).includes(title.replaceAll('&','&amp;')));
  await page.locator('[data-text-copy]').click();assert.equal(await page.evaluate(()=>window.copies.at(-1)),url+'\n\n'+title);
  await page.locator('[data-max-copy]').click();assert.equal(await page.evaluate(()=>window.copies.at(-1)),url+'\n\n'+title);
  await page.locator('[data-share-close]').click();assert.equal(await page.locator('.angle-share').isVisible(),false);
  await card.locator('[data-share-url]').evaluate(b=>b.dataset.shareTitle='A\u200b\u202e\u00a0 B\u0007');
  await card.locator('[data-share-url]').click();await page.locator('[data-text-copy]').click();assert.equal(await page.evaluate(()=>window.copies.at(-1)),url+'\n\nA B');await page.locator('[data-share-close]').click();
  await page.goto('https://catalog.test/ege-2027/');
  assert.equal(await page.locator('.card:not(.personal-card)').count(),await page.locator('.card:not(.personal-card) > .actions [data-share-url]').count());
  assert.equal(await page.locator('a.card button').count(),0,'no nested interactive elements in link cards');
  await page.locator('#groupTopGrid [data-group-tile="2. Высшая школа"]').click();
  await page.locator('[data-group-tile="2. Высшая школа/02. Чтение"]').click();
  const first=page.locator('.card:not(.personal-card):visible').first();await first.locator('[data-share-url]').click();
  assert.equal(await page.locator('.angle-share').isVisible(),true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(process.env.SHARE_SCREENSHOTS)await page.screenshot({path:path.join(process.env.SHARE_SCREENSHOTS,'share-'+width+'.png')});
  assert.deepEqual(errors,[]);await context.close();console.log(width+': staff/public sharing, topic emojis restored, native share, Telegram/SMS URLs, rich copy and MAX copy PASS');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
