#!/usr/bin/env node
// node scripts/check-migration-order.mjs — порядок міграцій у PR відносно базової гілки (job db-check у CI).
//
// Supabase CLI застосовує міграції за часовою міткою в назві файлу (<14 цифр>_<назва>.sql), а `supabase db push`
// без --include-all відмовляється вставляти файл, старший за вже застосовану міграцію («Found local migration files
// to be inserted before the last migration on remote database»). Типовий випадок: у двох паралельних гілках ви (чи агент)
// створили міграції, і новішу злили першою — тепер міграція другої гілки «старша» і зламає db-deploy після merge.
//
// Порівнює файли supabase/migrations/*.sql у робочій теці з базовою гілкою (за замовчуванням origin/main;
// перевизначення — змінна MIGRATION_BASE або аргумент --base <ref>). FAIL, якщо:
//   OLDER     міграція, якої немає в базовій гілці, має мітку ≤ найновішої міграції базової гілки;
//   NAME      назва не має вигляду <14 цифр>_<назва>.sql (CLI такий файл мовчки пропустить);
//   DUPLICATE дві міграції з однаковою міткою;
//   CHANGED   застосовану міграцію (є в базовій гілці) змінено — зміни лише новим файлом;
//   DELETED   застосовану міграцію видалено — db push впаде на кожному наступному прогоні.
// Не FAIL, а попередження RENAMED: файл з базової гілки з тим самим SQL під новішою міткою — відновлення після
// FAIL db-deploy «inserted before the last migration» (README, «Збої й відновлення»).
// Корінь проєкту — поточна тека (process.cwd()). Без залежностей: node:fs, node:path, node:child_process (git).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = "supabase/migrations";
const VALID = /^\d{14}_[A-Za-z0-9_-]+\.sql$/;

function fail(lines, hint) {
  console.log("migration-order — FAIL");
  for (const line of lines) console.log(`  ${line}`);
  if (hint) console.log(`\n${hint}`);
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const argIndex = process.argv.indexOf("--base");
const base = (argIndex > 0 && process.argv[argIndex + 1]) || process.env.MIGRATION_BASE || "origin/main";

try {
  git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
} catch {
  const branch = base.replace(/^origin\//, "");
  fail(
    [`базової гілки ${base} не знайдено.`],
    `Отримайте її: git fetch origin ${branch} (у CI — checkout з fetch-depth: 0).`,
  );
}

const normalize = (text) => text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

// Імена файлів міграцій у коміті ref.
function listMigrations(ref) {
  return git(["ls-tree", "--name-only", ref, `${DIR}/`])
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".sql"))
    .map((line) => path.posix.basename(line));
}

const baseNames = listMigrations(base);

// Міграції робочої теки (те, що піде в main після merge).
const headDir = path.join(process.cwd(), DIR);
const headNames = existsSync(headDir) ? readdirSync(headDir).filter((name) => name.endsWith(".sql")).sort() : [];

const version = (name) => (name.match(/^(\d+)_/) ?? [])[1] ?? null;
const baseVersions = baseNames.map(version).filter(Boolean);
const newest = baseVersions.reduce((max, v) => (max === null || BigInt(v) > BigInt(max) ? v : max), null);

const problems = [];
const added = headNames.filter((name) => !baseNames.includes(name));

for (const name of headNames) {
  if (!VALID.test(name)) {
    problems.push(`NAME      ${DIR}/${name}: очікується <14 цифр>_<назва>.sql (латинські літери, цифри, _ або -).`);
  }
}

const seen = new Map();
for (const name of headNames) {
  const v = version(name);
  if (!v) continue;
  if (seen.has(v)) problems.push(`DUPLICATE ${DIR}/${name} і ${DIR}/${seen.get(v)}: однакова мітка ${v}.`);
  else seen.set(v, name);
}

for (const name of added) {
  const v = version(name);
  if (v && newest && BigInt(v) <= BigInt(newest)) {
    const latest = baseNames.find((n) => version(n) === newest);
    problems.push(`OLDER     ${DIR}/${name}: мітка ${v} ≤ ${newest} (${latest} уже в ${base}).`);
  }
}

// Гілка, що відстає від базової (локальний запуск до git merge origin/main), просто ще не має новіших міграцій main —
// це не видалення. DELETED — лише для міграцій, які вже були в точці відгалуження гілки (git merge-base).
// У CI для PR перевіряється merge-ref (PR + свіжий main), тож там відставання немає.
let branchPointNames = baseNames;
try {
  const point = git(["merge-base", "HEAD", base]).trim();
  if (point) branchPointNames = listMigrations(point);
} catch {
  // Немає спільної історії чи неглибокий клон — порівнюємо з самою базовою гілкою.
}
const behind = baseNames.filter((name) => !headNames.includes(name) && !branchPointNames.includes(name));

