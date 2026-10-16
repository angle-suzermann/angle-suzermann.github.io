/* ANGLE — наградной стикер для страниц с собственным подсчётом баллов.
   Подключается после assets/sticker-data.js и assets/sticker-logic.js.
   Страница, посчитав процент, вызывает одну строку:
       awardSticker(pct, anchorElement?)
   Если на странице нет блока #completionStickers, он создаётся сразу после
   anchor (по умолчанию — после #scoreSummary / #resultsPanel / #finishBig …),
   стили добавляются сами. Выбор стикера, подпись и уровни — те же, что в
   sticker-logic.js (renderResultSticker), отдельной копии таблицы нет.
   Добавлено 2026-10-16 для опубликованных материалов без наградной системы. */
(function(){
  var CSS = '.completion-stickers{text-align:center}'
    + '.completion-sticker{display:block;max-width:260px;margin:12px auto 0;animation:stickerPop .45s cubic-bezier(.2,1.4,.4,1)}'
    + '.completion-sticker[hidden]{display:none}'
    + '.completion-sticker--medium{max-width:170px}'
    + '.completion-sticker--icon{max-width:110px}'
    + '@keyframes stickerPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}'
    + '.result-caption{text-align:center;font-size:.92rem;color:#2b2b2b;margin:8px auto 0;max-width:420px}'
    + '.result-caption:empty{display:none}'
    + '.result-caption{background:rgba(255,255,255,.92);border-radius:10px;padding:6px 12px}';
  var ANCHORS = ['resultsFraction','scoreSummary','resultsPanel','resultsBreakdown','finishBig','scorePill','score','results','result'];
  function ensureCss(){
    if(document.getElementById('awardStickerCss')) return;
    var st = document.createElement('style'); st.id = 'awardStickerCss'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function findAnchor(a){
    if(a) return a;
    for(var i=0;i<ANCHORS.length;i++){ var el = document.getElementById(ANCHORS[i]); if(el) return el; }
    return document.getElementById('sendBtn') || document.querySelector('main, .page, body');
  }
  window.awardSticker = function(pct, anchor){
    try{
      if(typeof renderResultSticker !== 'function' || typeof STICKER_DATA === 'undefined') return;
      ensureCss();
      var wrap = document.getElementById('completionStickers');
      if(!wrap){
        var a = findAnchor(anchor);
        wrap = document.createElement('div'); wrap.className = 'completion-stickers'; wrap.id = 'completionStickers';
        var cap = document.createElement('p'); cap.id = 'resultCaption'; cap.className = 'result-caption';
        if(a && a.parentNode && a !== document.body){
          a.parentNode.insertBefore(cap, a.nextSibling);
          a.parentNode.insertBefore(wrap, a.nextSibling);
        } else { document.body.appendChild(wrap); document.body.appendChild(cap); }
      } else if(!document.getElementById('resultCaption')){
        var c2 = document.createElement('p'); c2.id = 'resultCaption'; c2.className = 'result-caption';
        wrap.parentNode.insertBefore(c2, wrap.nextSibling);
      }
      var tier = renderResultSticker(pct, wrap);
      return tier;
    }catch(e){ if(window.console) console.warn('awardSticker', e); }
  };
  /* сбросить награду (кнопка «Сбросить» / «Показать ответы» на страницах с повторной проверкой) */
  window.clearAwardSticker = function(){
    var w = document.getElementById('completionStickers'), c = document.getElementById('resultCaption');
    if(w) w.querySelectorAll('.completion-sticker').forEach(function(i){ i.hidden = true; });
    if(c) c.textContent = '';
  };
})();
