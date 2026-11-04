# Automatic group worksheet submissions — 04.11.2026

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
