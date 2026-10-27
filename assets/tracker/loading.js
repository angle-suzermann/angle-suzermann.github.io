/* Fast read-only preview while the authoritative sheet is loading. */
export async function loadWithPreview({identity,load,preview,enabled=true}){
 const request=Promise.resolve().then(load);
 // Attach a rejection handler immediately while deriving the private cache key.
 request.catch(()=>{});
 let key=null,cached=null,notice=null;
 const regions=['view','tabs','courses'].map(id=>document.getElementById(id)).filter(Boolean);
 function lock(value){regions.forEach(el=>{el.inert=value;});}
 try{
  if(enabled&&globalThis.crypto?.subtle){
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(identity)));
   key='angleTracker.snapshot.v1.'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   try{cached=JSON.parse(localStorage.getItem(key)||'null');}catch{}
   if(cached?.data&&Date.now()-cached.time<7*86400000){
    try{
     preview(cached.data);lock(true);
     notice=document.createElement('div');notice.className='banner';notice.setAttribute('role','status');
     notice.textContent='Показана сохранённая копия от '+new Date(cached.time).toLocaleString('ru-RU')+'. Обновляем данные…';
     document.getElementById('banner')?.appendChild(notice);
    }catch{cached=null;lock(false);}
   }else cached=null;
  }
  const fresh=await request;
  if(key)try{localStorage.setItem(key,JSON.stringify({time:Date.now(),data:fresh}));}catch{}
  notice?.remove();lock(false);return fresh;
 }catch(error){
  if(cached&&notice){
   notice.textContent='Не удалось обновить данные. Показана сохранённая копия от '+new Date(cached.time).toLocaleString('ru-RU')+'. Изменения недоступны. ';
   const retry=document.createElement('button');retry.className='btn ghost';retry.textContent='Повторить';retry.onclick=()=>location.reload();notice.appendChild(retry);
   error.previewShown=true;
  }else lock(false);
  throw error;
 }
}
