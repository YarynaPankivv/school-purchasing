// Крок 4 UAT: звіт для PM у git — docs/qa/uat/<дата>/report.md + frames/*.png + manifest.json.
// Відео й траси в git НЕ кладемо (0,8–1,7 МБ на AC): вони лишаються в test-results/ локально й в артефакті CI.
// Тому manifest.json ще не сумісний із check-recordings конвеєра WS9 (той вимагає відео на диску) — див. поле note.
// Негативні контролі (NC-…) у manifest.results не потрапляють — лише в окремий список negativeControls.
// Використання: node scripts/uat/report.mjs [--out docs/qa/uat/2026-10-26]
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RULES, combine } from "./combine.mjs";
import { HAIKU, ROOT, SONNET, WORK, readJson, rel } from "./lib.mjs";

const kyivDate = (iso) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv", dateStyle: "short" }).format(new Date(iso));
const kyivTime = (iso) =>
  new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const sec = (ms) => `${(ms / 1000).toFixed(1)} с`;
const usd = (x) => `$${x.toFixed(4)}`;
const md = (s = "") => String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function report(rows = combine(), { out } = {}) {
  const runFile = path.join(WORK, "run.json");
  const run = existsSync(runFile) ? readJson(runFile) : {};
  const started = run.startedAt ?? rows[0]?.assertions.startTime ?? new Date().toISOString();
  const outDir = path.resolve(ROOT, out ?? path.join("docs", "qa", "uat", kyivDate(started)));
  rmSync(path.join(outDir, "frames"), { recursive: true, force: true });
  mkdirSync(path.join(outDir, "frames"), { recursive: true });
  const cleanupFile = path.join(ROOT, "test-results", "uat-cleanup.json");
  const cleanup = existsSync(cleanupFile) ? readJson(cleanupFile) : null;

  // Кадри: test-results/uat/<випадок>/agent/frame-then-N.png → <out>/frames/<випадок>-then-N.png
  for (const r of rows) {
    r.frameFiles = r.frames.map((f) => {
      const name = `${r.caseId}-${f.replace(/^frame-/, "")}`;
      copyFileSync(path.join(WORK, r.caseId, "agent", f), path.join(outDir, "frames", name));
      return `frames/${name}`;
    });
  }

  const real = rows.filter((r) => !r.negativeControl);
  const nc = rows.filter((r) => r.negativeControl);
  const count = (v) => real.filter((r) => r.verdict === v).length;
  const totalCost = rows.reduce((s, r) => s + r.review.costUsd, 0);

  const entry = (r) => ({
    id: r.caseId,
    proof: r.acId,
    title: r.assertions.title,
    screenshot: rel(path.join(outDir, r.frameFiles[0] ?? "")),
    video: r.assertions.video, // не в git: test-results/… локально або артефакт CI
    trace: r.assertions.trace,
    asserted: r.assertions.status === "passed",
    vision: r.agent ? { met: r.agent.verdict === "PASS", readable: r.agent.verdict !== "NEEDS-HUMAN", notes: r.agent.notes } : null,
    agentModel: r.agentModel,
    agentVerdicts: r.agentVerdicts,
    escalated: r.escalated,
    quotesVerified: r.quotes,
    verdict: r.verdict,
    factoryGate: r.factoryGate,
    rule: r.ruleText,
    playwrightMs: r.assertions.durationMs,
    reviewCostUsd: r.review.costUsd,
    reviewWallMs: r.review.wallMs,
  });
  const manifest = {
    kind: "uat",
    generatedAt: new Date().toISOString(),
    baseURL: run.baseURL ?? null,
    deployedSha: run.deployedSha ?? null,
    testsCommit: run.gitSha ?? null,
    reviewer: { model: HAIKU, disputes: SONNET },
    note: "Відео й траси не в git (test-results/ локально, артефакт CI). check-recordings конвеєра WS9 вимагає відео на диску — для нього цей manifest треба доповнити.",
    results: real.map(entry),
    negativeControls: nc.map(entry),
    cleanup,
  };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const lines = [
    `# Звіт UAT — ${kyivDate(started).split("-").reverse().join(".")}`,
    "",
    `- **Застосунок:** ${run.baseURL ?? "локальна збірка"}${run.deployedSha ? ` (/api/health: коміт \`${run.deployedSha.slice(0, 7)}\`)` : ""}`,
    `- **Код тестів:** \`${run.gitBranch ?? "?"}\` @ \`${(run.gitSha ?? "?").slice(0, 7)}\`${run.gitDirty ? " + незакомічені зміни" : ""}`,
    `- **Прогін:** ${kyivTime(started)} (Київ), Playwright ${run.playwrightMs ? sec(run.playwrightMs) : "—"}; AC: ${real.length} — PASS ${count("PASS")}, FAIL ${count("FAIL")}, NEEDS-HUMAN ${count("NEEDS-HUMAN")}${nc.length ? `; негативних контролів: ${nc.length}` : ""}`,
    `- **Рецензент:** \`${HAIKU}\`; суперечки → \`${SONNET}\`. Разом за розбір: ${usd(totalCost)} (ціни API; за підпискою — у межах ліміту плану)`,
    cleanup
      ? `- **Прибирання:** синтетичних uat-*@example.test видалено ${cleanup.deleted.length}, лишилось ${cleanup.remaining.length}, їхніх рядків, що лишились: ${cleanup.leftoverRequests}`
      : "- **Прибирання:** не запускалось (прогін без SUPABASE_SECRET_KEY — лише AC, що нічого не пишуть)",
    "- **Відео й траси:** не в git — `test-results/` локально або артефакт CI; трасу відкриває `npx playwright show-trace <trace.zip>`",
    "",
    "| AC | Перевірки | Агент | Підсумок | Чому | Playwright | Розбір |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((r) =>
      `| ${r.negativeControl ? `${r.caseId} (${r.acId})` : r.acId} | ${r.assertions.status === "passed" ? "пройшли" : "впали"} | ${md(
        [r.agentVerdicts[HAIKU] && `Haiku: ${r.agentVerdicts[HAIKU]}`, r.agentVerdicts[SONNET] && `Sonnet: ${r.agentVerdicts[SONNET]}`].filter(Boolean).join(", ") || "—",
      )} | **${r.verdict}** | ${md(r.ruleText)} | ${sec(r.assertions.durationMs)} | ${usd(r.review.costUsd)}, ${sec(r.review.wallMs)} |`,
    ),
    "",
  ];
  for (const r of rows) {
    const a = r.assertions;
    lines.push(
      `## ${r.negativeControl ? `${r.caseId} — негативний контроль для ${r.acId}` : r.acId} — ${r.verdict}`,
      "",
      `**Тест:** ${a.title}`,
      "",
      `**Критерій** (${a.acSource}):`,
      "",
      ...readAc(r).map((l) => `> ${l}`),
      "",
      ...r.frameFiles.map((f, i) => `![Кадр «Тоді» ${i + 1}](${f})`),
      "",
      `**Кроки:** ${a.steps.map((s) => `${s.ok ? "✔" : "✘"} ${s.title}`).join(" → ")}`,
      "",
      ...(a.error ? ["**Перевірка впала:**", "", "```", a.error, "```", ""] : []),
      r.agent ? `**Агент (${r.agentModel}, ${r.agent.verdict}):** ${r.agent.notes}` : "**Агент:** вердикту немає",
      "",
      ...(r.escalated ? [`Haiku сказав ${r.agentVerdicts[HAIKU] ?? "—"}, тож розбір повторив Sonnet; рішення агента — за Sonnet.`, ""] : []),
      ...(r.agent?.defects?.length ? ["**Агент бачить вади:**", ...r.agent.defects.map((d) => `- ${d}`), ""] : []),
      ...(r.quotes.length
        ? ["**Цитати агента, звірені зі сторінкою (aria):**", ...r.quotes.map((q) => `- «${q.quote}» — ${q.onPage ? "є на сторінці" : "НЕМАЄ на сторінці"}`), ""]
        : []),
      `**Правило:** ${r.ruleText}`,
      "",
      `**Відео:** \`${a.video ?? "—"}\` · **траса:** \`${a.trace ?? "—"}\` (не в git)`,
      "",
      r.negativeControl
        ? "_Негативний контроль: навмисно хибне очікування. Очікуваний підсумок — FAIL або NEEDS-HUMAN, не PASS._"
        : "**Рішення PM:** ☐ приймаю · ☐ відхилення від вимог (issue «Відхилення від вимог: " + r.acId + " — …») · @login: ____",
      "",
    );
  }
  lines.push(
    "## Як читати підсумок",
    "",
    "- **PASS** — автоматичні перевірки пройшли, агент-рецензент погодився з кадром, а кожну його цитату знайдено на сторінці.",
    "- **FAIL** — впала автоматична перевірка. Агент цього не перекриває: невидимі вади (буфер обміну, база) він на кадрі не побачить.",
    "- **NEEDS-HUMAN** — перевірки зелені, але агент не погодився або його цитати немає на сторінці. Часто це слабкий тест або розбіжність між текстом AC і тестом — питання до PM, а не обов'язково вада продукту.",
    "",
    "Правила: " + Object.values(RULES).join("; ") + ".",
    "",
  );
  writeFileSync(path.join(outDir, "report.md"), lines.join("\n"));
  return { outDir, rows, manifest };
}

function readAc(r) {
  const file = path.join(WORK, r.caseId, "agent", "ac.md");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const m = text.split("## Критерій приймання (дослівно від PM)")[1]?.split(/\n## /)[0] ?? "";
  return m.trim().split(/\r?\n/);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : undefined;
  const { outDir, rows } = report(combine(), { out });
  console.log(`Звіт: ${rel(outDir)}/report.md`);
  for (const r of rows) console.log(`${r.caseId}: ${r.verdict} (${r.ruleText})`);
}
