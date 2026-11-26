# 26.11.2026 — Gateway B1 Unit 7: A job application (classwork с совместным письмом + homework)

## Что сделано

Опубликованы два материала в `gateway/gateway-to-the-world-b1/Unit 7/`. В трекер не назначались.

- **`job-application-classwork/`** — «01. Unit 7 — A Job Application — Classwork», SB p. 93, `ws:kind` classwork, 8 страниц:
  1. Warm-up: учебная цель и вопросы 1 для обсуждения.
  2. Culture exchange: текст «Jobs for American teenagers», 5 MCQ.
  3. Объявления Faster Food и Star Camp: 5 MCQ и вопрос «which job would you prefer».
  4. Письмо Оливии:
     - MCQ «suitable?»;
     - сопоставление частей A–G с их функцией;
     - вопросы на наблюдение: в письме нет вопроса, нет сокращений.
  5. Writing bank с банком слов (ключ SB: Ms, look forward, sincerely, contractions, Could you; лишние слова: Miss, faithfully, Can you), затем «formal or informal?» и порядок слов в вежливых вопросах.
  6. Ex. 6 (качества для Faster Food) и план 7a из пяти пунктов.
  7. **Совместное письмо**: `collab.js`, режим shared, комната `gwb1-u7-job-application`, пять частей письма по ролям, подсказка «Dear A. Daly, … Yours sincerely».
  8. Чек-лист 7b, отзыв о письме другой группы, Check & Submit.
- **`job-application-homework/`** — «02. Unit 7 — A Job Application — Homework», WB pp. 64–65, 6 страниц:
  1. Объявление Cumbria и письмо Джеймса с пометками функций.
  2. Ex. 1, ключ WB.
  3. Ex. 2, 12 полей для ввода, ключ WB: Dear, am writing, to, would like, for, well, hard, Could, tell, forward, hearing, sincerely.
  4. Вежливые вопросы «Could you tell me…?»: 4 пункта, ключи мои; принимаются варианты с please и whether.
  5. Prepare: объявление Retail Assistant, 2 MCQ, заметки по трём качествам и вопрос.
  6. Письмо примерно на 130 слов со счётчиком слов, чек-лист Check 7 и отправка. Письмо оценивает учитель.
- Фоны:
  - classwork — фото подростков из SB p. 84;
  - homework — фото волонтёров из WB p. 64.
  Исходные кадры лежат в `Courses/Gateway/Gateway to the world B1/unit 7/job application/raw`.
- Отправка в обоих материалах:
  - проверяет `response.ok` и `success`;
  - на время отправки кнопка выключена;
  - есть своя кнопка «📋 Copy result», поэтому ставится `window.angleOwnSendFallback = true`.
  Прямого вызова трекера нет: запись делает общий hook после доставки.
- Бейдж ANGLE 100 px (как в Empower 5C), шапка в одну строку: 101 px на ПК, 132 px на телефоне.

## Попутно исправлено

`assets/tracker/submission-hook.js`: `message()` вызывалась из `<head>` до появления `<body>`, если на устройстве были отклонённые записи сдачи, и падала с ошибкой `appendChild`. Теперь функция ждёт `DOMContentLoaded`. В сборке версия поднята: celebrate6.

## Проверено (Playwright, собранный сайт, внешние запросы перехвачены)

- ПК 1280 и телефон 390 px: нет горизонтальной прокрутки и ошибок на странице.
- Правильные ответы дают 33/33 в классной работе и 25/25 в домашке.
- В письме приходят все поля: план, заметки, письмо, чек-лист, ошибки. Тема письма: «курс — Unit 7 — A Job Application — Classwork/Homework — имя».
- После перезагрузки ответы восстанавливаются: MCQ, банк слов, сопоставление, поля ввода.
- При отказе сервиса (403) видно «Not sent…» и кнопку копирования, ошибки перечислены по пунктам.
- Совместное письмо в тестовой среде без сети показывает «Connection error». Живая комната Firebase не проверялась.

## Назначение (26.11, решение Виктории)

- Homework назначен 🐙: Даниил С. (b19) и София Т. (b110). Весь воркшит, тип Homework, урок 2026-11-26, срок 2026-12-03. Запись в Extras: `assigned-…-B1`, сервер ответил «Назначено: 2».
- Связка с трекером: кружок Unit 7 · sec9 (Writing) у b19 и b110 поставлен в Assigned (лист Progress, 26.11 11:00). После приёмки письма поставить там ✓.
- 🐼🐬 пока не назначено.
- Совместное письмо — отдельные комнаты для групп (вариант A по решению Виктории):
  - Над окном письма две кнопки: «🐼🐬 Pandas & Dolphins» → `gwb1-u7-job-application` и «🐙 Octopuses» → `gwb1-u7-job-application-octopus`.
  - Выбор запоминается на устройстве (`localStorage gwb1-u7-collab-group`), пока группа не выбрана, комната не открывается.
  - Учительский режим из панели работает так же: учитель переключает группу кнопкой.
  - `?room=` в адресе по-прежнему главнее, при нём кнопки скрыты.
