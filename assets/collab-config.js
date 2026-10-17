/* Подключение совместного письма (assets/collab.js).
   Вставь адрес базы Firebase Realtime Database (Build → Realtime Database, вверху страницы).
   Для региона US он выглядит так: https://НАЗВАНИЕ-ПРОЕКТА-default-rtdb.firebaseio.com
   Это публичный адрес, его можно хранить в репозитории: защита — в правилах базы
   (см. _templates/collab-snippet.html). */
window.ANGLE_FIREBASE = {
  databaseURL: 'https://angle-7fc46-default-rtdb.firebaseio.com',
  teacherKey: 'angle'   /* ссылка для учителя: страница?teacher=angle  — смени на своё слово */
};
