# Wiseman Teens A2 — нумерация материалов внутри папок учениц (28 ноября 2026)

Продолжает [заметку 27.11 о папках учениц](2026-11-27-a2-wiseman-student-folders.md).

## Что сделано

- По просьбе Виктории номера в названиях (`ws:title`, `<title>`, заголовок страницы) идут по порядку внутри каждой папки:
  - `Wiseman Teens A2/Соня/`: 01 Homework 1 · 02 Lesson: fix my mistakes · 03 Homework 2 · 04 Find it. Prove it. Write it. · 05 Homework 3 · 06 Writing & Speaking exam practice · 07 Homework 4 · 08 The finishing line · 09 Homework 5 · 10 Ready for Sunday;
  - `Wiseman Teens A2/Амелия/`: 01 After the Mock Test · 02 Final practice before the exam.
- Адреса страниц, `PROGRESS_KEY` и переадресации не менялись. Общий «02. Wiseman Teens A2 — Mock Test» в корне папки не переименовывался.
- Изменены только номера: 17 строк в 12 файлах (переводы строк сохранены). Облачная сборка: курс A2 Key for Schools — 14 материалов, без ошибок.
- Локально (вне репозитория) тем же скриптом `Courses/Pause/A2 Key for schools/wiseman mock yp87/_build/renum_wiseman_titles.py` переименованы копии одним файлом в папках учениц и обновлены названия в скриптах сборки `_build/*.py`, чтобы пересборка не вернула старые номера.

## Что осталось

- Push из этой среды невозможен (прокси 403): опубликовать через GitHub Desktop.
- Новые материалы класть в папку ученицы со следующим номером (Соня — 11, Амелия — 03).
