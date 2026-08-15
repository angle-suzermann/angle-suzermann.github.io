#!/usr/bin/env node
/* ============================================================
   Сборка сайта с материалами ANGLE.

   Запуск:   node build.mjs
   Результат: папка _site/ — её и публикует GitHub Pages.

   Что делает:
     1. копирует всё нужное в _site/
     2. читает метаданные (<meta name="ws:*">) из самих материалов
     3. проверяет их и падает с понятной ошибкой, если что-то не так
     4. генерирует лендинг, страницы курсов, учительский индекс, catalog.json

   Зависимостей нет — только то, что уже есть в Node.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT  = path.join(ROOT, '_site');

/* не копируем в _site: служебное и то, что не должно быть в интернете */
const SKIP = new Set([
  '_site', '_templates', '.github', '.claude', '.git', '.gitignore',
  'build.mjs', 'site.config.json', '.DS_Store', 'node_modules',
  'docs',   // внутренняя документация, в интернет не выкладываем
]);

const REQUIRED = ['type', 'course', 'course-id', 'unit', 'title', 'date', 'status'];
const TYPES    = ['test', 'worksheet', 'warmup'];
const STATUSES = ['published', 'draft'];

const problems = [];
const fail = (file, msg) => problems.push(`  ${file}\n      ${msg}`);

