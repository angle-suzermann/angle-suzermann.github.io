const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/tracker/tracker.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'(');assert(start>=0);let open=source.indexOf('{',start),depth=0;for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&!--depth)return source.slice(start,i+1)}throw Error(name)}
const ctx=vm.createContext({D:{mee:[]},Date,Map});
vm.runInContext(fn('meeFor')+'\n'+fn('meeSum'),ctx);
ctx.D.mee=[{course:'Flyers',student:'Student',hw:'Power Cut',status:'done',pct:86},{course:'Flyers',student:'Student',hw:'Fix-it',status:'done',pct:71},{course:'Flyers',student:'Student',hw:'Voice (forgiven)',status:'na'},{course:'Flyers',student:'Student',hw:'Future task',status:'missing',due:'2099-01-01'},{course:'Flyers',student:'Student',hw:'Fix-it',status:'done',pct:75}];
let actual=vm.runInContext("meeSum(meeFor('Flyers',{name:'Student'}))",ctx);
assert.equal(actual.due,2);assert.equal(actual.done,2);assert.equal(actual.sub,1);assert.equal(actual.q,.805);
ctx.D.mee.push({course:'Flyers',student:'Student',hw:'Overdue',status:'missing',due:'2026-01-01'});
actual=vm.runInContext("meeSum(meeFor('Flyers',{name:'Student'}))",ctx);assert.equal(actual.sub,2/3);
assert.match(source,/teacherQuality=registered&&qa.length>0/);
assert.match(source,/registered\?null:o\.r/);
console.log('Flyers: forgiven and future work excluded; duplicate submission counted once; overdue work included.');
