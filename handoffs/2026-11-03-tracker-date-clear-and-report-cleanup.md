# Individual date removal and report cleanup — 3 November 2026

Each date field now has an accessible clear button. Clearing remains a draft until Save, recalculates the automatic week label, preserves the remaining dates and never deletes tasks. Cancel restores the previous date group.

The web report renderer strips the redundant metadata copied from PDF extraction, including the split Cyrillic label used by one historical report. The corresponding course PDF was rebuilt without its extra information row, archived locally and repackaged using the current private Reports metadata. No tracker data or report periods changed. PDF asset cache version and tracker script versions were bumped.

Validation: mobile browser regression covers clear/cancel/save/reload with two dates and preserves task statuses and points. Metadata regression covers five labels, LF and CRLF, while retaining greetings and substantive report content. Rebuilt PDF was visually inspected and locally decrypted byte for byte.
