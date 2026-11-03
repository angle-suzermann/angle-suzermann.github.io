/* The same structural index is used by the teacher picker and recipient link. */
(()=>{'use strict';
 function describe(doc=document){
  const pages=Array.from(doc.querySelectorAll('section.page,div.page'));
  const headings=Array.from(doc.querySelectorAll(pages.length?'section.page h2,section.page h3,div.page h2,div.page h3':'main h2,main h3,.exercise h2,.exercise h3'));
  const usable=headings.length?headings:Array.from(doc.querySelectorAll('h2,h3')).filter(h=>!h.closest('header,nav,dialog,.topbar'));
  const title=e=>(e.textContent||'').replace(/\s+/g,' ').trim();
  return {pages:pages.map((el,i)=>({token:'p'+i,label:'Страница '+(i+1)+(el.querySelector('h2,h3')?' · '+title(el.querySelector('h2,h3')):''),page:i,el})),exercises:usable.filter(h=>title(h)&&!/^results|итоги|roadmap|план занятия$/i.test(title(h))).map((el,i)=>({token:'e'+i,label:(pages.length?'Стр. '+(pages.indexOf(el.closest('section.page,div.page'))+1)+' · ':'')+title(el),page:pages.indexOf(el.closest('section.page,div.page')),el}))};
 }
 window.AngleAssignmentParts={describe};
 function open(){
  const match=location.hash.match(/^#angle-parts=([pe]\d+(?:,[pe]\d+)*)$/);if(!match)return;
  const model=describe(),items=match[1].split(',').map(t=>[...model.pages,...model.exercises].find(x=>x.token===t)).filter(Boolean);if(!items.length)return;
  const first=items[0];if(first.page>=0){const dots=document.querySelectorAll('.page-dot');if(dots[first.page])dots[first.page].click();else if(typeof window.showPage==='function')window.showPage(first.page)}
  const banner=document.createElement('aside');banner.setAttribute('role','note');banner.style.cssText='padding:12px 16px;margin:12px;border-left:4px solid #71568d;background:#f1eafa;color:#453458;line-height:1.5';banner.textContent='Назначено: '+items.map(x=>x.label).join('; ');const host=document.querySelector('#scrollArea,.scroll-area,main')||document.body;host.prepend(banner);
  items.forEach(x=>{x.el.style.outline='2px solid #d4b744';x.el.style.outlineOffset='4px'});first.el.scrollIntoView({block:'start'});
 }
 // Run after the worksheet restores its own saved page.
 if(document.readyState==='complete')open();else window.addEventListener('load',open,{once:true});
})();
