# Extra worksheet deletion — 04.11.2026

The Extra worksheet card had no delete action. Added Удалить next to Save in edit mode and next to Edit in compact mode. Confirmation is required; cancelling does not write. Shared tracker.js v37 and tracker.css v34 apply to AS2, AS3, AS5 and Gateway B1 entry pages.

Deletion is a recoverable tombstone stored through the existing updateExtra action: field purpose becomes `[ANGLE:deleted] ` + the original purpose. The existing Purpose column is guaranteed by the sheet contract, so no server replacement, new API or schema migration is required. ID, original purpose, content and all Progress marks remain intact. To restore a deleted row, remove exactly that leading prefix from Purpose in the Extras sheet, then refresh the tracker.

extraDeleted excludes archived cards from Extras; extraAssigned returns false for them, removing both earned and possible points and hiding the task from pupil/parent cards. An unsent deletion is applied from the existing persistent queue on teacher reload before rendering fresh sheet data, so a network failure does not make the task reappear. The write is idempotent and follows earlier queued edits. Parent views never show the delete button and do not apply the teacher queue.

Validation: docs/tests/tracker-extra-delete.cjs passed in Edge at 390px and 1280px. Covers existing edit/save behavior, cancelling, deletion in compact and draft modes, mock server failure, reload with a pending deletion, successful retry, preserved marks, score exclusion and read-only parent view. Screenshots inspected; actions fit mobile. All writes intercepted by the mock; no actual pupil assignment was deleted during QA. git diff --check passed.

Backups: ANGLE Memory/output/extra-delete-backup-20261104. Screenshots: output/extra-delete-390.png and extra-delete-1280.png.

Full node build.mjs passed: 318 catalog materials.
