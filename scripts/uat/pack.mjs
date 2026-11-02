// Крок 1 UAT: test-results/results.json (звіт Playwright) → пакет на кожен AC-тест у test-results/uat/<випадок>/.
//   agent/    — ЛИШЕ це бачить рецензент: ac.md (AC дослівно + видимі частини «Тоді»), journey.md (кроки Дано/Коли), кадри.
//   private/  — лише для combine.mjs: результат перевірок, aria-знімки сторінки, помилки сторінки, шляхи до відео й траси.
// Рецензент не бачить ні результату перевірок (щоб не підлаштовувався), ні aria-тексту (ним combine перевіряє його цитати).
// Використання: node scripts/uat/pack.mjs [results.json]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RESULTS, WORK, acText, readJson, rel } from "./lib.mjs";

const stripAnsi = (s = "") => s.replace(/\x1b\[[0-9;]*m/g, "");

export function pack(resultsPath = RESULTS) {
  const report = readJson(resultsPath);
  rmSync(WORK, { recursive: true, force: true });
  const specs = [];
  const walk = (suite) => {
    for (const s of suite.specs ?? []) specs.push(s);
    for (const c of suite.suites ?? []) walk(c);
  };
  report.suites.forEach(walk);

  const cases = [];
  for (const spec of specs) {
    for (const test of spec.tests) {
      const ann = (type) => test.annotations.find((a) => a.type === type)?.description;
      const acId = ann("ac");
      if (!acId) continue; // setup, прибирання — не AC
      const result = test.results.at(-1);
      const caseId = ann("case") ?? acId;
      const dir = path.join(WORK, caseId);
      const agentDir = path.join(dir, "agent");
      const privDir = path.join(dir, "private");
      mkdirSync(agentDir, { recursive: true });
      mkdirSync(privDir, { recursive: true });

      const att = (name) => result.attachments.find((a) => a.name === name);
      const body = (name) => Buffer.from(att(name).body, "base64");

      const thens = [];
      for (let n = 1; att(`then-${n}.json`); n++) {
        thens.push(JSON.parse(body(`then-${n}.json`).toString("utf8")));
        writeFileSync(path.join(agentDir, `frame-then-${n}.png`), body(`then-${n}.png`));
        writeFileSync(path.join(privDir, `aria-then-${n}.yml`), body(`then-${n}.aria.yml`));
      }

      const override = ann("ac-text");
      const ac = override ? { text: override, source: "анотація ac-text у тесті (негативний контроль)" } : acText(acId);
      writeFileSync(
        path.join(agentDir, "ac.md"),
        [
          `# ${acId}`,
          "",
          "## Критерій приймання (дослівно від PM)",
          "",
          ac.text,
          "",
          ...thens.flatMap((t) => [
            `## Кадр frame-then-${t.n}.png — момент «Тоді» (сторінка ${new URL(t.url).pathname})`,
            "",
            "Видимі частини «Тоді», які треба підтвердити цитатою з кадру:",
            ...t.visible.map((v) => `- ${v}`),
            "",
            "Не з кадрів (це перевіряють автоматичні перевірки, ти їх не оцінюєш):",
            ...(t.hidden?.length ? t.hidden.map((h) => `- ${h}`) : ["- —"]),
            "",
          ]),
        ].join("\n"),
      );

      const journey = (result.steps ?? [])
        .filter((s) => /^(Дано|Коли):/.test(s.title))
        .map((s) => `- ${s.title} — ${s.error ? "крок упав" : "виконано"}`);
      writeFileSync(path.join(agentDir, "journey.md"), ["# Що виконав браузер", "", ...journey, ""].join("\n"));

      const runtime = att("runtime-errors.json") ? JSON.parse(body("runtime-errors.json").toString("utf8")) : {};
      const assertions = {
        caseId,
        acId,
        acSource: ac.source,
        negativeControl: test.tags?.includes("@negative-control") || caseId.startsWith("NC-"),
        title: spec.title,
        project: test.projectName,
        status: result.status, // passed | failed | timedOut | interrupted | skipped
        error: stripAnsi(result.error?.message ?? "")
          .split("\n")
          .slice(0, 8)
          .join("\n"),
        steps: (result.steps ?? []).map((s) => ({ title: s.title, ok: !s.error, ms: s.duration })),
        thens: thens.map((t) => ({ n: t.n, url: t.url, clause: t.clause, assertionsPassed: t.assertionsPassed, visible: t.visible, hidden: t.hidden })),
        runtime,
        video: rel(att("video")?.path),
        trace: rel(att("trace")?.path),
        durationMs: result.duration,
        startTime: result.startTime,
      };
      writeFileSync(path.join(privDir, "assertions.json"), JSON.stringify(assertions, null, 2));
      cases.push(dir);
      console.log(`${caseId}: ${result.status}, кадрів «Тоді»: ${thens.length}`);
    }
  }
  return cases;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cases = pack(process.argv[2] ?? RESULTS);
  if (!cases.length) {
    console.error(`У ${process.argv[2] ?? RESULTS} немає тестів з анотацією ac.`);
    process.exitCode = 1;
  }
}
