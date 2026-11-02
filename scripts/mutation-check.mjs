#!/usr/bin/env node
// npm run mutation:sql — мутаційна перевірка правил, які Stryker не мутує (SQL: політики RLS, grant, функції, тригери),
// плюс кілька точкових TS-мутантів на межах з AC. Список мутантів — scripts/mutants.mjs.
// Для кожного мутанта:
//   1. відмовляється працювати, якщо у файлі мутанта є незакомічені зміни (ваші правки не зачіпаємо);
//   2. робить ОДНУ текстову заміну (find має трапитися рівно один раз; заміна вставляється буквально);
//   3. запускає лише файли тестів мутанта (Vitest, JSON-звіт);
//   4. завжди повертає файл як був (і після Ctrl+C);
//   5. вердикт: KILLED — хоч один тест упав (правило доведено); SURVIVED — усе зелене (тести правила не доводять);
//      ERROR — тест-файл не завантажився, впав хук beforeAll (наприклад, мутант зламав міграцію) або Vitest не дав
//      звіту. ERROR не рахується вбитим: такий мутант нічого не доводить — виправте його і запустіть ще раз.
// Перед мутантами — прогін без мутацій: якщо тести червоні вже на чистому коді, «вбитий» нічого б не означав.
//
// Використання:
//   node scripts/mutation-check.mjs                  усі мутанти (npm run mutation:sql — лише kind: "sql")
//   node scripts/mutation-check.mjs --only L2,L5     вибрані
//   node scripts/mutation-check.mjs --kind ts        лише TS-мутанти
//   … --json reports/sql-mutation.json              результати у файл; --markdown — таблиця для опису PR
// Код виходу: 0 — кожен мутант KILLED або прийнятий (expect: "survive" з reason); 1 — є SURVIVED чи ERROR;
// 2 — помилка запуску (брудний файл, find не знайдено, тести червоні без мутацій).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mutants } from "./mutants.mjs";

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const only = option("--only")?.split(",").map((s) => s.trim());
const kind = option("--kind");
const jsonOut = option("--json");
const markdown = args.includes("--markdown");

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(2);
};

const selected = mutants.filter((m) => (!only || only.includes(m.id)) && (!kind || m.kind === kind));
if (only) {
  const unknown = only.filter((id) => !mutants.some((m) => m.id === id));
  if (unknown.length) fail(`немає мутантів з ID: ${unknown.join(", ")} (див. scripts/mutants.mjs)`);
}
if (!selected.length) fail("жодного мутанта не вибрано");

// Перевірки списку до будь-яких змін у файлах.
for (const m of selected) {
  if (m.expect === "survive" && !m.reason) fail(`${m.id}: expect: "survive" без reason — поясніть, чому мутант еквівалентний`);
  for (const f of [m.file, ...m.tests]) if (!existsSync(f)) fail(`${m.id}: файлу ${f} немає`);
}

// Ctrl+C посеред мутанта: повертаємо оригінальні байти файлу.
const restoreQueue = new Map();
const restoreAll = () => {
  for (const [file, bytes] of restoreQueue) writeFileSync(file, bytes);
  restoreQueue.clear();
};
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    restoreAll();
    process.exit(130);
  });
}

function isDirty(file) {
  try {
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", file], { stdio: "ignore" });
    return false;
  } catch {
    return true;
  }
}

// Заміна функцією: у рядку-заміні String.prototype.replace інакше тлумачить «$$», «$&», «$1» (а plpgsql повний «$$»).
function applyOnce(text, find, replace) {
  const count =
    typeof find === "string"
      ? text.split(find).length - 1
      : [...text.matchAll(new RegExp(find.source, find.flags.includes("g") ? find.flags : `${find.flags}g`))].length;
  if (count !== 1) throw new Error(`find трапився ${count} раз(и), потрібно рівно 1: ${String(find).slice(0, 80)}`);
  return text.replace(find, () => replace);
}

// Vitest напряму через node (без npx і shell): однаково на Windows, macOS і Linux.
const vitestBin = path.join("node_modules", "vitest", "vitest.mjs");
if (!existsSync(vitestBin)) fail("немає node_modules/vitest — спершу npm ci");
const tmp = mkdtempSync(path.join(tmpdir(), "mutation-check-"));

function readReport(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null; // немає звіту чи він неповний — це ERROR
  }
}

