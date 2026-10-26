#!/usr/bin/env node
// Архітектурне правило «кожна Server Action сама перевіряє, хто викликає» (ADR 0003).
// Server Action — публічний POST-ендпойнт: її викликають напряму, оминувши сторінку, proxy і приховану кнопку.
// 1) Кожна експортована async-функція у файлі actions.ts / route.ts (крім винятків нижче) у своєму тілі викликає
//    requireActiveUser / requireAdmin / adminOr / authorRequest / getClaims — до будь-якого запису.
// 2) У src/ немає getSession(): для авторизації на сервері — лише getClaims().
// 3) У src/ немає middleware.ts: у Next.js 16 це src/proxy.ts (лише оновлення сесії, не захист).
// Винятки: дії, що створюють сесію (вхід) і сторінка активації за посиланням: там сесії ще немає
// (EXEMPT нижче; кожен виняток — з причиною).
// Використання: node scripts/check-server-actions.mjs [--root <dir>]
// Код виходу: 0 — порушень немає, 1 — є порушення, 2 — немає src/.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
const SRC = join(root, "src");

const EXEMPT = new Map([["src/app/login/actions.ts", "вхід: сесії ще немає, пароль перевіряє signInWithPassword"]]);
// adminOr — локальна обгортка над requireAdmin в actions.ts адміністрування.
const GUARDS = /\b(requireActiveUser|requireAdmin|adminOr|authorRequest|getClaims)\s*\(/;
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
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

const problems = [];
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const report = (rel, line, message) => problems.push(`${rel}:${line}  ${message}`);

for (const file of walk(SRC)) {
  const rel = relative(root, file).split(sep).join("/");
  const name = basename(file);
  if (name === "middleware.ts") report(rel, 1, "у Next.js 16 замість middleware.ts — src/proxy.ts");
  if (!/\.(tsx?|mjs)$/.test(name) || /\.test\./.test(name)) continue;
  const raw = readFileSync(file, "utf8");
  const text = stripComments(raw);

  for (const m of text.matchAll(/\bgetSession\s*\(/g)) {
    report(rel, lineOf(text, m.index), "getSession() для авторизації заборонено — лише getClaims()");
  }

  if (!["actions.ts", "route.ts"].includes(name) || EXEMPT.has(rel)) continue;

  // Експортовані функції: від `export async function` до наступного `export` (або кінця файлу).
  const starts = [...text.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)];
  starts.forEach((m, i) => {
    const body = text.slice(m.index, starts[i + 1]?.index ?? text.length);
    if (!GUARDS.test(body)) {
      report(rel, lineOf(text, m.index), `${m[1]}: немає перевірки користувача (requireActiveUser / requireAdmin / adminOr / authorRequest / getClaims) у тілі`);
    }
  });
}

if (problems.length === 0) {
  console.log("check-server-actions: OK — кожна Server Action перевіряє користувача, getSession() і middleware.ts немає.");
  process.exit(0);
}
for (const p of problems) console.log(p);
console.log(`\ncheck-server-actions: ${problems.length} порушень. Правило — docs/decisions/0003-permissions-in-database.md.`);
process.exit(1);
