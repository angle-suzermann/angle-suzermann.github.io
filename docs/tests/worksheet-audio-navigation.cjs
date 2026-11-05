const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=process.cwd(),out=path.join(root,'_site');
function collect(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!['_site','.git','node_modules'].includes(e.name)?collect(path.join(dir,e.name)):e.isFile()&&e.name==='index.html'?[path.join(dir,e.name)]:[])}
const files=collect(root).filter(p=>/<audio\b|new Audio\s*\(|speechSynthesis/.test(fs.readFileSync(p,'utf8'))).map(p=>path.relative(root,p)).filter(p=>!process.env.AUDIO_ONLY||new RegExp(process.env.AUDIO_ONLY).test(p));
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});let done=0;const results=[];
try{await Promise.all([0,1,2].map(async worker=>{const ctx=await browser.newContext();
await ctx.addInitScript(()=>{
 const states=new WeakMap();Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return states.get(this)!==true},configurable:true});
 HTMLMediaElement.prototype.play=function(){states.set(this,true);this.dispatchEvent(new Event('play'));return Promise.resolve()};
 HTMLMediaElement.prototype.pause=function(){states.set(this,false)};
 const ss={speaking:false,pending:false,getVoices(){return []},addEventListener(){},speak(){this.speaking=true},cancel(){this.speaking=false;this.pending=false}};
 Object.defineProperty(window,'speechSynthesis',{value:ss,configurable:true});
});
await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='audio.test')return route.abort();
 const f=path.join(out,decodeURIComponent(u.pathname.slice(1)),u.pathname.endsWith('/')?'index.html':'');
 if(!fs.existsSync(f)||!fs.statSync(f).isFile())return route.abort();
 if(/sticker-data\.js$/.test(f))return route.fulfill({body:'const STICKER_DATA={};',contentType:'text/javascript'});
 if(!/\.(html|js|css|json)$/.test(f))return route.abort();
 return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':'text/html'});
});
const page=await ctx.newPage();
for(let i=worker;i<files.length;i+=3){const rel=files[i];await page.goto('https://audio.test/'+rel.split(path.sep).map(encodeURIComponent).join('/'),{waitUntil:'load'});
assert.equal(await page.evaluate(()=>!!window.__anglePageAudioGuard),true,'guard missing: '+rel);
const result=await page.evaluate(async()=>{
 const tab=typeof activeTab!=='undefined'?activeTab:undefined;
 const nav=typeof showPage==='function'?(showPage.length>=2?(n)=>showPage(tab,n):showPage):typeof goToPage==='function'?goToPage:typeof goTo==='function'?goTo:null;
 if(!nav)return {skip:'no paged navigation'};
 nav(0);await new Promise(r=>setTimeout(r,0));
 const ids=new WeakMap();let n=0;const id=x=>{if(!ids.has(x))ids.set(x,++n);return ids.get(x)};
 const sig=()=>[...[...document.querySelectorAll('.page,.tab-panel')].filter(x=>x.getClientRects().length).map(id),document.querySelector('#stage')?.firstElementChild&&id(document.querySelector('#stage').firstElementChild)].join('|');
 const media=document.createElement('audio');document.body.append(media);await new Promise(r=>setTimeout(r,0));await media.play();
 const el=document.createElement('span');document.body.append(el);el.className='feedback';await new Promise(r=>setTimeout(r,0));
 if(media.paused)return {error:'unrelated update stopped audio'};
 const before=sig();if(typeof nextPage==='function')nextPage(tab);else nav(1);await new Promise(r=>setTimeout(r,0));
 if(before===sig())return {skip:'single page or unchanged next'};
 if(!media.paused)return {error:'DOM audio survived next page'};
 const detached=new Audio();await detached.play();speechSynthesis.speak(new SpeechSynthesisUtterance('test'));
 nav(0);await new Promise(r=>setTimeout(r,0));
 if(!detached.paused||speechSynthesis.speaking)return {error:'detached audio/speech survived previous page'};
 await detached.play();nav(0);await new Promise(r=>setTimeout(r,0));
 if(detached.paused)return {error:'same-page selection stopped audio'};
 detached.pause();
 if(typeof switchTab==='function'&&tab!==undefined){
   const target=[...document.querySelectorAll('[onclick]')].map(el=>(el.getAttribute('onclick')||'').match(/switchTab\(['"]([^'"]+)['"]\)/)).find(m=>m&&m[1]!==tab);
   if(target){await detached.play();speechSynthesis.speak(new SpeechSynthesisUtterance('tab test'));switchTab(target[1]);await new Promise(r=>setTimeout(r,0));if(!detached.paused||speechSynthesis.speaking)return {error:'audio/speech survived worksheet tab switch'};}
 }
 return {pass:true};
});
results.push({file:rel,...result});assert(!result.error,rel+': '+result.error);done++;if(done%20===0)console.log('Audited '+done+'/'+files.length);
}await ctx.close();}));
fs.writeFileSync(path.join(process.env.AUDIO_REPORT_DIR||root,process.env.AUDIO_ONLY?'audio-navigation-audit-extra-results.json':'audio-navigation-audit-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({materials:files.length,passed:results.filter(r=>r.pass).length,skipped:results.filter(r=>r.skip)},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
