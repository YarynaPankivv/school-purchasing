#!/usr/bin/env node
// Архітектурне правило «кожна Server Action сама перевіряє, хто викликає» (ADR 0003).
// Server Action — публічний POST-ендпойнт: її викликають напряму, оминувши сторінку, proxy і приховану кнопку.
// 1) Кожна експортована функція у файлі actions.ts / route.ts або в будь-якому файлі з директивою "use server" на
//    початку (declaration, `export const f = async () =>`,
//    `export default`), крім винятків нижче, у своєму тілі викликає requireActiveUser / requireAdmin / adminOr /
//    authorRequest / getClaims — і цей виклик іде ДО першого запису чи запиту до бази (.from, .rpc, .insert, .update,
//    .upsert, .delete) і fetch. Згадка в рядку чи коментарі не рахується.
//    Результат getClaims() має бути використано (присвоєно, повернуто чи перевірено): голий виклик нічого не охороняє.
// 2) У src/ немає getSession(): для авторизації на сервері — лише getClaims().
// 3) У src/ немає middleware.ts: у Next.js 16 це src/proxy.ts (лише оновлення сесії, не захист).
// Винятки (EXEMPT) — по іменах функцій і з причиною: дії, що створюють чи завершують сесію.
// Обмеження: аналіз текстовий, без AST; тіло функції — до наступного експорту файлу. Це найкраще зусилля, а не гарантія:
// остаточні перевірки прав — у базі (ADR 0003), правило ловить забуту перевірку в новій дії.
// Використання: node scripts/check-server-actions.mjs [--root <dir>]
// Код виходу: 0 — порушень немає, 1 — є порушення або каталог не вдалося прочитати, 2 — немає src/.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
const SRC = join(root, "src");

// Файл → { імʼя функції: причина }. Усе інше в цих файлах перевіряється.
const EXEMPT = new Map([
  [
    "src/app/login/actions.ts",
    { login: "вхід: сесії ще немає, пароль перевіряє signInWithPassword", signOut: "завершує власний сеанс, даних не змінює" },
  ],
]);
// adminOr — локальна обгортка над requireAdmin в actions.ts адміністрування.
const GUARD = /\b(?:requireActiveUser|requireAdmin|adminOr|authorRequest|getClaims)\s*\(/;
const WRITE = /\.(?:from|rpc|insert|update|upsert|delete)\s*\(|\bfetch\s*\(/;
// Директива файлу: перший оператор — "use server" (перед нею можуть бути лише коментарі).
const USE_SERVER = /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*["']use server["']/;
// Чи використано результат виклику getClaims(): присвоєння, return, умова чи заперечення перед викликом.
const CLAIMS_USED = /(?:=|\breturn\b|\bif\s*\(|!|&&|\|\||\?)\s*(?:\(\s*)?(?:await\s+)?[\w.]*$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

// Коментарі й рядкові літерали замінюємо пробілами (довжину зберігаємо, щоб номери рядків не зсунулись).
const blank = (s) => s.replace(/[^\n]/g, " ");
const stripNoise = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\\])\/\/.*$/gm, (m, p) => p + blank(m.slice(p.length)))
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, blank);

// Перший виклик перевірки в тілі, який справді щось охороняє: getClaims() — лише з використаним результатом.
function findGuard(body) {
  for (const m of body.matchAll(new RegExp(GUARD.source, "g"))) {
    if (!m[0].startsWith("getClaims") || CLAIMS_USED.test(body.slice(Math.max(0, m.index - 40), m.index))) return m.index;
  }
  return -1;
}

const problems = [];
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const report = (rel, line, message) => problems.push(`${rel}:${line}  ${message}`);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (error) {
    // Каталог, який не вдалося прочитати, — не «порушень немає»: перевірка була б неповною.
    report(relative(root, dir).split(sep).join("/") || ".", 1, `каталог не прочитано (${error.code ?? error.message}) — перевірка неповна`);
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

try {
  if (!statSync(SRC).isDirectory()) throw new Error("not a dir");
} catch {
  console.error(`check-server-actions: у ${root} немає src/ — вкажіть --root <корінь проєкту>.`);
  process.exit(2);
}

const EXPORT_FN =
  /^export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w*)|^export\s+const\s+(\w+)\s*(?::[^=\n]+)?=\s*(?:async\b|function\b|\([^)]*\)\s*(?::[^=\n]+)?=>)/gm;

for (const file of walk(SRC)) {
  const rel = relative(root, file).split(sep).join("/");
  const name = basename(file);
  if (name === "middleware.ts") report(rel, 1, "у Next.js 16 замість middleware.ts — src/proxy.ts");
  if (!/\.(tsx?|mjs)$/.test(name) || /\.test\./.test(name)) continue;
  const source = readFileSync(file, "utf8");
  const text = stripNoise(source);

  for (const m of text.matchAll(/\bgetSession\s*\(/g)) {
    report(rel, lineOf(text, m.index), "getSession() для авторизації заборонено — лише getClaims()");
  }

  if (!["actions.ts", "route.ts"].includes(name) && !USE_SERVER.test(source)) continue;
  const exempt = EXEMPT.get(rel) ?? {};

  // Експортовані функції: від експорту до наступного експорту (або кінця файлу).
  const starts = [...text.matchAll(EXPORT_FN)];
  starts.forEach((m, i) => {
    const fn = m[1] || m[2] || "default";
    if (Object.hasOwn(exempt, fn)) return;
    const body = text.slice(m.index, starts[i + 1]?.index ?? text.length);
    const guard = findGuard(body);
    if (guard === -1) {
      report(rel, lineOf(text, m.index), `${fn}: немає виклику перевірки користувача (requireActiveUser / requireAdmin / adminOr / authorRequest / getClaims) у тілі`);
      return;
    }
    const write = body.search(WRITE);
    if (write !== -1 && write < guard) {
      report(rel, lineOf(text, m.index), `${fn}: запис чи запит до бази раніше за перевірку користувача — спершу guard`);
    }
  });
}

if (problems.length === 0) {
  console.log("check-server-actions: OK — кожна Server Action перевіряє користувача до запису, getSession() і middleware.ts немає.");
  process.exit(0);
}
for (const p of problems) console.log(p);
console.log(`\ncheck-server-actions: ${problems.length} порушень. Правило — docs/decisions/0003-permissions-in-database.md.`);
process.exit(1);
