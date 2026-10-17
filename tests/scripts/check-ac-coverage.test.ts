import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtures, runScript } from "./run-script";

const run = (name: string) => runScript("check-ac-coverage.mjs", path.join(fixtures, "ac-coverage", name));

describe("scripts/check-ac-coverage.mjs", () => {
  it("passes when every implemented row has a test and REMOVED/commented rows are ignored", () => {
    const { code, out } = run("ok");
    expect(out).toContain("AC у специфікаціях: 2");
    expect(out).toContain("рядків у матриці: 2");
    expect(code).toBe(0);
  });

  it("reports NO-ROW when the spec has an AC without a matrix row", () => {
    const { code, out } = run("no-row");
    expect(code).toBe(1);
    expect(out).toContain("NO-ROW");
    expect(out).toMatch(/AC-DEMO-02 \(openspec\/specs\/leave\/spec\.md:\d+\)/);
  });

  it("reports MISSING when an implemented row only has skipped or todo tests", () => {
    const { code, out } = run("missing-test");
    expect(code).toBe(1);
    expect(out).toContain("MISSING");
    expect(out).toContain("AC-DEMO-02");
    expect(out).not.toMatch(/MISSING[\s\S]*AC-DEMO-01/);
  });

  it("does not count tests in files Vitest never runs (*.spec.ts, plain .ts)", () => {
    const { code, out } = run("not-run");
    expect(code).toBe(1);
    expect(out).toContain("MISSING");
    expect(out).toContain("AC-DEMO-01");
  });

  it("does not count a test without a body (Vitest treats it as todo)", () => {
    const { code, out } = run("no-body");
    expect(code).toBe(1);
    expect(out).toContain("MISSING");
    expect(out).toContain("AC-DEMO-01");
  });

  it("reports WRONG-REF for a missing file in «Код»/«Тест» and for a test that lives in another file", () => {
    const { code, out } = run("wrong-ref");
    expect(code).toBe(1);
    expect(out).toContain("WRONG-REF");
    expect(out).toContain("src/nope.ts");
    expect(out).toMatch(/AC-DEMO-02 — docs\/conformance\.md:\d+: у файлах колонки «Тест»/);
    expect(out).not.toContain("MISSING");
  });

  it("accepts a line number and non-path backticks in the «Код» cell", () => {
    const { code, out } = run("ok");
    expect(code).toBe(0);
    expect(out).not.toContain("WRONG-REF");
  });

  it("reports ORPHAN when a test names an AC that the spec lacks", () => {
    const { code, out } = run("orphan");
    expect(code).toBe(1);
    expect(out).toContain("ORPHAN");
    expect(out).toContain("AC-DEMO-42");
  });

  it("ignores commented-out tests, test.fail and skipped describe blocks but counts .each, .for, .concurrent and .runIf", () => {
    const { code, out } = run("test-forms");
    expect(code).toBe(1);
    const missing = out.slice(out.indexOf("MISSING"), out.indexOf("FAIL"));
    // Закоментовані (// і /* */) — тесту немає взагалі; describe.skip — «є лише пропущені».
    expect(missing).toContain("AC-DEMO-01");
    expect(missing).toContain("AC-DEMO-02");
    expect(missing).toMatch(/AC-DEMO-08 .*є лише пропущені/);
    // Playwright test.fail(title, …) очікувано падає — не покриття.
    expect(missing).toMatch(/AC-DEMO-09 .*є лише пропущені/);
    // `//` і `/*` усередині назви не ламають розбір; .each/.for/.concurrent.each/.runIf і «Реалізовано» з великої — рахуються.
    for (const id of ["AC-DEMO-03", "AC-DEMO-04", "AC-DEMO-05", "AC-DEMO-06", "AC-DEMO-07"]) {
      expect(missing).not.toContain(id);
    }
    expect(out).not.toContain("ORPHAN");
    expect(out).toContain("проблем — 4");
  });

  it("reports BAD-STATUS for unknown statuses, deferrals without a reason and «Реалізовано частково»", () => {
    const { code, out } = run("bad-status");
    expect(code).toBe(1);
    expect(out).toContain("BAD-STATUS");
    expect(out).toContain("готово");
    expect(out).toContain("«Реалізовано частково»");
    // Багаторядковий HTML-коментар над таблицею не зсуває номер рядка.
    expect(out).toContain("AC-DEMO-01 — docs/conformance.md:10:");
    expect(out).not.toContain("MISSING");
  });

  it("accepts the rows a «Специфікація» PR adds for new AC: «відкладено (чекає реалізації)»", () => {
    const { code, out } = run("new-ac");
    expect(out).toContain("рядків у матриці: 2");
    expect(code).toBe(0);
  });

  it("warns (exit 0) about PM acceptance criteria in requirements/ that the spec does not have yet", () => {
    const { code, out } = run("not-translated");
    expect(code).toBe(0);
    expect(out).toContain("AC у вимогах PM (requirements/): 3");
    const warn = out.slice(out.indexOf("WARN не перекладено"));
    // Рядок, що починається з ID (зокрема в блоці ``` поля issue-форми), — визначення AC; його немає в openspec/specs.
    expect(warn).toMatch(/вимогу PM ще не перекладено в специфікацію: AC-DEMO-03 \(requirements\/7-leave-request\.md:\d+\)/);
    // Перекладені AC, згадка посеред рядка, HTML-коментар, README.md, «Відкриті питання» й «Журнал змін» — без попередження.
    for (const id of ["AC-DEMO-01", "AC-DEMO-02", "AC-DEMO-04", "AC-DEMO-05", "AC-DEMO-06", "AC-DEMO-08", "AC-DEMO-09"]) {
      expect(warn).not.toContain(id);
    }
    expect(out).not.toContain("FAIL");
  });

  it("does not warn when requirements/ is absent or every PM AC is in the spec", () => {
    expect(run("ok").out).not.toContain("WARN не перекладено");
    expect(run("new-ac").out).toContain("AC у вимогах PM (requirements/): 0");
  });

  it("passes on an empty template", () => {
    const { code, out } = run("empty");
    expect(code).toBe(0);
    expect(out).toContain("порожній шаблон");
  });
});
