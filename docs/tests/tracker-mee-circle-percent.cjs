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
assert.deepEqual(map('Unit 6 test'),[]);
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
