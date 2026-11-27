# ЕГЭ «Россия» 27.11: уровень ЕГКР/СтатГрада в лексике 03–18 и в демо-тесте

Источники (папка `E:\…\5_EGE OGE Exam Prep\ЕГЭ 2022-2027`, подключена 27.11): ЕГКР апрель 2026 (вариант 953, скан, OCR), СтатГрад 11.02.2026 (АЯ2510201, скан, OCR, ответы), СтатГрад 27.11.2024 (АЯ2410101, текст, ответы). СтатГрад 2022/2023 не разбирались. Материалы СтатГрада — с запретом публикации: тексты и задания из них на сайт не переносились, только типы трудностей.

## Оценка сложности (по текстам и ключам)
- 19–24: в одном тексте 6 разных операций — пассив (is made, are awarded / have been awarded), Present Perfect (Continuous) с since/for, Conditional II (were), сравнительная/превосходная (hotter, better/best), местоимения (their, these, those), числительные (FOOT → feet, ONE → first), герундий после enjoy. Наши уроки 03–18 и демо: в основном Past Simple и простой пассив.
- 25–29: приставки in-/un-/re- (CREDIBLE → incredible, PRODUCE → reproduce, unlike), наречия -ally (internationally, realistically), -ful/-ous/-ic. У нас — прямые суффиксы (famous, successful).
- 30–36: 4 похожих по форме или смыслу слова (preserve/conserve/reserve/protect; departed/digressed/disappeared/distracted; appeal/admire/appear/approve; reminds/remembers/remains/repeats; alarm/alert/aware/await), связки (however/therefore/although/otherwise; well/awhile/while/when), сочетаемость (vital role, head for). У нас дистракторы проще.
- 10: заголовки абстрактные (The unexpected truth, A survival function), без ключевых слов из текста; 12–18: текст 600+ слов, вопросы NOT mentioned / FALSE / на что указывает слово / вывод автора. В демо — заголовки со словами из текстов, вопросы на прямую деталь.
- Итог: ЕГКР и СтатГрад ≈ B2 (30–36 и 10 — верх B2); наши материалы «Россия» были ≈ B1+.

## Что сделано
- **Лексика 03–18 (8 пар CW/HW):** перед Finish новая страница «Exam level». CW: 19–24 (6 пропусков, `exm_19…24`, data-acc) + 30–36 (4 select, `exs_30…`); HW: 25–29 (5 пропусков) + 30–36 (3 select). Темы — та же тема урока, факты сверены. Ответы 30–36 перемешаны по позициям (14/15/13/14). Объяснения — под «Show answers». Сохранённые ответы не сдвигаются (новые поля в конце DOM).
- **PAGE_LABELS** в этих 16 файлах дополнены всеми вставленными страницами (rov/cul/exam): раньше точек навигации не хватало (7 точек при 10 страницах).
- **Демо «02. Russia — Demo-format test · Part 1»:** заголовки 10 — абстрактные (позиции и ключ прежние: C1 D2 B3 E4 A5 F7 G8, лишний 6); 12–18 — новые вопросы ЕГЭ-типов (NOT mentioned, референция «It», вывод, FALSE, главная мысль абзаца, отношение автора), текст прежний; 19–24 Kaliningrad переписан (isseparated, wascalled, his, hasbecome, ismined, lived); 25–29 Tula (essential, production, unusually, conveniently, admirers); 30–36 — паронимы и связки (expect, otherwise, off, hardly, proposed, insisted, member), правильные позиции перемешаны. KEY обновлён. QA: 42/42.
- **Итоговый тест «01. Russia — Final Test»** не менялся: в нём остались прежние (более лёгкие) тексты 19–36, теперь он не дублирует демо.
- Локальные копии изменены (`0. Лексика/Праздники России`, `Выдающиеся люди`, `6. Итоговый тест/02…`), прежние — `_предыдущие версии/Exam level (до 27.11)`. Скрипты: `Claude outputs/exam/` (content_exam.py, insert_exam.py, fix_dots.py, demo_up.py).
- QA Playwright: 16 уроков — все новые пункты засчитываются (6/6+4/4 или 5/5+3/3), 390/1280 без горизонтальной прокрутки и ошибок JS; демо 42/42.

## Открыто
- Уроки 01–02 (Holidays lexis input), 19 Unity Day, 20–22 (Immortal Regiment, Heroes, 20th Century) — другой движок, страница Exam level не добавлялась.
- 2-я часть демо (37–38) и устная часть не менялись; задание 11 демо не усложнялось.
- Ульяне ничего не назначалось; 05/06 State (назначены на 29.11) получили новую страницу.
