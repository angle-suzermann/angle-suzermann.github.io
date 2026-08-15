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

/* Фирменный бейдж ANGLE — трассированный вордмарк, fill наследует цвет
   через currentColor. Взят как есть из скилла angle-sticky-badge,
   руками не редактировать. */
const ANGLE_WORDMARK = `<svg class="wordmark" viewBox="0 0 2190 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ANGLE">
  <g transform="translate(0.000000,640.000000) scale(0.100000,-0.100000)" fill="currentColor">
    <path d="M4253 6000 c-18 -4 -49 -20 -69 -36 -39 -30 -101 -79 -230 -179 -43 -33 -94 -73 -115 -90 -41 -33 -162 -127 -243 -190 -96 -73 -200 -154 -267 -208 -68 -54 -406 -318 -508 -397 -32 -25 -96 -74 -141 -110 -46 -36 -106 -83 -135 -105 -50 -38 -81 -62 -225 -176 -36 -28 -96 -75 -135 -105 -38 -30 -101 -79 -140 -109 -38 -30 -101 -79 -140 -109 -38 -30 -99 -77 -135 -106 -128 -101 -148 -116 -221 -172 -41 -31 -103 -80 -139 -108 -36 -28 -96 -75 -135 -105 -38 -30 -99 -77 -135 -106 -36 -28 -89 -70 -119 -92 -188 -146 -276 -215 -391 -307 -41 -33 -100 -78 -131 -99 -57 -40 -119 -104 -119 -122 0 -42 21 -51 190 -79 36 -6 110 -24 165 -39 55 -16 164 -41 241 -56 165 -31 177 -29 290 61 34 27 92 73 130 102 69 53 110 84 239 186 101 80 111 80 364 18 113 -28 246 -58 294 -67 48 -9 113 -25 144 -36 30 -10 128 -32 217 -49 88 -17 204 -43 256 -59 52 -16 165 -42 250 -59 85 -17 200 -43 255 -57 55 -14 120 -30 145 -35 83 -19 104 -67 75 -165 -8 -27 -23 -92 -31 -145 -9 -52 -25 -121 -35 -153 -25 -79 -11 -117 52 -140 89 -32 218 -66 356 -93 192 -38 210 -29 238 122 9 43 26 112 39 154 13 41 31 118 40 170 9 52 37 173 61 269 25 96 45 184 45 196 0 12 13 69 30 126 16 57 45 183 64 279 20 96 45 204 56 240 11 35 32 127 46 205 15 77 37 174 49 215 13 41 35 136 49 211 15 75 39 183 56 240 16 57 34 136 40 174 7 39 29 140 51 225 21 85 50 209 63 275 14 66 32 139 40 163 9 24 25 91 36 150 11 59 28 137 36 173 32 134 0 165 -211 203 -77 14 -176 37 -220 50 -71 22 -182 46 -270 59 -16 2 -45 1 -62 -3z m-65 -974 c2 -15 -10 -70 -27 -124 -16 -53 -44 -168 -61 -255 -17 -87 -40 -186 -50 -220 -11 -34 -29 -111 -41 -172 -11 -60 -38 -177 -59 -260 -22 -82 -46 -189 -54 -237 -18 -108 -50 -213 -76 -256 -32 -52 -57 -58 -147 -34 -43 11 -123 28 -178 38 -55 9 -145 29 -200 45 -55 15 -143 35 -195 44 -52 9 -153 31 -225 50 -127 33 -202 48 -298 60 -124 16 -110 95 32 196 63 44 120 88 201 154 58 48 132 105 250 195 40 30 118 91 174 135 168 133 226 178 276 215 26 19 84 64 129 100 45 36 95 75 111 86 44 33 147 114 199 159 159 135 230 159 239 81z M5488 5700 c-39 -30 -54 -72 -82 -230 -15 -80 -40 -194 -57 -253 -17 -60 -34 -134 -39 -165 -8 -51 -61 -280 -135 -582 -14 -58 -43 -189 -64 -291 -22 -103 -49 -216 -60 -253 -11 -36 -34 -141 -51 -232 -17 -91 -40 -191 -51 -222 -11 -31 -29 -106 -41 -167 -11 -60 -33 -162 -50 -225 -16 -63 -40 -167 -53 -231 -13 -64 -35 -156 -49 -205 -13 -49 -39 -161 -56 -248 -17 -88 -40 -185 -52 -215 -69 -190 -35 -234 216 -276 50 -9 137 -29 194 -46 170 -51 195 -30 243 204 16 79 35 163 44 186 8 23 28 113 45 199 17 86 44 204 59 262 16 58 42 170 57 250 15 80 37 175 50 212 12 36 27 99 33 140 6 40 31 154 56 253 24 99 49 209 55 245 7 36 23 103 36 150 14 47 38 153 55 235 16 83 38 179 48 215 11 36 25 94 31 130 16 90 33 120 70 120 34 0 56 -27 90 -115 13 -33 45 -103 71 -155 26 -52 86 -174 134 -270 47 -96 95 -191 106 -210 11 -19 33 -64 49 -100 17 -36 39 -81 51 -100 11 -19 32 -60 45 -90 50 -109 125 -266 144 -302 47 -89 69 -133 258 -518 110 -223 308 -623 440 -890 132 -267 252 -510 265 -541 43 -97 90 -122 317 -163 78 -15 195 -42 259 -60 190 -56 266 -59 296 -12 8 12 26 80 40 151 13 70 33 156 44 189 11 34 36 140 56 237 19 96 41 195 50 218 8 23 22 82 30 129 14 79 58 266 146 627 17 72 46 203 65 293 18 90 42 193 53 230 12 37 34 139 51 227 16 88 39 187 50 220 12 33 30 107 41 165 10 58 33 159 50 225 16 66 43 184 60 262 16 79 34 154 39 168 5 14 23 86 40 161 46 207 34 234 -116 260 -49 8 -147 31 -219 51 -273 75 -273 76 -350 -340 -9 -49 -27 -125 -41 -169 -13 -44 -33 -131 -44 -192 -30 -163 -39 -203 -65 -286 -14 -41 -31 -118 -40 -170 -9 -52 -34 -162 -55 -245 -21 -82 -41 -170 -45 -195 -4 -25 -24 -112 -45 -195 -21 -82 -51 -210 -65 -284 -14 -74 -32 -149 -40 -167 -7 -18 -30 -117 -50 -220 -46 -238 -68 -309 -101 -330 -33 -22 -69 -6 -88 38 -55 126 -316 674 -357 748 -46 84 -340 681 -359 731 -12 29 -35 76 -51 103 -17 26 -39 71 -50 100 -11 28 -34 73 -50 100 -17 26 -39 71 -50 100 -11 28 -34 73 -50 100 -17 26 -38 69 -49 95 -10 25 -36 77 -59 116 -23 38 -41 74 -41 79 0 5 -23 57 -51 115 -71 145 -295 598 -319 641 -10 19 -48 96 -85 170 -94 188 -81 178 -277 215 -73 13 -160 34 -193 45 -33 11 -96 27 -140 35 -44 7 -93 19 -108 24 -46 18 -111 13 -139 -9z M11020 4450 c-189 -30 -353 -70 -430 -104 -41 -19 -93 -39 -115 -46 -117 -36 -405 -219 -550 -350 -233 -210 -442 -499 -526 -728 -17 -48 -42 -108 -55 -133 -22 -45 -83 -327 -102 -479 -31 -234 26 -703 107 -888 16 -37 40 -94 52 -127 81 -217 315 -548 503 -710 142 -123 334 -256 412 -287 24 -10 62 -29 85 -43 22 -15 86 -42 142 -62 56 -19 113 -41 127 -48 83 -42 468 -95 660 -91 165 4 425 44 530 80 98 35 229 93 270 120 20 13 58 35 85 49 28 14 84 52 125 86 95 76 123 88 151 60 24 -24 21 -60 -17 -204 -13 -49 -36 -135 -50 -189 -49 -185 -31 -201 285 -255 115 -20 175 -46 186 -81 5 -15 15 -20 43 -20 62 1 118 109 158 310 18 85 46 208 63 272 16 64 37 159 46 210 9 51 27 127 40 168 13 42 33 130 45 195 11 66 34 167 50 225 16 58 45 182 64 276 19 94 41 187 50 208 57 137 3 179 -299 236 -88 16 -187 39 -220 50 -33 11 -112 30 -175 41 -63 12 -164 34 -225 50 -60 16 -164 40 -230 53 -66 14 -183 41 -260 62 -288 78 -302 71 -345 -167 -11 -64 -34 -156 -50 -205 -65 -192 -39 -219 275 -279 355 -68 379 -103 207 -305 -233 -276 -562 -418 -912 -394 -143 9 -438 86 -516 134 -19 12 -61 35 -94 51 -168 81 -437 345 -520 509 -13 24 -33 61 -46 80 -43 65 -121 297 -139 415 -44 277 16 642 139 845 19 30 43 73 54 95 70 139 331 399 472 470 19 10 54 31 77 46 49 34 268 114 368 135 198 41 537 23 674 -35 37 -16 94 -36 126 -46 124 -36 349 -189 481 -326 68 -72 156 -184 203 -262 43 -70 83 -78 226 -48 50 10 161 27 249 36 135 15 162 21 184 40 40 35 35 87 -17 173 -22 37 -41 73 -41 79 0 38 -210 322 -330 446 -178 186 -494 402 -665 457 -22 7 -74 28 -116 46 -226 99 -692 149 -969 104z M21320 3909 c-74 -4 -840 -7 -1701 -8 -1527 -1 -1567 -1 -1590 -20 -24 -19 -24 -19 -29 -1863 -5 -1800 -5 -1845 14 -1931 20 -87 20 -87 1786 -87 1765 0 1765 0 1778 65 16 84 16 519 1 565 -23 64 61 61 -1459 60 -865 -1 -1386 3 -1397 9 -48 25 -55 44 -63 188 -15 238 -16 665 -2 690 31 57 -46 54 1428 54 1472 -1 1402 -3 1440 54 15 24 17 56 17 293 0 266 0 266 -27 289 -15 13 -37 23 -49 23 -12 0 -636 2 -1387 3 -1307 2 -1366 3 -1392 20 -40 27 -39 23 -40 456 0 431 0 428 55 461 31 19 63 20 1420 20 1527 0 1433 -4 1456 61 15 44 15 519 0 553 -21 46 -70 54 -259 45z M14548 3809 c-27 -15 -35 -37 -58 -150 -12 -57 -30 -135 -42 -174 -11 -38 -33 -131 -49 -205 -16 -74 -40 -178 -54 -230 -14 -52 -34 -142 -46 -200 -11 -58 -31 -139 -44 -180 -12 -41 -37 -148 -55 -238 -17 -90 -40 -189 -51 -220 -11 -31 -29 -104 -40 -162 -10 -58 -30 -148 -44 -200 -14 -52 -34 -138 -46 -190 -12 -52 -41 -174 -64 -270 -24 -96 -50 -214 -59 -261 -9 -47 -25 -112 -36 -143 -11 -32 -35 -135 -54 -229 -19 -95 -42 -192 -51 -217 -9 -25 -27 -99 -40 -165 -13 -66 -31 -151 -39 -190 -9 -38 -16 -96 -16 -128 0 -57 0 -57 1947 -55 1946 3 1946 3 1965 68 20 74 27 515 8 565 -22 58 52 56 -1533 55 -799 0 -1462 0 -1474 0 -68 1 -79 72 -34 219 16 53 43 166 60 251 17 86 39 181 50 213 11 32 32 118 46 192 14 73 39 180 55 237 17 57 37 142 45 190 9 48 24 116 35 150 23 78 53 206 74 319 9 47 25 112 36 143 10 31 35 138 55 237 19 99 44 202 55 228 10 27 28 100 40 162 29 154 55 260 81 333 25 71 21 108 -15 131 -30 20 -206 70 -277 80 -30 4 -96 16 -148 26 -103 21 -157 23 -183 8z"/>
  </g>
</svg>`;

