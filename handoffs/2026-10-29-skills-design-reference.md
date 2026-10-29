# Скиллы по дизайну прототипа ANGLE (29.10.2026)

Сессия по просьбе Виктории: обновить скиллы по дизайну страниц из
`D:\Вика\воркинг\Obsidian storage\Courses\ANGLE prototype` (`index.html` —
эталонный воркшит, `branded-file-preview.html` — фирменный PDF). Файлы сайта
в этой сессии не менялись: изменены только скиллы аккаунта и добавлена эта заметка.
Правила репозитория — в `CLAUDE.md`, оболочка и шапка — в скилле `angle-unified-shell`.

## Как проверялось

Прототип открыт в headless Chromium (desktop 1100–1280 и 390 px), CSS и разметка
прочитаны из файлов. `feedback-pdf/example_maria_2210.py` запущен: собирается
двухстраничный A4 PDF. В репозитории проверены `build.mjs` (что он подключает сам),
`assets/sticker-data.js`, наличие `.angle-badge` во всех `index.html` с
`ws:type` = worksheet | warmup (скриптом по файлам). `node build.mjs` не запускался:
сайт не менялся.

## Что изменилось в скиллах

- **`angle-worksheet-design` (новый).** Эталонная страница прототипа: порядок страниц
  (Start → Read it → Vocabulary → … → Glossary → Finish), анатомия страницы
  (рамка «By the end of this page you can», надзаголовок «Operation · …», h2 с жёлтой
  полосой, метки источника `src-text` / `src-made`), CSS карточек и лексические
  компоненты: поиск фраз в тексте, карточки чанков, upgrade, живые чипы при письме
  (`chunks_used` в письме учителю до `mistakes`), глоссарий с аудио и поиском.
- **`angle-branded-pdf` (новый).** Бланк PDF для ученика и родителей по
  `branded-file-preview.html` и `feedback-pdf/feedback_pdf.py`: фиолетовая шапка,
  жёлтая метка, блоки «Было / Правильно», футер на каждой странице, только PDF,
  исключение для колец прогресса (28.10).
- **`angle-worksheet-template` (обновлён).** Исправлены устаревшие места: Save my
  writing — только PDF в фирменном бланке; рисование, заметки и таймер —
  `ws-tools.js`, подключает сборка; описан `ws-extras.js` (глаз, цвета пар).
  Влиты изменения локальной версии 29.10 из `Claude Library\007 skills\01. Актуальные\29.10.2026 — angle-worksheet-template`
  (три контекстные реакции, правило иконок у названий, папка стикеров
  `ANGLE\brand\stickers`). Ссылки на новые скиллы и на `angle-unified-shell`.
- **Бейдж ANGLE — стандарт для каждого воркшита (решение Виктории 29.10).**
  Обновлены `angle-sticky-badge` (больше не opt-in для воркшитов) и
  `angle-worksheet-template`. На тестах и презентациях бейдж не нужен.

## Текущее состояние (проверено 29.10)

- Материалы по `ws:type`: worksheet 207, warmup 5, test 56, presentation 24.
- Бейдж есть на 204 из 212 воркшитов/разминок. Без бейджа 8 страниц:
  `as4/Unit 9/sounds-and-letters`, `as4/Unit 9/vocab2-water-weight`,
  `as4/Unit 9/warmup-water-weather`, `empower-b1/collab-test`,
  `expert-advanced/Module 3/modals-case-file`, `expert-advanced/Module 3/modals-homework`,
  `gateway/gateway-to-the-world-b2/Unit 3/future-tenses-worksheet`,
  `gateway/gateway-to-the-world-b2/Unit 3/prefixes-worksheet`.
- `build.mjs` вставляет бейдж только в страницы каталогов, не в материалы.
- Реакции `i-need-proofs`, `think-again`, `english-please` есть в
  `ANGLE\brand\stickers` (63–65), но их нет в `assets/sticker-data.js`.

## Что осталось

- Добавить бейдж на 8 страниц выше (по решению Виктории — стандарт). Не сделано
  в этой сессии: нужно её подтверждение на правку опубликованных страниц.
- Добавить три реакции в `assets/sticker-data.js` перед первым использованием
  на сайте (размер medium, PNG, без `SILENT_STICKERS`).
- Возможный вариант: подключать бейдж в материалы через `build.mjs`, как
  `ws-tools.js`, чтобы не дописывать его в каждую страницу. Не обсуждалось.
- Скиллы аккаунта и локальная копия в `Claude Library` теперь расходятся:
  в аккаунте — более новая версия (включает локальные изменения 29.10).
