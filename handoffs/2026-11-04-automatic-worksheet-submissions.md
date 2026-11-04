# Automatic group worksheet submissions — 04.11.2026

## Deployed v23 review follow-up

The existing Apps Script deployment was updated to version 23 on 04.11.2026, 18:32 Moscow time. Candidate source was compared with the live editor (only prior comments/whitespace differed from its v22 baseline); an exact pre-deployment source backup is retained privately. Maintained `Course checklists/Web tracker/Code.gs` now matches the reviewed v23 candidate.

Review corrected one additional scope defect: legacy `result` requests must not force a partial plan submission into a full completion. Legacy plan handling now resolves identity without confirming Tasks; the common hook v4 suppresses old automatic result calls and is the single writer after accepted mail. This also prevents a legacy result posted before a failed email from appearing as a delivered worksheet. Regression fixtures passed.

The deployed v23 API returned `{ok:true,matched:true,credited:0,planCredited:0}` for a null-score, partial, non-assignment validation: no marks, scores, comments or submission-issue rows were written. Real individual-task submission has not been replayed in this review; individual matching/scope behavior was tested on fixtures. Do not describe this as a live end-to-end individual delivery test.

The installed Codex skill was synced from the maintained library, including references and package, with matching hashes and a private backup of its previous version. Installing the package in Claude's account remains a separate step; changing the library does not update Claude's account cache.

Viktoria requires automatic scores and submission ticks for every worksheet in every group, without agent/manual confirmation. Email delivery alone previously did not update Extras. The optional individual-plan hook was not a group solution.

The site build now injects `assets/tracker/submission-hook.js` into material pages before their own scripts. It observes successful Web3Forms/Formspree fetch delivery, extracts FormData/JSON names and first-attempt scores, queues failed tracker writes locally, and retries while open/on reconnect/on reopening. Open answers remain for teacher assessment. No teacher credentials or pupil names in public assets.

The existing Apps Script deployment was updated to version 22 without changing URL/audience. New `worksheetSubmission` action matches an active pupil using existing aliases and course/assignment, writes available scores, and confirms existing assigned Extras by URL and recipient. N/A is preserved; retries do not duplicate assignment ticks. A partial-task email cannot confirm a whole worksheet. Selected-page/exercise assignments retain scope matching. Unknown/ambiguous identity produces a visible warning instead of guessing.

Private source, exact pre-change backup and backend fixtures: `Course checklists/Web tracker/auto-submissions-2026-11-04/`; maintained `Code.gs` includes the new handler. An existing authorized submission was replayed directly to the deployed API (no email): `{ok:true,matched:true,credited:1}`. Names and result evidence remain private.

Validation: backend fixtures for group isolation, alias matching, recipient restriction, repeated sends, N/A, partial assignments, unscored work and first-attempt scores; hook tests for successful/failed mail, JSON scoring, corrected-vs-first result and offline queue. Site build passed. Current group material sources use fetch; future native form/XHR/new-provider submissions must explicitly implement the shared contract.

Updated the library and installed `angle-worksheet-template`, new `references/automatic-tracker.md`, and both .skill packages. The former skill specified email only, with no mandatory group tracker delivery. Skills for report-time manual reconciliation remain useful for historical/backfilled evidence; they are not the submission automation.

Teacher/parent group trackers also refresh from the server every minute and on focus/visibility return. Refresh pauses for pending writes, draft edits, focused input or open dialog, and checks those guards again after fetching. Temporary read errors keep the current view. Separate fixtures cover these guards and prevent unchanged-data rerendering.

## Дополнение (Claude, 04.11.2026): аудит и правки хука v2

- Активная копия скилла у Claude была старой (синхронизированный кэш без правила автозаписи и без references/). Актуальны библиотечная копия и пакет .skill.
- `submission-hook.js` v2 (`?v=2` в `build.mjs`): при повторной отправке остаётся результат первой попытки (хранится в `angle.firstSubmissionScores.v1`, исправленный балл идёт в note); частичная отправка пишется под названием задания, а не под всем воркшитом; отклонённая бэкендом запись не блокирует очередь (до 5 попыток).
- Проверено перехватом сети в браузере на собранном сайте, без тестовых писем и без записей реальным ученикам: 12 из 12 сценариев пройдены, `docs/tests/submission-hook.cjs` проходит.
- Открыто: страницы только с Basin (12) и test-engine+Basin (8) хук не видит; 14 файлов ЕГЭ с нераспознаваемой пометкой частичной отправки; два разных URL Apps Script (`test-engine.js` и хук); курсы без записи `hints` и индивидуальные планы (ЕГЭ/Empower/Expert). Бэкенд не менялся.

## Дополнение 2 (Claude, 04.11.2026): хук v3 и backend v23

