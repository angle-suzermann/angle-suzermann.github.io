/* ============================================================
   Общий движок интерактивных тестов ANGLE
   Подключается в конце <body>:
     <script src="/assets/test-engine.js"></script>

   Ничего настраивать в JS не нужно — движок сам читает разметку.

   ЧТО ОН ИЩЕТ В РАЗМЕТКЕ
   ----------------------
   Секции:   <section class="card" id="ex1" data-name="01 Словарь">
             id — любой уникальный; data-name — подпись в разбивке результатов.

   Вопросы (три вида, можно смешивать в одной секции):
     1. Текстовое поле
        <input type="text" data-q="1_1" data-ans="teaspoon">
        Несколько верных вариантов — через | :
        <input type="text" data-q="1_1" data-ans-list="lorry|truck">
     2. Выпадающий список
        <select data-q="1_1m" data-ans="h">…</select>
     3. Группа кнопок-вариантов
        <div class="dialog-line" data-group="6_1" data-ans="something">
          <button class="choice-btn" data-val="something">something</button>
          <button class="choice-btn" data-val="anything">anything</button>
        </div>

   Куда отправлять результат — из <meta name="ws:formspree" content="xxxx">
   Название теста в письме — из <meta name="ws:title" content="…">

   Обязательные элементы страницы:
     #studentName #studentGroup #progressFill #progressLabel #checkBtn
     #resultsPanel #resultsPercent #resultsFraction #resultsBreakdown
   Необязательные (блок отправки):  #sendBtn #sendStatus
   Необязательный:                  #resetLink
   ============================================================ */

