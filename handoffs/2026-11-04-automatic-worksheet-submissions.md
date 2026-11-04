# Automatic group worksheet submissions — 04.11.2026

Viktoria requires automatic scores and submission ticks for every worksheet in every group, without agent/manual confirmation. Email delivery alone previously did not update Extras. The optional individual-plan hook was not a group solution.

The site build now injects `assets/tracker/submission-hook.js` into material pages before their own scripts. It observes successful Web3Forms/Formspree fetch delivery, extracts FormData/JSON names and first-attempt scores, queues failed tracker writes locally, and retries while open/on reconnect/on reopening. Open answers remain for teacher assessment. No teacher credentials or pupil names in public assets.

The existing Apps Script deployment was updated to version 22 without changing URL/audience. New `worksheetSubmission` action matches an active pupil using existing aliases and course/assignment, writes available scores, and confirms existing assigned Extras by URL and recipient. N/A is preserved; retries do not duplicate assignment ticks. A partial-task email cannot confirm a whole worksheet. Selected-page/exercise assignments retain scope matching. Unknown/ambiguous identity produces a visible warning instead of guessing.

Private source, exact pre-change backup and backend fixtures: `Course checklists/Web tracker/auto-submissions-2026-11-04/`; maintained `Code.gs` includes the new handler. An existing authorized submission was replayed directly to the deployed API (no email): `{ok:true,matched:true,credited:1}`. Names and result evidence remain private.

Validation: backend fixtures for group isolation, alias matching, recipient restriction, repeated sends, N/A, partial assignments, unscored work and first-attempt scores; hook tests for successful/failed mail, JSON scoring, corrected-vs-first result and offline queue. Site build passed. Current group material sources use fetch; future native form/XHR/new-provider submissions must explicitly implement the shared contract.

Updated the library and installed `angle-worksheet-template`, new `references/automatic-tracker.md`, and both .skill packages. The former skill specified email only, with no mandatory group tracker delivery. Skills for report-time manual reconciliation remain useful for historical/backfilled evidence; they are not the submission automation.
