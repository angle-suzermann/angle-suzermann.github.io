# Starters 26.11: игра Wordwall в домашке — 26.11.2026

## Что сделано (по просьбе Виктории)
- В карточку урока 26.11 (`as2/Unit 3/homework-2026-11-27/`, срок 3.12) после шагов Workbook, перед итоговым блоком, добавлено необязательное задание: Wordwall Anagram «Academy Stars 2 unit 3» — https://wordwall.net/resource/37755581/academy-stars-2-unit-3 (автор ресурса не Виктория; слова Unit 3: camera, tablet, headphones, take a photo и др.).
- Оформление — как игра Baamboozle во Flyers 19.11 (`section.card.optional-game`), кнопка со своим CSS `.optional-game .game-btn`.
- Это не часть ДЗ: `data-homework-part` и `.task` не добавлялись, `homework-cards.json` и назначение не менялись, переназначать не нужно. Части по-прежнему dialogue-voice, wb-sounds, wb-whose — совпадают с partIds на сервере (сверка 22.11); счётчик 0/6.
- Локальная копия: `Courses/Academy Stars/AS2/unit 3/homework-2026-11-27/index.html`, прежняя версия — `_previous/before-wordwall-2026-11-26/`. Файл в репозитории приведён к LF, как в HEAD.

## Проверка
`node build.mjs` PASS (облачная копия origin/main 7307700 + этот файл). Chrome 390/1440: без ошибок JS и горизонтальной прокрутки, блок перед итоговым, ссылка и target=_blank верны. Саму игру не проходили; пробную отправку `#test` не делали.

## Не сделано
Коммит и push: закоммитить только этот файл карточки и хэндофф.
