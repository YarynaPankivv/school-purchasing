// Назви тестів test()/it() з файлів коду — через синтаксичне дерево TypeScript (devDependency `typescript`),
// а не регулярним виразом по тексту. Тому:
//   - закоментовані тести (`// it("AC-…")`, `/* … */`) не рахуються;
//   - `//` чи `/*` всередині рядка назви не ламають розбір;
//   - ланцюжки модифікаторів розпізнаються будь-якої довжини: it.each([...])("…"), test.concurrent.each(...)("…"),
//     test.for(...)("…"), it.runIf(cond)("…"), test.only(...).
// Пропущений тест (counted = false): у ланцюжку є skip / todo / fixme / fails / fail (Playwright) / skipIf,
// тест лежить усередині describe.skip / describe.todo / describe.skipIf (Vitest і Playwright)
// або в нього немає функції тесту: it("AC-…") без тіла Vitest вважає todo.
// AC ID рахується лише НА ПОЧАТКУ назви test()/it() (не в describe і не в середині назви) і лише у файлах,
// які запускає `npm test` (див. isRunByNpmTest).
// Не тест (ігнорується): describe(…), test.step(…), test.extend(…), test.use(…), хуки beforeEach тощо.
import { createRequire } from "node:module";
import path from "node:path";
import { AC_ID_AT_START, readText, rel, root, walk } from "./spec-lib.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const TEST_ROOTS = new Set(["it", "test"]);
const SKIP_MODIFIERS = new Set(["skip", "todo", "fixme", "fails", "fail", "skipIf"]);
const NOT_A_TEST = new Set([
  "describe",
  "step",
  "extend",
  "use",
  "beforeEach",
  "afterEach",
  "beforeAll",
  "afterAll",
  "info",
  "setTimeout",
  "slow",
]);

function scriptKind(file) {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.[cm]?ts$/.test(file)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

// callee виклику → { root: "it" | "test" | "describe" | …, names: [модифікатори] } або null.
// it.each([...])("…"): callee — виклик it.each([...]), тож ідемо через CallExpression до кореня.
function calleeChain(expr) {
  const names = [];
  let node = expr;
  for (;;) {
    if (ts.isCallExpression(node)) node = node.expression;
    else if (ts.isPropertyAccessExpression(node)) {
      names.unshift(node.name.text);
      node = node.expression;
    } else if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
    else if (ts.isIdentifier(node)) return { root: node.text, names };
    else return null;
  }
}

function titleText(arg, sf) {
  if (!arg) return null;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  if (ts.isTemplateExpression(arg)) return arg.getText(sf).slice(1, -1);
  return null;
}

export function parseTestTitles(file) {
  const sf = ts.createSourceFile(file, readText(file), ts.ScriptTarget.Latest, true, scriptKind(file));
  const titles = [];

  const visit = (node, skippedScope) => {
    let childScope = skippedScope;
    if (ts.isCallExpression(node)) {
      const chain = calleeChain(node.expression);
      const title = titleText(node.arguments[0], sf);
      if (chain && title !== null) {
        const all = [chain.root, ...chain.names];
        const skipped = chain.names.some((n) => SKIP_MODIFIERS.has(n));
        const isDescribe = all.includes("describe");
        if (isDescribe) {
          // describe.skip / test.describe.skip: усе всередині не запускається.
          if (skipped) childScope = true;
        } else if (TEST_ROOTS.has(chain.root) && !chain.names.some((n) => NOT_A_TEST.has(n))) {
          const line = sf.getLineAndCharacterOfPosition(node.arguments[0].getStart(sf)).line + 1;
          // it("AC-…") без функції тесту Vitest вважає todo — не покриття.
          const hasBody = node.arguments.length >= 2;
          titles.push({
            title,
            counted: !skipped && !skippedScope && hasBody,
            modifier: chain.names.join(".") || undefined,
            line,
          });
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, childScope));
  };

  visit(sf, false);
  return titles;
}

// Рахуємо лише файли, які запускає `npm test` (Vitest, include у vitest.config.mts):
// src/**/*.test.{ts,tsx} і tests/**/*.test.{ts,tsx}. Тест у *.spec.ts, *.test.js, helpers.ts чи будь-якому іншому
// файлі CI не виконує, тож AC він не покриває. Додаєте e2e (Playwright) — розширюйте цей фільтр РАЗОМ із кроком CI.
export const isRunByNpmTest = (r) => /^(?:src|tests)\/(?:.+\/)?[^/]+\.test\.tsx?$/.test(r);
export const skipNonSource = (r) =>
  /(^|\/)(node_modules|\.next|\.git|coverage|dist|build)(\/|$)/.test(r) || /^tests\/fixtures(\/|$)/.test(r);

// AC ID на початку назв тестів із src/**/*.test.ts(x) і tests/**/*.test.ts(x) → [{file, line, title, counted}].
export function collectTestRefs(dirs = ["src", "tests"]) {
  const refs = new Map();
  for (const d of dirs) {
    for (const file of walk(path.join(root(), d), { skip: skipNonSource, filter: isRunByNpmTest })) {
      for (const t of parseTestTitles(file)) {
        for (const id of t.title.match(AC_ID_AT_START) ?? []) {
          if (!refs.has(id)) refs.set(id, []);
          refs.get(id).push({ file: rel(file), line: t.line, title: t.title, counted: t.counted });
        }
      }
    }
  }
  return refs;
}
