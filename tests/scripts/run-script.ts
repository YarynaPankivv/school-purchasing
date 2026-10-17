import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
export const fixtures = path.join(repoRoot, "tests", "fixtures");

// Запускає scripts/<name> з робочою текою cwd (скрипти беруть корінь проєкту з process.cwd()).
export function runScript(name: string, cwd: string, env: Record<string, string | undefined> = {}) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", name)], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SPEC_DENYLIST: "", ...env },
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}
