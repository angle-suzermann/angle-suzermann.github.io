# Трекер: секции Academy Stars и шапка iOS

27 октября 2026. Изменения по просьбе Виктории.

- Названия секций AS2/3/5 сверены по сохранённым Pupil's Books в `Course checklists/coursebooks and students/`. AS2: Vocabulary, Grammar time, Grammar focus, Reading, Sounds and letters, Language in use, Listening and speaking, Writing. AS3: Vocabulary, Reading, Reading comprehension, Grammar, Language in use, Listening and speaking, Writing, Think about it! AS5: Reading, Reading comprehension, Grammar, Language in use, Listening, Writing, Speaking, Think about it!
- More/Extra Grammar, More/Extra Language in Use и Extra сохранены, включая названия и баллы из живой таблицы. B1 не менялся.
- Revision (новый id `revision`, 5 баллов) отделён от Unit test (старый `sec12`, 10 баллов). Старые отметки объединённой Revision Test оставлены у Unit test; результаты не копируются в новый Revision.
- Добавлены отдельные id `grammar-time` и `think-about-it`, чтобы не переименовывать старые отметки Speaking в другое задание. В AS2/3 объединённый Listening and speaking использует прежний `sec8`; если есть история отдельного Speaking (`sec9`), старый столбец дополнительно сохраняется рядом. Сырые progress не переписываются и не удаляются.
- `Store.load` применяет структуру к живому и родительскому представлению, а Demo использует тот же structure.json. Данные Google Sheets не менялись. Apps Script поддерживает произвольные item в setStatus; его передеплой для новых id не нужен.
- Версия tracker.js и structure.json теперь связаны query-параметром, чтобы структура не оставалась в старом кэше. tracker.js и общий CSS — v24.
- По новому скриншоту размытия iOS добавлен CSS только для WebKit в display-mode:standalone: белый верх, отступ над содержимым `32px + max(safe-area-inset-top, 44px)`. Это отодвигает текст и настройки от системной подложки даже при нулевом inset и старых иконках. В обычном Safari и на компьютере отступ прежний. Настройка default/white в build.mjs уже существовала, её не меняли.

Проверки: `node --check`, `git diff --check`; браузерные тесты `docs/tests/tracker-cards.cjs` и `docs/tests/tracker-sections.cjs` проходят в headless Edge с вымышленными данными и перехваченными запросами. Проверены заголовки всех трёх курсов в живом и родительском представлениях, сохранение прежней отметки теста и отдельный POST Revision. Реальные данные не затрагивались.

Полная сборка в этой Windows-среде не завершилась: имеющийся build.mjs вызывает Unix sleep, которого нет, после неудачной попытки очистки `_site`. Игнорируемая `_site` может быть частично очищена. Исходники проверены отдельно. На физическом iPhone результат нового отступа пока не проверен; desktop-тест не воспроизводит системное размытие iOS. Публикация — Push origin Викторией по постоянным правилам проекта.
