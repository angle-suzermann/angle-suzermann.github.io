const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/tracker/tracker.js'),'utf8');
const cut=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
const ctx=vm.createContext({D:{courses:{},progress:{},mee:[]},EXTRA_DELETED_PREFIX:'__deleted__'});
const escLine=source.slice(source.indexOf('const esc='),source.indexOf('\n',source.indexOf('const esc=')));
vm.runInContext(escLine+'\n'+cut('const pk=','const fmt=')+cut('function next(','function ring(')+source.slice(source.indexOf('function meeFor('),source.indexOf('function assignedWorkFor(')),ctx);
const sections=['Vocabulary','Reading','Grammar 1','Developing Vocabulary','Great Learners, Great Thinkers','Developing Listening','Grammar 2','Speaking','Writing','Revision','Test'].map((name,i)=>({id:'sec'+(i+1),name}));
ctx.D={courses:{B1:{units:[{n:2},{n:5},{n:6}],sections,phonics:[],extras:[],students:[{id:'a',name:'Pupil A'},{id:'b',name:'Pupil B'}]}},progress:{},mee:[]};
const map=hw=>JSON.parse(vm.runInContext(`JSON.stringify(meeSections("B1",${JSON.stringify(hw)}))`,ctx));
assert.deepEqual(map('WB unit 2 vocab 🐼🐬'),['sec1']);
assert.deepEqual(map('WB unit 1 voc'),['sec1']);
assert.deepEqual(map('WB unit 5 developing vocab and listening'),['sec4','sec6']);
assert.deepEqual(map('WB unit 1 developing vocab ex 1,2,6'),['sec4']);
assert.deepEqual(map('WB unit 6 developing vocabulary and listening'),['sec4','sec6']);
assert.deepEqual(map('WB unit 1 developing listening'),['sec6']);
assert.deepEqual(map('WB unit 6 grammar 1'),['sec3']);
assert.deepEqual(map('WB unit 1 grammar ex3-6'),['sec3']);
assert.deepEqual(map('wb unit 2 Grammar (past cont)'),['sec7']);
assert.deepEqual(map('WB unit 6 grammar 2 Conditionals 0-1'),['sec7']);
assert.deepEqual(map('wb unit 2 writing + review'),['sec9','sec10']);
assert.deepEqual(map('WB unit 5 review'),['sec10']);
assert.deepEqual(map('Unit 1 backlog'),[]);
assert.deepEqual(map('Unit 6 test'),['sec11']); // test -> Test section only
assert.deepEqual(map('06. Unit 1 — Emergencies & Past Tenses — Test'),['sec11']);
const add=r=>ctx.D.mee.push({course:'B1',student:'Pupil A',due:'2026-11-15',pts:'',max:'',...r});
const score=(n,sec,sid='a')=>vm.runInContext(`sectionMeeScore('B1','${sid}',${n},'${sec}')`,ctx);
const html=(scope,sec)=>vm.runInContext(`dot('B1','a','${scope}','${sec}','u',true)`,ctx);
add({hw:'WB unit 2 vocab 🐼🐬',status:'done',pct:44});
assert.equal(score(2,'sec1').pct,44);
assert.match(html('u2','sec1'),/44%/);assert.match(html('u2','sec1'),/Результат MEE \(WB unit 2 vocab/);
assert.equal(score(2,'sec2'),null);assert.equal(score(2,'sec1','b'),null); // other section, other pupil
add({hw:'WB unit 6 speaking',status:'done',pct:''});assert.equal(score(6,'sec8'),null); // awaiting grading: no number
add({hw:'WB unit 6 reading',status:'pending',pct:''});assert.equal(score(6,'sec2'),null);
add({hw:'WB unit 5 grammar 1 a',status:'done',pct:60});add({hw:'WB unit 5 grammar 1 b',status:'done',pct:100});
assert.equal(score(5,'sec3'),null); // two tasks without points: never average percentages
ctx.D.mee.slice(-2).forEach((r,i)=>{r.pts=[3,10][i];r.max=[5,10][i]});assert.equal(score(5,'sec3').pct,87); // 13/15
add({hw:'WB unit 5 review',status:'na',pct:''});add({hw:'WB unit 5 review b',status:'done',pct:80});assert.equal(score(5,'sec10').pct,80); // exempt excluded
ctx.D.progress['B1|a|u2|sec1']='N/A';assert.doesNotMatch(html('u2','sec1'),/%/); // not assigned: no number
ctx.D.progress['B1|a|u2|sec1']='✓';assert.match(html('u2','sec1'),/class="dot d worksheet-score"/);
console.log('PASS: MEE percentage on unit circles — section mapping, single task, ungraded, pending, no averaging, points total, exempt, N/A, tick styling');
// 08.11.2026: one piece of work = one task in the submission ring
{
 const c2=vm.createContext({D:{},EXTRA_DELETED_PREFIX:'__deleted__'});
 vm.runInContext(escLine+'\n'+cut('const pk=','const fmt=')+cut('function next(','function ring(')+source.slice(source.indexOf('function meeFor('),source.indexOf('function ring2(')),c2);
 const fresh=()=>{c2.D={courses:{B1:{units:[{n:2},{n:6}],sections,phonics:[],extras:[],students:[{id:'m',name:'Pupil M'}]}},progress:{},mee:[]};};
 const sum=()=>JSON.parse(vm.runInContext("JSON.stringify(groupSubmission('B1',D.courses.B1.students[0]))",c2));
 const row=(hw,status)=>c2.D.mee.push({course:'B1',student:'Pupil M',hw,status,due:'2026-11-15',pct:status==='done'?42:''});
 fresh();row('WB unit 2 vocab 🐼🐬','done');c2.D.progress['B1|m|u2|sec1']='✓';
 assert.deepEqual([sum().assigned,sum().done],[1,1]); // tick + MEE row = one task, not two
 fresh();row('WB unit 2 vocab 🐼🐬','pending');c2.D.progress['B1|m|u2|sec1']='Assigned';
 assert.deepEqual([sum().assigned,sum().done],[1,0]); // agent "Assigned" does not double the task
 fresh();row('WB unit 2 vocab 🐼🐬','missing');c2.D.progress['B1|m|u2|sec1']='✓';
 assert.deepEqual([sum().assigned,sum().done],[1,1]); // teacher tick confirms paper work
 fresh();row('WB unit 2 vocab 🐼🐬','missing');c2.D.progress['B1|m|u2|sec1']='N/A';
 assert.equal(sum().assigned,0); // released
 fresh();row('wb unit 2 writing + review','done');c2.D.progress['B1|m|u2|sec9']='✓';c2.D.progress['B1|m|u2|sec10']='✓';
 assert.deepEqual([sum().assigned,sum().done],[1,1]); // one combined task covers two circles
 fresh();row('WB unit 1 grammar ex 1,2','done');row('WB unit 1 grammar ex3-6','pending');c2.D.courses.B1.units.push({n:1});c2.D.progress['B1|m|u1|sec3']='Assigned';
 assert.deepEqual([sum().assigned,sum().done],[2,1]); // two MEE tasks in one section stay two tasks
 fresh();c2.D.progress['B1|m|u2|sec2']='✓';row('WB unit 2 vocab 🐼🐬','done');
 assert.deepEqual([sum().assigned,sum().done],[2,2]); // circle without MEE work still counts
 console.log('PASS: submission ring — one piece of work counts once (tick, Assigned, paper credit, N/A, combined, separate tasks)');
}
{ // 08.11.2026: online unit test (source worksheet) shows on the Unit test circle and counts once
 const c3=vm.createContext({D:{},EXTRA_DELETED_PREFIX:'__deleted__'});
 vm.runInContext(escLine+'\n'+cut('const pk=','const fmt=')+cut('function next(','function ring(')+source.slice(source.indexOf('function meeFor('),source.indexOf('function ring2(')),c3);
 c3.D={courses:{Flyers:{units:[{n:1}],sections:[{id:'sec4',name:'Grammar'},{id:'sec12',name:'Unit test'}],phonics:[],extras:[{id:'e1',topic:'Emergency Lab · Words & feelings'}],students:[{id:'fl4',name:'Pupil N'}]}},progress:{'Flyers|fl4|u1|sec12':'✓'},mee:[
  {course:'Flyers',student:'Pupil N',hw:'06. Unit 1 — Emergencies & Past Tenses — Test',status:'done',pct:72,source:'worksheet',due:'2026-11-08'},
  {course:'Flyers',student:'Pupil N',hw:'05. Emergency Lab · Words & feelings',status:'done',pct:90,source:'worksheet',due:'2026-11-05'}]};
 assert.equal(JSON.parse(vm.runInContext("JSON.stringify(sectionMeeScore('Flyers','fl4',1,'sec12'))",c3)).pct,72);
 const g=JSON.parse(vm.runInContext("JSON.stringify(groupSubmission('Flyers',D.courses.Flyers.students[0]))",c3));
 assert.deepEqual([g.assigned,g.done],[2,2]); // test once + extra once
 console.log('PASS: online unit test on the Unit test circle, counted once; extra worksheets unaffected');
}
