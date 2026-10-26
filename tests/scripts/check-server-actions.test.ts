// Правило «кожна Server Action сама перевіряє користувача» (ADR 0003): скрипт має ловити порушення, інакше воно
// нічого не охороняє. Без AC PM — це тести самого скрипта; AC, які правило охороняє, — AC-FRM-02, 04, AC-APR-03, 05.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { repoRoot, runScript } from "./run-script";

const roots: string[] = [];
function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "check-actions-"));
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

const guarded = `"use server";
export async function submit(formData: FormData) {
  const { supabase } = await requireActiveUser();
  await supabase.rpc("submit_purchase", {});
}
`;

describe("scripts/check-server-actions.mjs", () => {
  it("passes when every exported action checks the caller first", () => {
    const root = project({ "app/requests/actions.ts": guarded });
    const { code, out } = runScript("check-server-actions.mjs", root);
    expect(out).toContain("OK");
    expect(code).toBe(0);
  });

  it("flags an exported action that writes without checking the caller", () => {
    const root = project({
      "app/requests/actions.ts": `"use server";
export async function submit() {
  const { supabase } = await requireActiveUser();
}
export async function wipe(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("requests").delete().neq("id", "");
}
`,
    });
    const { code, out } = runScript("check-server-actions.mjs", root);
    expect(code).toBe(1);
    expect(out).toContain("wipe: немає перевірки користувача");
    expect(out).not.toContain("submit: немає");
  });

  it("does not accept a guard that is only mentioned in a comment", () => {
    const root = project({
      "app/requests/actions.ts": `"use server";
// await requireActiveUser();
export async function wipe() {
  /* requireAdmin() */
  await createClient();
}
`,
    });
    expect(runScript("check-server-actions.mjs", root).code).toBe(1);
  });

  it("flags getSession() used for authorization and middleware.ts", () => {
    const root = project({
      "lib/auth.ts": "export const user = (await supabase.auth.getSession()).data.session;\n",
      "middleware.ts": "export {};\n",
    });
    const { code, out } = runScript("check-server-actions.mjs", root);
    expect(code).toBe(1);
    expect(out).toContain("getSession()");
    expect(out).toContain("middleware.ts");
  });

  it("exempts the sign-in action, where there is no session yet", () => {
    const root = project({
      "app/login/actions.ts": `"use server";
export async function login(formData: FormData) {
  await supabase.auth.signInWithPassword({ email: "a@example.test", password: "x" });
}
`,
    });
    expect(runScript("check-server-actions.mjs", root).code).toBe(0);
  });

  it("passes on this repository", () => {
    const { code, out } = runScript("check-server-actions.mjs", repoRoot);
    expect(out).toContain("OK");
    expect(code).toBe(0);
  });
});
