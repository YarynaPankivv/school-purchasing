#!/usr/bin/env node
// npm run ac:coverage — наскрізне покриття критеріїв приймання (AC):
//   вимоги PM (requirements/**) → ваша специфікація (openspec/specs/**) → рядок матриці (docs/conformance.md) →
//   тест (назва test()/it() у файлах *.test.ts(x) з src/** або tests/** — інші файли Vitest не запускає; AC ID — на
//   початку назви).
// FAIL, якщо:
//   NO-ROW     — AC є в специфікаціях, але в docs/conformance.md немає рядка (типово — PR «Специфікація» без рядків
//                нових AC, див. /conformance, або рядок випадково видалено);
//   MISSING    — рядок має статус «реалізовано», але немає непропущеного тесту, назва якого починається з цього ID
//                (закоментовані тести, .skip/.todo/.fails/.skipIf, тести без функції тесту і тести всередині
//                describe.skip не рахуються; it.each / test.for / .concurrent / .runIf — рахуються);
//   ORPHAN     — тест посилається на AC, якого немає в специфікаціях (AC прибрано зі специфікації, або вимогу PM ще не
//                перекладено в неї);
//   BAD-STATUS — статус рядка не рівно «реалізовано» і не «відкладено (причина)»
//                («реалізовано частково» — теж BAD-STATUS: або реалізовано повністю, або відкладено з причиною);
//   WRONG-REF  — у рядку «реалізовано» шлях із колонок «Код»/«Тест» (`src/…`, `tests/…`, `supabase/…`; `:12` у кінці
//                можна) не існує або тест із цим AC лежить в іншому файлі.
// Попередження (не валить): AC з вимог PM (requirements/**, рядок починається з ID), якого ще немає в
// openspec/specs/** — «вимогу PM ще не перекладено в специфікацію» (після /requirements-sync це нормально, доки не
// злито PR «Специфікація»); рядок матриці для AC, якого вже немає в специфікаціях; дублікати рядків.
// Секції «## REMOVED Requirements» ігноруються. Скрипт перевіряє НАЯВНІСТЬ тесту, а не те, що він зелений:
// це робить `npm test` (vitest.config.mts вимагає хоча б одну перевірку expect у кожному тесті).
import { existsSync } from "node:fs";
import path from "node:path";
import {
  collectRequirementAcs,
  collectSpecAcs,
  isDeferred,
  isImplemented,
  parseConformance,
  printList,
  root,
} from "./lib/spec-lib.mjs";
import { collectTestRefs } from "./lib/test-titles.mjs";

const specAcs = collectSpecAcs();
const requirementAcs = collectRequirementAcs();
const { exists: matrixExists, rows } = parseConformance();
const testRefs = collectTestRefs();

const rowsById = new Map();
for (const row of rows) {
  if (!rowsById.has(row.id)) rowsById.set(row.id, []);
  rowsById.get(row.id).push(row);
}

const noRow = [];
const missing = [];
const orphan = [];
const badStatus = [];
const wrongRef = [];
// Шляхи в бектиках із колонок «Код»/«Тест»: лише `src/…`, `tests/…`, `supabase/…`; номер рядка (`:12`, `#L12`)
// відкидаємо, а `public.profiles` чи назви функцій — не шляхи.
const paths = (cell) =>
  [...(cell ?? "").matchAll(/`([^`]+)`/g)]
    .map((m) => m[1].trim().replace(/(?::\d+(?:-\d+)?|#L\d+(?:-L?\d+)?)$/, ""))
    .filter((x) => /^(?:src|tests|supabase)\//.test(x));
const staleRows = [];
const duplicateRows = [];

for (const [id, places] of specAcs) {
  if (!rowsById.has(id)) noRow.push(`${id} (${places[0].file}:${places[0].line})`);
}

for (const [id, list] of rowsById) {
  if (list.length > 1) duplicateRows.push(`${id} — рядки ${list.map((r) => r.line).join(", ")}`);
  if (!specAcs.has(id)) staleRows.push(`${id} — docs/conformance.md:${list[0].line}`);
  for (const row of list) {
    if (isImplemented(row.status)) {
      const covered = (testRefs.get(id) ?? []).some((t) => t.counted);
      const [, , code, test] = row.cells;
      for (const f of [...paths(code), ...paths(test)]) {
        if (!existsSync(path.join(root(), f))) wrongRef.push(`${id} — docs/conformance.md:${row.line}: файлу \`${f}\` немає`);
      }
      const listed = paths(test);
      if (covered && listed.length && !(testRefs.get(id) ?? []).some((t) => t.counted && listed.includes(t.file))) {
        wrongRef.push(`${id} — docs/conformance.md:${row.line}: у файлах колонки «Тест» немає тесту з «${id}» на початку назви`);
      }
      if (!covered) {
        const skipped = (testRefs.get(id) ?? []).filter((t) => !t.counted);
        const hint = skipped.length
          ? ` (є лише пропущені: ${skipped.map((t) => `${t.file}:${t.line}`).join(", ")})`
          : " (перевірте, чи AC ID у назві тесту набрано латиницею)";
        missing.push(`${id} — статус «реалізовано», але тесту з «${id}» на початку назви немає${hint}`);
      }
    } else if (!isDeferred(row.status)) {
      badStatus.push(`${id} — docs/conformance.md:${row.line}: «${row.status}» (дозволено: реалізовано / відкладено (причина))`);
    }
  }
}

for (const [id, list] of testRefs) {
  if (!specAcs.has(id)) orphan.push(`${id} — ${list.map((t) => `${t.file}:${t.line}`).join(", ")}`);
}

const notTranslated = [];
for (const [id, places] of requirementAcs) {
  if (!specAcs.has(id)) {
    notTranslated.push(`вимогу PM ще не перекладено в специфікацію: ${id} (${places[0].file}:${places[0].line})`);
  }
}

const implemented = rows.filter((r) => isImplemented(r.status)).length;
console.log(
  `ac:coverage — AC у вимогах PM (requirements/): ${requirementAcs.size}, AC у специфікаціях: ${specAcs.size}, ` +
    `рядків у матриці: ${rows.length}${matrixExists ? "" : " (docs/conformance.md не знайдено)"}, ` +
    `«реалізовано»: ${implemented}, AC у назвах тестів: ${testRefs.size}`,
);
printList("NO-ROW: AC зі специфікації без рядка в docs/conformance.md", noRow);
printList("MISSING: «реалізовано» без тесту з AC ID у назві (рахуються лише файли *.test.ts / *.test.tsx)", missing);
printList("ORPHAN: тест посилається на AC, якого немає в специфікаціях", orphan);
printList("BAD-STATUS: невідомий статус у матриці", badStatus);
printList("WRONG-REF: колонки «Код» / «Тест» не відповідають репозиторію", wrongRef);
printList(
  "WARN не перекладено: AC з вимог PM (requirements/), якого немає в openspec/specs — зміна специфікації (PR «Специфікація»)",
  notTranslated,
);
printList("WARN stale: рядок матриці для AC, якого немає в специфікаціях", staleRows);
printList("WARN duplicate: кілька рядків для одного AC", duplicateRows);

const failures = noRow.length + missing.length + orphan.length + badStatus.length + wrongRef.length;
if (failures) {
  console.log(`\nFAIL: проблем — ${failures}. Оновіть docs/conformance.md і тести.`);
  process.exit(1);
}
if (specAcs.size) console.log("OK");
else if (requirementAcs.size) console.log("OK (вимоги PM є, специфікації ще немає — перекладіть їх: PR «Специфікація»)");
else console.log("OK (специфікацій ще немає — порожній шаблон)");
