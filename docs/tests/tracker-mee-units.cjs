const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/tracker/tracker.js','utf8');
const ctx={esc:s=>String(s).replace(/</g,'&lt;'),isTest:r=>/\btest\b/i.test(r.hw),rateBlock:()=>''};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function meeUnitGroups('),source.indexOf('function renderParent(')),ctx);
const rows=[
 {hw:'WB unit 4 writing',due:'2026-10-20',status:'missing'},
 {hw:'WB unit 6 grammar',due:'2026-10-01',status:'done',pct:79},
 {hw:'WB unit 5 reading',due:'2026-10-25',status:'na'},
 {hw:'WB Unit 6 speaking',due:'2026-11-08',status:'done',pct:100},
 {hw:'WB unit 12 reading',due:'2026-09-01',status:'pending'},
 {hw:'Writing <practice>',due:'2026-10-26',status:'missing'},
 {hw:'Unit 6 test',due:'2026-10-28',status:'done',pct:80}
];
const before=JSON.stringify(rows);
for(const teacher of [false,true]){
 const html=ctx.meeBlock(rows,null,teacher);
 const groups=[...html.matchAll(/data-mee-unit="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(groups,['12','6','5','4','other','6']);
 const unit6=html.match(/data-mee-unit="6">([\s\S]*?)<\/section>/)[1];
 assert(unit6.indexOf('speaking')<unit6.indexOf('grammar'));
 assert(!unit6.includes('unit 4')&&!unit6.includes('unit 5'));
 assert(html.includes('79%')&&html.includes('100%')&&html.includes('80%'));
 assert(html.includes(teacher?'not required':'не требуется'));
 assert(html.includes('&lt;practice>'));
}
assert.equal(JSON.stringify(rows),before);
assert.equal(ctx.meeBlock([],null,false),'');
console.log('PASS: MEE units separated, numeric unit order, dates within unit, tests separate, unknown unit preserved, statuses and source data unchanged.');
