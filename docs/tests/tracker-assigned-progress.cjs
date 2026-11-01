const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const group=fs.readFileSync('assets/tracker/tracker.js','utf8');
const individual=fs.readFileSync('assets/tracker/individual.js','utf8');
const ctx={D:{mee:[]},Map,Date,dateParts:raw=>String(raw||'').split(/\s*[·;]\s*/).filter(Boolean)};
vm.createContext(ctx);
vm.runInContext(group.slice(group.indexOf('function meeFor('),group.indexOf('function ring2(')),ctx);
for(const course of ['Starters','Movers','Flyers','B1']){
 ctx.D.mee=[{course,student:'Demo',hw:'A',status:'done',pct:80},{course,student:'Demo',hw:'B',status:'pending',due:'2099-01-01'},{course,student:'Demo',hw:'C',status:'missing',due:'2099-01-01'},{course,student:'Demo',hw:'D',status:'na'},{course,student:'Demo',hw:'A',status:'done',pct:90}];
 const actual=ctx.meeSum(ctx.meeFor(course,{name:'Demo'}));
 assert.equal(actual.assigned,3);assert.equal(actual.done,1);assert.equal(actual.sub,1/3);assert.equal(actual.q,.9);
}
assert.equal(ctx.meeSum([]).sub,null);
assert.equal(ctx.meeSum([{status:'na'}]).sub,null);
vm.runInContext(individual.slice(individual.indexOf('function trackerDateISO('),individual.indexOf('const dateInputs=')),ctx);
vm.runInContext(individual.slice(individual.indexOf('function lessonHasStarted('),individual.indexOf('function individualRings(')),ctx);
assert.equal(ctx.lessonHasStarted({date:'2026-11-02'},'2026-11-01'),false);
assert.equal(ctx.lessonHasStarted({date:'2026-11-01'},'2026-11-01'),true);
assert.equal(ctx.lessonHasStarted({date:'01.11.2026'},'2026-11-01'),true);
assert.equal(ctx.lessonHasStarted({date:'November, 2, 2026'},'2026-11-01'),false);
assert.equal(ctx.lessonHasStarted({date:'2026-10-29 · 2026-11-05'},'2026-11-01'),true);
assert.equal(ctx.lessonHasStarted({when:'2099-01-01'},'2026-11-01'),true,'deadline is not lesson date');
assert.equal(ctx.lessonHasStarted({date:''},'2026-11-01'),true,'undated existing work is not silently removed');
const result=ctx.individualMetrics({blocks:[{tasks:[{status:'✓',date:'2000-01-01',note:'Worksheet 80%',points:1},{status:'',date:'2000-01-01',when:'2099-01-01',points:99},{status:'',date:'2099-01-01'},{status:'✓',date:'2099-01-01',note:'MEE 100%'},{status:'N/A',date:'2000-01-01'}]}]});
assert.equal(result.total,2);assert.equal(result.done,1);assert.equal(result.sub,.5);assert.equal(result.quality,.8);
console.log('PASS: every group includes assigned future deadlines, excludes waivers and duplicates; individual lesson date excludes advance plans while future deadlines remain; task counts are not weighted points.');
