(function(){
 'use strict';
 var key='angle.staff.recent.v1',section=document.getElementById('recentMaterials'),list=document.getElementById('recentList');
 if(!section||!list)return;
 var cards=Array.from(document.querySelectorAll('#staffList .staff-card:not(.personal-card)'));
 function anchor(card){return card.querySelector('a.open');}
 function read(){try{var data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter(function(x){return typeof x==='string';}).slice(0,8):[];}catch(e){return [];}}
 function render(){list.replaceChildren();read().forEach(function(href){var card=cards.find(function(c){var a=anchor(c);return a&&a.href===href;});if(!card)return;var a=anchor(card),row=document.createElement('div'),link=document.createElement('a');row.className='recent-item';link.href=a.href;link.target='_blank';link.rel='noopener';link.textContent=card.dataset.title;row.appendChild(link);list.appendChild(row);});section.hidden=!list.children.length;}
 document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var card=a.closest('#staffList .staff-card:not(.personal-card)');var recent=a.closest('#recentList');if((!card||!a.classList.contains('open'))&&!recent)return;var href=card?anchor(card).href:a.href;var history=read().filter(function(x){return x!==href;});history.unshift(href);try{localStorage.setItem(key,JSON.stringify(history.slice(0,8)));}catch(err){}render();});
 window.addEventListener('storage',function(e){if(e.key===key)render();});
 render();
})();
