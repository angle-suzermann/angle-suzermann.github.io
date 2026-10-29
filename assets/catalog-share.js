(function(){
 'use strict';
 let dialog,active,originButton;
 function safeUrl(raw){const url=new URL(raw,location.href);if(!/^https?:$/.test(url.protocol))throw new Error('Invalid URL');return url.href;}
 function close(){dialog.close();originButton?.focus();}
 function init(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.className='angle-share';dialog.setAttribute('aria-labelledby','angleShareTitle');
  dialog.innerHTML='<div class="share-heading"><h2 id="angleShareTitle">Поделиться материалом</h2><button type="button" data-share-close aria-label="Закрыть">×</button></div><p class="share-material"></p><div class="share-options"><button type="button" data-native-share>Выбрать приложение…</button><a data-telegram-share target="_blank" rel="noopener">Telegram</a><a data-sms-share>SMS / iMessage</a><button type="button" data-max-copy>MAX — скопировать сообщение</button><button type="button" data-rich-copy>Скопировать название со ссылкой</button><button type="button" data-text-copy>Скопировать название и адрес</button></div><p class="share-help">MAX и другие установленные приложения доступны через «Выбрать приложение», если они поддерживают меню вашего устройства. Ссылку внутри названия поддерживают не все мессенджеры; SMS передаёт обычный текст.</p><p class="share-status" role="status" aria-live="polite"></p>';
  document.body.appendChild(dialog);
  dialog.querySelector('[data-share-close]').onclick=close;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  dialog.querySelector('[data-native-share]').onclick=async()=>{
   try{await navigator.share({title:active.title,text:active.title,url:active.url});}
   catch(e){if(e.name!=='AbortError')status('Меню недоступно. Выберите Telegram, SMS или копирование.');}
  };
  dialog.querySelector('[data-text-copy]').onclick=async()=>{
   try{await navigator.clipboard.writeText(active.title+'\n'+active.url);status('Название и адрес скопированы.');}
   catch{manualCopy();}
  };
  dialog.querySelector('[data-max-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(active.title+'\n'+active.url);status('Сообщение скопировано. Откройте MAX и вставьте его в нужный чат.');}catch{manualCopy();}};
  dialog.querySelector('[data-rich-copy]').onclick=async()=>{
   const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   try{
    if(!globalThis.ClipboardItem||!navigator.clipboard?.write)throw new Error('Unsupported');
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob(['<a href="'+esc(active.url)+'">'+esc(active.title)+'</a>'],{type:'text/html'}),'text/plain':new Blob([active.title+'\n'+active.url],{type:'text/plain'})})]);
    status('Название со ссылкой скопировано. Вид вставки зависит от приложения.');
   }catch{try{await navigator.clipboard.writeText(active.title+'\n'+active.url);status('Форматированная ссылка недоступна: скопированы название и адрес.');}catch{manualCopy();}}
  };
 }
 function status(text){dialog.querySelector('.share-status').textContent=text;}
 function manualCopy(){let field=dialog.querySelector('textarea');if(!field){field=document.createElement('textarea');field.readOnly=true;field.setAttribute('aria-label','Название и ссылка для копирования');dialog.appendChild(field);}field.value=active.title+'\n'+active.url;field.focus();field.select();status('Выделенный текст можно скопировать вручную.');}
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-share-url]');if(!button)return;e.preventDefault();e.stopPropagation();
  init();originButton=button;
  try{active={title:button.dataset.shareTitle||'Материал ANGLE',url:safeUrl(button.dataset.shareUrl)};}catch{return;}
  dialog.querySelector('.share-material').textContent=active.title;status('');dialog.querySelector('textarea')?.remove();
  dialog.querySelector('[data-telegram-share]').href='https://t.me/share/url?url='+encodeURIComponent(active.url)+'&text='+encodeURIComponent(active.title);
  const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  dialog.querySelector('[data-sms-share]').href='sms:'+(isiOS?'&':'?')+'body='+encodeURIComponent(active.title+'\n'+active.url);
  dialog.querySelector('[data-native-share]').hidden=typeof navigator.share!=='function';
  dialog.showModal();
 });
})();
