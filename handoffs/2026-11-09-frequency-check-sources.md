# Проверка частотности: новые источники — 09.11.2026

Дополняет [2026-11-06-colleague-ideas-skills.md](2026-11-06-colleague-ideas-skills.md) (навык `expression-frequency-check`).

## Метод
Каждый сервис открыт во встроенном браузере с запросом *if all goes well* и прочитан через get_page_text. Правка навыка предложена карточкой; пока Виктория не нажмёт «сохранить», она не применена.

## Что сделано
- Виктория назвала постоянные источники: SKELL, fraze.it, BNC (english-corpora.org), sentence.yourdictionary.com. Все четыре сайта разрешены во встроенном браузере (scope site).
- SKELL: `#result?lang=en&query=…&f=concordance`, частота в строке «N hits per million» (*if all goes well* 0.29). Без входа.
- fraze.it: `n_search.jsp?q=…&l=0`, «About N results» (787), источник Daily Use.
- BNC: проверка Cloudflare (403) сама не проходит; проходит её только Виктория.
- YourDictionary: только примеры без чисел, страницы слов и некоторых фраз через дефис; *if-all-goes-well* — 404.

## Что осталось
1. Сохранить карточку правки навыка; затем перенести её в основную копию в Claude Library и `.skill` (как и правку angle-worksheet-template из заметки 06.11).
2. BNC: проверить после ручного прохождения Cloudflare и при необходимости входа, нужна ли бесплатная учётная запись.
3. Публикация фидбека от 08.11 для Empower B1+ — после урока 09.11 (см. 2026-11-08-empower-b1-homework-check-0911.md).
