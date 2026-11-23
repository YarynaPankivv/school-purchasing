import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Дія з postmortem 2026-11-21-supabase-url-typo: розділи runbook, на які спираємось о 2-й ночі, не зникають непомітно.
// Назви тестів без AC ID: це операційна перевірка WS11, а не критерій приймання PM (інакше ac:coverage покаже ORPHAN).
const runbook = readFileSync(join(process.cwd(), "docs", "runbook.md"), "utf8");
const headings = runbook.split(/\r?\n/).filter((line) => /^#{1,3} /.test(line));

describe("docs/runbook.md (дія з postmortem)", () => {
  it.each(["Червоний smoke", "База на паузі", "Відкат", "Відновлення", "Ротація ключів"])(
    "має розділ «%s»",
    (title) => {
      expect(headings.some((line) => line.includes(title))).toBe(true);
    },
  );

  it("у розділі «Червоний smoke» є крок про вибір команди Vercel (без нього вхід у MCP дає 403) і крок «Кому написати й що»", () => {
    expect(runbook).toContain("обираєте команду");
    expect(runbook).toContain("Кому написати й що");
  });

  it("у розділі «База на паузі» названо, як перевірити, що база прокинулась", () => {
    expect(runbook).toContain('`"db":"ok"`');
  });

  it("посилання на incident-message веде на файл у репо PM, а не на корінь репо", () => {
    const links = [...runbook.matchAll(/\]\((https:\/\/github\.com\/[^)]*)\)/g)]
      .map((m) => m[1])
      .filter((url) => url.includes("incident-message") || url.endsWith("2026-quitcode-dream-team"));
    expect(links.length).toBeGreaterThan(0);
    for (const url of links) expect(url).toMatch(/\/blob\/[^/]+\/docs\/incident-message\.md$/);
  });
});
