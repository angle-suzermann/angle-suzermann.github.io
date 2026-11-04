// Every material must be covered by the shared tracker hook, and every delivery transport it uses must be one the hook observes.
// Fails when a new page uses an unobserved way of sending (native form, unknown provider, handler-attached partial button).
const fs=require('fs'),path=require('path'),assert=require('assert');
const SRC=['.'],SKIP=/(^|\/)(_site|node_modules|\.git|docs|handoffs|_templates|assets|staff-[^/]+)(\/|$)/;
const OBSERVED=['api.web3forms.com/submit','formspree.io/f/','usebasin.com/f/'];
const OTHER=/formsubmit\.co|getform\.io|formspark\.io|emailjs|netlify\/forms|data-netlify|web3forms\.com\/(?!submit)|mailto:/i;
const files=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(SKIP.test(p))continue;e.isDirectory()?walk(p):e.name==='index.html'&&files.push(p)}})('.');
const problems=[],count={materials:0,withMail:0,partialPages:0};
for(const f of files){const s=fs.readFileSync(f,'utf8');if(!s.includes('ws:course-id')||/name="ws:type"\s+content="presentation"/.test(s))continue;count.materials++;
  const uses=OBSERVED.some(h=>s.includes(h));if(uses)count.withMail++;
  if(/<form[^>]+action=["']https?:/i.test(s))problems.push(f+': native form with external action (not observed by the hook)');
  if(OTHER.test(s.replace(/mailto:[^"'\s]*/g,'')))problems.push(f+': unknown mail provider');
  if(/submitPartial\s*\(/.test(s)){count.partialPages++;const calls=(s.match(/submitPartial\s*\(/g)||[]).length,inline=(s.match(/onclick=["']submitPartial\s*\(/g)||[]).length;
    if(inline+1<calls)problems.push(f+': submitPartial is called from a handler the hook cannot see ('+inline+' inline of '+calls+')');}
}
// the build must inject the hook for every such page
const build=fs.readFileSync('build.mjs','utf8');assert(/submission-hook\.js\?v=\d+/.test(build),'build.mjs does not inject the submission hook');
assert(/MAIL\s*=\s*\/\^https:\\\/\\\/\(\?:api\\\.web3forms[^\n]*usebasin/.test(fs.readFileSync('assets/tracker/submission-hook.js','utf8')),'hook does not list Basin');
assert.deepStrictEqual(problems,[],problems.join('\n'));
console.log('PASS transports: '+count.materials+' materials, '+count.withMail+' with mail delivery (Web3Forms/Formspree/Basin), '+count.partialPages+' with partial buttons; no native forms or unknown providers');