(function(){
  'use strict';

  var $  = function(id){ return document.getElementById(id); };
  var meta = function(name){
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content').trim() : '';
  };

  var TEST_TITLE = meta('ws:title') || document.title;
  var FORMSPREE  = meta('ws:formspree');
  var WEB3FORMS_KEY = '8af30ecf-0d8b-4e1f-aa4b-2b3b76fe8234';

  var sections = Array.prototype.slice.call(
    document.querySelectorAll('section.card[id]')
  );
  var lastResults = null;

  function normalize(str){
    return (str || '')
      .toLowerCase()
      .replace(/[?.!]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inputs(){  return document.querySelectorAll('input[data-q]');  }
  function selects(){ return document.querySelectorAll('select[data-q]'); }
  function groups(){  return document.querySelectorAll('[data-group]');   }

  function sectionOf(el){
    var s = el.closest('section.card[id]');
    return s ? s.id : null;
  }

  var TOTAL = inputs().length + selects().length + groups().length;

  /* ---------- прогресс ---------- */

  function updateProgress(){
    var answered = 0;
    inputs().forEach(function(el){  if(normalize(el.value) !== '') answered++; });
    selects().forEach(function(el){ if(el.value !== '') answered++; });
    groups().forEach(function(g){   if(g.querySelector('.choice-btn.selected')) answered++; });

    var fill  = $('progressFill');
    var label = $('progressLabel');
    if(fill)  fill.style.width = (TOTAL ? Math.round((answered / TOTAL) * 100) : 0) + '%';
    if(label) label.textContent = answered + ' / ' + TOTAL + ' answered';
  }

  inputs().forEach(function(el){
    el.addEventListener('input', function(){
      el.classList.remove('correct', 'incorrect');
      updateProgress();
    });
  });

  selects().forEach(function(el){
    el.addEventListener('change', function(){
      el.classList.remove('correct', 'incorrect');
      updateProgress();
    });
  });

  document.querySelectorAll('[data-group] .choice-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var group = btn.closest('[data-group]');
      group.querySelectorAll('.choice-btn').forEach(function(b){
        b.classList.remove('selected', 'correct', 'incorrect', 'reveal-correct');
      });
      btn.classList.add('selected');
      updateProgress();
    });
  });

  /* ---------- проверка ---------- */

  /* человекочитаемая подпись элемента для разбивки ошибок:
     если рядом есть .item с .item-number — берём "секция, №N (data-q)",
     иначе просто "секция — data-q/data-group id". Ничего в разметке
     это не требует, деградирует мягко на любой странице. */
  function itemLabel(el, fallbackId){
    var section = el.closest('section.card[id]');
    var sectionName = section ? (section.getAttribute('data-name') || section.id) : '';
    var item = el.closest('.item');
    var num  = item ? item.querySelector('.item-number') : null;
    if(num){
      var n = num.textContent.replace(/[^\d]/g, '');
      return (sectionName || 'Без секции') + (n ? ', №' + n : '') +
        (fallbackId ? ' (' + fallbackId + ')' : '');
    }
    return (sectionName ? sectionName + ' — ' : '') + fallbackId;
  }

  function check(){
    var correctCount = 0;
    var score = {};
    var wrongList = [];
    sections.forEach(function(s){ score[s.id] = { correct: 0, total: 0 }; });

    function tally(sec, isCorrect){
      if(!score[sec]) return;
      score[sec].total++;
      if(isCorrect){ score[sec].correct++; correctCount++; }
    }

    inputs().forEach(function(el){
      var ok;
      var answerText = el.hasAttribute('data-ans-list')
        ? el.getAttribute('data-ans-list').split('|')[0]
        : el.getAttribute('data-ans');
      if(el.hasAttribute('data-ans-list')){
        ok = el.getAttribute('data-ans-list').split('|').map(normalize)
               .indexOf(normalize(el.value)) !== -1;
      } else {
        ok = normalize(el.value) === normalize(el.getAttribute('data-ans'));
      }
      el.classList.toggle('correct', ok);
      el.classList.toggle('incorrect', !ok);
      tally(sectionOf(el), ok);
      if(!ok){
        wrongList.push(itemLabel(el, el.getAttribute('data-q')) +
          ' → answered "' + (el.value.trim() || '(blank)') + '", correct "' + answerText + '"');
      }
    });

    selects().forEach(function(el){
      var ok = normalize(el.value) === normalize(el.getAttribute('data-ans'));
      el.classList.toggle('correct', ok);
      el.classList.toggle('incorrect', !ok);
      tally(sectionOf(el), ok);
      if(!ok){
        wrongList.push(itemLabel(el, el.getAttribute('data-q')) +
          ' → answered "' + (el.value || '(blank)') + '", correct "' + el.getAttribute('data-ans') + '"');
      }
    });

    groups().forEach(function(g){
      var key      = g.getAttribute('data-ans');
      var selected = g.querySelector('.choice-btn.selected');
      var ok       = false;

      g.querySelectorAll('.choice-btn').forEach(function(b){
        b.classList.remove('correct', 'incorrect', 'reveal-correct');
        if(normalize(b.dataset.val) === normalize(key)) b.classList.add('reveal-correct');
      });

      if(selected){
        ok = normalize(selected.dataset.val) === normalize(key);
        selected.classList.add(ok ? 'correct' : 'incorrect');
        if(ok) selected.classList.remove('reveal-correct');
      }
      tally(sectionOf(g), ok);
      if(!ok){
        wrongList.push(itemLabel(g, g.getAttribute('data-group')) +
          ' → answered "' + (selected ? selected.dataset.val : '(blank)') + '", correct "' + key + '"');
      }
    });

    var percent = TOTAL ? Math.round((correctCount / TOTAL) * 100) : 0;

    $('resultsPercent').textContent  = percent + '%';
    $('resultsFraction').textContent = correctCount + ' / ' + TOTAL + ' correct';
    $('resultsPanel').classList.add('show');

    var breakdown = $('resultsBreakdown');
    breakdown.innerHTML = '';
    sections.forEach(function(s, i){
      var span = document.createElement('span');
      span.textContent = '#' + (i + 1) + ': ' + score[s.id].correct + '/' + score[s.id].total;
      breakdown.appendChild(span);
    });

    lastResults = {
      percent: percent,
      correct: correctCount,
      total: TOTAL,
      sections: sections.map(function(s, i){
        return {
          name:    s.getAttribute('data-name') || ('#' + (i + 1)),
          correct: score[s.id].correct,
          total:   score[s.id].total
        };
      }),
      mistakes: wrongList
    };

    resetSendUI();
    $('resultsPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- отправка учителю ---------- */

  function resetSendUI(){
    var btn = $('sendBtn'), status = $('sendStatus');
    if(status){ status.textContent = ''; status.className = 'send-status'; }
    if(btn){ btn.disabled = false; btn.textContent = 'Отправить результат учителю'; }
  }

  function send(){
    var status = $('sendStatus');
    var btn    = $('sendBtn');

    function fail(msg){
      status.textContent = msg;
      status.className = 'send-status err';
    }

    if(!lastResults){ return fail('Сначала нажмите «Проверить ответы».'); }

    // ws:formspree теперь используется только как метка курса в письме (course_id),
    // а не как отдельный адрес доставки — реальный адрес один для всего сайта (Web3Forms).
    // Если тег не заполнен, отправка всё равно проходит, просто без метки курса.

    var name  = $('studentName').value.trim();
    var group = $('studentGroup') ? $('studentGroup').value.trim() : '';

    if(!name){
      fail('Впишите имя ученика вверху страницы.');
      $('studentName').focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Отправка…';
    status.textContent = '';
    status.className = 'send-status';

    var payload = {
      access_key:     WEB3FORMS_KEY,
      course_id:      FORMSPREE,
      subject:        'ANGLE — результат: ' + TEST_TITLE,
      test:           TEST_TITLE,
      student_name:   name,
      group:          group || '—',
      score_percent:  lastResults.percent + '%',
      score_fraction: lastResults.correct + ' / ' + lastResults.total,
      breakdown:      lastResults.sections.map(function(s){
                        return s.name + ': ' + s.correct + '/' + s.total;
                      }).join('\n'),
      mistakes:       lastResults.mistakes.length
                        ? lastResults.mistakes.join('\n')
                        : 'No mistakes — all items correct.',
      submitted_at:   new Date().toLocaleString('ru-RU')
    };

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res){
      if(res.ok){
        status.textContent = 'Результат отправлен учителю ✓';
        status.className = 'send-status ok';
        btn.textContent = 'Отправлено';
        return;
      }
      return res.json().then(function(data){
        throw new Error((data && data.error) || 'Ошибка отправки');
      });
    })
    .catch(function(err){
      fail('Не удалось отправить: ' + err.message + '. Попробуйте ещё раз.');
      btn.disabled = false;
      btn.textContent = 'Отправить результат учителю';
    });
  }

  /* ---------- сброс ---------- */

  function reset(){
    inputs().forEach(function(el){  el.value = ''; el.classList.remove('correct', 'incorrect'); });
    selects().forEach(function(el){ el.value = ''; el.classList.remove('correct', 'incorrect'); });
    document.querySelectorAll('.choice-btn').forEach(function(b){
      b.classList.remove('selected', 'correct', 'incorrect', 'reveal-correct');
    });
    $('resultsPanel').classList.remove('show');
    lastResults = null;
    resetSendUI();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- сохранение и восстановление прогресса ---------- */

  var PROGRESS_KEY = 'angle_progress::' + location.pathname;
  var isRestoring = false;
  var saveTimer = null;

  function saveProgress(){
    if(isRestoring) return;
    try{
      var state = { savedAt: new Date().toISOString() };
      state.name  = $('studentName') ? $('studentName').value : '';
      state.group = $('studentGroup') ? $('studentGroup').value : '';
      state.inputs = Array.prototype.map.call(inputs(), function(el){ return el.value; });
      state.selects = Array.prototype.map.call(selects(), function(el){ return el.value; });
      state.groups = Array.prototype.map.call(groups(), function(g){
        var sel = g.querySelector('.choice-btn.selected');
        return sel ? sel.dataset.val : null;
      });
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
      showSavedIndicator();
    } catch(e){ /* localStorage unavailable — fail silently */ }
  }
  function scheduleSave(){ clearTimeout(saveTimer); saveTimer = setTimeout(saveProgress, 400); }
  function showSavedIndicator(){
    var el = $('saveIndicator');
    if(!el) return;
    el.textContent = '✓ Saved ' + new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    el.classList.add('show');
    clearTimeout(showSavedIndicator._t);
    showSavedIndicator._t = setTimeout(function(){ el.classList.remove('show'); }, 2200);
  }

  function restoreProgress(){
    var raw;
    try{ raw = localStorage.getItem(PROGRESS_KEY); } catch(e){ return; }
    if(!raw) return;
    var state;
    try{ state = JSON.parse(raw); } catch(e){ return; }
    isRestoring = true;

    if(state.name && $('studentName'))   $('studentName').value = state.name;
    if(state.group && $('studentGroup')) $('studentGroup').value = state.group;

    var inputEls = inputs();
    (state.inputs || []).forEach(function(v, i){ if(inputEls[i] && v) inputEls[i].value = v; });

    var selectEls = selects();
    (state.selects || []).forEach(function(v, i){ if(selectEls[i] && v) selectEls[i].value = v; });

    var groupEls = groups();
    (state.groups || []).forEach(function(val, i){
      if(val == null || !groupEls[i]) return;
      var btn = groupEls[i].querySelector('.choice-btn[data-val="' + val + '"]');
      if(btn){
        groupEls[i].querySelectorAll('.choice-btn').forEach(function(b){ b.classList.remove('selected'); });
        btn.classList.add('selected');
      }
    });

    var hasContent = (state.inputs && state.inputs.some(function(v){ return v; }))
      || (state.selects && state.selects.some(function(v){ return v; }))
      || (state.groups && state.groups.some(function(v){ return v != null; }));
    if(hasContent){
      var note = $('restoreNote');
      if(note){
        var when = state.savedAt ? new Date(state.savedAt).toLocaleString('ru-RU') : '';
        var noteText = $('restoreNoteText');
        if(noteText) noteText.textContent = 'Мы нашли сохранённые ответы' + (when ? ' от ' + when : '') + ' — вписали их обратно.';
        note.hidden = false;
      }
    }

    updateProgress();
    isRestoring = false;
  }

  function clearProgress(){
    if(!confirm('Это сотрёт все сохранённые на этом устройстве ответы. Продолжить?')) return;
    try{ localStorage.removeItem(PROGRESS_KEY); }catch(e){}
    location.reload();
  }
  window.clearProgress = clearProgress;

  document.addEventListener('input', function(e){
    if(e.target.matches('input[data-q], #studentName, #studentGroup')) scheduleSave();
  });
  document.addEventListener('change', function(e){
    if(e.target.matches('select[data-q]')) scheduleSave();
  });
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-group] .choice-btn')) scheduleSave();
  });

  /* ---------- запуск ---------- */

  $('checkBtn').addEventListener('click', check);
  if($('sendBtn'))   $('sendBtn').addEventListener('click', send);
  if($('resetLink')) $('resetLink').addEventListener('click', reset);

  updateProgress();
  restoreProgress();
})();
