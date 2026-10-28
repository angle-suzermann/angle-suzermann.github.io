(function(){
 'use strict';
 if(document.getElementById('task38Reference'))return;
 const assets=new URL('task38-reference/',document.currentScript.src);
 const resource=name=>new URL(name,assets).href;
 const launch=document.createElement('button');
 launch.type='button';launch.className='ref38-trigger';launch.textContent='Справка К1–К5';
 launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-controls','task38Reference');
 launch.title='Кодификатор ошибок и критерии оценивания задания 38';
 (document.getElementById('pageDots')||document.querySelector('.namebar')).appendChild(launch);
 const dialog=document.createElement('dialog');dialog.id='task38Reference';dialog.className='ref38-dialog';
 dialog.setAttribute('aria-labelledby','ref38Title');
 const pdfLink=(name,label)=>`<a href="${resource(name)}" target="_blank" rel="noopener">${label} ↗</a>`;
 const image=(name,alt)=>`<a class="ref38-page" href="${resource(name)}" target="_blank" rel="noopener" aria-label="Открыть изображение крупнее: ${alt}"><img src="${resource(name)}" loading="lazy" alt="${alt}"></a>`;
 dialog.innerHTML=`<header class="ref38-head"><div><h2 id="ref38Title">Кодификатор ошибок и критерии</h2><p>Задание 38 · справка для Classwork и Homework</p></div><button type="button" class="ref38-close" aria-label="Закрыть справку" autofocus>✕</button></header>
 <div class="ref38-tabs" role="tablist" aria-label="Разделы справки">
 <button type="button" id="ref38Tab0" role="tab" aria-controls="ref38Panel0" aria-selected="true" tabindex="0">Ошибки К1–К5</button>
 <button type="button" id="ref38Tab1" role="tab" aria-controls="ref38Panel1" aria-selected="false" tabindex="-1">Кодификатор ФИПИ</button>
 <button type="button" id="ref38Tab2" role="tab" aria-controls="ref38Panel2" aria-selected="false" tabindex="-1">Критерии оценивания</button>
 </div>
 <div class="ref38-scroll">
 <section id="ref38Panel0" role="tabpanel" aria-labelledby="ref38Tab0" tabindex="0">
 <p class="ref38-note">Рабочая схема для классификации ошибок в тренажёре. Кодификатор ФИПИ перечисляет проверяемые умения и языковые темы; баллы за эссе определяют критерии оценивания. Оригиналы — в соседних вкладках.</p>
 <div class="ref38-codes">
 <article><h3>К1 · Решение коммуникативной задачи</h3><p>Проверь содержание по плану: вступление, факты, сравнение с комментарием, проблема с решением, собственное мнение с объяснением. Сюда же относятся неверная передача данных и нарушение нейтрального стиля.</p></article>
 <article><h3>К2 · Организация текста</h3><p>Логика, структура и абзацы; средства связи между частями текста. Неверная связка или неясная отсылка местоимения может нарушать организацию, даже если отдельные слова написаны верно.</p></article>
 <article><h3>К3 · Лексика</h3><p>Выбор слова, значение, сочетаемость и фразовые глаголы. Если написание привело к другому слову, например then вместо than, нельзя автоматически считать это только орфографией.</p></article>
 <article><h3>К4 · Грамматика</h3><p>Времена и формы глагола, согласование, число, артикли, местоимения, предлоги, порядок слов, неличные формы. Ориентир в кодификаторе — раздел 2.4; частицы фразовых глаголов рассматриваются вместе с лексикой.</p></article>
 <article><h3>К5 · Орфография и пунктуация</h3><p>Написание слов и знаки препинания. Апостроф и кавычки входят в пунктуацию: см. пункт 2.2.2 кодификатора. Ошибки, изменившие значение слова или грамматическую форму, требуют проверки по К3/К4.</p></article>
 </div>
 <p class="ref38-note">В одном предложении могут быть ошибки нескольких категорий. В спорных случаях используй пометки тренажёра: правило ФИПИ, рекомендация экспертов или допустимые альтернативы.</p>
 <p class="ref38-links"><a href="https://doc.fipi.ru/ege/dlya-predmetnyh-komissiy-subektov-rf/2026/angl_yaz_pch_mr_ege_2026.pdf" target="_blank" rel="noopener">Методические рекомендации ФИПИ 2026 · письменная речь ↗</a></p>
 </section>
 <section id="ref38Panel1" role="tabpanel" aria-labelledby="ref38Tab1" tabindex="0" hidden>
 <h3>Кодификатор ФИПИ · проект ЕГЭ 2027</h3>
 <p>Ниже — оригинальные страницы 14–18: орфография и пунктуация (2.2), лексика (2.3) и грамматика (2.4). Полный кодификатор содержит 22 страницы.</p>
 <p class="ref38-links">${pdfLink('fipi-codifier-2027.pdf','Открыть полный кодификатор PDF')}</p>
 ${[14,15,16,17,18].map(n=>image('codifier-'+n+'.webp','Кодификатор ФИПИ 2027, страница '+n)).join('')}
 </section>
 <section id="ref38Panel2" role="tabpanel" aria-labelledby="ref38Tab2" tabindex="0" hidden>
 <h3>Оригинальные критерии задания 38 · проект ЕГЭ 2027</h3>
 <p>Максимум — 14 баллов: К1–К4 по 3, К5 — 2. Ниже — оригинальные страницы 32–34 демоверсии. PDF также включает дополнительные схемы и порядок подсчёта слов (страницы 32–38).</p>
 <p class="ref38-links">${pdfLink('fipi-task38-criteria-2027.pdf','Открыть критерии и схемы PDF')}</p>
 ${[1,2,3].map(n=>image('criteria-'+n+'.webp','Критерии ФИПИ 2027, страница '+(31+n))).join('')}
 </section>
 <footer class="ref38-source">Источник оригиналов: <a href="https://fipi.ru/ege/demoversii-specifikacii-kodifikatory" target="_blank" rel="noopener">ФИПИ, комплект по английскому языку 2027</a>. На 28.10.2026 документы обозначены ФИПИ как проекты. Методические рекомендации для экспертов по письменной речи — за 2026 год.</footer>
 </div>`;
 document.body.appendChild(dialog);
 const tabs=[...dialog.querySelectorAll('[role=tab]')],panels=[...dialog.querySelectorAll('[role=tabpanel]')];
 function select(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index});dialog.querySelector('.ref38-scroll').scrollTop=0}
 tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>select(i));
  tab.addEventListener('keydown',e=>{
   let next=i;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;
   e.preventDefault();select(next);tabs[next].focus();
  });
 });
 launch.addEventListener('click',()=>{if(!dialog.open)dialog.showModal()});
 dialog.querySelector('.ref38-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>launch.focus());
 dialog.addEventListener('keydown',e=>e.stopPropagation());
})();
