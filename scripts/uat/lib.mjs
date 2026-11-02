// Спільне для scripts/uat/*: шляхи, текст AC з вимог, нормалізація цитат.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();
/** Робоча тека прогону: пакети для рецензента, вердикти, підсумок (у .gitignore разом із test-results/). */
export const WORK = path.join(ROOT, "test-results", "uat");
export const RESULTS = path.join(ROOT, "test-results", "results.json");
export const HAIKU = "claude-haiku-5-5";
export const SONNET = "claude-sonnet-5-5";

export const rel = (p) => (p ? path.relative(ROOT, p).split(path.sep).join("/") : null);
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const caseDirs = () =>
  existsSync(WORK)
    ? readdirSync(WORK, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(path.join(WORK, d.name, "private", "assertions.json")))
        .map((d) => path.join(WORK, d.name))
        .sort()
    : [];

/**
 * Текст AC дослівно: спершу вимоги PM (requirements/*.md, рядок «- AC-…: Дано… Коли… Тоді…»),
 * інакше — сценарій зі специфікації (openspec/specs/<capability>/spec.md, рядки GIVEN/WHEN/THEN/AND без змін).
 */
export function acText(acId) {
  const reqDir = path.join(ROOT, "requirements");
  for (const f of existsSync(reqDir) ? readdirSync(reqDir).filter((x) => x.endsWith(".md")) : []) {
    const line = readFileSync(path.join(reqDir, f), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`- ${acId}: `));
    if (line) return { text: line.slice(2), source: `requirements/${f}` };
  }
  const specsDir = path.join(ROOT, "openspec", "specs");
  for (const cap of existsSync(specsDir) ? readdirSync(specsDir) : []) {
    const file = path.join(specsDir, cap, "spec.md");
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const i = lines.findIndex((l) => l.startsWith(`#### Scenario: ${acId} `));
    if (i < 0) continue;
    const body = [];
    for (const l of lines.slice(i + 1)) {
      if (/^#{1,4} /.test(l)) break;
      if (l.trim().startsWith("- ")) body.push(l.trim().replace(/\*\*/g, ""));
    }
    return {
      text: [`${acId} — ${lines[i].slice(`#### Scenario: ${acId} `.length)}`, ...body].join("\n"),
      source: `openspec/specs/${cap}/spec.md`,
    };
  }
  throw new Error(`${acId}: не знайдено ні в requirements/*.md, ні в openspec/specs/*/spec.md`);
}

/**
 * Для перевірки цитат: Unicode NFC, пробіли й переноси → один пробіл, лапки-обгортки по краях геть.
 * Регістр і пунктуацію всередині НЕ чіпаємо: «інший регістр — not-met» (правило 4 рецензента) діє і тут.
 */
export const norm = (s) =>
  s
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[«"“„']+|[»"”']+$/g, "")
    .trim();

/** Цитата є в aria-знімку сторінки? (Знімок — YAML; рядки з «:» Playwright бере в лапки — їх знімаємо.) */
export function quoteInAria(quote, aria) {
  const flat = norm(aria.replace(/^(\s*)- [a-z]+: "(.*)"$/gm, "$1$2").replace(/\\"/g, '"'));
  return flat.includes(norm(quote));
}
