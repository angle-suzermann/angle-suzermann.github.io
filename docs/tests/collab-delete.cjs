const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this._text='';this.classList={add(){},remove(){}};this.style={};}
 set textContent(v){this._text=v;this.children=[];} get textContent(){return this._text;}
 appendChild(n){if(n.parent)n.remove();this.children.push(n);n.parent=this;return n;}
 insertBefore(n,a){if(n.parent)n.remove();this.children.splice(a?this.children.indexOf(a):this.children.length,0,n);n.parent=this;}
 remove(){if(this.parent){const a=this.parent.children;a.splice(a.indexOf(this),1);this.parent=null;}}
 contains(n){return this===n||this.children.some(c=>c.contains(n));}
 get nextSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
 setAttribute(k,v){this[k]=v;}
 addEventListener(e,f){this.listeners[e]=f;} focus(){} getAttribute(k){return k==='data-room'?'test':k==='data-mode'?'blocks':null;}
}
function find(root,p){if(p(root))return root;for(const c of root.children){const r=find(c,p);if(r)return r;}}
async function run(teacher=false,mode='blocks'){
 const root=new Element('root');root.getAttribute=k=>k==='data-room'?'test':k==='data-mode'?mode:null;
 let callback,seq=0;const tasks=new Map(),writes=[],deletes=[];
 const adapter={on(p,cb){callback=cb;},set(p,v){writes.push([p,v]);return Promise.resolve();},remove(p){deletes.push(p);return Promise.resolve();}};
 const document={head:new Element('head'),readyState:'complete',activeElement:null,createElement:t=>new Element(t),querySelectorAll:()=>[root]};
 const storage={'angle-collab-uid':'me','angle-collab-name-test':'Student'};
 const context={document,window:{ANGLE_COLLAB_ADAPTER:adapter,ANGLE_FIREBASE:{teacherKey:'key'}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},location:{search:teacher?'?teacher=key':''},URLSearchParams,Promise,Date,Math,console,navigator:{},confirm:()=>true,setTimeout:f=>{tasks.set(++seq,f);return seq;},clearTimeout:id=>tasks.delete(id)};
 vm.runInNewContext(fs.readFileSync('assets/collab.js','utf8'),context);await Promise.resolve();await Promise.resolve();
 const entry={uid:'me',name:'Student',text:'Old text'};
 callback({mode,[mode==='blocks'?'blocks':'paras']:{me:entry}});
 if(!teacher){const field=find(root,e=>e.tagName==='textarea');assert.equal(field.value,'Old text');field.value='Pending draft';field.listeners.input();assert.equal(tasks.size,1);}
 callback({mode});
 assert.equal(tasks.size,0,'remote deletion cancels queued save');
 assert.equal(writes.length,0,'deleted participant not automatically recreated');
 const field=find(root,e=>e.tagName==='textarea');
 if(mode==='blocks'&&!teacher)assert.equal(field.value,'','deleted editor text is cleared');
 else assert(!field,'deleted paragraph removed');
 if(teacher){callback({mode,[mode==='blocks'?'blocks':'paras']:{me:entry}});find(root,e=>e.className==='cb-x').listeners.click();await Promise.resolve();assert.equal(deletes[0],'rooms/test/'+(mode==='blocks'?'blocks':'paras')+'/me');}
 return true;
}
(async()=>{await run(false);await run(false,'shared');await run(true);await run(true,'shared');console.log('PASS: student and teacher deletion in both modes; pending drafts cancelled; deleted text stays cleared');})().catch(e=>{console.error(e);process.exitCode=1});
