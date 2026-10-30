# Удалён тестовый черновик empower-b1/collab-test

Дата: 30 октября 2026. Закрывает открытый пункт из заметок
[2026-10-28-migration-reconciliation.md](2026-10-28-migration-reconciliation.md),
[2026-10-29-empower-b1-plus.md](2026-10-29-empower-b1-plus.md) и
[2026-10-29-gateway-b1-unit6-opinion-essay.md](2026-10-29-gateway-b1-unit6-opinion-essay.md).

## Что сделано

- По подтверждению Виктории удалена папка `empower-b1/collab-test/`
  (`ws:status` draft, «Collaborative writing — тест», комната `test-room`).
  Это была проверочная страница совместного письма; настоящие материалы
  с совместным письмом — B1 Unit 1 informal email classwork и B1 Unit 6 opinion
  essay classwork.
- Перед удалением проверено: на эту папку не ссылается ни один файл сайта,
  скрипт, `site.config.json`, `build.mjs` или тест в `docs/tests/` — только
  заметки в `handoffs/` (их не правил: это история).
- Записи комнаты `test-room` в Firebase не удалялись (из репозитория до базы
  не дотянуться); если там что-то осталось, это ни на что не влияет.

## Проверка

`node build.mjs` проходит: Empower B1+ — 27 материалов, черновиков нет; в панели
преподавателя ссылки на collab-test больше нет. Совместное письмо подключают
2 материала (оба в Gateway B1).

## Что осталось

- Из заметки 29.10 по-прежнему открыто: совместное письмо не проверено
  на реальных iOS/Android.
