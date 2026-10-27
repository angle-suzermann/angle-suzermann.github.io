const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync('assets/tracker/individual.js','utf8');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(const STUDENT of [true,false]){
 const context={STUDENT,KINDS:{homework:'Homework'},safeLink:u=>/^https?:\/\//i.test(u||'')?u:'',esc,stateOf:t=>t.status==='N/A'?'na':t.status==='✓'?'ok':t.suggested?'sug':'',ui:{tedit:null},fmtDay:d=>d,stBtn:()=>'<button class="st"></button>'};
 vm.createContext(context);vm.runInContext(s.slice(s.indexOf('function taskCard('),s.indexOf('function groupWeeks('))+'\nglobalThis.renderTask=taskCard;',context);
 const task={n:1,kind:'homework',link:'https://example.test/worksheet',task:'Homework <1>',status:'N/A',points:5};
 const disabled=context.renderTask({},0,task);assert.equal(disabled.includes('<a '),!STUDENT);assert.equal(disabled.includes(task.link),!STUDENT);assert(disabled.includes('Homework &lt;1>'));
 for(const status of ['', '✓'])assert(context.renderTask({},0,{...task,status}).includes('<a href="https://example.test/worksheet"'));
 assert(context.renderTask({},0,{...task,status:'',suggested:'2026-10-27'}).includes('<a href='));
 assert(!context.renderTask({},0,{...task,status:'',link:'javascript:alert(1)'}).includes('<a '));
}
console.log('PASS: unassigned tasks have no anchor or URL for students; teachers retain working links; assigned, confirmed, suggested links remain active');