const ANGLE_BADGE = `<div class="angle-badge">${ANGLE_WORDMARK}<div class="credit">by ${esc(config.author || '')}</div></div>`;

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
<div class="bg-photo"></div>
<div class="bg-wash"></div>
${ANGLE_BADGE}
<header class="cat-header">
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

/* Курсы с одинаковым config.courses[].family сворачиваются в одну кнопку
   с подвкладками-уровнями (см. site.config.json, поле "family"). Курсы без
   family остаются обычными отдельными кнопками. */
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

const familyBtns = familyOrder.map(([fid, famName]) =>
  `<button type="button" class="filter-btn" data-filter="family:${esc(fid)}" data-has-sub="${esc(fid)}">${esc(famName)}</button>`);

const subTabRows = familyOrder.map(([fid, famName]) => {
  const levelBtns = familyCourses.get(fid).map((c) => {
    const label = esc(c.name.replace(famName, '').trim() || c.name);
    return `<button type="button" class="filter-btn sub" data-filter="course:${esc(c.id)}">${label}</button>`;
  }).join('\n      ');
  return `  <div class="sub-tabs" data-sub-for="${esc(fid)}" hidden>
      <button type="button" class="filter-btn sub on" data-filter="family:${esc(fid)}">Все уровни</button>
      ${levelBtns}
    </div>`;
}).join('\n');

