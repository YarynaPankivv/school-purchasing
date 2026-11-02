// Крок 3 UAT: підсумковий вердикт рахує КОД, а не агент.
//   R1 перевірка впала                                         → FAIL (агент не може перекрити; його думка — лише для розбору)
//   R2 немає вердикту агента / зламаний JSON / немає кадру     → NEEDS-HUMAN
//   R3 перевірки пройшли, агент каже FAIL чи NEEDS-HUMAN       → NEEDS-HUMAN (розбіжність вирішує людина)
//   R4 агент каже PASS, але його цитати немає в aria-знімку    → NEEDS-HUMAN (цитату не підтверджено)
//   R5 помилки сторінки або відповіді 5xx під час сценарію     → NEEDS-HUMAN
//   R6 перевірки + агент + підтверджені цитати збігаються      → PASS
// Агент — Haiku; якщо була суперечка (review.mjs), рішення агента — за Sonnet, а вердикт Haiku лишається у звіті.
// Використання: node scripts/uat/combine.mjs  → test-results/uat/combined.json
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { HAIKU, SONNET, WORK, caseDirs, quoteInAria, readJson } from "./lib.mjs";

export const RULES = {
  R1: "R1: перевірка впала — FAIL завжди, агент не перекриває",
  R2: "R2: немає вердикту агента або кадру",
  R3: "R3: перевірки пройшли, агент не погоджується — вирішує людина",
  R4: "R4: цитати агента немає на сторінці (aria) — не підтверджено",
  R5: "R5: помилка сторінки або 5xx під час сценарію",
  R6: "R6: перевірки, агент і цитати збігаються",
};
const FACTORY = { PASS: "PASS", FAIL: "FAIL", "NEEDS-HUMAN": "NOT-EARNED" };

function loadReview(dir, model) {
  const file = path.join(dir, `review.${model}.json`);
  return existsSync(file) ? readJson(file) : null;
}

export function combineCase(dir) {
  const a = readJson(path.join(dir, "private", "assertions.json"));
  const haiku = loadReview(dir, HAIKU);
  const sonnet = loadReview(dir, SONNET);
  const final = sonnet ?? haiku; // Sonnet є лише після суперечки
  const v = final?.out?.structured_output ?? null;
  const aria = readdirSync(path.join(dir, "private"))
    .filter((f) => f.startsWith("aria-then-"))
    .map((f) => readFileSync(path.join(dir, "private", f), "utf8"))
    .join("\n");
  const frames = readdirSync(path.join(dir, "agent")).filter((f) => /^frame-then-\d+\.png$/.test(f));

  const quotes = (v?.then_parts ?? [])
    .filter((p) => p.observable === "visible" && p.status === "met")
    .flatMap((p) => p.quoted_text.split(";").map((q) => q.trim()).filter(Boolean))
    .map((q) => ({ quote: q, onPage: quoteInAria(q, aria) }));
  const runtimeBad =
    (a.runtime?.pageErrors?.length ?? 0) > 0 || (a.runtime?.failed ?? []).some((f) => / → 5\d\d$/.test(f));

  let verdict;
  let rule;
  if (a.status !== "passed") [verdict, rule] = ["FAIL", "R1"];
  else if (!v || !frames.length) [verdict, rule] = ["NEEDS-HUMAN", "R2"];
  else if (v.verdict !== "PASS") [verdict, rule] = ["NEEDS-HUMAN", "R3"];
  else if (!quotes.length || quotes.some((q) => !q.onPage)) [verdict, rule] = ["NEEDS-HUMAN", "R4"];
  else if (runtimeBad) [verdict, rule] = ["NEEDS-HUMAN", "R5"];
  else [verdict, rule] = ["PASS", "R6"];

  const cost = (r) => r?.out?.total_cost_usd ?? 0;
  return {
    caseId: a.caseId,
    acId: a.acId,
    negativeControl: a.negativeControl,
    assertions: a,
    agent: v,
    agentModel: final?.model ?? null,
    agentVerdicts: { [HAIKU]: haiku?.out?.structured_output?.verdict ?? null, [SONNET]: sonnet?.out?.structured_output?.verdict ?? null },
    escalated: Boolean(sonnet),
    quotes,
    frames,
    verdict,
    rule,
    ruleText: RULES[rule],
    factoryGate: FACTORY[verdict],
    review: {
      costUsd: Number((cost(haiku) + cost(sonnet)).toFixed(5)),
      wallMs: (haiku?.wallMs ?? 0) + (sonnet?.wallMs ?? 0),
      turns: (haiku?.out?.num_turns ?? 0) + (sonnet?.out?.num_turns ?? 0),
    },
  };
}

export function combine() {
  const rows = caseDirs().map(combineCase);
  writeFileSync(path.join(WORK, "combined.json"), JSON.stringify(rows, null, 2));
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const r of combine()) console.log(`${r.caseId}: ${r.verdict} (${r.ruleText})`);
}
