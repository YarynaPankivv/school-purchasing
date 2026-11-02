#!/usr/bin/env node
// npm run coverage:summary — coverage/coverage-summary.json (репортер json-summary з npm run test:coverage) →
// таблиця Markdown у Summary прогону GitHub Actions ($GITHUB_STEP_SUMMARY) або в термінал.
// Без сторонньої дії й без дозволу pull-requests: write. Порядок: спершу доменні правила (src/lib/**, крім адаптерів
// src/lib/supabase/**) — найнижчі зверху, потім сторінки й server actions, потім адаптери. 0 % сторінок — не провал:
// їх доводять тести бази (PGlite) та e2e, а не Vitest. Джерело — демо-репо курсу, тег ws8-01-gates.
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const LAYERS = [
  // Домен — src/lib/**, крім src/lib/supabase/**. Інша структура — змініть вираз (у демо: src/lib/(leave|users|auth)/).
  { name: "домен (unit)", test: /src[\\/]lib[\\/](?!supabase[\\/])/ },
  { name: "сторінки й дії (PGlite, e2e)", test: /src[\\/]app[\\/]/ },
  { name: "адаптери, інше (e2e)", test: /./ },
];
const layerIndex = (file) => LAYERS.findIndex((l) => l.test.test(file));
const pct = (m) => (m.total === 0 ? "—" : `${Math.floor(m.pct)} %`);

const summary = JSON.parse(readFileSync(process.argv[2] ?? "coverage/coverage-summary.json", "utf8"));
const rows = Object.entries(summary)
  .filter(([file]) => file !== "total")
  .map(([file, m]) => ({ file: path.relative(process.cwd(), file).replaceAll("\\", "/"), layer: layerIndex(file), m }))
  .sort((a, b) => a.layer - b.layer || a.m.lines.pct - b.m.lines.pct || a.file.localeCompare(b.file));

const { total } = summary;
let md = "### Покриття коду тестами (Vitest, v8)\n\n";
md += `Разом: рядки ${pct(total.lines)} (${total.lines.covered} з ${total.lines.total}), гілки ${pct(total.branches)}. `;
md += "Покриття показує, який код виконався, а не що перевірено: силу тестів міряє мутаційне тестування ";
md += "(`npm run mutation:ts` — TS, `npm run mutation:sql` — правила в SQL).\n\n";
md += "| Шар | Файл | Рядки | Гілки | Функції |\n|---|---|---|---|---|\n";
for (const r of rows) {
  // Доменні файли — усі; решта — лише неповністю покриті (повністю покриті сторінки не шумлять).
  if (r.layer !== 0 && r.m.lines.pct === 100) continue;
  md += `| ${LAYERS[r.layer].name} | \`${r.file}\` | ${pct(r.m.lines)} | ${pct(r.m.branches)} | ${pct(r.m.functions)} |\n`;
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else process.stdout.write(md);
