#!/usr/bin/env node
// Архітектурне правило «дизайн-система»: у застосунку кольори лише через семантичні токени.
// Шукає в src/ (поза src/components/ui і src/app/globals.css). Якщо теки src/ немає — у app/, components/ і lib/
// кореня (поза components/ui і app/globals.css); що саме перевірено, скрипт пише у виводі.
//   1) hex-кольори (#fff, #0f6b6e); якір у посиланні (href="#add") — не колір;
//   2) довільні кольори в класах Tailwind (bg-[#…], text-[oklch(…)]);
//   3) сирі палітри Tailwind (bg-zinc-900, text-rose-700, bg-white, text-black);
//   4) кольори в inline style — лише всередині style={{ … }} (style={{ color: "…" }}). Мапа класів поза style,
//      наприклад { label: "На розгляді", color: "bg-status-pending text-status-pending-foreground" }, — не порушення.
// Виняток — коментар `design-ok: <причина>` у тому самому рядку.
// Використання: node scripts/check-design-tokens.mjs [--root <dir>] [--json]
// Код виходу: 0 — порушень немає, 1 — є порушення, 2 — немає чого перевіряти (ні src/, ні app/, components/, lib/).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
const asJson = args.includes("--json");

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// Код у src/ — як у шаблоні проєкту. Інакше — теки Next.js у корені.
const hasSrc = isDir(join(root, "src"));
const BASES = hasSrc ? ["src"] : ["app", "components", "lib"].filter((d) => isDir(join(root, d)));
if (BASES.length === 0) {
  console.error(`check-design-tokens: у ${root} немає ні src/, ні app/, components/, lib/ — вкажіть --root <корінь проєкту>.`);
  process.exit(2);
}
const BASE = hasSrc ? "src" : "";
const SCANNED = BASES.map((b) => `${b}/`);
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const SKIP_FILES = [
  join(BASE, "components", "ui") + sep, // компоненти дизайн-системи — тут токени визначають вигляд
  join(BASE, "app", "globals.css"), // тут токени оголошені
];
const EXT = /\.(tsx|ts|jsx|js|css)$/;

const PREFIX =
  "(?:bg|text|border|border-[trblxy]|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow)";
const PALETTE =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

const RULES = [
  {
    id: "hex",
    message: "hex-колір — візьміть семантичний токен (bg-primary, text-muted-foreground…)",
    re: /(?<![\w&/])(?<!href=["'])(?<!href=\{["'`])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
  },
  {
    id: "arbitrary-color",
    message: "довільний колір у класі — додайте токен у globals.css і використайте його",
    re: new RegExp(`(?<![\\w-])${PREFIX}-\\[(?:#|rgb|hsl|oklch|oklab|lab|lch|color|var\\(--(?!color-))[^\\]]*\\]`, "g"),
  },
  {
    id: "raw-palette",
    message: "сира палітра Tailwind — замініть на семантичний клас із DESIGN.md",
    re: new RegExp(`(?<![\\w-])${PREFIX}-(?:${PALETTE}-\\d{2,3}|black|white)(?:\\/\\d{1,3})?(?![\\w-])`, "g"),
  },
];

const INLINE_STYLE = {
  id: "inline-style-color",
  message: "колір в inline style — використайте клас із токеном",
  re: /(?:\bcolor|backgroundColor|borderColor|background)\s*:\s*["'`](?!var\(--)[^"'`]+["'`]/g,
};

// Діапазони тексту всередині style={{ … }}: від другої «{» до парної «}», з урахуванням вкладених дужок і рядків.
function styleBlocks(text) {
  const blocks = [];
  for (const m of text.matchAll(/\bstyle\s*=\s*\{\s*\{/g)) {
    const start = m.index + m[0].length;
    let depth = 2;
    let quote = null;
    let i = start;
    for (; i < text.length && depth > 0; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    blocks.push([start, i]);
  }
  return blocks;
}

// Знахідки правила inline style за номером рядка (0-based), щоб вивести їх у тому ж порядку, що й решту.
function inlineStyleFindings(text) {
  const byLine = new Map();
  for (const [start, end] of styleBlocks(text)) {
    const block = text.slice(start, end);
    for (const m of block.matchAll(INLINE_STYLE.re)) {
      const line = text.slice(0, start + m.index).split("\n").length - 1;
      if (!byLine.has(line)) byLine.set(line, []);
      byLine.get(line).push(m[0]);
    }
  }
  return byLine;
}

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
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of BASES.flatMap((b) => walk(join(root, b)))) {
  const rel = relative(root, file);
  if (SKIP_FILES.some((s) => rel === s || rel.startsWith(s))) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const inline = /\.(tsx|jsx)$/.test(file) ? inlineStyleFindings(text) : new Map();
  const add = (i, rule, match) =>
    findings.push({ file: rel.split(sep).join("/"), line: i + 1, rule: rule.id, match, message: rule.message });
  lines.forEach((line, i) => {
    if (/design-ok:/.test(line)) return;
    for (const rule of RULES) {
      for (const m of line.matchAll(rule.re)) add(i, rule, m[0]);
    }
    for (const match of inline.get(i) ?? []) add(i, INLINE_STYLE, match);
  });
}

const where = hasSrc ? "src/components/ui" : "components/ui";
if (asJson) {
  console.log(JSON.stringify({ ok: findings.length === 0, scanned: SCANNED, findings }, null, 2));
} else {
  if (!hasSrc) console.log(`check-design-tokens: теки src/ немає — перевіряю ${SCANNED.join(", ")}.`);
  if (findings.length === 0) {
    console.log(`check-design-tokens: OK — сирих кольорів поза ${where} немає.`);
  } else {
    for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}]  ${f.match}  — ${f.message}`);
    const files = new Set(findings.map((f) => f.file)).size;
    console.log(`\ncheck-design-tokens: ${findings.length} порушень у ${files} файлах. Правила — у DESIGN.md.`);
  }
}
process.exit(findings.length === 0 ? 0 : 1);