const familyMapJson = JSON.stringify(
  Object.fromEntries(familyOrder.map(([fid]) => [fid, familyCourses.get(fid).map((c) => c.id)]))
);

const filterBtns = [
  '<button type="button" class="filter-btn on" data-filter="all">Все</button>',
  ...familyBtns,
  ...standaloneCourses.map((c) => `<button type="button" class="filter-btn" data-filter="course:${esc(c.id)}">${esc(c.name)}</button>`),
  ...TYPES.filter((t) => t === 'test').map((t) => `<button type="button" class="filter-btn" data-filter="type:${t}">${t}</button>`),
].join('\n    ');

const staffScript = `<script>
(function(){
  var cards = Array.prototype.slice.call(document.querySelectorAll('.staff-card'));
  var search = document.getElementById('q');
  var count = document.getElementById('count');
  var active = 'all';
  var familyMap = ${familyMapJson};

  function apply(){
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function(c){
      var okFilter = active === 'all' ||
        (active.indexOf('course:') === 0 && c.dataset.course === active.slice(7)) ||
        (active.indexOf('family:') === 0 && (familyMap[active.slice(7)] || []).indexOf(c.dataset.course) !== -1) ||
        (active.indexOf('type:')   === 0 && c.dataset.type   === active.slice(5)) ||
        (active.indexOf('status:') === 0 && c.dataset.status === active.slice(7));
      var okSearch = !q || c.dataset.search.indexOf(q) !== -1;
      var show = okFilter && okSearch;
      c.style.display = show ? '' : 'none';
      if(show) shown++;
    });
    count.textContent = 'Показано: ' + shown + ' из ' + cards.length;
  }

  function showSubTabsFor(famId){
    document.querySelectorAll('.sub-tabs').forEach(function(row){
      row.hidden = row.dataset.subFor !== famId;
    });
  }

  document.querySelectorAll('.toolbar .filter-btn').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.toolbar .filter-btn').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      active = b.dataset.filter;
      if(b.dataset.hasSub){
        showSubTabsFor(b.dataset.hasSub);
        var row = document.querySelector('.sub-tabs[data-sub-for="' + b.dataset.hasSub + '"]');
        if(row){
          row.querySelectorAll('.filter-btn').forEach(function(x){ x.classList.remove('on'); });
          row.querySelector('.filter-btn').classList.add('on');
        }
      } else {
        showSubTabsFor(null);
      }
      apply();
    });
  });

  document.querySelectorAll('.sub-tabs .filter-btn').forEach(function(b){
    b.addEventListener('click', function(){
      var row = b.closest('.sub-tabs');
      row.querySelectorAll('.filter-btn').forEach(function(x){ x.classList.remove('on'); });
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
${subTabRows}
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