/* ---------- утилиты ---------- */

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** «сырое» значение из HTML-атрибута: раскодируем сущности, чтобы не двоить экранирование */
const unesc = (s = '') => String(s)
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function readMeta(html) {
  const meta = {};
  const re = /<meta\s+name=["'](ws:[\w-]+)["']\s+content=["']([^"']*)["']\s*\/?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) meta[m[1].slice(3)] = unesc(m[2]).trim();
  return meta;
}

/* ---------- конфиг ---------- */

const configPath = path.join(ROOT, 'site.config.json');
if (!fs.existsSync(configPath)) {
  console.error('Не найден site.config.json рядом с build.mjs');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const courses = config.courses ?? [];
const staffPath = (config.staffPath || 'staff').replace(/^\/+|\/+$/g, '');

/* Префикс подпапки. Пусто для сайта в корне домена (репозиторий ЛОГИН.github.io),
   иначе «/имя-репозитория». Материалы пишутся с обычными абсолютными путями
   (/assets/…), а сборка подставляет префикс — чтобы автору не приходилось
   думать о том, где именно опубликован сайт. */
const BASE = (config.basePath || '').replace(/\/+$/, '');

if (!courses.length) {
  console.error('В site.config.json пустой список courses — нечего собирать.');
  process.exit(1);
}

/* ---------- 1. копируем статику ---------- */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const entry of fs.readdirSync(ROOT)) {
  if (SKIP.has(entry) || entry.endsWith('.md')) continue;
  fs.cpSync(path.join(ROOT, entry), path.join(OUT, entry), { recursive: true });
}

/* Подставляем префикс подпапки в скопированные html и css.
   Трогаем только пути, начинающиеся с одного «/»: «//host» и «https://» —
   это внешние адреса, их оставляем как есть. Делается ДО генерации каталогов,
   поэтому сгенерированные страницы сюда не попадают — в них префикс уже вшит. */
function applyBase(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { applyBase(p); continue; }
    if (!/\.(html|css)$/i.test(e.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    const out = src
      .replace(/\b(href|src)=("|')\/(?!\/)/g, `$1=$2${BASE}/`)
      .replace(/url\((\s*["']?)\/(?!\/)/g, `url($1${BASE}/`);
    if (out !== src) fs.writeFileSync(p, out);
  }
}
if (BASE) applyBase(OUT);

/* ---------- 2. собираем материалы ---------- */

const materials = [];
const seenPaths = new Set();

for (const course of courses) {
  const courseDir = path.join(ROOT, course.id);
  if (!fs.existsSync(courseDir)) continue;

  for (const slug of fs.readdirSync(courseDir)) {
    const file = path.join(courseDir, slug, 'index.html');
    if (!fs.statSync(path.join(courseDir, slug)).isDirectory()) continue;
    if (!fs.existsSync(file)) continue;

    const rel  = `${course.id}/${slug}`;
    const html = fs.readFileSync(file, 'utf8');
    const meta = readMeta(html);

    const missing = REQUIRED.filter((k) => !meta[k]);
    if (missing.length) {
      fail(`${rel}/index.html`,
        `не заполнены обязательные поля: ${missing.map((k) => 'ws:' + k).join(', ')}\n` +
        `      Возьмите готовый блок из _templates/test.html или _templates/worksheet.html.`);
      continue;
    }
    if (meta['course-id'] !== course.id) {
      fail(`${rel}/index.html`,
        `ws:course-id = "${meta['course-id']}", а материал лежит в папке "${course.id}". ` +
        `Либо исправьте метаданные, либо перенесите папку.`);
    }
    if (!TYPES.includes(meta.type)) {
      fail(`${rel}/index.html`, `ws:type = "${meta.type}", допустимо: ${TYPES.join(' | ')}`);
    }
    if (!STATUSES.includes(meta.status)) {
      fail(`${rel}/index.html`, `ws:status = "${meta.status}", допустимо: ${STATUSES.join(' | ')}`);
    }
    if (seenPaths.has(rel)) fail(`${rel}/index.html`, 'такой путь уже занят другим материалом');
    seenPaths.add(rel);

    /* если на странице есть кнопка отправки — должен быть указан адрес */
    if (/id=["']sendBtn["']/.test(html) && !meta.formspree) {
      fail(`${rel}/index.html`,
        'на странице есть кнопка «Отправить результат учителю», но ws:formspree пустой — ' +
        'результаты никуда не придут.');
    }
    /* забытый base64 — то, ради чего всё затевалось */
    if (/src\s*=\s*["']data:(image|font)\//i.test(html)) {
      fail(`${rel}/index.html`,
        'внутри страницы есть картинка или шрифт в base64. Положите файл в img/ рядом ' +
        'с материалом (или в /assets/, если он общий) и сошлитесь на него по пути.');
    }

    /* ВНИМАНИЕ: ключ courseCfg, а не course — иначе объект курса
       затрёт человекочитаемое название из ws:course. */
    materials.push({
      ...meta,
      url: `${BASE}/${rel}/`,
      dir: rel,
      courseCfg: course,
      bytes: Buffer.byteLength(html),
    });
  }
}

if (problems.length) {
  console.error(`\nСборка остановлена. Проблем: ${problems.length}\n`);
  console.error(problems.join('\n\n'));
  console.error('\nИсправьте и запустите ещё раз: node build.mjs\n');
  process.exit(1);
}

/* сортировка: по курсу как в конфиге, внутри — по юниту (числа по-человечески) */
const byUnit = (a, b) =>
  String(a.unit).localeCompare(String(b.unit), 'ru', { numeric: true }) ||
  a.title.localeCompare(b.title, 'ru');
materials.sort((a, b) =>
  courses.findIndex((c) => c.id === a['course-id']) -
  courses.findIndex((c) => c.id === b['course-id']) || byUnit(a, b));

/* ---------- 3. страницы ---------- */

const page = ({ title, heading, sub, body, extraScript = '' }) => `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${BASE}/assets/catalog.css">
</head>
<body>
<header class="cat-header">
  <div class="logo"><img src="${BASE}/assets/brand/angle-logo.png" alt="ANGLE"></div>
  <p class="credit">by ${esc(config.author || '')}</p>
  <h1>${esc(heading)}</h1>
  ${sub ? `<p>${esc(sub)}</p>` : ''}
</header>
<div class="page">
${body}
</div>
${extraScript}
</body>
</html>
`;

const card = (m) => `  <a class="card" href="${esc(m.url)}">
    <div class="row">
      <span class="name">${m.emoji ? esc(m.emoji) + ' ' : ''}${esc(m.title)}</span>
      <span class="pill ${esc(m.type)}">${esc(m.type)}</span>
    </div>
    <div class="meta"><span>Unit ${esc(m.unit)}</span>${m.tags ? `<span>${esc(m.tags)}</span>` : ''}</div>
  </a>`;

/* --- лендинг: намеренно без списка материалов --- */
fs.writeFileSync(path.join(OUT, 'index.html'), page({
  title: config.siteTitle || 'ANGLE',
  heading: config.siteTitle || 'ANGLE',
  sub: 'Материалы для учеников',
  body: `  <p class="empty">Откройте ссылку, которую дал преподаватель — она ведёт сразу на нужное задание.</p>
  <p class="note">Если вы преподаватель: список всех материалов лежит по отдельному адресу,
  он должен быть у вас в закладках.</p>`,
}));

/* --- страница курса: только опубликованное --- */
for (const course of courses) {
  const list = materials.filter((m) => m['course-id'] === course.id && m.status === 'published');
  const dir = path.join(OUT, course.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({
    title: `${course.name} — материалы`,
    heading: `${course.emoji ? course.emoji + ' ' : ''}${course.name}`,
    sub: `${list.length} ${list.length === 1 ? 'материал' : list.length < 5 ? 'материала' : 'материалов'}`,
    body: list.length
      ? `<div class="course-block">\n${list.map(card).join('\n')}\n</div>`
      : '  <p class="empty">Пока пусто.</p>',
  }));
}

/* --- учительский индекс: всё, с фильтрами и копированием ссылок --- */
const staffCard = (m) => {
  const repo = config.repoUrl
    ? `<a href="${esc(config.repoUrl)}/blob/main/${esc(m.dir)}/index.html" target="_blank" rel="noopener">исходник</a>`
    : '';
  return `  <div class="staff-card${m.status === 'draft' ? ' is-draft' : ''}"
       data-search="${esc((m.title + ' ' + m.course + ' ' + (m.tags || '') + ' unit ' + m.unit).toLowerCase())}"
       data-course="${esc(m['course-id'])}" data-type="${esc(m.type)}" data-status="${esc(m.status)}">
    <div class="row">
      <span class="name">${m.emoji ? esc(m.emoji) + ' ' : ''}${esc(m.title)}</span>
      <span class="pill ${esc(m.type)}">${esc(m.type)}</span>
      ${m.status === 'draft' ? '<span class="pill draft">черновик</span>' : ''}
    </div>
    <div class="meta">
      <span>${esc(m.course)}</span><span>Unit ${esc(m.unit)}</span><span>${esc(m.date)}</span>
      <span>${m.formspree ? 'сабмиты → ' + esc(m.formspree) : 'без отправки'}</span>
      <span>${(m.bytes / 1024).toFixed(0)} КБ</span>
    </div>
    <div class="actions">
      <a class="open" href="${esc(m.url)}" target="_blank" rel="noopener">Открыть</a>
      <button type="button" data-copy="${esc(m.url)}">Копировать ссылку</button>
      ${repo}
    </div>
    ${m['legacy-url'] ? `<div class="legacy">Старая ссылка на Netlify всё ещё живёт:
      <a href="${esc(m['legacy-url'])}" target="_blank" rel="noopener">${esc(m['legacy-url'])}</a></div>` : ''}
  </div>`;
};

const filterBtns = [
  '<button type="button" class="filter-btn on" data-filter="all">Все</button>',
  ...courses.map((c) => `<button type="button" class="filter-btn" data-filter="course:${esc(c.id)}">${esc(c.name)}</button>`),
  ...TYPES.map((t) => `<button type="button" class="filter-btn" data-filter="type:${t}">${t}</button>`),
  '<button type="button" class="filter-btn" data-filter="status:draft">черновики</button>',
].join('\n    ');

const staffScript = `<script>
(function(){
  var cards = Array.prototype.slice.call(document.querySelectorAll('.staff-card'));
  var search = document.getElementById('q');
  var count = document.getElementById('count');
  var active = 'all';

  function apply(){
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function(c){
      var okFilter = active === 'all' ||
        (active.indexOf('course:') === 0 && c.dataset.course === active.slice(7)) ||
        (active.indexOf('type:')   === 0 && c.dataset.type   === active.slice(5)) ||
        (active.indexOf('status:') === 0 && c.dataset.status === active.slice(7));
      var okSearch = !q || c.dataset.search.indexOf(q) !== -1;
      var show = okFilter && okSearch;
      c.style.display = show ? '' : 'none';
      if(show) shown++;
    });
    count.textContent = 'Показано: ' + shown + ' из ' + cards.length;
  }

  document.querySelectorAll('.filter-btn').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.filter-btn').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      active = b.dataset.filter;
      apply();
    });
  });
  search.addEventListener('input', apply);

  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var url = location.origin + btn.dataset.copy;
      navigator.clipboard.writeText(url).then(function(){
        var old = btn.textContent;
        btn.textContent = 'Скопировано ✓';
        btn.classList.add('copied');
        setTimeout(function(){ btn.textContent = old; btn.classList.remove('copied'); }, 1600);
      });
    });
  });

  apply();
})();
</script>`;

const staffDir = path.join(OUT, staffPath);
fs.mkdirSync(staffDir, { recursive: true });
fs.writeFileSync(path.join(staffDir, 'index.html'), page({
  title: 'Все материалы — панель преподавателя',
  heading: 'Все материалы',
  sub: 'Панель преподавателя — эта страница не индексируется поисковиками',
  body: `  <div class="toolbar">
    <input type="search" id="q" placeholder="Поиск по названию, теме, юниту…">
  </div>
  <div class="toolbar">
    ${filterBtns}
  </div>
  <p class="count" id="count"></p>
${materials.map(staffCard).join('\n')}
  <p class="note">Материалов всего: ${materials.length}.
  Чтобы добавить новый — попросите Claude, он положит папку в нужный курс, и она появится здесь
  сама после <code>Commit</code> и <code>Push</code> в GitHub.</p>`,
  extraScript: staffScript,
}));

/* --- машиночитаемый каталог для агентов --- */
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify({
  generated: 'при сборке; поле намеренно без даты, чтобы сборки были воспроизводимыми',
  staffPath: `${BASE}/${staffPath}/`,
  courses,
  materials: materials.map(({ courseCfg, bytes, ...m }) => m),
}, null, 2));

/* ---------- итог ---------- */

console.log(`Собрано в _site/`);
for (const c of courses) {
  const list = materials.filter((m) => m['course-id'] === c.id);
  const drafts = list.filter((m) => m.status === 'draft').length;
  console.log(`  /${c.id}/  ${c.name}: ${list.length}${drafts ? ` (черновиков: ${drafts})` : ''}`);
}
console.log(`  /${staffPath}/  панель преподавателя: ${materials.length}`);
