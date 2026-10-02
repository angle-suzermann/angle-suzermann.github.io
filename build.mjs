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
import { execFileSync, spawnSync } from 'node:child_process';

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

/* Версия иконок сайта. Браузеры (особенно Safari) очень долго держат старую
   иконку в памяти. Поменяли favicon.ico / apple-touch-icon.png — увеличьте
   число на 1, и у всех, включая учеников, подтянется новая иконка. */
const ICON_VERSION = 6;

/* Адрес сайта целиком — нужен для превью ссылок в Telegram/WhatsApp/VK:
   картинка превью должна быть с полным адресом. Берётся из repoUrl,
   при желании можно задать явно в site.config.json полем "siteUrl". */
const ORIGIN = (() => {
  if (config.siteUrl) return String(config.siteUrl).replace(/\/+$/, '').replace(new RegExp(BASE + '$'), '');
  const m = String(config.repoUrl || '').match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  return m ? `https://${m[1].toLowerCase()}.github.io` : '';
})();
/* Картинки превью лежат в assets/og/: <курс>--<вид>.jpg, например
   ege-2027--homework.jpg (курс «gateway/gw-b2» → «gateway-gw-b2»).
   Вид: homework / classwork (по слову в имени папки или названии), иначе
   test / warmup / worksheet; для страницы курса — course. Если нужной
   картинки нет (новый курс или новый вид), берётся <курс>--course.jpg,
   а если и её нет — общая site.jpg. Добавили курс — попросите Claude
   нарисовать для него картинки. */
