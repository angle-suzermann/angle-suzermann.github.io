const fs=require('fs'),vm=require('vm'),assert=require('assert');
const all=fs.readFileSync('assets/tracker/tracker.js','utf8');
const code=all.slice(all.indexOf('let submissionRefreshBusy=false;'),all.indexOf('setInterval(refreshSubmissions,60000);'));
let reads=0,renders=0,dirty=false,dialog=false,editing=false;
const c={live:true,PARENT:false,flushing:false,pending:[],extraDrafts:new Map(),D:{progress:{}},document:{hidden:false,querySelector:()=>dialog,activeElement:{matches:()=>editing}},Store:{load:async()=>{reads++;return {progress:{new:'✓'}}}},render:()=>renders++,renderParent:()=>renders++,setSync(){},JSON};
vm.createContext(c);vm.runInContext(code,c);
(async()=>{
  c.pending.push({});await c.refreshSubmissions();assert.equal(reads,0);c.pending=[];
  dialog=true;await c.refreshSubmissions();assert.equal(reads,0);dialog=false;
  editing=true;await c.refreshSubmissions();assert.equal(reads,0);editing=false;
  await c.refreshSubmissions();assert.equal(reads,1);assert.equal(renders,1);assert.equal(c.D.progress.new,'✓');
  await c.refreshSubmissions();assert.equal(renders,1);
  c.Store.load=async()=>{editing=true;return {progress:{other:'✓'}}};await c.refreshSubmissions();assert.equal(c.D.progress.new,'✓');
  console.log('PASS: live refresh, pending writes, active edits, open dialogs, unchanged data and edits begun during fetch');
})().catch(e=>{console.error(e);process.exit(1)});
