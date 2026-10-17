import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtures, runScript } from "./run-script";

const dir = (name: string) => path.join(fixtures, "check-spec", name);
const run = (name: string, env?: Record<string, string>) => runScript("check-spec.mjs", dir(name), env);

describe("scripts/check-spec.mjs", () => {
  it("passes valid specs, ignores archived changes and allows MODIFIED/RENAMED to reuse canonical IDs", () => {
    const { code, out } = run("valid");
    expect(out).toContain("OK");
    expect(code).toBe(0);
  });

  it("fails when a scenario title does not start with a valid ID", () => {
    const { code, out } = run("bad-title");
    expect(code).toBe(1);
    expect(out).toContain("BAD-TITLE");
    expect(out).toContain("Працівник подає заявку");
    expect(out).toContain("lowercase id");
  });

  it("fails on a scenario heading with three hashes", () => {
    const { code, out } = run("bad-level");
    expect(code).toBe(1);
    expect(out).toContain("BAD-LEVEL");
  });

  it("fails when an ID repeats across canonical specs", () => {
    const { code, out } = run("duplicate");
    expect(code).toBe(1);
    expect(out).toContain("DUPLICATE");
  });

  it("fails when an active change would duplicate an AC ID after archive", () => {
    const { code, out } = run("change-duplicate");
    expect(code).toBe(1);
    expect(out).toContain("DUPLICATE-CHANGE");
    // той самий ID двічі в зміні; ADDED з ID чужої канонічної вимоги; той самий новий ID у двох змінах
    expect(out).toMatch(/AC-LEAVE-11 — після archive зміни clarify/);
    expect(out).toMatch(/AC-LEAVE-04 — після archive зміни clarify/);
    expect(out).toMatch(/AC-LEAVE-12 — новий ID вводять кілька активних змін: clarify .*, other/);
    // MODIFIED повторює свій канонічний ID; зміна move переносить сценарій і видаляє стару вимогу — не дубль
    expect(out).not.toContain("AC-LEAVE-01");
    expect(out).not.toContain("зміни move");
    expect(out).toContain("помилок — 3");
  });

  it("fails on a denylisted word regardless of case and catches inflected forms by prefix", () => {
    const { code, out } = run("denylist");
    expect(code).toBe(1);
    expect(out).toContain("openspec/specs/leave/spec.md:3");
    // «Нортвінд» у denylist.txt ловить «Нортвінду» у тексті знімка вимог PM (requirements/)
    expect(out).toContain('requirements/product.md:3 — "Нортвінд"');
    expect(out).not.toContain("product/denylist.txt");
  });

  it("reads extra words from SPEC_DENYLIST without printing them", () => {
    const { code, out } = run("denylist", { SPEC_DENYLIST: "Fabrikam,Northwind" });
    expect(code).toBe(1);
    expect(out).toContain("requirements/7-leave-request.md:3 — слово #1 із SPEC_DENYLIST");
    expect(out).not.toContain("Fabrikam");
  });

  it("reads words from the local product/denylist.local.txt without printing them", () => {
    const { code, out } = run("denylist-local");
    expect(code).toBe(1);
    // «Тейлспін» з локального файлу ловить «Тейлспіну»; значення не друкуємо
    expect(out).toContain("requirements/product.md:3 — слово #2 із product/denylist.local.txt");
    expect(out).toContain("requirements/7-leave-request.md:3 — слово #1 із product/denylist.local.txt");
    expect(out).not.toMatch(/Woodgrove|Тейлспін/);
    // сам локальний файл не сканується, публічний список працює як раніше
    expect(out).not.toContain("product/denylist.local.txt:");
    expect(out).toContain("слів у denylist: 3");
  });

  it("catches a phrase wrapped across lines, look-alike letters, soft hyphens, &nbsp; and names outside requirements/openspec", () => {
    const { code, out } = run("denylist-wide");
    expect(code).toBe(1);
    expect(out).toContain('requirements/product.md:3 — "Wide World Importers"');
    expect(out).toContain('requirements/product.md:5 — "Нортвінд"');
    expect(out).toContain('requirements/7-leave-request.md:3 — "Нортвінд"');
    expect(out).toContain('requirements/7-leave-request.md:4 — "Wide World Importers"');
    expect(out).toContain('docs/spec-reading.md:3 — "Нортвінд"');
    expect(out).toContain('supabase/seed.sql:2 — "Wide World Importers"');
    expect(out).toContain('supabase/demo-users.json:2 — "Нортвінд"');
    expect(out).toContain('supabase/config.toml:2 — "Wide World Importers"');
    expect(out).toContain('src/lib/names.ts:1 — "Нортвінд"');
    expect(out).toContain('README.md:3 — "Wide World Importers"');
    expect(out).toContain('AGENTS.md:3 — "Нортвінд"');
    expect(out).toContain("помилок — 11");
    // тести самих скриптів, lock-файли й службова тека Supabase CLI (supabase/.temp) не скануються
    expect(out).not.toContain("tests/scripts/");
    expect(out).not.toContain("package-lock.json");
    expect(out).not.toContain("supabase/.temp");
  });

  it("reports a stray local denylist such as denylist.local.txt.txt", () => {
    const { code, out } = run("stray");
    expect(code).toBe(1);
    expect(out).toContain("STRAY-DENYLIST");
    expect(out).toContain("product/denylist.local.txt.txt");
    expect(out).not.toContain("SecretName");
  });

  it("requires proposal.md with all sections in order in spec changes; impl plans with skip_specs are exempt", () => {
    const { code, out } = run("proposal");
    expect(code).toBe(1);
    expect(out).toContain("openspec/changes/no-proposal — бракує proposal.md");
    expect(out).toContain("openspec/changes/wrong-order — бракує розділу «Assumptions»");
    expect(out).not.toContain("impl-demo");
    expect(out).not.toContain("impl-commented");
    expect(out).not.toContain("archive/2026-10-09-add-demo");
    expect(out).toContain("помилок — 2");
  });

  it("explains near-miss AC IDs (Cyrillic look-alike letters, three digits)", () => {
    const { out } = run("bad-title");
    expect(out).toMatch(/AC-LЕAVE-02 cyrillic letter inside.*схоже на AC ID/);
    expect(out).toMatch(/AC-LEAVE-100 three digits.*схоже на AC ID/);
    expect(out).not.toMatch(/Працівник подає заявку.*схоже на AC ID/);
  });

  it("passes in a directory without openspec/", () => {
    const { code } = runScript("check-spec.mjs", path.join(fixtures, "ac-coverage", "empty"));
    expect(code).toBe(0);
  });
});
