import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { fixtures, runScript } from "./run-script";

// Кожен випадок — tests/fixtures/migration-order/<випадок>/{main,pr}. Тест збирає тимчасовий git-репозиторій:
// коміт «main» → ref origin/main (як після fetch у CI) → гілка PR із файлами «pr» у робочій теці.
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.test", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

const temps: string[] = [];

function repo(name: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), `migration-order-${name}-`));
  temps.push(dir);
  const src = path.join(fixtures, "migration-order", name);
  git(dir, "init", "-q", "-b", "main");
  // Необов'язкова тека point: точка відгалуження PR; потім main іде далі (гілка відстає від main).
  const hasPoint = existsSync(path.join(src, "point"));
  cpSync(path.join(src, hasPoint ? "point" : "main"), dir, { recursive: true });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", hasPoint ? "branch point" : "main");
  git(dir, "branch", "task/1-demo");
  if (hasPoint) {
    rmSync(path.join(dir, "supabase"), { recursive: true, force: true });
    cpSync(path.join(src, "main"), dir, { recursive: true });
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "main");
  }
  git(dir, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(dir, "switch", "-q", "task/1-demo");
  rmSync(path.join(dir, "supabase"), { recursive: true, force: true });
  if (existsSync(path.join(src, "pr", "supabase"))) {
    cpSync(path.join(src, "pr", "supabase"), path.join(dir, "supabase"), { recursive: true });
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "pr");
  return dir;
}

const run = (name: string, env: Record<string, string> = {}) =>
  runScript("check-migration-order.mjs", repo(name), { MIGRATION_BASE: "", ...env });

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe("scripts/check-migration-order.mjs", () => {
  it("passes when the PR migration is newer than the newest on main", () => {
    const { code, out } = run("newer");
    expect(code).toBe(0);
    expect(out).toContain("migration-order — OK: нових міграцій 1, усі новіші за 20261014090000");
  });

  it("fails when the PR migration is older than the newest on main and suggests a rename", () => {
    const { code, out } = run("older");
    expect(code).toBe(1);
    expect(out).toContain("OLDER     supabase/migrations/20261013120000_blocked_days.sql");
    expect(out).toContain("20261014090000_leave_requests.sql уже в origin/main");
    expect(out).toMatch(/git mv supabase\/migrations\/20261013120000_blocked_days\.sql supabase\/migrations\/\d{14}_blocked_days\.sql/);
  });

  it("fails on a timestamp equal to the newest on main (older-or-equal and duplicate)", () => {
    const { code, out } = run("equal");
    expect(code).toBe(1);
    expect(out).toContain("OLDER     supabase/migrations/20261014090000_blocked_days.sql");
    expect(out).toContain("DUPLICATE");
  });

  it("fails when an applied migration is edited", () => {
    const { code, out } = run("changed");
    expect(code).toBe(1);
    expect(out).toContain("CHANGED   supabase/migrations/20261014090000_leave_requests.sql");
  });

  it("fails when an applied migration is deleted", () => {
    const { code, out } = run("deleted");
    expect(code).toBe(1);
    expect(out).toContain("DELETED   supabase/migrations/20261014090000_leave_requests.sql");
    expect(out).not.toContain("OLDER");
  });

  it("allows the recovery rename of a merged-but-unapplied migration to a newer timestamp (same SQL)", () => {
    const { code, out } = run("renamed");
    expect(code).toBe(0);
    expect(out).toContain(
      "RENAMED supabase/migrations/20261014090000_leave_requests.sql → 20261016080000_leave_requests.sql",
    );
    expect(out).not.toContain("DELETED");
  });

  it("still fails DELETED when the renamed migration's SQL was changed", () => {
    const { code, out } = run("renamed-edited");
    expect(code).toBe(1);
    expect(out).toContain("DELETED   supabase/migrations/20261014090000_leave_requests.sql");
    expect(out).not.toContain("RENAMED");
  });

  it("fails DELETED when the newest (already applied) migration on main is renamed", () => {
    const { code, out } = run("renamed-newest");
    expect(code).toBe(1);
    expect(out).toContain("DELETED   supabase/migrations/20261015100000_blocked_days.sql");
    expect(out).not.toContain("RENAMED");
  });

  it("fails on a file name the Supabase CLI would skip", () => {
    const { code, out } = run("bad-name");
    expect(code).toBe(1);
    expect(out).toContain("NAME      supabase/migrations/blocked_days.sql");
  });

  it("passes when the PR adds no migrations", () => {
    const { code, out } = run("no-new");
    expect(code).toBe(0);
    expect(out).toContain("нових міграцій 0");
  });

  it("passes when main has no migrations yet", () => {
    const { code, out } = run("empty-main");
    expect(code).toBe(0);
    expect(out).toContain("нових міграцій 1");
  });

  it("does not report main's newer migrations as deleted when the branch is behind main", () => {
    const { code, out } = run("behind-ok");
    expect(code).toBe(0);
    expect(out).toContain("нових міграцій 1");
    expect(out).toContain("Примітка: гілка відстає від origin/main (ще не злиті: 20261014090000_leave_requests.sql)");
  });

  it("still fails OLDER (and only OLDER) for a branch behind main", () => {
    const { code, out } = run("behind-older");
    expect(code).toBe(1);
    expect(out).toContain("OLDER     supabase/migrations/20261013120000_blocked_days.sql");
    expect(out).not.toContain("DELETED");
    expect(out).not.toContain("CHANGED / DELETED");
  });

  it("fails with a fetch hint when the base branch is missing", () => {
    const { code, out } = run("newer", { MIGRATION_BASE: "origin/release" });
    expect(code).toBe(1);
    expect(out).toContain("базової гілки origin/release не знайдено");
    expect(out).toContain("git fetch origin release");
  });
});
