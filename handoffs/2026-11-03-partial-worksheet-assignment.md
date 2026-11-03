# Partial worksheet assignment — 03.11.2026

The Assign task dialog now offers the whole worksheet, selected pages, or selected exercises/sections. The picker reads page and heading structure from the selected material. The chosen labels appear in the tracker title; a validated angle-parts fragment opens the first selected page and highlights the requested headings. The full worksheet remains available for context.

Controls remain on each material card beside Open. Selection of pupils and selection of worksheet parts use separate checkbox lists; Choose all applies only to pupils. Materials without detected pages can use named sections; if structure cannot be detected, the dialog keeps whole-worksheet assignment available.

The shared assignment-parts.js model is used both when picking a part and when opening it. The module is injected into generated worksheet pages. The server preserves the original worksheet URL and allows only the expected partial-assignment fragment. Teacher access, existing tasks and marks retain their existing behavior. Partial selection does not change the worksheet's own scoring scheme.

Validation: local UI selected pages 3–4 and generated the matching title/link for one recipient, without production writes. Recipient links opened page 3 and a named exercise on it. Backend fixtures covered valid and invalid fragments, retry behavior and recipient isolation. Existing group/plan APIs and a no-write request were checked after the server update. The complete server was backed up before the small link-validation change.