- Хук `?v=3`: отслеживает fetch, XHR и sendBeacon к Web3Forms, Formspree и Basin (все 42 страницы с Basin проверены в браузере); частичная отправка определяется по нажатой кнопке `submitPartial`, по метке и по названию «страница — упражнение»; отклонённая запись после 5 попыток переносится в `angle.rejectedSubmissions.v1` с причиной и кнопкой «Отправить ещё раз», остальные записи не блокируются; имя, которое трекер не нашёл, тоже сохраняется.
- Один адрес Apps Script во всех 47 файлах и в движке теста; расхождения, отмеченные ранее, не подтвердились.
- Новый статический тест `docs/tests/submission-transports.cjs`: любая страница с нативной формой, неизвестным провайдером или кнопкой частичной отправки вне inline-обработчика ломает проверку.
- Backend v23 (кандидат; в Apps Script публикует владелец): записи индивидуальных планов в существующие строки Tasks, первая попытка сохраняется на сервере, ручные оценки и комментарии не перезаписываются, неопознанные имена попадают в лист Submission_Issues с повтором `retrySubmissionIssues`. Файлы и тесты лежат в приватной папке проверок.
- Открыто: развёртывание v23 в Apps Script; проверка на реальной отправке уже авторизованной сдачи после развёртывания; страницы без кнопки отправки (справочники, презентации) записывать нечего.

## Итоговый статус (Claude, 04.11.2026, 16:15 UTC) — цепочка ещё НЕ полностью работает

| Статус | Состояние |
|---|---|
| Backend v23 в Apps Script | развёрнут (Codex, 18:32 мск, URL прежний). Живой сервер проверен одним пробным запросом без оценки к неназначенной странице: ok=true, matched=true, credited=0, planCredited=0, записей в Results/Progress/Tasks/Submission_Issues нет |
| Хук v4 (`?v=4`, коммит ca6c220) | ожидает публикации. Первый деплой упал по таймауту Pages, повтор прогона упал («Deployment cancelled»), ручной запуск 41862166448 (workflow_dispatch, 15:52 UTC) стоит в очереди без начала build. На живом сайте пока v3 (в файле нет `deferred:true`) |
| Реальная индивидуальная сдача после развёртывания | не проверена: нет подтверждённой реальной сдачи с точным совпадением ученика, задания и объёма; оценок и писем не создавалось |
| Пакет навыка в аккаунте Claude | ожидает установки: активная копия — SKILL.md без `references/`. Пакет `29.10.2026 — angle-worksheet-template` в библиотеке актуален, Виктория загружает его сама через Настройки → Навыки |

Очередь публикации (проверено 16:13 UTC): других активных или ожидающих запусков нет, блокирующего запуска нет; единственный незавершённый — 41862166448 (build и deploy в queued, runner не выдан). Ничего не отменялось. Пустой коммит не делался по решению Виктории.

| Способ отправки | Группы / планы | Результат проверки | Оставшиеся ограничения |
|---|---|---|---|
| fetch к Web3Forms / Formspree | Starters, Movers, Flyers, B1, планы | перехват сети в браузере и fixtures backend; живой сервер — только нулевой пробный запрос | хук v4 на сайте не опубликован |
| Basin (fetch + FormData), 42 страницы | группы, ЕГЭ | все 42 страницы наблюдаются, одна запись на отправку (браузер, сеть перехвачена) | Basin не передаёт балл: пишется сдача, результат только в письме |
| XHR и sendBeacon | любые | перехват в браузере | реальных страниц на них нет |
| Частичная отправка (кнопка submitPartial, метка, «страница — упражнение») | группы, ЕГЭ | partial:true с названием задания; в планах только заметка; fixtures backend | частично назначенные дополнения не засчитываются |
| Индивидуальные планы ЕГЭ / Empower / Expert | Plans и Tasks | fixtures v23: ✓, дата, заметка «Автозапись …», N/A и комментарии сохранены, открытые ответы на проверку учителю | на живых данных не проверено |
| Первая попытка | все | клиент (после перезагрузки) и сервер (fixtures) | исправленный балл с другого устройства виден только в письме |
| Отклонённая или неопознанная запись | все | 5 отказов → хранение с причиной и кнопка «Отправить ещё раз»; одна запись не блокирует остальные; на сервере лист Submission_Issues | имя вне Students/Plans ждёт добавления алиаса |
| Старый `result` | старые страницы | хук v4 заменяет его заглушкой; backend не закрывает Tasks без подтверждённой доставки | работает только после публикации v4 |
| Страницы без кнопки отправки | справочники, презентации | — | записывать нечего |

Следующее: после завершения запуска проверить живой хук (`deferred:true`, `?v=4`), прогнать `submission-hook.cjs`, `submission-transports.cjs` и браузерный тест на сборке, обновить таблицу. Реальную запись в Tasks проверять только на уже подтверждённой сдаче.
