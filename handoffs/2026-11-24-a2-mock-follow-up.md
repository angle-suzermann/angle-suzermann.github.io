# Wiseman Teens A2 — домашка после Mock Test для второй ученицы (24 ноября 2026)

Продолжает [заметку 08.11 о Wiseman Teens A2](2026-11-08-wiseman-teens-a2-mock.md) (дополнена до 19.11). Правила репозитория — в CLAUDE.md; правила A2 (первый ответ окончательный, голосовые — Telegram со скриншотом) не менялись.

## Метод

Проверено: `git status`, сборка `node build.mjs` в облачной копии репозитория (с GitHub, HEAD 99e03c2) с добавленной страницей, Playwright на собранном сайте (390 px с touch и 1200 px) и на копии одним файлом. На компьютере Виктории `node build.mjs` не уложился в 170 секунд (медленная файловая система), поэтому сборка проверялась только в облаке. Реальных писем и отметок в трекере не было: Web3Forms и трекер перехватывались.

## Что сделано

- Вторая ученица (подготовка к экзамену 29.11) выполнила диагностику «02. Wiseman Teens A2 — Mock Test» (yp87). Разбор с результатами — только локально: `Courses/Pause/A2 Key for schools/<папка ученицы>/24,11/`. В репозиторий результаты не попадают.
- Решение Виктории 24.11 по ключу Mock Test, Listening Task 2 Q4: ответ с лишним словом (два слова при инструкции «one word») **не засчитывается**. Ключ `swimming pool|swimming-pool` остаётся как есть; это закрывает пункт «ключи Listening Task 2 узкие» из заметки 08.11 для этого вопроса.
- Новая страница `a2-key-for-schools/Wiseman Teens A2/mock-test-follow-up/` («10. Wiseman Teens A2 — After the Mock Test», `ws:type=test`, published): 15 страниц, 57 автопроверяемых пунктов, 2 текста, 2 голосовых в Telegram.
  - Language: 11 фраз ученицы из мока (Past Simple вместо Past Continuous для завершённых событий, *clothes* — множественное число, артикли, *in the holidays*, порядок слов в косвенном вопросе) и 6 «маленьких слов» (*that/which, find out, worse, the most, the, too*).
  - Reading: R1 — переписки True/False (ANGLE, на перефраз); R2 = Part 2, R3 = Part 5, R4 = Part 3 с доказательствами, R5 = Part 4 — Cambridge A2 Key for Schools Trainer 1, **Test 2** (Exam Practice).
  - Writing: email Sam (ситуация Trainer Test 2 Part 6, пункты в формате Wiseman, 35–50 слов); рассказ с началом *Last Saturday I was walking in the park with my best friend when my phone rang* (45–60).
  - Listening: только L1 = Part 1 (трек 32) и L2 = Part 2 (трек 35) — по ошибкам мока. Номер трека L2 определён по длительности и порядку треков, на слух не проверен.
  - Speaking: картинка Trainer Test 2 Speaking Part 2 (спорт) Today / Yesterday / Tomorrow + тренировочная диаграмма ANGLE «after school» (та же, что в материале 08, данные выдуманы и помечены).
  - Ключи Trainer: Teacher’s Notes стр. 180–187, сверены с текстами и картинками страниц.
- Движок — из Homework 1 (`patch_lock`): A/B/C фиксируется первым кликом, поля закрываются после Check answers.
- Скрипт сборки (локально): `Courses/Pause/A2 Key for schools/wiseman mock yp87/_build/build_homework_mock_followup.py`; исходники — `_build/hw_amelia_src/`. Копия одним файлом — в папке ученицы `24,11/`.

## Проверено

- Сборка в облаке: курс A2 Key for Schools — 10 материалов; в странице нет base64; подключены те же скрипты, что у Homework 4 (submission-hook, save-writing, ws-extras, ws-tools, worksheet-ui, fixed-badge, student-picker).
- Playwright на собранном сайте, 390 px: 15 страниц без горизонтального сдвига, шапка 124 px; при всех верных 57/57; повторный клик по другому варианту ответ не меняет; поля после проверки только для чтения; допустимые варианты (*visit Big Ben, on holiday, 10.45, thirty-seven* и др.) принимаются; Web3Forms-письмо с разбивкой и запрос трекера уходят (перехвачены); ошибок в консоли нет. 1200 px — сдвигов нет, шапка 94 px.
- Аудиостыки треков 32 и 35 не прослушаны.

## Что осталось

- **Публикация:** коммит сделан на компьютере Виктории; push из этой среды невозможен (прокси 403). На GitHub уже есть более новые коммиты (99e03c2 и др.), поэтому в GitHub Desktop: Pull → Push. В рабочей папке есть чужие незакоммиченные изменения (только переводы строк CRLF в CLAUDE.md, build.mjs, submission-hook.js и ещё 10 файлах); если Pull откажется из-за них, их нужно сбросить или закоммитить тому, кто их сделал.
- **Строка в CLAUDE.md** «Последняя передача» не добавлена, чтобы не создать конфликт с более новым CLAUDE.md на GitHub. Добавить после Pull.
- Назначение в трекере не делалось (A2 без публичного списка имён).
- Из заметки 08.11 по-прежнему открыто: `build_wiseman_mock.py` собирает версию с Basin (3 упоминания Basin в скрипте на 24.11) и без правок 19.11; аудиостыки yp87 не прослушаны. PDF «Mock Test 6 — Answer Key» (Q14) в этот раз не перепроверялся.
- Использованные тесты Trainer 1: 2–6. Свободны Test 1 и Trainer 2.