const OG_VERSION = 2;
const KIND_LABEL = { homework: 'Homework', classwork: 'Classwork', test: 'Test', warmup: 'Warm-up', worksheet: 'Practice' };
const COURSE_EN = { 'ege-2027': 'EGE 2027', 'placement-tests': 'Placement Tests' };
const courseNameEn = (id) => COURSE_EN[id] || (courses.find((c) => c.id === id) || {}).name || '';
function materialKind(meta, relDir) {
  const s = `${relDir} ${meta.title || ''}`.toLowerCase();
  if (s.includes('homework')) return 'homework';
  if (s.includes('classwork')) return 'classwork';
  return KIND_LABEL[meta.type] ? meta.type : 'worksheet';
}
function ogImageFor(courseId, kind) {
  const slug = (courseId || '').replace(/\//g, '-');
  const names = slug ? [`${slug}--${kind}.jpg`, `${slug}--course.jpg`, 'site.jpg'] : ['site.jpg'];
  const hit = names.find((n) => fs.existsSync(path.join(OUT, 'assets', 'og', n))) || 'site.jpg';
  return `${ORIGIN}${BASE}/assets/og/${hit}?v=${OG_VERSION}`;
}

if (!courses.length) {
  console.error('В site.config.json пустой список courses — нечего собирать.');
  process.exit(1);
}

/* ---------- 1. копируем статику ---------- */

/* Та же история, что и ниже с cp -r: на этом сетевом/смонтированном томе
   fs.rmSync иногда падает с ENOTEMPTY, потому что каталог ещё не до конца
   "устоялся" после предыдущих операций. Чистим через `rm -rf` с повтором —
   на обычной ФС (в т.ч. на раннерах GitHub Actions) отработает с первого
   раза и без задержек. */
for (let attempt = 1; fs.existsSync(OUT); attempt++) {
  const result = spawnSync('rm', ['-rf', OUT], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (!fs.existsSync(OUT)) break;
  if (attempt >= 8) {
    process.stderr.write(result.stderr || '');
    throw new Error(`не смог очистить ${OUT} за 8 попыток`);
  }
  execFileSync('sleep', ['0.4']);
}
fs.mkdirSync(OUT, { recursive: true });

/* fs.cpSync рекурсивно иногда падает (ENOENT/ENOTEMPTY) на сетевых/смонтированных
   файловых системах — например, при запуске build.mjs через удалённый мост на
   машине Виктории (device_bash, смонтированный диск, похоже на облачно
   синхронизируемый том с неатомарной видимостью только что созданных
   папок). Обычный `cp -r` куда надёжнее fs.cpSync, но и он изредка ловит
   ENOENT прямо во время копирования (mkdir отработал, а сама папка ещё не
   "видна" для записи файла в неё через долю секунды). Поэтому копируем
   с повтором: если `cp -r` упал, ждём немного и запускаем его же ещё раз —
   уже скопированные файлы просто перезапишутся, а то, что не успело
   появиться в прошлый раз, к этому моменту обычно уже видно. На обычной
   (не сетевой) файловой системе, включая раннеры GitHub Actions, всё это
   отрабатывает с первой попытки и без задержек. */
function copyRecursive(src, dest, attempt = 1) {
  const MAX_ATTEMPTS = 6;
  const result = spawnSync('cp', ['-r', src, dest], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status === 0) return;
  if (attempt >= MAX_ATTEMPTS) {
    process.stderr.write(result.stderr || '');
    throw new Error(`cp -r не смог скопировать ${src} -> ${dest} за ${MAX_ATTEMPTS} попыток`);
  }
  execFileSync('sleep', ['0.4']);
  copyRecursive(src, dest, attempt + 1);
}

for (const entry of fs.readdirSync(ROOT)) {
  if (SKIP.has(entry) || entry.endsWith('.md')) continue;
  copyRecursive(path.join(ROOT, entry), path.join(OUT, entry));
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

/* Иконка сайта и превью ссылки на КАЖДОЙ странице, включая материалы.
   Сами материалы не трогаем: теги вставляются в копии в _site при сборке
   (вызов — в самом конце файла, после генерации каталогов). Старые иконки
   и og-теги, если они были в материале, убираем, чтобы не было дублей. */
const ICON_TAGS =
  `<link rel="icon" href="${BASE}/favicon.ico?v=${ICON_VERSION}" sizes="any">\n` +
  `<link rel="icon" type="image/png" sizes="32x32" href="${BASE}/assets/brand/favicon-32.png?v=${ICON_VERSION}">\n` +
  `<link rel="apple-touch-icon" sizes="180x180" href="${BASE}/apple-touch-icon.png?v=${ICON_VERSION}">\n` +
  `<meta name="apple-mobile-web-app-title" content="ANGLE">\n`;

function ogTags(html, file) {
  const meta = readMeta(html);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = meta.title || (t ? unesc(t[1].replace(/\s+/g, ' ').trim()) : '') || 'ANGLE';
  const rel = path.relative(OUT, file).split(path.sep).join('/');
  const relDir = rel.replace(/\/?index\.html?$/i, '');
  const coursePage = courses.find((c) => c.id === relDir);
  let courseId = meta['course-id'] || '';
  let kind = 'course';
  if (coursePage) courseId = coursePage.id;
  else if (courseId) kind = materialKind(meta, relDir);
  /* заголовки страниц-каталогов — по-английски, как и вся карточка */
  if (coursePage) title = `${courseNameEn(courseId)} · Course Materials`;
  else if (relDir === '') title = 'ANGLE · Learning Materials';
  else if (relDir === staffPath) title = 'ANGLE · Teacher Panel';
  const parts = [];
  if (courseId) parts.push(courseNameEn(courseId));
  else parts.push('Systematic English Studio');
  if (kind !== 'course' && /^\d+[a-z]?$/i.test(meta.unit || '')) parts.push(`Unit ${meta.unit}`);
  if (kind !== 'course') parts.push(KIND_LABEL[kind]);
  parts.push('by Viktoria Syuzyova');
  const desc = parts.join(' · ');
  const image = ogImageFor(courseId, kind);
  const url = `${ORIGIN}${BASE}/${rel.replace(/(^|\/)index\.html?$/i, '$1')}`;
  return (
    `<meta property="og:type" content="website">\n` +
    `<meta property="og:site_name" content="ANGLE · Systematic English Studio">\n` +
    `<meta property="og:title" content="${esc(title)}">\n` +
    `<meta property="og:description" content="${esc(desc)}">\n` +
    (ORIGIN ? `<meta property="og:url" content="${esc(url)}">\n` : '') +
    (ORIGIN ? `<meta property="og:image" content="${esc(image)}">\n` +
      `<meta property="og:image:width" content="1200">\n` +
      `<meta property="og:image:height" content="630">\n` +
      `<meta name="twitter:card" content="summary_large_image">\n` : '')
  );
}

function injectHead(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { injectHead(p); continue; }
    if (!/\.html?$/i.test(e.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (!/<head(?:\s[^>]*)?>/i.test(src)) continue;
    const cleaned = src
      .replace(/<link\b[^>]*\brel=["'](?:shortcut\s+)?icon["'][^>]*>\s*/gi, '')
      .replace(/<link\b[^>]*\brel=["']apple-touch-icon(?:-precomposed)?["'][^>]*>\s*/gi, '')
      .replace(/<meta\b[^>]*\bname=["']apple-mobile-web-app-title["'][^>]*>\s*/gi, '')
      .replace(/<meta\b[^>]*\b(?:property|name)=["'](?:og|twitter):[^"']*["'][^>]*>\s*/gi, '');
    /* ставим после <meta charset>, если он есть: кодировка должна быть объявлена
       в первом килобайте страницы, иначе кириллица может отобразиться криво */
    const tags = `${ICON_TAGS}${ogTags(cleaned, p)}`;
    const out = /<meta\s+charset=[^>]*>/i.test(cleaned)
      ? cleaned.replace(/<meta\s+charset=[^>]*>/i, (m) => `${m}\n${tags}`)
      : cleaned.replace(/<head(?:\s[^>]*)?>/i, (h) => `${h}\n${tags}`);
    if (out !== src) fs.writeFileSync(p, out);
  }
}

/* ---------- 2. собираем материалы ---------- */

const materials = [];
const seenPaths = new Set();

/* Ищет материалы на любой глубине внутри папки курса: сама папка материала —
   первая по пути вниз, у которой есть index.html. Так юниты можно сгруппировать
   в подпапки (as4/unit9/water-test), не трогая site.config.json. */
function findMaterialSlugs(dir, prefix = '') {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = path.join(dir, entry.name);
    const slug = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (fs.existsSync(path.join(sub, 'index.html'))) {
      out.push(slug);
    } else {
      out = out.concat(findMaterialSlugs(sub, slug));
    }
  }
  return out;
}

/* Личные папки (фидбек конкретному ученику — PDF/HTML-экспорты без
   index.html, то есть НЕ материалы: findMaterialSlugs их не видит, в
   каталог и панель преподавателя они не попадают, ws:*-метаданные им не
   нужны). Сами файлы build.mjs всё равно копирует в _site как есть (общее
   копирование статики, см. ниже), так что по прямой ссылке они и так
   открывались бы — просто без этой ссылки на странице курса их никто не
   найдёт. Чтобы такая папка появилась отдельным блоком со ссылками на
   странице курса — положите прямо в её корень пустой файл-маркер
   `.personal`. Больше ничего регистрировать не нужно: подпапки внутри
   стают заголовками-темами, остальные файлы — ссылками, пустые папки
   (ни одного файла ни на одном уровне) в блок не попадают. */
function walkPersonalTree(dir, relPrefix) {
  const files = [];
  const groups = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'ru'))) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      groups.push({ name: entry.name, ...walkPersonalTree(full, rel) });
    } else {
      files.push({ name: entry.name, rel });
    }
  }
  return { files, groups };
}
const personalTreeHasFiles = (node) => node.files.length > 0 || node.groups.some(personalTreeHasFiles);
function findPersonalFolders(courseDir) {
  const out = [];
  if (!fs.existsSync(courseDir)) return out;
  for (const entry of fs.readdirSync(courseDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const sub = path.join(courseDir, entry.name);
    if (!fs.existsSync(path.join(sub, '.personal'))) continue;
    const tree = walkPersonalTree(sub, entry.name);
    if (personalTreeHasFiles(tree)) out.push({ name: entry.name, tree });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

for (const course of courses) {
  const courseDir = path.join(ROOT, course.id);
  if (!fs.existsSync(courseDir)) continue;

  for (const slug of findMaterialSlugs(courseDir)) {
    const file = path.join(courseDir, slug, 'index.html');

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
    /* группа — подпапка внутри курса (unit 9, module 3, 1.Путешествие…),
       если материал лежит не прямо в папке курса, а на уровень глубже */
    const group = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : null;

    /* реальный адрес доставки определяем по коду страницы, а не по ws:formspree —
       этот тег остался только меткой курса в письме и легко расходится с правдой
       (см. историю с mjgnbjkk). Так строка в панели не может протухнуть. */
    const backend =
      /usebasin\.com\/f\//.test(html) ? 'Basin (файлы)' :
      /api\.web3forms\.com/.test(html) ? 'Web3Forms' :
      /test-engine\.js/.test(html) ? 'Web3Forms (через test-engine.js)' :
      /formspree\.io\/f\//.test(html) ? 'Formspree — ' + (meta.formspree || '?') :
      null;

    materials.push({
      ...meta,
      url: `${BASE}/${rel}/`,
      dir: rel,
      group,
      courseCfg: course,
      backend,
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

/* Фирменный бейдж ANGLE — трассированный вордмарк, fill наследует цвет
   через currentColor. Взят как есть из скилла angle-sticky-badge,
   руками не редактировать. */
const ANGLE_WORDMARK = `<svg class="wordmark" viewBox="0 0 2190 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ANGLE">
  <g transform="translate(0.000000,640.000000) scale(0.100000,-0.100000)" fill="currentColor">
    <path d="M4253 6000 c-18 -4 -49 -20 -69 -36 -39 -30 -101 -79 -230 -179 -43 -33 -94 -73 -115 -90 -41 -33 -162 -127 -243 -190 -96 -73 -200 -154 -267 -208 -68 -54 -406 -318 -508 -397 -32 -25 -96 -74 -141 -110 -46 -36 -106 -83 -135 -105 -50 -38 -81 -62 -225 -176 -36 -28 -96 -75 -135 -105 -38 -30 -101 -79 -140 -109 -38 -30 -101 -79 -140 -109 -38 -30 -99 -77 -135 -106 -128 -101 -148 -116 -221 -172 -41 -31 -103 -80 -139 -108 -36 -28 -96 -75 -135 -105 -38 -30 -99 -77 -135 -106 -36 -28 -89 -70 -119 -92 -188 -146 -276 -215 -391 -307 -41 -33 -100 -78 -131 -99 -57 -40 -119 -104 -119 -122 0 -42 21 -51 190 -79 36 -6 110 -24 165 -39 55 -16 164 -41 241 -56 165 -31 177 -29 290 61 34 27 92 73 130 102 69 53 110 84 239 186 101 80 111 80 364 18 113 -28 246 -58 294 -67 48 -9 113 -25 144 -36 30 -10 128 -32 217 -49 88 -17 204 -43 256 -59 52 -16 165 -42 250 -59 85 -17 200 -43 255 -57 55 -14 120 -30 145 -35 83 -19 104 -67 75 -165 -8 -27 -23 -92 -31 -145 -9 -52 -25 -121 -35 -153 -25 -79 -11 -117 52 -140 89 -32 218 -66 356 -93 192 -38 210 -29 238 122 9 43 26 112 39 154 13 41 31 118 40 170 9 52 37 173 61 269 25 96 45 184 45 196 0 12 13 69 30 126 16 57 45 183 64 279 20 96 45 204 56 240 11 35 32 127 46 205 15 77 37 174 49 215 13 41 35 136 49 211 15 75 39 183 56 240 16 57 34 136 40 174 7 39 29 140 51 225 21 85 50 209 63 275 14 66 32 139 40 163 9 24 25 91 36 150 11 59 28 137 36 173 32 134 0 165 -211 203 -77 14 -176 37 -220 50 -71 22 -182 46 -270 59 -16 2 -45 1 -62 -3z m-65 -974 c2 -15 -10 -70 -27 -124 -16 -53 -44 -168 -61 -255 -17 -87 -40 -186 -50 -220 -11 -34 -29 -111 -41 -172 -11 -60 -38 -177 -59 -260 -22 -82 -46 -189 -54 -237 -18 -108 -50 -213 -76 -256 -32 -52 -57 -58 -147 -34 -43 11 -123 28 -178 38 -55 9 -145 29 -200 45 -55 15 -143 35 -195 44 -52 9 -153 31 -225 50 -127 33 -202 48 -298 60 -124 16 -110 95 32 196 63 44 120 88 201 154 58 48 132 105 250 195 40 30 118 91 174 135 168 133 226 178 276 215 26 19 84 64 129 100 45 36 95 75 111 86 44 33 147 114 199 159 159 135 230 159 239 81z M5488 5700 c-39 -30 -54 -72 -82 -230 -15 -80 -40 -194 -57 -253 -17 -60 -34 -134 -39 -165 -8 -51 -61 -280 -135 -582 -14 -58 -43 -189 -64 -291 -22 -103 -49 -216 -60 -253 -11 -36 -34 -141 -51 -232 -17 -91 -40 -191 -51 -222 -11 -31 -29 -106 -41 -167 -11 -60 -33 -162 -50 -225 -16 -63 -40 -167 -53 -231 -13 -64 -35 -156 -49 -205 -13 -49 -39 -161 -56 -248 -17 -88 -40 -185 -52 -215 -69 -190 -35 -234 216 -276 50 -9 137 -29 194 -46 170 -51 195 -30 243 204 16 79 35 163 44 186 8 23 28 113 45 199 17 86 44 204 59 262 16 58 42 170 57 250 15 80 37 175 50 212 12 36 27 99 33 140 6 40 31 154 56 253 24 99 49 209 55 245 7 36 23 103 36 150 14 47 38 153 55 235 16 83 38 179 48 215 11 36 25 94 31 130 16 90 33 120 70 120 34 0 56 -27 90 -115 13 -33 45 -103 71 -155 26 -52 86 -174 134 -270 47 -96 95 -191 106 -210 11 -19 33 -64 49 -100 17 -36 39 -81 51 -100 11 -19 32 -60 45 -90 50 -109 125 -266 144 -302 47 -89 69 -133 258 -518 110 -223 308 -623 440 -890 132 -267 252 -510 265 -541 43 -97 90 -122 317 -163 78 -15 195 -42 259 -60 190 -56 266 -59 296 -12 8 12 26 80 40 151 13 70 33 156 44 189 11 34 36 140 56 237 19 96 41 195 50 218 8 23 22 82 30 129 14 79 58 266 146 627 17 72 46 203 65 293 18 90 42 193 53 230 12 37 34 139 51 227 16 88 39 187 50 220 12 33 30 107 41 165 10 58 33 159 50 225 16 66 43 184 60 262 16 79 34 154 39 168 5 14 23 86 40 161 46 207 34 234 -116 260 -49 8 -147 31 -219 51 -273 75 -273 76 -350 -340 -9 -49 -27 -125 -41 -169 -13 -44 -33 -131 -44 -192 -30 -163 -39 -203 -65 -286 -14 -41 -31 -118 -40 -170 -9 -52 -34 -162 -55 -245 -21 -82 -41 -170 -45 -195 -4 -25 -24 -112 -45 -195 -21 -82 -51 -210 -65 -284 -14 -74 -32 -149 -40 -167 -7 -18 -30 -117 -50 -220 -46 -238 -68 -309 -101 -330 -33 -22 -69 -6 -88 38 -55 126 -316 674 -357 748 -46 84 -340 681 -359 731 -12 29 -35 76 -51 103 -17 26 -39 71 -50 100 -11 28 -34 73 -50 100 -17 26 -39 71 -50 100 -11 28 -34 73 -50 100 -17 26 -38 69 -49 95 -10 25 -36 77 -59 116 -23 38 -41 74 -41 79 0 5 -23 57 -51 115 -71 145 -295 598 -319 641 -10 19 -48 96 -85 170 -94 188 -81 178 -277 215 -73 13 -160 34 -193 45 -33 11 -96 27 -140 35 -44 7 -93 19 -108 24 -46 18 -111 13 -139 -9z M11020 4450 c-189 -30 -353 -70 -430 -104 -41 -19 -93 -39 -115 -46 -117 -36 -405 -219 -550 -350 -233 -210 -442 -499 -526 -728 -17 -48 -42 -108 -55 -133 -22 -45 -83 -327 -102 -479 -31 -234 26 -703 107 -888 16 -37 40 -94 52 -127 81 -217 315 -548 503 -710 142 -123 334 -256 412 -287 24 -10 62 -29 85 -43 22 -15 86 -42 142 -62 56 -19 113 -41 127 -48 83 -42 468 -95 660 -91 165 4 425 44 530 80 98 35 229 93 270 120 20 13 58 35 85 49 28 14 84 52 125 86 95 76 123 88 151 60 24 -24 21 -60 -17 -204 -13 -49 -36 -135 -50 -189 -49 -185 -31 -201 285 -255 115 -20 175 -46 186 -81 5 -15 15 -20 43 -20 62 1 118 109 158 310 18 85 46 208 63 272 16 64 37 159 46 210 9 51 27 127 40 168 13 42 33 130 45 195 11 66 34 167 50 225 16 58 45 182 64 276 19 94 41 187 50 208 57 137 3 179 -299 236 -88 16 -187 39 -220 50 -33 11 -112 30 -175 41 -63 12 -164 34 -225 50 -60 16 -164 40 -230 53 -66 14 -183 41 -260 62 -288 78 -302 71 -345 -167 -11 -64 -34 -156 -50 -205 -65 -192 -39 -219 275 -279 355 -68 379 -103 207 -305 -233 -276 -562 -418 -912 -394 -143 9 -438 86 -516 134 -19 12 -61 35 -94 51 -168 81 -437 345 -520 509 -13 24 -33 61 -46 80 -43 65 -121 297 -139 415 -44 277 16 642 139 845 19 30 43 73 54 95 70 139 331 399 472 470 19 10 54 31 77 46 49 34 268 114 368 135 198 41 537 23 674 -35 37 -16 94 -36 126 -46 124 -36 349 -189 481 -326 68 -72 156 -184 203 -262 43 -70 83 -78 226 -48 50 10 161 27 249 36 135 15 162 21 184 40 40 35 35 87 -17 173 -22 37 -41 73 -41 79 0 38 -210 322 -330 446 -178 186 -494 402 -665 457 -22 7 -74 28 -116 46 -226 99 -692 149 -969 104z M21320 3909 c-74 -4 -840 -7 -1701 -8 -1527 -1 -1567 -1 -1590 -20 -24 -19 -24 -19 -29 -1863 -5 -1800 -5 -1845 14 -1931 20 -87 20 -87 1786 -87 1765 0 1765 0 1778 65 16 84 16 519 1 565 -23 64 61 61 -1459 60 -865 -1 -1386 3 -1397 9 -48 25 -55 44 -63 188 -15 238 -16 665 -2 690 31 57 -46 54 1428 54 1472 -1 1402 -3 1440 54 15 24 17 56 17 293 0 266 0 266 -27 289 -15 13 -37 23 -49 23 -12 0 -636 2 -1387 3 -1307 2 -1366 3 -1392 20 -40 27 -39 23 -40 456 0 431 0 428 55 461 31 19 63 20 1420 20 1527 0 1433 -4 1456 61 15 44 15 519 0 553 -21 46 -70 54 -259 45z M14548 3809 c-27 -15 -35 -37 -58 -150 -12 -57 -30 -135 -42 -174 -11 -38 -33 -131 -49 -205 -16 -74 -40 -178 -54 -230 -14 -52 -34 -142 -46 -200 -11 -58 -31 -139 -44 -180 -12 -41 -37 -148 -55 -238 -17 -90 -40 -189 -51 -220 -11 -31 -29 -104 -40 -162 -10 -58 -30 -148 -44 -200 -14 -52 -34 -138 -46 -190 -12 -52 -41 -174 -64 -270 -24 -96 -50 -214 -59 -261 -9 -47 -25 -112 -36 -143 -11 -32 -35 -135 -54 -229 -19 -95 -42 -192 -51 -217 -9 -25 -27 -99 -40 -165 -13 -66 -31 -151 -39 -190 -9 -38 -16 -96 -16 -128 0 -57 0 -57 1947 -55 1946 3 1946 3 1965 68 20 74 27 515 8 565 -22 58 52 56 -1533 55 -799 0 -1462 0 -1474 0 -68 1 -79 72 -34 219 16 53 43 166 60 251 17 86 39 181 50 213 11 32 32 118 46 192 14 73 39 180 55 237 17 57 37 142 45 190 9 48 24 116 35 150 23 78 53 206 74 319 9 47 25 112 36 143 10 31 35 138 55 237 19 99 44 202 55 228 10 27 28 100 40 162 29 154 55 260 81 333 25 71 21 108 -15 131 -30 20 -206 70 -277 80 -30 4 -96 16 -148 26 -103 21 -157 23 -183 8z"/>
  </g>
</svg>`;

const ANGLE_BADGE = `<div class="angle-badge">${ANGLE_WORDMARK}<div class="credit">by ${esc(config.author || '')}</div></div>`;

/* headingIcon — необязательный путь к фирменному стикеру ANGLE (см.
   assets/brand/heading-*.png), рисуется перед заголовком на лендинге и
   в панели преподавателя вместо обычного эмодзи курса — просили именно
   фирменные стикеры из папки Виктории, не юникод-эмодзи. headingIconSmall —
   стикер заменяет собой именно юникод-эмодзи (курс/семья курсов), поэтому
   должен быть размером с этот эмодзи и вписываться в строку текста
   (.heading-icon--inline, высота 1em); без этого флага — крупный фирменный
   стикер ANGLE Student/ANGLE Teacher, для него размер прежний (1.6em). */
const page = ({ title, heading, sub, body, extraScript = '', headingIcon = '', headingIconSmall = false }) => `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${BASE}/assets/catalog.css">
<link rel="icon" href="${BASE}/favicon.ico?v=${ICON_VERSION}" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="${BASE}/assets/brand/favicon-32.png?v=${ICON_VERSION}">
<link rel="apple-touch-icon" sizes="180x180" href="${BASE}/apple-touch-icon.png?v=${ICON_VERSION}">
<meta name="apple-mobile-web-app-title" content="ANGLE">
</head>
<body>
<div class="bg-photo"></div>
<div class="bg-wash"></div>
${ANGLE_BADGE}
<header class="cat-header">
  <h1>${headingIcon ? `<img class="heading-icon${headingIconSmall ? ' heading-icon--inline' : ''}" src="${BASE}${headingIcon}" alt="">` : ''}${esc(heading)}</h1>
  ${sub ? `<p>${esc(sub)}</p>` : ''}
</header>
<div class="page">
${body}
</div>
${extraScript}
</body>
</html>
`;

const card = (m) => `  <a class="card" href="${esc(m.url)}" data-group="${esc(m.group || '')}"
     data-date="${esc(m.date)}" data-title="${esc(m.title)}" data-unit="${esc(m.unit)}">
    <div class="row">
      <span class="name">${m.emoji ? esc(m.emoji) + ' ' : ''}${esc(m.title)}</span>
      <span class="pill ${esc(m.type)}">${esc(m.type)}</span>
    </div>
    <div class="meta"><span>Unit ${esc(m.unit)}</span>${m.tags ? `<span>${esc(m.tags)}</span>` : ''}</div>
  </a>`;

/* Панель сортировки — переставляет карточки внутри контейнера по дате
   (когда добавили материал), по имени или по теме (юниту). Разметка
   одинаковая для страницы курса и панели преподавателя, скрипт общий
   (см. sortScript), различается только то, какой контейнер он сортирует. */
/* startHidden — для страниц с плитками-папками (см. groupFolderNav):
   сортировка относится к списку материалов, а он сам скрыт, пока не
   зайти в юнит, — без этого кнопки сортировки до захода в юнит висели
   бы прямо под сеткой плиток, наезжая на неё визуально. Скрываем сразу
   в разметке (не только через JS), чтобы не было вспышки при загрузке. */
const sortToolbar = (startHidden) => `  <div class="sort-toolbar"${startHidden ? ' hidden' : ''}>
    <span class="sort-label">Сортировка:</span>
    <button type="button" class="filter-btn" data-sort="date">🕓 По дате</button>
    <button type="button" class="filter-btn" data-sort="title">🔤 По имени</button>
    <button type="button" class="filter-btn" data-sort="unit">📚 По теме</button>
  </div>
`;

/* containerSel — что переставляем местами, itemSel — что именно является
   элементом списка внутри контейнера. Клик по уже активной кнопке меняет
   направление на обратное; по дате по умолчанию сначала новые. */
const sortScript = (containerSel, itemSel) => `<script>
(function(){
  var container = document.querySelector(${JSON.stringify(containerSel)});
  var toolbar = document.querySelector('.sort-toolbar');
  if(!container || !toolbar) return;
  var btns = Array.prototype.slice.call(toolbar.querySelectorAll('.filter-btn'));
  var state = { key: null, dir: 1 };

  function compare(a, b){
    var av = a.dataset[state.key] || '';
    var bv = b.dataset[state.key] || '';
    var res = state.key === 'date'
      ? (av < bv ? -1 : av > bv ? 1 : 0)
      : av.localeCompare(bv, 'ru', { numeric: true, sensitivity: 'base' });
    return res * state.dir;
  }

  function apply(){
    var items = Array.prototype.slice.call(container.querySelectorAll(${JSON.stringify(itemSel)}));
    items.sort(compare);
    items.forEach(function(el){ container.appendChild(el); });
  }

  btns.forEach(function(b){
    b.addEventListener('click', function(){
      var key = b.dataset.sort;
      if(state.key === key){ state.dir *= -1; }
      else { state.key = key; state.dir = key === 'date' ? -1 : 1; }
      btns.forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      apply();
    });
  });
})();
</script>`;

/* Юниты/темы внутри курса — на странице курса выглядят и ведут себя
   как плитки уровней на лендинге (см. /oxford-phonics/): плиточная
   сетка «папок», клик по плитке заходит внутрь (прячет сетку, кладёт
   список материалов), кнопка «← Назад» возвращает. Для курсов, где
   темы вложены на два уровня (Тема/Навык, например
   "2. Высшая школа/аудирование"), плитка темы с навыками ведёт не
   сразу на материалы, а на второй экран плиток-навыков (плюс плитка
   «Все», чтобы увидеть все материалы темы целиком). Для курсов без
   такой вложенности (GW B2 "unit 8" и т.п.) плитка темы сразу ведёт
   на материалы — второго экрана просто нет. */
const themeOf = (g) => (g.includes('/') ? g.slice(0, g.indexOf('/')) : g);
const skillOf = (g) => (g.includes('/') ? g.slice(g.indexOf('/') + 1) : null);
const isHierGroups = (list) => list.some((m) => m.group && m.group.includes('/'));

/* Общие для лендинга и панели преподавателя: считает темы/навыки и их
   счётчики материалов один раз, дальше оба места просто рисуют плитки
   из готового дерева — чтобы не дублировать подсчёты и не разойтись
   в поведении между публичной страницей курса и панелью учителя. */
const groupTileTree = (list) => {
  const groups = [...new Set(list.map((m) => m.group).filter(Boolean))];
  if (!groups.length) return null;
  const themes = [...new Set(groups.map(themeOf))]
    .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  const countExact = (g) => list.filter((m) => m.group === g).length;
  const countPrefix = (t) => list.filter((m) => m.group === t || (m.group && m.group.indexOf(t + '/') === 0)).length;
  const ungroupedCount = list.filter((m) => !m.group).length;
  return { groups, themes, countExact, countPrefix, ungroupedCount };
};

const groupTileHtml = (attrs, emoji, name, count) => `      <a class="tile" href="javascript:void(0)"${attrs}>
        <span class="tile-icon"><span class="tile-emoji">${emoji}</span></span>
        <span class="tile-name">${esc(name)}</span>
        <span class="tile-count">${count} ${wordForm(count, 'материал', 'материала', 'материалов')}</span>
      </a>`;

const groupFolderNav = (list) => {
  const tree = groupTileTree(list);
  if (!tree) return '';
  const { groups, themes, countExact, countPrefix, ungroupedCount } = tree;

  const topTiles = themes.map((t) => {
    const hasSkills = groups.some((g) => themeOf(g) === t && skillOf(g));
    const count = hasSkills ? countPrefix(t) : countExact(t);
    return groupTileHtml(` data-group-tile="${esc(t)}"${hasSkills ? ' data-has-skills="1"' : ''}`, '📁', t, count);
  });
  if (ungroupedCount) {
    topTiles.push(groupTileHtml(' data-group-tile=""', '📁', 'Без юнита', ungroupedCount));
  }

  const skillGrids = themes
    .filter((t) => groups.some((g) => themeOf(g) === t && skillOf(g)))
    .map((t) => {
      const skills = [...new Set(groups.filter((g) => themeOf(g) === t).map(skillOf).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
      const allTile = groupTileHtml(` data-group-tile="${esc(t)}" data-prefix="1"`, '📂', 'Все', countPrefix(t));
      const skillTiles = skills.map((s) => {
        const full = `${t}/${s}`;
        return groupTileHtml(` data-group-tile="${esc(full)}"`, '📁', s, countExact(full));
      }).join('\n');
      return `    <div class="tile-grid" data-skill-grid-for="${esc(t)}" hidden>
${allTile}
${skillTiles}
    </div>`;
    }).join('\n');

  return `  <div class="folder-nav">
    <button type="button" class="link-copy" id="groupBack" hidden>← Назад</button>
    <button type="button" class="link-copy" id="groupLinkBtn" data-copy="" hidden>🔗 Скопировать ссылку на эту папку</button>
    <div class="tile-grid" id="groupTopGrid">
${topTiles.join('\n')}
    </div>
${skillGrids}
  </div>
`;
};

/* Клик по плитке юнита/темы «заходит внутрь» ровно по той же логике,
   что и плитки курсов/семей в панели преподавателя: прячет текущую
   сетку плиток, показывает либо следующий уровень плиток (навыки),
   либо отфильтрованный список материалов, плюс кнопку «← Назад». */
const groupFolderScript = `<script>
(function(){
  var nav = document.querySelector('.folder-nav');
  if(!nav) return;
  var backBtn = document.getElementById('groupBack');
  var linkBtn = document.getElementById('groupLinkBtn');
  var topGrid = document.getElementById('groupTopGrid');
  var skillGrids = Array.prototype.slice.call(document.querySelectorAll('[data-skill-grid-for]'));
  var materials = document.getElementById('groupMaterials');
  var sortToolbarEl = document.querySelector('.sort-toolbar');
  var view = 'top';
  var currentTheme = null;
  var currentGroup = null;
  var currentPrefix = false;

  function filterMaterials(group, prefix){
    document.querySelectorAll('.card[data-group]').forEach(function(c){
      var g = c.dataset.group;
      var show = prefix ? (g === group || g.indexOf(group + '/') === 0) : g === group;
      c.style.display = show ? '' : 'none';
    });
  }
  function render(){
    topGrid.hidden = view !== 'top';
    skillGrids.forEach(function(g){ g.hidden = !(view === 'skills' && g.dataset.skillGridFor === currentTheme); });
    if(materials) materials.hidden = view !== 'materials';
    if(sortToolbarEl) sortToolbarEl.hidden = view !== 'materials';
    backBtn.hidden = view === 'top';
    if(view === 'materials') filterMaterials(currentGroup, currentPrefix);
    /* ссылка на конкретную папку — видна только когда открыт её список
       материалов (не на сетке плиток и не на экране навыков), ведёт
       прямо в этот же вид через ?g=группа(&p=1 для «Все» внутри темы) —
       см. разбор параметров внизу файла */
    if(linkBtn){
      if(view === 'materials'){
        linkBtn.dataset.copy = location.pathname + '?g=' + currentGroup + (currentPrefix ? '&p=1' : '');
        linkBtn.hidden = false;
      } else {
        linkBtn.hidden = true;
      }
    }
  }
  function showTop(){ view = 'top'; currentTheme = null; currentGroup = null; currentPrefix = false; render(); }
  function showSkills(theme){ view = 'skills'; currentTheme = theme; render(); }
  function showMaterials(group, prefix, parentTheme){
    view = 'materials';
    currentTheme = parentTheme || null;
    currentGroup = group;
    currentPrefix = prefix;
    render();
  }

  /* iOS-свайп вправо (и кнопка «Назад» браузера) должны листать экраны
     папок так же, как видимая кнопка «← Назад»: каждый переход на экран
     глубже кладёт в историю запись-снимок (pushFolderNav), а возврат —
     жестом, кнопкой браузера или самой кнопкой «← Назад» — вызывает
     popstate и восстанавливает ровно предыдущий снимок. */
  function pushFolderNav(){
    history.pushState({ view: view, currentTheme: currentTheme, currentGroup: currentGroup, currentPrefix: currentPrefix }, '');
  }
  window.addEventListener('popstate', function(e){
    if(e.state){
      view = e.state.view; currentTheme = e.state.currentTheme;
      currentGroup = e.state.currentGroup; currentPrefix = e.state.currentPrefix;
      render();
    } else {
      showTop();
    }
  });

  document.querySelectorAll('.tile[data-group-tile]').forEach(function(t){
    t.addEventListener('click', function(){
      var val = t.dataset.groupTile;
      var grid = t.closest('[data-skill-grid-for]');
      if(t.dataset.hasSkills === '1'){
        showSkills(val);
      } else if(grid){
        showMaterials(val, t.dataset.prefix === '1', grid.dataset.skillGridFor);
      } else {
        showMaterials(val, false, null);
      }
      pushFolderNav();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  backBtn.addEventListener('click', function(){
    history.back();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* открытие по ссылке с ?g=...: сразу показываем нужную папку, минуя
     клик по плитке — g без «/» и без p=1 — обычная плоская папка;
     p=1 — плитка «Все» внутри темы с навыками (g тогда сама тема);
     g с «/» — конкретный навык внутри темы (тема — часть до «/») */
  var params = new URLSearchParams(location.search);
  var gParam = params.get('g');
  if(gParam){
    if(params.get('p') === '1'){
      showMaterials(gParam, true, gParam);
    } else if(gParam.indexOf('/') !== -1){
      showMaterials(gParam, false, gParam.slice(0, gParam.indexOf('/')));
    } else {
      showMaterials(gParam, false, null);
    }
  } else {
    showTop();
  }
})();
</script>`;

/* копирование ссылки по клику — общее для страницы курса и панели преподавателя */
const copyScript = `<script>
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var url = encodeURI(location.origin + btn.dataset.copy);
      navigator.clipboard.writeText(url).then(function(){
        var old = btn.textContent;
        btn.textContent = 'Скопировано ✓';
        btn.classList.add('copied');
        setTimeout(function(){ btn.textContent = old; btn.classList.remove('copied'); }, 1600);
      });
    });
  });
</script>`;

const courseLinkRow = (course) => `  <div class="course-link-row">${course.textbookUrl ? `
    <a class="textbook-link" href="${esc(course.textbookUrl)}" target="_blank" rel="noopener">📘 Скачать учебник</a>` : ''}
    <button type="button" class="link-copy" data-copy="${esc(`${BASE}/${course.id}/`)}">🔗 Скопировать ссылку на эту страницу</button>
  </div>
`;

/* см. findPersonalFolders выше — рисует блок ссылок на личные папки
   (фидбек конкретному ученику), если в курсе есть хоть одна такая
   непустая папка с маркером .personal. */
const personalFileLink = (course, rel) => {
  const label = path.basename(rel).replace(/\.[^.]+$/, '');
  const href = `${BASE}/${course.id}/${rel.split('/').map(encodeURIComponent).join('/')}`;
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
};
function renderPersonalNode(course, node, depth) {
  const filesHtml = node.files.length
    ? `<ul class="personal-files">\n${node.files.map((f) => `        <li>${personalFileLink(course, f.rel)}</li>`).join('\n')}\n      </ul>`
    : '';
  const groupsHtml = node.groups
    .filter(personalTreeHasFiles)
    .map((g) => `      <div class="personal-group">
        <h${Math.min(depth + 4, 6)}>${esc(g.name)}</h${Math.min(depth + 4, 6)}>
        ${renderPersonalNode(course, g, depth + 1)}
      </div>`)
    .join('\n');
  return `${filesHtml}${groupsHtml}`;
}
const personalFoldersBlock = (course) => {
  const folders = findPersonalFolders(path.join(ROOT, course.id));
  if (!folders.length) return '';
  return `  <div class="personal-folders">
    <h2>📁 Личные материалы</h2>
${folders.map((f) => `    <div class="personal-folder">
      <h3>${esc(f.name)}</h3>
      ${renderPersonalNode(course, f.tree, 0)}
    </div>`).join('\n')}
  </div>
`;
};

/* Курсы с одинаковым config.courses[].family группируются в один блок
   с общим заголовком (см. site.config.json, поле "family") — используется
   и на лендинге (плитки), и в панели преподавателя (кнопка + подвкладки). */
const familyOrder = [];
const familyCourses = new Map(); // famId -> [course, ...]
const familyId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const standaloneCourses = [];
for (const c of courses) {
  if (c.family) {
    const fid = familyId(c.family);
    if (!familyCourses.has(fid)) { familyCourses.set(fid, []); familyOrder.push([fid, c.family]); }
    familyCourses.get(fid).push(c);
  } else {
    standaloneCourses.push(c);
  }
}

/* --- лендинг: плитки папок курсов, без списков материалов и без общего «Все» --- */
const wordForm = (n, one, few, many) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;

/* Семьи, где вместо плитки на каждый уровень показываем одну общую плитку
   на всю семью (уровни-заглушки без единого материала выглядят как мусор).
   Плитка ведёт на уровень с наибольшим числом материалов; появятся материалы
   в других уровнях — просто уберите семью отсюда, когда решите их показать. */
const COLLAPSED_FAMILIES = ['Oxford Phonics'];

/* Логотипы учебников вместо эмодзи на плитках курса — файлы лежат в
   assets/brand/logos/. Добавили лого для нового курса — впишите сюда его
   course-id, эмодзи останется запасным вариантом для всех остальных. */
const LOGO_MAP = {
  'ege-2027': 'ege-2027.png',
  as2: 'academy-stars-2.png',
  as3: 'academy-stars-3.png',
  as4: 'academy-stars-4.png',
  as5: 'academy-stars-5.png',
  'empower-b1': 'empower-b1.png',
  'gateway/gateway-to-the-world-b1': 'gateway-to-the-world-b1.png',
  'gateway/gateway-to-the-world-b2': 'gateway-to-the-world-b2.png',
  'oxford-phonics/1': 'oxford-phonics.png',
  'oxford-phonics/2': 'oxford-phonics.png',
  'oxford-phonics/3': 'oxford-phonics.png',
  'oxford-phonics/4': 'oxford-phonics.png',
  'oxford-phonics/5': 'oxford-phonics.png',
  'expert-advanced': 'expert-advanced-sticker.png',
  'gateway/gw-b2': 'gw-b2.png',
  'a2-key-for-schools': 'a2-key-for-schools.png',
  'placement-tests': 'placement-tests-cambridge.png',
};
/* .tile-icon — общая рамка высотой 44px под лого/эмодзи: у всех логотипов
   разное соотношение сторон (Gateway — широкий и низкий, Academy Stars —
   почти квадратный), поэтому просто высота+object-fit давала им разный
   видимый размер. Рамка ограничивает и высоту, и максимальную ширину —
   картинка сама вписывается по большей стороне (см. .tile-logo в catalog.css). */
const tileIconFor = (course) => LOGO_MAP[course.id]
  ? `<span class="tile-icon"><img class="tile-logo" src="${esc(`${BASE}/assets/brand/logos/${LOGO_MAP[course.id]}`)}" alt=""></span>`
  : `<span class="tile-icon"><span class="tile-emoji">${esc(course.emoji || '📁')}</span></span>`;

/* Иконка перед названием семьи курсов (заголовок «🌟 Academy Stars» и т.п.,
   и на лендинге, и в панели преподавателя) — фирменный стикер вместо
   юникод-эмодзи, там где он заведён; для остальных семей эмодзи остаётся
   запасным вариантом. Файлы лежат в assets/brand/course/ — общие с
   иконками заголовков страниц курса (см. COURSE_HEADING_ICON_MAP ниже),
   переиспользуем те же картинки, где это в тему. */
const FAMILY_ICON_MAP = {
  'Academy Stars': 'academy-stars.png',
  Gateway: 'gateway-door.png',
  'Oxford Phonics': 'oxford-phonics.png',
};
const familyIconFor = (famName, emoji) => FAMILY_ICON_MAP[famName]
  ? `<img class="family-icon" src="${esc(`${BASE}/assets/brand/course/${FAMILY_ICON_MAP[famName]}`)}" alt="">`
  : (emoji ? esc(emoji) + ' ' : '');

const tileFor = (course, label, overrideCount) => {
  const count = overrideCount != null
    ? overrideCount
    : materials.filter((m) => m['course-id'] === course.id && m.status === 'published').length;
  return `      <a class="tile" href="${esc(`${BASE}/${course.id}/`)}">
        ${tileIconFor(course)}
        <span class="tile-name">${esc(label)}</span>
        <span class="tile-count">${count} ${wordForm(count, 'материал', 'материала', 'материалов')}</span>
      </a>`;
};

/* Если у всех курсов схлопнутой семьи общий префикс пути (oxford-phonics/1,
   oxford-phonics/2, …) — у семьи будет отдельная хаб-страница с плитками
   по уровням, и общая плитка семьи ведёт на неё, а не сразу на курс. */
const familyPrefix = (fam) => {
  const parts = fam.map((c) => (c.id.includes('/') ? c.id.slice(0, c.id.indexOf('/')) : null));
  return parts.every((p) => p && p === parts[0]) ? parts[0] : null;
};

const landingFamilyBlocks = familyOrder.map(([fid, famName]) => {
  const fam = familyCourses.get(fid);
  const emoji = fam.find((c) => c.emoji)?.emoji || '';
  const countPublished = (c) => materials.filter((m) => m['course-id'] === c.id && m.status === 'published').length;
  let tiles;
  if (COLLAPSED_FAMILIES.includes(famName)) {
    const prefix = familyPrefix(fam);
    const total = fam.reduce((sum, c) => sum + countPublished(c), 0);
    const repCourse = fam.reduce((a, b) => (countPublished(b) > countPublished(a) ? b : a));
    const href = prefix ? `${BASE}/${prefix}/` : `${BASE}/${repCourse.id}/`;
    tiles = `      <a class="tile" href="${esc(href)}">
        ${tileIconFor(repCourse)}
        <span class="tile-name">${esc(famName)}</span>
        <span class="tile-count">${total} ${wordForm(total, 'материал', 'материала', 'материалов')}</span>
      </a>`;
  } else {
    tiles = fam.map((c) => tileFor(c, c.name.replace(famName, '').trim() || c.name)).join('\n');
  }
  return `  <div class="tile-family">
    <h2>${familyIconFor(famName, emoji)}${esc(famName)}</h2>
    <div class="tile-grid">
${tiles}
    </div>
  </div>`;
}).join('\n');

/* хаб-страницы схлопнутых семей — плитки по уровням, ведущие на реальные
   страницы курсов; генерируются только если есть общий префикс пути. */
for (const [fid, famName] of familyOrder) {
  if (!COLLAPSED_FAMILIES.includes(famName)) continue;
  const fam = familyCourses.get(fid);
  const prefix = familyPrefix(fam);
  if (!prefix) continue;
  const dir = path.join(OUT, prefix);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({
    title: `${famName} — материалы`,
    heading: famName,
    headingIcon: FAMILY_ICON_MAP[famName] ? `/assets/brand/course/${FAMILY_ICON_MAP[famName]}` : '',
    headingIconSmall: true,
    sub: 'Выберите уровень',
    body: `  <div class="tile-grid">
${fam.map((c) => tileFor(c, c.name.replace(famName, '').trim() || c.name)).join('\n')}
  </div>`,
  }));
}

const landingStandaloneBlock = standaloneCourses.length
  ? `  <div class="tile-family">
    <div class="tile-grid">
${standaloneCourses.map((c) => tileFor(c, c.name)).join('\n')}
    </div>
  </div>`
  : '';

fs.writeFileSync(path.join(OUT, 'index.html'), page({
  title: 'ANGLE Student',
  heading: 'ANGLE Student',
  headingIcon: '/assets/brand/heading-student.png',
  sub: '',
  body: `${landingFamilyBlocks}
${landingStandaloneBlock}`,
}));

/* Иконка в заголовке страницы курса — фирменный стикер вместо юникод-
   эмодзи, там где он заведён (course.emoji остаётся запасным вариантом
   для остальных курсов, как раньше). */
const COURSE_HEADING_ICON_MAP = {
  'gateway/gateway-to-the-world-b1': 'gateway-door.png',
  'gateway/gateway-to-the-world-b2': 'gateway-door.png',
  as2: 'academy-stars.png',
  as3: 'academy-stars.png',
  as4: 'academy-stars.png',
  as5: 'academy-stars.png',
  'ege-2027': 'ege.png',
  'empower-b1': 'empower.png',
  'gateway/gw-b2': 'gw-b2.png',
  'expert-advanced': 'expert-advanced.png',
  'oxford-phonics/1': 'oxford-phonics.png',
  'oxford-phonics/2': 'oxford-phonics.png',
  'oxford-phonics/3': 'oxford-phonics.png',
  'oxford-phonics/4': 'oxford-phonics.png',
  'oxford-phonics/5': 'oxford-phonics.png',
  'placement-tests': 'placement-tests.png',
  'a2-key-for-schools': 'a2-key.png',
};

/* --- страница курса: только опубликованное --- */
for (const course of courses) {
  const list = materials.filter((m) => m['course-id'] === course.id && m.status === 'published');
  const dir = path.join(OUT, course.id);
  fs.mkdirSync(dir, { recursive: true });
  const hasGroups = list.some((m) => m.group);
  const headingIconPath = COURSE_HEADING_ICON_MAP[course.id]
    ? `/assets/brand/course/${COURSE_HEADING_ICON_MAP[course.id]}` : '';
  fs.writeFileSync(path.join(dir, 'index.html'), page({
    title: `${course.name} — материалы`,
    heading: headingIconPath ? course.name : `${course.emoji ? course.emoji + ' ' : ''}${course.name}`,
    headingIcon: headingIconPath,
    headingIconSmall: true,
    sub: `${list.length} ${list.length === 1 ? 'материал' : list.length < 5 ? 'материала' : 'материалов'}`,
    body: list.length
      ? `${courseLinkRow(course)}${personalFoldersBlock(course)}${hasGroups ? groupFolderNav(list) : ''}${sortToolbar(hasGroups)}<div class="course-block"${hasGroups ? ' id="groupMaterials" hidden' : ''}>\n${list.map(card).join('\n')}\n</div>`
      : `${courseLinkRow(course)}${personalFoldersBlock(course)}  <p class="empty">Пока пусто.</p>`,
    extraScript: copyScript + (hasGroups ? groupFolderScript : '') + (list.length ? sortScript('.course-block', '.card') : ''),
  }));
}

/* --- учительский индекс: всё, с фильтрами и копированием ссылок --- */
const staffCard = (m) => {
  const repo = config.repoUrl
    ? `<a href="${esc(config.repoUrl)}/blob/main/${esc(m.dir)}/index.html" target="_blank" rel="noopener">исходник</a>`
    : '';
  return `  <div class="staff-card${m.status === 'draft' ? ' is-draft' : ''}"
       data-search="${esc((m.title + ' ' + m.course + ' ' + (m.tags || '') + ' unit ' + m.unit).toLowerCase())}"
       data-course="${esc(m['course-id'])}" data-type="${esc(m.type)}" data-status="${esc(m.status)}" data-group="${esc(m.group || '')}"
       data-date="${esc(m.date)}" data-title="${esc(m.title)}" data-unit="${esc(m.unit)}">
    <div class="row">
      <span class="name">${m.emoji ? esc(m.emoji) + ' ' : ''}${esc(m.title)}</span>
      <span class="pill ${esc(m.type)}">${esc(m.type)}</span>
      ${m.status === 'draft' ? '<span class="pill draft">черновик</span>' : ''}
    </div>
    <div class="meta">
      <span>${esc(m.course)}</span><span>Unit ${esc(m.unit)}</span><span>${esc(m.date)}</span>
      <span>${m.backend ? 'сабмиты → ' + esc(m.backend) : 'без отправки'}</span>
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

/* familyOrder / familyCourses / standaloneCourses уже посчитаны выше,
   для плиток на лендинге — переиспользуем их и здесь для кнопок-фильтров. */
const familyBtns = familyOrder.map(([fid, famName]) =>
  `<button type="button" class="filter-btn" data-filter="family:${esc(fid)}" data-has-sub="${esc(fid)}">${esc(famName)}</button>`);

const familyMapJson = JSON.stringify(
  Object.fromEntries(familyOrder.map(([fid]) => [fid, familyCourses.get(fid).map((c) => c.id)]))
);

/* третий уровень навигации в панели преподавателя — по подпапкам внутри
   курса (unit 9, module 3, 1.Путешествие…). Строится из тех же данных,
   что и вкладки на страницах курсов, отдельно ничего в site.config.json
   заводить не нужно. С сентября 2026 — те же плитки-папки с заходом
   внутрь/кнопкой «Назад», что и на публичной странице курса (см.
   groupFolderNav): плитка юнита прячет сетку юнитов и показывает
   материалы, плитка темы с навыками — открывает второй экран плиток
   навыков. Считаем ПО ВСЕМ материалам курса, включая черновики — в
   панели преподавателя это принципиально, в отличие от публичной
   страницы курса, где список уже отфильтрован на published. */
const courseGroupsMap = new Map(); // courseId -> [group, ...]
for (const c of courses) {
  const groups = [...new Set(
    materials.filter((m) => m['course-id'] === c.id && m.group).map((m) => m.group)
  )].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  if (groups.length) courseGroupsMap.set(c.id, groups);
}

const courseGroupRows = [...courseGroupsMap.keys()].map((courseId) => {
  const list = materials.filter((m) => m['course-id'] === courseId);
  const tree = groupTileTree(list);
  if (!tree) return '';
  const { groups, themes, countExact, countPrefix } = tree;
  /* «Без юнита» тут намеренно не выводим: в отличие от публичной
     страницы курса, где ungroupedCount мог бы означать реальные
     материалы без юнита, здесь courseGroupsMap уже гарантирует, что
     courseId вообще есть в списке только если у курса есть хотя бы
     один материал с группой — а сами материалы без группы просто
     останутся доступны через плитку курса без захода в юниты, если
     когда-нибудь у курса будут и те, и другие. */

  const topTiles = themes.map((t) => {
    const hasSkills = groups.some((g) => themeOf(g) === t && skillOf(g));
    const count = hasSkills ? countPrefix(t) : countExact(t);
    return groupTileHtml(
      ` data-group-tile="${esc(t)}" data-course-tile="${esc(courseId)}"${hasSkills ? ` data-has-skills="${esc(courseId + '::' + t)}"` : ''}`,
      '📁', t, count
    );
  });
  const groupGrid = `  <div class="tile-grid sub-tabs-group" data-group-for="${esc(courseId)}" hidden>
${topTiles.join('\n')}
  </div>`;

  const skillGrids = themes
    .filter((t) => groups.some((g) => themeOf(g) === t && skillOf(g)))
    .map((t) => {
      const skills = [...new Set(groups.filter((g) => themeOf(g) === t).map(skillOf).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
      const allTile = groupTileHtml(` data-group-tile="${esc(t)}" data-prefix="1" data-course-tile="${esc(courseId)}"`, '📂', 'Все', countPrefix(t));
      const skillTiles = skills.map((s) => {
        const full = `${t}/${s}`;
        return groupTileHtml(` data-group-tile="${esc(full)}" data-course-tile="${esc(courseId)}"`, '📁', s, countExact(full));
      }).join('\n');
      return `  <div class="tile-grid sub-tabs-skill" data-skill-for="${esc(courseId + '::' + t)}" hidden>
${allTile}
${skillTiles}
  </div>`;
    }).join('\n');

  return skillGrids ? `${groupGrid}\n${skillGrids}` : groupGrid;
}).join('\n');

const courseGroupIdsJson = JSON.stringify([...courseGroupsMap.keys()]);

/* ссылка курса → адрес его открытой страницы, для кнопки копирования,
   которая появляется в панели преподавателя, когда выбран конкретный курс */
const courseUrlMapJson = JSON.stringify(
  Object.fromEntries(courses.map((c) => [c.id, `${BASE}/${c.id}/`]))
);

const filterBtns = [
  '<button type="button" class="filter-btn" data-filter="all">Все</button>',
  ...familyBtns,
  ...standaloneCourses.map((c) => `<button type="button" class="filter-btn" data-filter="course:${esc(c.id)}">${esc(c.name)}</button>`),
].join('\n    ');

const staffScript = `<script>
(function(){
  var cards = Array.prototype.slice.call(document.querySelectorAll('.staff-card'));
  var search = document.getElementById('q');
  var count = document.getElementById('count');
  var active = 'none';
  var activeGroup = 'all';
  var activeGroupPrefix = false;
  var familyMap = ${familyMapJson};
  var courseUrlMap = ${courseUrlMapJson};
  var courseGroupIds = ${courseGroupIdsJson};
  var courseLinkBtn = document.getElementById('courseLinkBtn');
  var hint = document.getElementById('pickHint');
  var courseTilesWrap = document.getElementById('courseTilesWrap');
  var backBtn = document.getElementById('backToCourses');
  var searchToggleBtn = document.getElementById('searchToggleBtn');
  var sortToolbarEl = document.querySelector('.sort-toolbar');

  /* строка поиска свёрнута в иконку по умолчанию — разворачивается по
     клику и сворачивается обратно, если её очистить и убрать фокус,
     чтобы не занимала место на экране, когда ей не пользуются */
  if(searchToggleBtn){
    searchToggleBtn.addEventListener('click', function(){
      search.hidden = !search.hidden;
      if(!search.hidden) search.focus();
    });
    search.addEventListener('blur', function(){
      if(!search.value.trim()) search.hidden = true;
    });
  }

  /* Юниты/темы внутри курса — те же плитки-папки, что и на публичной
     странице курса (см. groupFolderNav): зайти в курс без юнитов сразу
     показывает материалы, а курс с юнитами сначала показывает только
     сетку плиток юнитов, пока не выбрать одну из них — courseNavLevel
     отслеживает это, чтобы кнопка «← Назад» знала, на сколько уровней
     подняться (материалы → навыки → юниты → все курсы). */
  var courseNavCourseId = null;
  var courseNavLevel = 'top'; // 'top' | 'group' | 'skill' | 'materials'
  var courseNavTheme = null;  // ключ "courseId::тема" — откуда пришли на материалы, если из навыков
  var courseNavFamily = null; // fid семьи, если в этот курс зашли через её ряд уровней (иначе null)

  function apply(){
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    var topNoPick = active === 'none' && !q;
    /* выбрана целая семья (например Oxford Phonics), но конкретный
       уровень ещё не выбран — показываем только плитки уровней, без
       материалов, точно как на публичном хабе /oxford-phonics/ (там
       тоже нет варианта «показать все уровни разом», нужно выбрать
       один уровень) */
    var familyGated = active.indexOf('family:') === 0 && !q;
    /* курс с юнитами: пока юнит не выбран (activeGroup === 'none'),
       список пуст — вместо «стены» из всех материалов курса сразу
       после входа, точно как на публичной странице курса */
    var courseGated = active.indexOf('course:') === 0 && courseGroupIds.indexOf(active.slice(7)) !== -1 && activeGroup === 'none' && !q;
    var noPickYet = topNoPick || familyGated || courseGated;
    cards.forEach(function(c){
      var okFilter = noPickYet ? false : active === 'all' || active === 'none' ||
        (active.indexOf('course:') === 0 && c.dataset.course === active.slice(7)) ||
        (active.indexOf('family:') === 0 && (familyMap[active.slice(7)] || []).indexOf(c.dataset.course) !== -1) ||
        (active.indexOf('type:')   === 0 && c.dataset.type   === active.slice(5)) ||
        (active.indexOf('status:') === 0 && c.dataset.status === active.slice(7));
      var okGroup = activeGroup === 'all' ||
        (activeGroupPrefix ? (c.dataset.group === activeGroup || c.dataset.group.indexOf(activeGroup + '/') === 0) : c.dataset.group === activeGroup);
      var okSearch = !q || c.dataset.search.indexOf(q) !== -1;
      var show = okFilter && okGroup && okSearch;
      c.style.display = show ? '' : 'none';
      if(show) shown++;
    });
    if(hint) hint.hidden = !topNoPick;
    count.hidden = noPickYet;
    count.textContent = 'Показано: ' + shown + ' из ' + cards.length;
    if(sortToolbarEl) sortToolbarEl.hidden = noPickYet;
  }

  function showSubTabsFor(famId){
    document.querySelectorAll('.sub-tabs:not(.sub-tabs-group):not(.sub-tabs-skill)').forEach(function(row){
      row.hidden = row.dataset.subFor !== famId;
    });
  }

  function showSkillTabsFor(key){
    document.querySelectorAll('.sub-tabs-skill').forEach(function(row){
      row.hidden = row.dataset.skillFor !== key;
    });
  }

  /* Заходим в курс (или сбрасываем эту вложенность, если courseId === null —
     например, когда сверху выбрана целая семья без конкретного курса).
     Показывает верхнюю сетку плиток-юнитов курса и прячет всё глубже.
     Если courseId задан — значит, зашли в конкретный курс внутри семьи
     (например World 3 внутри Oxford Phonics), и ряд уровней семьи
     («Все уровни», World 1/2/3…) больше не нужен: внутри курса должны
     быть видны только его собственные юниты/папки и строка поиска, без
     набора всех остальных уровней семьи рядом. Когда courseId === null,
     наоборот, ничего не трогаем — этот ряд уровней в этот момент как
     раз показывает вызывающий код (клик по плитке семьи). */
  function showGroupTabsFor(courseId){
    courseNavCourseId = courseId;
    courseNavLevel = 'group';
    courseNavTheme = null;
    showSkillTabsFor(null);
    if(courseId){ showSubTabsFor(null); }
    document.querySelectorAll('.sub-tabs-group').forEach(function(row){
      row.hidden = row.dataset.groupFor !== courseId;
    });
    activeGroup = (courseId && courseGroupIds.indexOf(courseId) !== -1) ? 'none' : 'all';
    activeGroupPrefix = false;
    if(courseId && courseUrlMap[courseId]){
      courseLinkBtn.dataset.copy = courseUrlMap[courseId];
      courseLinkBtn.hidden = false;
    } else {
      courseLinkBtn.hidden = true;
    }
  }

  /* Заходим во второй экран — плитки навыков внутри темы (только для
     курсов с вложенностью Тема/Навык, например ЕГЭ). key — это
     "courseId::тема", как в data-has-skills/data-skill-for. */
  function showSkillLevelFor(key){
    courseNavLevel = 'skill';
    courseNavTheme = key;
    document.querySelectorAll('.sub-tabs-group').forEach(function(row){ row.hidden = true; });
    showSkillTabsFor(key);
    activeGroup = 'none';
    activeGroupPrefix = false;
  }

  /* Плитка-лист (юнит, «Все» темы или конкретный навык) — прячем все
     сетки плиток этого курса и показываем отфильтрованные материалы. */
  function showMaterialsFor(group, prefix, fromSkillKey){
    courseNavLevel = 'materials';
    courseNavTheme = fromSkillKey || null;
    document.querySelectorAll('.sub-tabs-group').forEach(function(row){ row.hidden = true; });
    document.querySelectorAll('.sub-tabs-skill').forEach(function(row){ row.hidden = true; });
    activeGroup = group;
    activeGroupPrefix = prefix;
  }

  /* iOS-свайп вправо (и обычная кнопка «Назад» браузера) должны листать
     экраны панели так же, как кнопка «← Назад» на странице курса у
     ученика: каждый переход на экран глубже кладёт в историю браузера
     запись-снимок текущего состояния (pushStaffNav), а возврат — свайпом,
     жестом или через сам браузер — вызывает popstate и восстанавливает
     ровно предыдущий снимок (applyStaffState). Видимая кнопка «← Назад»
     теперь тоже просто вызывает history.back() — и жест, и кнопка идут
     через один и тот же код, так что их поведение не может разойтись. */
  function pushStaffNav(){
    history.pushState({
      active: active, activeGroup: activeGroup, activeGroupPrefix: activeGroupPrefix,
      courseNavCourseId: courseNavCourseId, courseNavLevel: courseNavLevel,
      courseNavTheme: courseNavTheme, courseNavFamily: courseNavFamily
    }, '');
  }
  function resetToTop(){
    active = 'none';
    activeGroup = 'all';
    activeGroupPrefix = false;
    courseNavCourseId = null;
    courseNavLevel = 'top';
    courseNavTheme = null;
    courseNavFamily = null;
    search.value = '';
    document.querySelectorAll('.toolbar > .filter-btn').forEach(function(x){ x.classList.remove('on'); });
    showSubTabsFor(null);
    document.querySelectorAll('.sub-tabs-group').forEach(function(row){ row.hidden = true; });
    showSkillTabsFor(null);
    courseTilesWrap.hidden = false;
    backBtn.hidden = true;
    courseLinkBtn.hidden = true;
    apply();
  }
  function applyStaffState(s){
    active = s.active; activeGroup = s.activeGroup; activeGroupPrefix = s.activeGroupPrefix;
    courseNavCourseId = s.courseNavCourseId; courseNavLevel = s.courseNavLevel;
    courseNavTheme = s.courseNavTheme; courseNavFamily = s.courseNavFamily;

    var famForButton = courseNavFamily || (active.indexOf('family:') === 0 ? active.slice(7) : null);
    document.querySelectorAll('.toolbar > .filter-btn').forEach(function(x){
      x.classList.toggle('on', famForButton ? x.dataset.filter === 'family:' + famForButton : x.dataset.filter === active);
    });
    /* Внутри конкретного курса (courseNavCourseId задан) строка
       уровней семьи не нужна — см. тот же принцип в showGroupTabsFor
       выше (комментарий «без набора всех остальных уровней семьи
       рядом»). Раньше applyStaffState всегда звал
       showSubTabsFor(famForButton), даже уже внутри курса — из-за
       этого при возврате назад (кнопка «← Назад», iOS-свайп,
       браузерная история) плитки уровней семьи (2/3/4/5 и т.п.)
       оставались видны рядом с папками курса, хотя при обычном
       клике внутрь курса они корректно прячутся. */
    showSubTabsFor(courseNavCourseId ? null : famForButton);
    document.querySelectorAll('.sub-tabs-group').forEach(function(row){
      row.hidden = row.dataset.groupFor !== courseNavCourseId;
    });
    showSkillTabsFor(courseNavLevel === 'skill' ? courseNavTheme : null);

    courseTilesWrap.hidden = active !== 'none';
    backBtn.hidden = active === 'none';
    if(courseNavCourseId && courseNavLevel !== 'top' && courseUrlMap[courseNavCourseId]){
      courseLinkBtn.dataset.copy = courseUrlMap[courseNavCourseId];
      courseLinkBtn.hidden = false;
    } else {
      courseLinkBtn.hidden = true;
    }
    apply();
  }
  window.addEventListener('popstate', function(e){
    if(e.state) applyStaffState(e.state);
    else resetToTop();
  });

  document.querySelectorAll('.toolbar .filter-btn').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.toolbar .filter-btn').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      active = b.dataset.filter;
      courseNavFamily = null;
      if(b.dataset.hasSub){
        /* плитка целой семьи (например Oxford Phonics) — показываем
           только сетку уровней-плиток, без варианта «Все уровни»:
           материалы остаются скрыты, пока не выбрать конкретный
           уровень (см. familyGated в apply()) */
        showSubTabsFor(b.dataset.hasSub);
        showGroupTabsFor(null);
      } else {
        showSubTabsFor(null);
        showGroupTabsFor(active.indexOf('course:') === 0 ? active.slice(7) : null);
      }
      apply();
      pushStaffNav();
    });
  });

  /* Клик по плитке юнита/темы/навыка внутри курса — заходит внутрь ровно
     по той же логике, что и плитки курсов/семей выше: либо открывает
     следующий экран плиток (навыки), либо показывает отфильтрованные
     материалы. Один обработчик на все такие плитки — group-плитки и
     skill-плитки устроены одинаково, отличает их только data-has-skills. */
  document.querySelectorAll('.tile[data-group-tile]').forEach(function(t){
    t.addEventListener('click', function(){
      if(t.dataset.hasSkills){
        showSkillLevelFor(t.dataset.hasSkills);
      } else {
        var skillGrid = t.closest('.sub-tabs-skill');
        showMaterialsFor(t.dataset.groupTile, t.dataset.prefix === '1', skillGrid ? skillGrid.dataset.skillFor : null);
      }
      apply();
      pushStaffNav();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  search.addEventListener('input', apply);

  document.querySelectorAll('.tile[data-tile-course]').forEach(function(t){
    t.addEventListener('click', function(){
      var courseId = t.dataset.tileCourse;
      /* два случая: (1) плитка отдельного (не входящего в семью) курса
         прямо на домашнем экране — для неё в скрытом тулбаре есть
         готовая кнопка-фильтр, проще всего «нажать» на неё (её обработчик
         сам вызовет pushStaffNav); (2) плитка уровня ВНУТРИ семьи
         (например World 3 внутри Oxford Phonics, см. subTabRows) —
         отдельной кнопки для конкретного уровня в тулбаре нет и не нужно,
         выставляем active сами и кладём свою запись в историю. */
      var topBtn = document.querySelector('.toolbar > .filter-btn[data-filter="course:' + courseId + '"]');
      if(topBtn){
        topBtn.click();
      } else {
        var famId = null;
        Object.keys(familyMap).forEach(function(fid){ if(familyMap[fid].indexOf(courseId) !== -1) famId = fid; });
        document.querySelectorAll('.toolbar > .filter-btn').forEach(function(x){ x.classList.remove('on'); });
        if(famId){
          var famBtn = document.querySelector('.toolbar > .filter-btn[data-filter="family:' + famId + '"]');
          if(famBtn) famBtn.classList.add('on');
          showSubTabsFor(famId);
        }
        active = 'course:' + courseId;
        courseNavFamily = famId;
        showGroupTabsFor(courseId);
        apply();
        pushStaffNav();
      }
      /* «заходим внутрь» курса — плитки всех курсов прячем, показываем
         только материалы этого курса (и его юниты-плитки, если есть) */
      courseTilesWrap.hidden = true;
      backBtn.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.tile[data-tile-family]').forEach(function(t){
    t.addEventListener('click', function(){
      /* плитка схлопнутой семьи (например Oxford Phonics) — не выбирает
         курс сама, а открывает ряд уровней внутри (тоже плитками);
         выбор конкретного уровня — обычный клик по .tile[data-tile-course]
         чуть выше по коду, ничего дополнительно писать не нужно. Клик
         «нажимает» настоящую кнопку семьи в тулбаре — та сама положит
         запись в историю через pushStaffNav. */
      var famId = t.dataset.tileFamily;
      var famBtn = document.querySelector('.toolbar > .filter-btn[data-filter="family:' + famId + '"]');
      if(famBtn) famBtn.click();
      courseTilesWrap.hidden = true;
      backBtn.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  /* «← Назад» просто листает историю браузера на один шаг — экран,
     который при этом покажется, восстановит popstate (applyStaffState),
     так что кнопка и iOS-свайп вправо ведут себя абсолютно одинаково. */
  backBtn.addEventListener('click', function(){
    history.back();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  apply();
})();
</script>`;

/* плитки курсов в шапке панели преподавателя — быстрый переход к курсу,
   кликом «нажимают» те же скрытые кнопки-фильтры тулбара (см. staffScript
   выше). Показывают счётчик по ВСЕМ материалам курса, включая черновики —
   в отличие от плиток на лендинге, где считаются только published. */
const staffTileFor = (course, label, overrideCount) => {
  const count = overrideCount != null ? overrideCount : materials.filter((m) => m['course-id'] === course.id).length;
  return `      <a class="tile" href="javascript:void(0)" data-tile-course="${esc(course.id)}">
        ${tileIconFor(course)}
        <span class="tile-name">${esc(label)}</span>
        <span class="tile-count">${count} ${wordForm(count, 'материал', 'материала', 'материалов')}</span>
      </a>`;
};

/* Ряд уровней внутри схлопнутой семьи (Oxford Phonics) в панели
   преподавателя — плитки, а не кнопки-пилюли (см. staffTileFor выше,
   те же самые), и без варианта «Все уровни»: как и на публичном хабе
   /oxford-phonics/, нужно выбрать конкретный уровень, ничего не
   показывается заранее. Клик по такой плитке ловит уже существующий
   обработчик `.tile[data-tile-course]` в staffScript — отдельный
   JS-обработчик здесь не нужен. */
const subTabRows = familyOrder.map(([fid, famName]) => {
  const levelTiles = familyCourses.get(fid).map((c) => {
    const label = c.name.replace(famName, '').trim() || c.name;
    return staffTileFor(c, label);
  }).join('\n');
  return `  <div class="tile-grid sub-tabs" data-sub-for="${esc(fid)}" hidden>
${levelTiles}
  </div>`;
}).join('\n');
/* плитка схлопнутой семьи в панели преподавателя — ведёт не на конкретный
   курс, а «внутрь» семьи: клик открывает её ряд уровней (тоже плитками,
   см. .sub-tabs в catalog.css), точно как «зайти в папку phonics и увидеть
   плитки уровней внутри». Обрабатывается отдельным JS-обработчиком
   data-tile-family (см. staffScript). */
const staffFamilyTileFor = (fid, famName, repCourse, total) => `      <a class="tile" href="javascript:void(0)" data-tile-family="${esc(fid)}">
        ${tileIconFor(repCourse)}
        <span class="tile-name">${esc(famName)}</span>
        <span class="tile-count">${total} ${wordForm(total, 'материал', 'материала', 'материалов')}</span>
      </a>`;
const staffTileFamilyBlocks = familyOrder.map(([fid, famName]) => {
  const fam = familyCourses.get(fid);
  const emoji = fam.find((c) => c.emoji)?.emoji || '';
  const countAll = (c) => materials.filter((m) => m['course-id'] === c.id).length;
  const tiles = COLLAPSED_FAMILIES.includes(famName)
    ? staffFamilyTileFor(fid, famName, fam.reduce((a, b) => (countAll(b) > countAll(a) ? b : a)),
        fam.reduce((sum, c) => sum + countAll(c), 0))
    : fam.map((c) => staffTileFor(c, c.name.replace(famName, '').trim() || c.name)).join('\n');
  return `  <div class="tile-family">
    <h2>${familyIconFor(famName, emoji)}${esc(famName)}</h2>
    <div class="tile-grid">
${tiles}
    </div>
  </div>`;
}).join('\n');
const staffTileStandaloneBlock = standaloneCourses.length
  ? `  <div class="tile-family">
    <div class="tile-grid">
${standaloneCourses.map((c) => staffTileFor(c, c.name)).join('\n')}
    </div>
  </div>`
  : '';

const staffDir = path.join(OUT, staffPath);
fs.mkdirSync(staffDir, { recursive: true });
fs.writeFileSync(path.join(staffDir, 'index.html'), page({
  title: 'ANGLE Teacher',
  heading: 'ANGLE Teacher',
  headingIcon: '/assets/brand/heading-teacher.png',
  sub: '',
  body: `  <div class="search-toggle toolbar">
    <button type="button" class="link-copy" id="searchToggleBtn" aria-label="Поиск">🔍</button>
    <input type="search" id="q" placeholder="Поиск по названию, теме, юниту…" hidden>
  </div>
  <div id="courseTilesWrap">
${staffTileFamilyBlocks}
${staffTileStandaloneBlock}
  </div>
  <button type="button" class="link-copy" id="backToCourses" hidden>← Все курсы</button>
  <div hidden>
    <div class="toolbar">
      ${filterBtns}
    </div>
  </div>
${subTabRows}
${courseGroupRows}
  <p class="empty" id="pickHint"></p>
  <p class="count" id="count"></p>
  <button type="button" class="link-copy" id="courseLinkBtn" data-copy="" hidden>🔗 Скопировать ссылку на страницу курса</button>
${sortToolbar(true)}
  <div class="staff-list" id="staffList">
${materials.map(staffCard).join('\n')}
  </div>`,
  extraScript: copyScript + staffScript + sortScript('#staffList', '.staff-card'),
}));

/* --- машиночитаемый каталог для агентов --- */
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify({
  generated: 'при сборке; поле намеренно без даты, чтобы сборки были воспроизводимыми',
  staffPath: `${BASE}/${staffPath}/`,
  courses,
  materials: materials.map(({ courseCfg, bytes, ...m }) => m),
}, null, 2));

/* ---------- иконки и превью ссылок во все страницы ---------- */

injectHead(OUT);

/* ---------- итог ---------- */

console.log(`Собрано в _site/`);
for (const c of courses) {
  const list = materials.filter((m) => m['course-id'] === c.id);
  const drafts = list.filter((m) => m.status === 'draft').length;
  console.log(`  /${c.id}/  ${c.name}: ${list.length}${drafts ? ` (черновиков: ${drafts})` : ''}`);
}
console.log(`  /${staffPath}/  панель преподавателя: ${materials.length}`);
