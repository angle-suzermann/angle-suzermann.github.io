const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/tracker/tracker.js'),'utf8');
const ctx=vm.createContext({D:{courses:{},progress:{},mee:[]}});
vm.runInContext(source.slice(source.indexOf('const pk='),source.indexOf('const fmt='))+source.slice(source.indexOf('function next('),source.indexOf('function worksheetPercent('))+source.slice(source.indexOf('function meeFor('),source.indexOf('function ring2(')),ctx);
function fixture(course='Starters',id='s'){
 ctx.D={courses:{[course]:{units:[{n:1},{n:8}],sections:[{id:'v',name:'Vocabulary'},{id:'w',name:'Writing'}],phonics:[],extras:[]}},progress:{},mee:[]};ctx.course=course;ctx.student={id,name:'Test'};
 return {mark:(scope,item,status)=>ctx.D.progress[[course,id,scope,item].join('|')]=status,online:(hw,status)=>ctx.D.mee.push({course,student:'Test',hw,status,due:'2099-01-01'}),sum:()=>vm.runInContext('groupSubmission(course,student)',ctx)};
}
for(const course of ['Starters','Movers','Flyers','B1']){
 const f=fixture(course);assert.equal(f.sum().sub,null);
 f.mark('u8','v','✓');assert.equal(f.sum().sub,1);assert.equal(f.sum().assigned,1); // empty programme is not assigned
 f.mark('u8','w','Assigned');assert.equal(f.sum().sub,.5);assert.equal(vm.runInContext('unitOn(course,student.id,8)',ctx),true);
 f.mark('u8','w','Done');assert.equal(f.sum().done,1); // waiting for teacher
 f.mark('u8','w','N/A');assert.equal(f.sum().assigned,1);
 f.online('Unit 8 Vocabulary','done');assert.equal(f.sum().assigned,1); // exact duplicate table/online identity
 f.online('Independent online work','pending');assert.equal(f.sum().sub,.5); // future deadline is still assigned
}
for(const id of ['mo1','mo2']){const f=fixture('Movers',id);f.mark('u1','v','Assigned');f.mark('u8','v','✓');assert.equal(f.sum().assigned,1);assert.equal(f.sum().sub,1)}
const f=fixture();ctx.D.courses.Starters.extras=[{id:'e',topic:'Extra task'}];f.mark('ex','e','Assigned');f.online('Extra task','done');assert.equal(f.sum().assigned,1);assert.equal(f.sum().done,0);f.mark('ex','e','✓');assert.equal(f.sum().sub,1);f.mark('ex','e','N/A');assert.equal(f.sum().assigned,0);
assert.equal(vm.runInContext("next('','u')",ctx),'Assigned');assert.equal(vm.runInContext("next('Assigned','u')",ctx),'✓');assert.equal(vm.runInContext("next('Assigned','ex')",ctx),'Done');
console.log('PASS: assignment rings, all groups, empty cells, pending confirmation, future deadlines, duplicate identity, exemptions, Movers scope and status cycle');
