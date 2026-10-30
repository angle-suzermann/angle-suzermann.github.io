// A unit that is off for the course still counts for a pupil who already has handed-in or overdue MEE work in it.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/tracker/tracker.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'(');assert(start>=0);let open=source.indexOf('{',start),depth=0;for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&!--depth)return source.slice(start,i+1)}throw Error(name)}
const unitNo=source.match(/const unitNo=.*\n/)[0];
const ctx=vm.createContext({});
vm.runInContext('var D;const pk=(c,s,scope,item)=>[c,s,scope,item].join("|");const st=(c,s,scope,item)=>D.progress[pk(c,s,scope,item)]||"";function ratio(e,p){return p>0?e/p:null}\n'+unitNo+fn('unitOn')+'\n'+fn('unitScore'),ctx);
ctx.D={courses:{B1:{students:[{id:'a',name:'Ahead'},{id:'b',name:'Behind'}],units:[{n:1,active:true},{n:2,active:false},{n:5,active:false},{n:6,active:false}],sections:[{id:'s1',points:5},{id:'s2',points:5}]}},
 progress:{'B1|a|u2|s1':'✓','B1|b|u2|s1':'✓','B1|a|u5|s1':'N/A','B1|a|u5|s2':'N/A'},
 mee:[{course:'B1',student:'Ahead',hw:'WB unit 2 vocab',status:'done'},{course:'B1',student:'Ahead',hw:'WB unit 5 vocab',status:'na'},
      {course:'B1',student:'Ahead',hw:'WB unit 6 reading',status:'missing'},{course:'B1',student:'Behind',hw:'WB unit 6 speaking',status:'pending'},
      {course:'B1',student:'Behind',hw:'WB grammar 2: Articles',status:'done'}]};
const on=(s,n)=>vm.runInContext(`unitOn('B1','${s}',${n})`,ctx), score=(s,n)=>vm.runInContext(`unitScore('B1','${s}',${n})`,ctx);
assert.equal(on('a',1),true);assert.equal(on('b',1),true);           // course switch still works
assert.equal(on('a',2),true);{const x=score('a',2);assert.equal(x.e,5);assert.equal(x.p,10);assert.equal(x.r,.5);} // handed-in work turns the unit on for this pupil
assert.equal(on('b',2),false);assert.equal(score('b',2).r,null);     // a stray tick alone does not
assert.equal(on('a',5),false);                                        // exempted unit stays off
assert.equal(on('a',6),true);                                         // overdue work counts
assert.equal(on('b',6),false);                                        // work not yet due does not
console.log('Units per pupil: course switch kept; handed-in or overdue MEE work turns a unit on; exempt, future-only and unnamed work do not.');
