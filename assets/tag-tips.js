/* Метки-источники (.vb-tag, .src): подсказка по клику или касанию, а не только по наведению.
   Клик открывает строку с источником под меткой, повторный клик или клик в другом месте закрывает. */
(function () {
  'use strict';
  var SEL = '.vb-tag[title], .src[title]';
  var css = document.createElement('style');
  css.textContent = '.tag-tip{display:block;margin:4px 0 2px;padding:5px 10px;border-radius:8px;background:#fff;border:1.5px solid #5E4877;color:#453458;font-size:.82rem;font-weight:700;line-height:1.4;max-width:34em}'
    + '.vb-tag[title],.src[title]{cursor:pointer}';
  document.head.appendChild(css);
  var open = null;
  function close() { if (open) { open.tip.remove(); open = null; } }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest(SEL) : null;
    if (!t) { close(); return; }
    if (open && open.src === t) { close(); return; }
    close();
    var tip = document.createElement('span');
    tip.className = 'tag-tip';
    tip.textContent = t.getAttribute('title');
    /* вставляем после ближайшего блока, чтобы не ломать строку с текстом */
    var host = t.closest('li,p,td,div') || t.parentNode;
    host.insertAdjacentElement('afterend', tip);
    open = { src: t, tip: tip };
    e.preventDefault();
  });
})();
