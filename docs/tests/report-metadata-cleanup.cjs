const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('assets/tracker/parent-reports.js','utf8').replace('window.AngleParentReports={panel,shareButton:toolbarShare};','window.AngleParentReports={panel,shareButton:toolbarShare,reportBody};');
const sandbox={window:{},document:{currentScript:{src:'https://example.test/assets/tracker/parent-reports.js'},addEventListener(){}},URL,TextEncoder,setTimeout(){}};vm.runInNewContext(src,sandbox);
for(const label of ['ДАННЫ Е НА','ДАННЫЕ НА','ПЕРИОД','ДАТА','ДАТА ОТЧЁТА'])for(const nl of ['\n','\r\n']){
 const text=['УЧЕНИК','Ульяна','КУРС','ЕГЭ 2027',label,'16.10.2026','Анастасия, здравствуйте!','Главное','90% — результат чтения.'].join(nl);
 const html=sandbox.window.AngleParentReports.reportBody(text,'parent');assert(!html.includes('УЧЕНИК'));assert(!html.includes(label));assert(html.includes('Анастасия, здравствуйте!'));assert(html.includes('90%'));
}
assert(sandbox.window.AngleParentReports.reportBody('Главное\nУЧЕНИК — тема обсуждения.','parent').includes('УЧЕНИК — тема обсуждения.'));
console.log('PASS: extracted PDF metadata removed for five labels and LF/CRLF; greeting, scores and legitimate content preserved');
