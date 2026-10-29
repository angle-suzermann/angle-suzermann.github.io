# Empower B1+ — handoff, 29 October 2026

Course for one 1:1 learner on Cambridge *Empower B1+* (2nd ed.). Site folder `empower-b1/`; working files, build pipelines and teacher notes in `Courses\Empower B1+\` on Viktoria's computer. Repo rules: `CLAUDE.md`. Shell rules: the `angle-unified-shell` skill. Student-specific detail (results, lesson evidence, context for personalisation) is **not** in this public file — see the private part: `Claude Library\00 Хэндоффы по проектам\B1+ Empower\Handoff_B1+_Empower_2026-10-29_private.md`.

Baseline: `Claude Library\00 Хэндоффы по проектам\B1+ Empower\Handoff_B1+_Empower_2026-10-18.md` (+ `ANGLE_B1+_Empower_Handoff.md`, 2 Oct). Both of those were reconstructed from files, not from chats. This note covers 18.10 14:19 → 29.10 08:40.

## Method (how much to trust each line)
- **Checked with git** (repo, `git log -- empower-b1`, `git branch -r --contains`, `git status`): site pages, commits, push state as of the last fetch made on Viktoria's computer. A new `git fetch` from this session was blocked by the network proxy, so "pushed" means "contained in the local `origin/main`", not a fresh check of GitHub.
- **Checked by file dates and grep** (`Courses\Empower B1+\`, not a git repo): course files, form endpoints, build folders, `shared.py` hashes. Weaker evidence: it shows what exists, not who decided what.
- **Run:** Playwright QA of the 5B site page on 28.10 (served with the repo's real `/assets/`): header 124 px at 380 px / 94 px at 1100 px, no horizontal scroll, photo opacity 0.5 + wash, Apercu loads, 0% empty / 100% full (57 items), autosave restore, sticker from shared `sticker-logic.js`, results POST to Web3Forms + tracker hook.
- **Not run:** `node build.mjs` — on the mounted disk it cannot clear `_site/` (deletes not permitted / >170 s). The page was checked directly instead; GitHub Pages builds on push.

## What changed since 18.10

### Site (`empower-b1/`)
- **Unit 5A classwork (lexical)** rebuilt from the learner's homework results and published (`d6a0499`, 18.10 18:16); iOS safe-area badge fix (`5176f3c`).
- **Homework tracker for the course** (`empower-b1/0-homework-tracker/`) and individual-plan features arrived with the site-wide tracker work (`57d6ecf` 23.10 … `62d0cd4` 28.10). Worksheets report scored results to the tracker through `assets/tracker/plan-hook.js` (`97a5bf2`, 25.10). Details: tracker handoffs of 27–28.10.
- **Unit 5B classwork (lexical), zero & first conditionals** — new page `empower-b1/Unit 5/5b-conditionals-classwork-lexical/`, title "03. Unit 5B — Grammar — Zero & First Conditionals — Classwork · lexical", `status: published` (`8ac0748`, 28.10 13:34). It is contained in `origin/main`; local and remote tracking were level (0/0) on 29.10.
  - Built with the course's Python pipeline (`shared.py` + `lexical.py`, same engine as 5A), then converted for the site by using the published 5A lexical page as the shell (v4 header, Start over, reveal/pair badges, `plan-hook.js`, shared stickers). Converter: `Courses\Empower B1+\Unit 5\5B Conditionals\_build\to_site5b.py`.
  - Shape: test → teach → test. 7 pages: start/warm-up · diagnostic from memory (10 judge + 6 meaning items) · noticing in a short text + concept questions + rules box + 10 chunk cards · if/when/unless, verb forms, plain → chunk upgrades · matching, *unless* transforms, oral chain, quick questions · "What if…?" + plan A/plan B message with live chunk chips and watch-out warnings · submit. 57 auto-checked items.
  - Background photo: Unsplash, Daria Gordova (frozen lake), reused from `Courses\EGE\3. Россия\…`; `img/bg-photo.jpg`.
- Site-wide tools also reached these pages (drawing dock, Save my writing, collaborative-writing fixes) — see the 27–28.10 handoffs.

### Course folder (`Courses\Empower B1+\`)
- `Unit 5\5B Conditionals\` (new):
  - `Unit 5B - Conditionals - CLASSWORK.html` — an **earlier draft** (28.10 12:30, generic context, not on the template engine). Not published.
  - `Unit 5B - Conditionals - CLASSWORK (lexical).html` + `TEACHER NOTES (lexical).pdf` — the published version above (standalone copy with embedded assets) and its notes (route after diagnostic, expected errors, chunk table, timed plan, answer key extracted from the built HTML).
  - `Unit 5B - Plan A, plan B - CLASSWORK (pilot).html` + `TEACHER NOTES (pilot).pdf` + `Pilot plan - speak first, upgrade, recall.md` — **a third version, built 29.10 08:20–08:37 by another session**: a 9-page "speak first → upgrade → recall" pilot (78 auto-checked items, recorded speaking before/after, a dialogue with glossary and per-line audio, YouGlish frequency check of the chunks). **Not on the site.** Its plan says the lexical classwork "stays as it is". Full description (pages, frequency check, QA): `handoffs/2026-10-29-empower-5b-pilot.md` (`1e47504`) — this note does not repeat it.
  - `Homework - awaiting lesson evidence.md` — homework deliberately deferred until after the 5B lesson.
  - `_build\` — full pipeline for the lexical classwork (`build_cw.py`, `common5b.py`, `shared.py`, `lexical.py`, `tn5b.py`, `qa5b.py`, `to_site5b.py`, `assets\`) **and** the pilot (`build_cw_pilot.py`, `qa_pilot.py`, `tn_pilot.py`, `_tn_parts.py`).
- Learner feedback PDFs and lesson records added 19–28.10 (`Lessons and chats\`, `Revision Units 1-4\…feedback\`) — content in the private part.

## Current state (measured 29.10)
- `empower-b1/` on the site: `0-homework-tracker`, a learner-named folder (3), `Revision Units 1-4/` (8), `Unit 4/` (11), `Unit 5/` (3: 5A homework + classwork lexical, 5B classwork lexical — all `published`), `collab-test` (draft).
- Build pipelines saved on disk: Revision 1–4, Unit 5A, Unit 5B. Driving Test: none.
- `shared.py` exists in **two** versions: Revision (`72f7697…`, also copied as `5A\_build\ref\shared.py`) and 5A/5B (`336bba0…`). Difference: optional background/audio and `finish_page(review=…)` in the 5A/5B copy.

## Open items from the 18.10 handoff — rechecked
| Item | Status 29.10 | Evidence |
|---|---|---|
| 4B/4C forms Formspree → Web3Forms | **Resolved on the site; still open in course copies.** The four site pages (`personality-classwork/-homework`, `4c-everyday-english-classwork/-homework`) contain no `formspree.io` and send via Web3Forms. The standalone files in `Courses\…\Unit 4\4b…` and `4с…` still post to Formspree. | grep |
| Driving Test `_build` pipeline | **Still open** — folder has only the two HTML files, TN PDF and `raw\`. | `ls` |
| Consolidate `shared.py` | **Still open** — two versions (see above). | md5 |
| 4B classwork 7.2 MB | **Mostly resolved**: the course HTML is now 51 KB (3.10 update); the site folder is 6.6 MB, mainly `img/img1.jpg` 2.2 MB (uncompressed) and two mp3s. Compressing `img1.jpg` is the remaining step. | `du` |
| Basin voice recorder untested | **Still open / no evidence** of an end-to-end test. 5B has no recorder. | — |
| Lexical: pilot or standard? | **Not decided in any file.** Since 18.10 only lexical versions were published (5A on the site is lexical only; 5B lexical only). Treat "plain + lexical pair" from the 18.10 note as no longer followed in practice, pending Viktoria's word. | site listing |
| `_backup_2026-10-11` → `_archive` | **Still open** — folder still in `Unit 5\5A Vocab + Grammar\`. | `ls` |
| (2.10) Revision 1–2 content vs the learner's original writing | **Can't tell** — no record of a check. | — |
| (2.10) proof-transcript retrofit for 4C / 4D p.1 | **Can't tell fully**: 4D classwork page uses the proof mechanic; 4C page has neither proof buttons nor `script-drop`. | grep |

## Keep in mind / next
1. **Which 5B classwork is used in the next lesson** — the published lexical one or the pilot? If the pilot, it needs the same site conversion (`to_site5b.py` approach) before the learner can open it. Two pilot TN PDFs in the folder are byte-identical (`… (pilot).pdf` and `… pilot.pdf`); one can go.
2. **5B homework** is pending lesson evidence (results, transcript, the learner's exact wording). Plan in `Homework - awaiting lesson evidence.md` and in the pilot plan.
3. Old draft `Unit 5B - Conditionals - CLASSWORK.html` — keep or move to `_archive`.
4. `empower-b1/collab-test` (draft) is still on the site (also noted in `2026-10-28-migration-reconciliation.md`).
5. Push from cloud sessions is blocked by the proxy (403 on `github.com`); Viktoria pushes from GitHub Desktop. Git leaves `.git/HEAD.lock` and `tmp_obj_*` on the mounted disk unless delete permission is granted.
