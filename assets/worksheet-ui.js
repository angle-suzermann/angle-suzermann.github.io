/* Normalise service controls only; never translate exercise text or rewrite answers. */
(function(){
 'use strict';
 function init(){
  if(!document.querySelector('#scrollArea .page, #restoreNote')) return;
  document.body.classList.add('angle-worksheet');
  var words={'Name:':'Имя:','Your full name':'Ваше имя','Next →':'Далее →','← Back':'← Назад','↺ Start over':'↺ Сбросить ответы','Start over (clear saved answers)':'Сбросить ответы','Check & Submit':'Проверить и отправить','Save my writing':'Скачать мои ответы','Roadmap':'План занятия'};
  function translate(root){
   var walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[],n;
   while((n=walk.nextNode())) if(!/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName)) nodes.push(n);
   nodes.forEach(function(n){var s=n.textContent.trim();if(words[s])n.textContent=n.textContent.replace(s,words[s]);});
  }
  document.querySelectorAll('.topbar,.nav-btns,.reset-link,#restoreNote,.sw-bar').forEach(translate);
  var name=document.getElementById('studentName');if(name)name.placeholder='Ваше имя';
  var reset=document.querySelector('.topbar-reset');
  if(reset){reset.title='Удалить сохранённые ответы этого задания в этом браузере';document.querySelectorAll('#restoreNote button,.reset-link').forEach(function(el){el.remove();});}
  var status=document.getElementById('saveIndicator');
  function localStatus(){if(!status)return;var text=status.textContent;if(/Saved/.test(text))status.textContent=text.replace('Saved','Сохранено в этом браузере');}
  if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');new MutationObserver(localStatus).observe(status,{childList:true,subtree:true,characterData:true});localStatus();}
  var note=document.getElementById('restoreNoteText');
  function restoreText(){if(note&&/^We found saved answers/.test(note.textContent))note.textContent='Найдена сохранённая работа. Ответы восстановлены в этом браузере.';}
  if(note){new MutationObserver(restoreText).observe(note,{childList:true,characterData:true,subtree:true});restoreText();}
  var label=document.getElementById('progressLabel');
  function progress(){if(label&&/^Page /.test(label.textContent))label.textContent=label.textContent.replace(/^Page /,'Страница ');}
  if(label){new MutationObserver(progress).observe(label,{childList:true,subtree:true,characterData:true});progress();}
  var pages=Array.from(document.querySelectorAll('#scrollArea section.page'));
  var roadmap=Array.from(document.querySelectorAll('h3')).find(function(el){return el.textContent.trim()==='Roadmap';});
  if(roadmap&&pages.length){roadmap.textContent='План занятия';var next=roadmap.nextElementSibling;if(next&&(next.tagName==='OL'||next.classList.contains('tag'))){var ol=document.createElement('ol');if(next.tagName==='OL')next.replaceWith(ol);else{roadmap.after(ol);while(next&&next.classList.contains('tag')){var following=next.nextElementSibling;next.remove();next=following;}}pages.forEach(function(page,i){var item=document.createElement('li'),heading=page.querySelector('h2');item.textContent=i===0?'Введение и разминка':heading?heading.textContent.trim().replace(/^Results$/,'Итоги'):'Этап '+(i+1);ol.appendChild(item);});}}
  document.querySelectorAll('.page-dot').forEach(function(dot,i){dot.setAttribute('role','button');dot.tabIndex=0;dot.setAttribute('aria-label','Страница '+(i+1)+(dot.title?' — '+dot.title:''));dot.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();dot.click();}});});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