// Відновлення після FAIL db-deploy «inserted before the last migration»: файл, уже злитий у main, але НЕ застосований
// (два PR-и злились у зворотному порядку), перейменовують новою міткою без зміни SQL. Це не видалення: такий файл
// з тим самим вмістом під новішою міткою — RENAMED (попередження, не FAIL). Якщо ж цю міграцію вже застосовано,
// db-deploy після merge впаде «Remote migration versions not found» — тому перед merge звірте журнал db-deploy.
const renamed = [];
for (const name of baseNames) {
  if (headNames.includes(name) || behind.includes(name)) continue;
  // Лише файл, старший за найновіший у базовій гілці (саме такий db-deploy відмовився застосувати); найновіший уже застосовано.
  const from = version(name);
  if (!from || !newest || BigInt(from) >= BigInt(newest)) continue;
  const before = normalize(git(["show", `${base}:${DIR}/${name}`]));
  const target = added.find((candidate) => {
    const v = version(candidate);
    return (
      v &&
      newest &&
      BigInt(v) > BigInt(newest) &&
      normalize(readFileSync(path.join(headDir, candidate), "utf8")) === before
    );
  });
  if (target) renamed.push([name, target]);
}

for (const name of baseNames) {
  if (!headNames.includes(name)) {
    if (!behind.includes(name) && !renamed.some(([from]) => from === name)) {
      problems.push(`DELETED   ${DIR}/${name}: міграція з ${base} видалена (застосовані міграції не видаляємо).`);
    }
    continue;
  }
  const before = normalize(git(["show", `${base}:${DIR}/${name}`]));
  const after = normalize(readFileSync(path.join(headDir, name), "utf8"));
  if (before !== after) {
    problems.push(`CHANGED   ${DIR}/${name}: відрізняється від ${base} (застосовані міграції не редагуємо — лише новий файл).`);
  }
}

if (problems.length) {
  // Нова мітка: зараз (UTC), але точно новіша за найновішу в базовій гілці.
  const now = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const suggested = newest && BigInt(now) <= BigInt(newest) ? (BigInt(newest) + 1n).toString() : now;
  const older = added.find((name) => {
    const v = version(name);
    return v && newest && BigInt(v) <= BigInt(newest);
  });
  const rename = older
    ? `OLDER — перейменуйте файл новою міткою (SQL не змінюється), закомітьте й запуште в ту саму гілку:\n` +
      `  git fetch origin && git merge origin/main\n` +
      `  git mv ${DIR}/${older} ${DIR}/${suggested}_${older.replace(/^\d+_/, "")}\n` +
      `  (або: npx supabase migration new <назва> → перенесіть SQL → видаліть старий файл)`
    : "";
  const has = (kind) => problems.some((line) => line.startsWith(kind));
  const hints = [
    rename,
    has("CHANGED") || has("DELETED")
      ? `CHANGED / DELETED — поверніть файл: git checkout ${base} -- ${DIR}/<файл>; зміну схеми оформіть новою міграцією.`
      : "",
    has("NAME") || has("DUPLICATE") ? "NAME / DUPLICATE — створюйте файли лише командою: npx supabase migration new <назва>." : "",
  ];
  fail(problems, hints.filter(Boolean).join("\n"));
}

console.log(
  `migration-order — OK: нових міграцій ${added.length}` +
    (added.length && newest ? `, усі новіші за ${newest} (${base})` : "") +
    `; застосовані міграції не змінено.`,
);
for (const [from, to] of renamed) {
  const text =
    `RENAMED ${DIR}/${from} → ${to} (SQL той самий). Лише для відновлення після FAIL db-deploy «Found local migration ` +
    `files to be inserted before the last migration»: файл є в ${base}, але ще НЕ застосований у вашій базі. ` +
    `Якщо його вже застосовано, db-deploy після merge впаде «Remote migration versions not found» — звірте журнал db-deploy.`;
  console.log(`Увага: ${text}`);
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::warning title=migration-order::${text}`);
}
if (behind.length) {
  console.log(
    `Примітка: гілка відстає від ${base} (ще не злиті: ${behind.join(", ")}). Перед PR: git fetch origin && git merge origin/main.`,
  );
}
