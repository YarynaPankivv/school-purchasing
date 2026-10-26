// Перевірки дизайн-системи й меж сервера: правила, які посилено за рев'ю (вирази в style, виняток лише з причиною,
// імпорт admin-клієнта через кілька рядків). Без AC PM — це тести самих скриптів.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runScript } from "./run-script";

const roots: string[] = [];
function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "check-"));
  roots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, "src", name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("scripts/check-design-tokens.mjs", () => {
  it("flags a colour given as an expression in style, not only as a string", () => {
    const root = project({ "app/page.tsx": "export const a = <div style={{ color: statusColor }} />;\n" });
    const { code, out } = runScript("check-design-tokens.mjs", root);
    expect(code).toBe(1);
    expect(out).toContain("inline-style-color");
  });

  it("allows only var(--token) inside style", () => {
    const root = project({ "app/page.tsx": 'export const a = <div style={{ color: "var(--primary)" }} />;\n' });
    expect(runScript("check-design-tokens.mjs", root).code).toBe(0);
  });

  it("scans src/components/ui too", () => {
    const root = project({ "components/ui/x.tsx": 'export const a = <div className="bg-white" />;\n' });
    const { code, out } = runScript("check-design-tokens.mjs", root);
    expect(code).toBe(1);
    expect(out).toContain("components/ui/x.tsx");
  });

  it("accepts design-ok only as a comment with a reason", () => {
    const withReason = project({ "app/a.tsx": 'export const a = <div className="bg-white" />; // design-ok: внутрішня емблема\n' });
    expect(runScript("check-design-tokens.mjs", withReason).code).toBe(0);
    const noReason = project({ "app/a.tsx": 'export const a = <div className="bg-white" />; // design-ok:\n' });
    expect(runScript("check-design-tokens.mjs", noReason).code).toBe(1);
    const inString = project({ "app/a.tsx": 'export const a = <div className="bg-white" title="design-ok: x" />;\n' });
    expect(runScript("check-design-tokens.mjs", inString).code).toBe(1);
  });
});

describe("scripts/check-server-boundary.mjs", () => {
  const ADMIN = 'import "server-only";\nexport const admin = {};\n';

  it("finds an admin client import split over several lines in a non-server file", () => {
    const root = project({
      "lib/supabase/admin.ts": ADMIN,
      "lib/helper.ts": 'import {\n  admin,\n}\n  from "@/lib/supabase/admin";\nexport const x = admin;\n',
    });
    const { code, out } = runScript("check-server-boundary.mjs", root);
    expect(code).toBe(1);
    expect(out).toContain("lib/helper.ts:4");
  });

  it("allows the same import in actions.ts", () => {
    const root = project({
      "lib/supabase/admin.ts": ADMIN,
      "app/actions.ts": 'import {\n  admin,\n}\n  from "@/lib/supabase/admin";\nexport const x = admin;\n',
    });
    expect(runScript("check-server-boundary.mjs", root).code).toBe(0);
  });
});
