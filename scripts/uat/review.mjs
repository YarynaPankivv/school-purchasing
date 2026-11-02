// Крок 2 UAT: агент-рецензент (`claude -p`) дивиться кадри «Тоді» й повертає вердикт JSON за verdict.schema.json.
//   1) Claude Haiku 5.5 — для кожного AC (≈ $0,0025 за AC).
//   2) Claude Sonnet 5.5 — ЛИШЕ для суперечки: перевірки пройшли, а Haiku не каже PASS або його цитати немає на
//      сторінці (aria). Тоді рішення агента — за Sonnet; у звіті видно обидва вердикти.
// Рецензент сліпий: працює в окремій тимчасовій теці (поза репо — щоб не підхопив CLAUDE.md/AGENTS.md і назву випадку),
// бачить лише agent/ (AC, кроки, кадри), без інструментів, крім Read, без MCP, без налаштувань користувача.
// Використання: node scripts/uat/review.mjs [--only AC-USERS-07] [--model claude-haiku-5-5] [--no-escalate]
// Потрібен Claude Code (`claude` у PATH) з входом за підпискою або ANTHROPIC_API_KEY.
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HAIKU, SONNET, caseDirs, readJson, quoteInAria } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const prompt = readFileSync(path.join(here, "review-prompt.uk.md"), "utf8");
const schema = JSON.stringify(readJson(path.join(here, "verdict.schema.json")));

function runClaude(caseDir, model) {
  const args = [
    "-p",
    "--output-format", "json",
    "--json-schema", schema,
    "--model", model,
    "--effort", "medium",
    "--tools", "Read", // дивитись, не чіпати: без Bash, Write і вебу
    "--setting-sources", "project", // без налаштувань користувача: без advisor, хуків, особистих моделей
    "--strict-mcp-config", // без MCP-серверів
    "--permission-prompts", "none",
    "--no-session-persistence",
    "--max-budget-usd", "0.50",
  ];
  // Окрема тека в системному temp: у cwd немає ні назви випадку (NC-…), ні файлів репо.
  const blindDir = mkdtempSync(path.join(os.tmpdir(), "uat-review-"));
  cpSync(path.join(caseDir, "agent"), blindDir, { recursive: true });
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("claude", args, { cwd: blindDir, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill(), 300_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      rmSync(blindDir, { recursive: true, force: true });
      resolve({ model, wallMs: Date.now() - started, out: { parse_error: true, stderr: String(error) } });
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      rmSync(blindDir, { recursive: true, force: true });
      let out;
      try {
        out = JSON.parse(stdout);
      } catch {
        out = { parse_error: true, status, stdout: stdout.slice(0, 1500), stderr: stderr.slice(0, 1500) };
      }
      resolve({ model, wallMs: Date.now() - started, out });
    });
    child.stdin.end(prompt); // кирилиця через stdin, а не argv (кодова сторінка Windows)
  });
}

const verdictOf = (review) => review?.out?.structured_output ?? null;

/** Суперечка = перевірки пройшли, а рецензент не каже PASS, або його «met»-цитати немає на сторінці. */
export function isDispute(caseDir, review) {
  const a = readJson(path.join(caseDir, "private", "assertions.json"));
  if (a.status !== "passed") return false; // FAIL вирішує перевірка; агент лише для розбору
  const v = verdictOf(review);
  if (!v || v.verdict !== "PASS") return true;
  const aria = readdirSync(path.join(caseDir, "private"))
    .filter((f) => f.startsWith("aria-then-"))
    .map((f) => readFileSync(path.join(caseDir, "private", f), "utf8"))
    .join("\n");
  const quotes = v.then_parts
    .filter((p) => p.observable === "visible" && p.status === "met")
    .flatMap((p) => p.quoted_text.split(";").map((q) => q.trim()).filter(Boolean));
  return quotes.length === 0 || quotes.some((q) => !quoteInAria(q, aria));
}

async function reviewCase(caseDir, { model, escalate }) {
  const id = path.basename(caseDir);
  const save = (r) => writeFileSync(path.join(caseDir, `review.${r.model}.json`), JSON.stringify(r, null, 2));
  const first = await runClaude(caseDir, model);
  save(first);
  const line = (r) => `${id} [${r.model}] → ${verdictOf(r)?.verdict ?? "БЕЗ ВЕРДИКТУ"}; $${r.out.total_cost_usd ?? "?"}; ${r.wallMs} мс`;
  console.log(line(first));
  if (escalate && model !== SONNET && isDispute(caseDir, first)) {
    const second = await runClaude(caseDir, SONNET);
    save(second);
    console.log(`${line(second)} (суперечка → Sonnet)`);
  } else {
    rmSync(path.join(caseDir, `review.${SONNET}.json`), { force: true });
  }
}

export async function review({ only, model = HAIKU, escalate = true, concurrency = 3 } = {}) {
  const dirs = caseDirs().filter((d) => !only || path.basename(d) === only);
  if (!dirs.length) throw new Error("Немає пакетів у test-results/uat — спершу node scripts/uat/pack.mjs");
  const queue = [...dirs];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let d = queue.shift(); d; d = queue.shift()) await reviewCase(d, { model, escalate });
    }),
  );
  return dirs;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  if (!existsSync(path.join(process.cwd(), "test-results", "uat"))) {
    console.error("Немає test-results/uat — спершу npx playwright test і node scripts/uat/pack.mjs");
    process.exitCode = 1;
  } else {
    await review({ only: opt("--only"), model: opt("--model") ?? HAIKU, escalate: !argv.includes("--no-escalate") });
  }
}
