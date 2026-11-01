const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/catalog-share.js','utf8');
async function run(rich){
 const nodes=new Map();let listener,written,plain;
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',hidden:false,remove(){},focus(){},select(){}});return nodes.get(selector)};
 const dialog={querySelector:node,setAttribute(){},addEventListener(){},showModal(){},close(){},getBoundingClientRect(){return{left:0,right:100,top:0,bottom:100}}};
 class Item{constructor(parts){this.parts=parts}}
 const context={URL,Blob,location:{href:'https://angle.test/'},document:{createElement(){return dialog},body:{appendChild(){}},addEventListener(name,fn){listener=fn}},navigator:{userAgent:'test',platform:'test',maxTouchPoints:0,clipboard:{async write(items){written=items},async writeText(value){plain=value}}},ClipboardItem:rich?Item:undefined};
 vm.runInNewContext(source,context);
 const url='https://angle.test/report?p=fixture-recipient&report=fixture-document',title='Отчёт — ученица & группа';
 listener({preventDefault(){},stopPropagation(){},target:{closest(){return{dataset:{shareUrl:url,shareTitle:title,shareKind:'report'}}}}});
 await node('[data-max-copy]').onclick();
 assert.equal(node('#angleShareTitle').textContent,'Поделиться отчётом');
 if(rich){assert.equal(await written[0].parts['text/html'].text(),'<a href="https://angle.test/report?p=fixture-recipient&amp;report=fixture-document">Отчёт — ученица &amp; группа</a>');assert.equal(await written[0].parts['text/plain'].text(),url+'\n\n'+title);assert.match(node('.share-status').textContent,/Если MAX показывает адрес/)}
 else{assert.equal(plain,url+'\n\n'+title);assert.match(node('.share-status').textContent,/Форматированная ссылка недоступна/)}
}
(async()=>{await run(true);await run(false);console.log('PASS: MAX copies a title hyperlink with an intact plain-text fallback; unsupported browsers report the fallback accurately')})().catch(e=>{console.error(e);process.exitCode=1});
