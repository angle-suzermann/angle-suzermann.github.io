/* Подключение совместного письма (assets/collab.js).
   Вставь адрес базы Firebase Realtime Database (Build → Realtime Database, вверху страницы).
   Для региона US он выглядит так: https://НАЗВАНИЕ-ПРОЕКТА-default-rtdb.firebaseio.com
   Это публичный адрес, его можно хранить в репозитории: защита — в правилах базы
   (см. _templates/collab-snippet.html). */
window.ANGLE_FIREBASE = {
  databaseURL: 'https://angle-7fc46-default-rtdb.firebaseio.com',
  teacherKey: 'vika-sx9jg9'   /* ссылка для учителя: страница?teacher=vika-sx9jg9  — не показывай её ученикам */
};