// Чому прогін нічого не доводить: файл «failed», де жоден тест не впав сам (не завантажився або впав хук
// beforeAll з міграціями), або файл тестів узагалі не запустився.
function loadProblems(report, files) {
  const firstLine = (s) => (s ?? "").split("\n").find((l) => l.trim()) ?? "";
  const problems = report.testResults
    .filter((f) => f.status === "failed" && !f.assertionResults.some((a) => a.status === "failed"))
    .map((f) => `${path.basename(f.name)}: ${firstLine(f.message)}`.slice(0, 160));
  const ran = new Set(report.testResults.map((f) => path.relative(process.cwd(), f.name).replaceAll("\\", "/")));
  const missing = files.filter((f) => !ran.has(f));
  if (missing.length) problems.push(`не запущено: ${missing.join(", ")}`);
  return problems.length ? problems.join("; ") : null;
}

function runTests(files, label) {
  const out = path.join(tmp, `${label}.json`);
  const run = spawnSync(process.execPath, [vitestBin, "run", ...files, "--reporter=json", `--outputFile=${out}`], {
    stdio: "ignore",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const report = readReport(out);
  if (!report) return { error: `Vitest не дав звіту (код виходу ${run.status ?? run.signal})`, failed: [] };
  const failed = report.testResults.flatMap((f) =>
    f.assertionResults.filter((a) => a.status === "failed").map((a) => a.title),
  );
  return { error: loadProblems(report, files), failed };
}

// 0. Прогін без мутацій: тести мутантів мають бути зеленими на чистому коді.
for (const m of selected) if (isDirty(m.file)) fail(`${m.id}: ${m.file} має незакомічені зміни — закомітьте або git stash`);
const allTests = [...new Set(selected.flatMap((m) => m.tests))];
const t0 = Date.now();
const clean = runTests(allTests, "clean");
if (clean.error || clean.failed.length) {
  fail(
    `без мутацій тести вже не зелені — спершу полагодьте їх: ${clean.error ?? clean.failed.slice(0, 3).join(" | ")}`,
  );
}
console.log(`Без мутацій: ${allTests.length} файл(и) тестів зелені (${((Date.now() - t0) / 1000).toFixed(1)} с)\n`);

const results = [];
const started = Date.now();
for (const m of selected) {
  const original = readFileSync(m.file);
  // find пишемо з «\n». Якщо файл має CRLF (немає .gitattributes eol=lf), шукаємо в LF-копії; мутант пишемо з LF,
  // а повертаємо оригінальні байти.
  let mutated;
  try {
    mutated = applyOnce(original.toString("utf8").replace(/\r\n/g, "\n"), m.find, m.replace);
  } catch (e) {
    fail(`${m.id}: ${e.message}`);
  }
  const t = Date.now();
  restoreQueue.set(m.file, original);
  let run;
  try {
    writeFileSync(m.file, mutated);
    run = runTests(m.tests, m.id);
  } finally {
    restoreAll();
  }
  const status = run.error ? "ERROR" : run.failed.length ? "KILLED" : "SURVIVED";
  const accepted = status === "SURVIVED" && m.expect === "survive";
  const ok = status === "KILLED" || accepted;
  const seconds = (Date.now() - t) / 1000;
  results.push({ id: m.id, kind: m.kind, ac: m.ac, what: m.what, status, accepted, failed: run.failed, error: run.error, seconds });
  console.log(`${ok ? "✓" : "✗"} ${m.id} ${status.padEnd(8)} ${m.ac} — ${m.what} (${seconds.toFixed(1)} с)`);
  for (const title of run.failed) console.log(`      × ${title}`);
  if (run.error) console.log(`      ! ${run.error}`);
  if (accepted) console.log(`      = прийнято: ${m.reason}`);
}
rmSync(tmp, { recursive: true, force: true });

const valid = results.filter((r) => r.status !== "ERROR");
const killed = valid.filter((r) => r.status === "KILLED").length;
const acceptedCount = valid.filter((r) => r.accepted).length;
const errors = results.length - valid.length;
const pct = valid.length ? Math.round((100 * killed) / valid.length) : 0;
console.log(
  `\nМутаційний бал: ${killed} з ${valid.length} вбито (${pct} %)` +
    (acceptedCount ? `, прийнято еквівалентних: ${acceptedCount}` : "") +
    (errors ? `, ERROR (не в балі): ${errors}` : "") +
    ` — ${((Date.now() - started) / 1000).toFixed(1)} с`,
);

if (markdown) {
  console.log("\n| Мутант | AC | Що зламано | Вердикт | Який тест упав |\n|---|---|---|---|---|");
  for (const r of results) {
    const verdict = r.accepted ? "SURVIVED (еквівалентний, прийнято)" : r.status;
    const evidence = r.failed.length ? r.failed.join("; ") : r.error ?? "—";
    console.log(`| ${r.id} | ${r.ac} | ${r.what} | ${verdict} | ${evidence.replaceAll("|", "\\|")} |`);
  }
}
if (jsonOut) {
  mkdirSync(path.dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify(results, null, 2));
}
process.exit(results.every((r) => r.status === "KILLED" || r.accepted) ? 0 : 1);
