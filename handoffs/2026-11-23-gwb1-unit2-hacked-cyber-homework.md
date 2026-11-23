# Gateway B1 Unit 2 — домашка «Hacked! Cyber safety phrases» — 23.11.2026

Новый материал: `gateway/gateway-to-the-world-b1/Unit 2/hacked-cyber-safety-homework/` (ws:title «01. Unit 2 — Hacked! Cyber Safety Phrases — Homework», kind homework, status published). Урок SB pp. 22–23 Great Learners, Great Thinkers «Right and wrong actions», видео «Hacked!».

## Содержание (5 страниц, 45 автопроверяемых пунктов + письмо)
1. Видео (сжато из пакета издательства `Great learners/unit 2.mp4`, 640 px, 4,8 МБ, `video/hacked.mp4`) + заполнение пропусков в речи диктора, 14 пропусков, слова в рамке. Текст — по скрипту `UNIT 2 Great Learners.docx`.
2. Глоссарий 14 фраз (EN–RU) + выбор слова в коллокациях (10).
3. Сборка предложений из плиток (5, с кнопкой Clear) + Past Simple о истории Мэта (8).
4. Сортировка Right / Wrong actions (8 фраз; ценности урока: respect people's property, think about the consequences, be considerate).
5. Письмо 60–80 слов, вариант A (пересказ) или B (безопасность в сети, без реальных паролей), счётчик слов → Check & Submit.

## Техника
- Основа — `Unit 1/present-simple-continuous-homework` (та же оболочка v4, сохранение, проверка, Web3Forms, стикеры).
- Устаревший прямой вызов трекера (`a:'result'`) убран: результат записывает общий submission-hook (build.mjs вставляет его сам).
- Фон `img/bg-photo.jpg` — кадр из видео.
- Проверено: Playwright 1280 и 390 px — без горизонтального переполнения на всех 5 страницах; 45/45 при правильных ответах; отмена в плитках и в сортировке; восстановление после перезагрузки; перехваченная отправка (тема «Gateway to the World B1 — Unit 2 — … — имя», writing перед mistakes); реальной почты не отправлялось. `node build.mjs` в копии курса — карточка в каталоге B1 и в панели, hook/badge/ws-extras подключены, base64 нет.

## Не сделано
- Коммит и push: из среды Claude push заблокирован (403 прокси), git commit — запрет удаления lock-файлов. Нужен коммит из GitHub Desktop: папка материала, этот хэндофф и строка в CLAUDE.md.
- Назначение группам не выполнялось (отдельное решение).
