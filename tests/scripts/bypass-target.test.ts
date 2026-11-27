import { describe, expect, it } from "vitest";
import { isTrustedBypassTarget } from "../../scripts/lib/bypass-target.mjs";

// Секрет обходу захисту Vercel йде лише на адресу цього проєкту, а не на будь-який *.vercel.app (друга лінія захисту smoke.mjs).
// Назви тестів без AC ID: це операційна перевірка WS11, а не критерій приймання PM (інакше ac:coverage покаже ORPHAN).
const env = { prodUrl: "https://school-purchasing.vercel.app", scope: "team-projects" };

describe("isTrustedBypassTarget (smoke, секрет обходу)", () => {
  it("свої адреси: прод, staging і preview цього проєкту", () => {
    expect(isTrustedBypassTarget("https://school-purchasing.vercel.app", env)).toBe(true);
    expect(isTrustedBypassTarget("https://school-purchasing-git-staging-team-projects.vercel.app", env)).toBe(true);
    expect(isTrustedBypassTarget("https://school-purchasing-ab12cd34-team-projects.vercel.app/login", env)).toBe(true);
  });

  it("чужий *.vercel.app секрет не отримує (раніше достатньо було суфікса .vercel.app)", () => {
    expect(isTrustedBypassTarget("https://other-app.vercel.app", env)).toBe(false);
    expect(isTrustedBypassTarget("https://school-purchasing-git-staging-other-team.vercel.app", env)).toBe(false);
  });

  it("крапки в шаблоні — справжні крапки, а не «будь-який символ», і середня частина не порожня", () => {
    expect(isTrustedBypassTarget("https://school-purchasing-ab12-team-projectsXvercelXapp", env)).toBe(false);
    expect(isTrustedBypassTarget("https://school-purchasing-ab12-team-projects-vercel-app", env)).toBe(false);
    expect(isTrustedBypassTarget("https://school-purchasing--team-projects.vercel.app", env)).toBe(false);
    expect(isTrustedBypassTarget("https://school-purchasing-team-projects.vercel.app", env)).toBe(false);
  });

  it("не https, логін у адресі, керівні символи і хитрі хости відхилено", () => {
    expect(isTrustedBypassTarget("http://school-purchasing.vercel.app", env)).toBe(false);
    expect(isTrustedBypassTarget("https://user:pw@school-purchasing.vercel.app", env)).toBe(false);
    expect(isTrustedBypassTarget("https://school-purchasing.vercel.app\nhttps://evil.example", env)).toBe(false);
    expect(isTrustedBypassTarget("https://school-purchasing.vercel.app.evil.example", env)).toBe(false);
    expect(isTrustedBypassTarget("https://evil.example/school-purchasing.vercel.app", env)).toBe(false);
    expect(isTrustedBypassTarget("not a url", env)).toBe(false);
  });

  it("без PROD_URL відхиляє все, а без VERCEL_SCOPE пускає лише прод-адресу", () => {
    expect(isTrustedBypassTarget("https://school-purchasing.vercel.app", {})).toBe(false);
    expect(isTrustedBypassTarget("https://school-purchasing.vercel.app", { prodUrl: env.prodUrl })).toBe(true);
    expect(isTrustedBypassTarget("https://school-purchasing-git-staging-team-projects.vercel.app", { prodUrl: env.prodUrl })).toBe(false);
  });
});
