// npm run uat — UAT за AC на РОЗГОРНУТОМУ застосунку: запис → кадри «Тоді» → вердикт агента → звіт для PM.
//   npm run uat -- --url https://<ваш-прод>.vercel.app      (або змінна UAT_BASE_URL; без неї — локальна збірка)
//   npm run uat -- --url … --grep-invert '@writes'          (лише AC, що нічого не пишуть; решта аргументів → Playwright)
//   npm run uat:nc -- --url …                               (негативні контролі; звіт у test-results/uat-report-nc/)
// Кроки: playwright test → pack.mjs → review.mjs (claude -p) → combine.mjs → report.mjs.
// Звіт пишеться завжди, навіть якщо тести червоні: FAIL — теж результат для PM. Код виходу 1, якщо є FAIL.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pack } from "./pack.mjs";
import { review } from "./review.mjs";
import { combine } from "./combine.mjs";
import { report } from "./report.mjs";
import { ROOT, WORK, rel } from "./lib.mjs";

const argv = process.argv.slice(2);
const take = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const [, value] = argv.splice(i, 2);
  return value;
};
const flag = (name) => {
  const i = argv.indexOf(name);
  if (i >= 0) argv.splice(i, 1);
  return i >= 0;
};

const url = (take("--url") ?? process.env.UAT_BASE_URL)?.replace(/\/+$/, "");
const negativeControls = flag("--negative-controls");
const skipReview = flag("--skip-review");
const git = (...a) => {
  try {
    return execFileSync("git", a, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

async function deployedSha(base) {
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/health`, { redirect: "manual" });
    if (!res.headers.get("content-type")?.includes("json")) return null;
    return (await res.json()).sha ?? null;
  } catch {
    return null;
  }
}

const startedAt = new Date().toISOString();
const env = { ...process.env, UAT_NEGATIVE_CONTROLS: negativeControls ? "1" : "" };
if (url) env.UAT_BASE_URL = url;
else delete env.UAT_BASE_URL;

// Журнал прибирання — лише цього прогону: інакше «видалено» у звіті підсумовує адреси з попередніх прогонів.
rmSync(path.join(ROOT, "test-results", "uat-cleanup.jsonl"), { force: true });
console.log(`UAT: ${url ?? "локальна збірка (npm run build && npm run start)"}${negativeControls ? " — негативні контролі" : ""}`);
const cli = path.join(ROOT, "node_modules", "@playwright", "test", "cli.js");
const pw = spawnSync(
  process.execPath,
  [cli, "test", `--project=${negativeControls ? "negative-controls" : "chromium"}`, ...argv],
  { stdio: "inherit", env },
);
const playwrightMs = Date.now() - Date.parse(startedAt);

const cases = pack();
mkdirSync(WORK, { recursive: true });
writeFileSync(
  path.join(WORK, "run.json"),
  JSON.stringify(
    {
      baseURL: url ?? "http://localhost:3000",
      deployedSha: await deployedSha(url),
      gitSha: git("rev-parse", "HEAD"),
      gitBranch: git("rev-parse", "--abbrev-ref", "HEAD"),
      gitDirty: Boolean(git("status", "--porcelain")),
      startedAt,
      playwrightMs,
      playwrightExit: pw.status,
      negativeControls,
    },
    null,
    2,
  ),
);
// process.exitCode, а не process.exit(): на Windows exit() після fetch падає з assertion libuv.
if (!cases.length) {
  console.error("Жодного AC-тесту в результатах Playwright — звіту не буде.");
  process.exitCode = 1;
} else {
  if (!skipReview) await review();
  const { outDir, rows } = report(combine(), { out: negativeControls ? "test-results/uat-report-nc" : undefined });
  console.log(`\nЗвіт: ${rel(outDir)}/report.md`);
  for (const r of rows) console.log(`  ${r.caseId}: ${r.verdict} — ${r.ruleText}`);
  const real = rows.filter((r) => !r.negativeControl);
  if (real.some((r) => r.verdict === "FAIL")) process.exitCode = 1;
  if (real.some((r) => r.verdict === "NEEDS-HUMAN")) console.log("Є NEEDS-HUMAN: рішення — за PM (див. звіт).");
}
