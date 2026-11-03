// Читання профілів колегами на справжній базі (PGlite): AC-ORG-16 (вибір особи «від імені» — лише активні колеги) без
// витоку role, email і is_active. Прямий запит до public.profiles віддає лише власний рядок, а довідник
// colleague_directory() — лише (user_id, label, is_admin) активних колег зі спільного відділу.
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let worker: string; // заявник Primary School
let colleague: string; // активний колега з іменем
let nameless: string; // активний колега без імені в профілі (підпис — email)
let sleeper: string; // деактивований колега
let outsider: string; // інший відділ
let boss: string; // адміністратор, заявник Primary School

beforeAll(async () => {
  t = await createPurchasingDb();
  worker = await t.addUser("worker@example.test", { fullName: "Worker Demo" });
  colleague = await t.addUser("colleague@example.test", { fullName: "Colleague Demo" });
  nameless = await t.addUser("nameless@example.test", { fullName: null });
  sleeper = await t.addUser("sleeper@example.test", { fullName: "Sleeper Demo" });
  outsider = await t.addUser("outsider@example.test", { fullName: "Outsider Demo" });
  boss = await t.addUser("boss@example.test", { fullName: "Boss Admin", admin: true });
  for (const user of [worker, colleague, nameless, sleeper, boss]) await t.addMember("Primary School", user);
  await t.addMember("Upper School", outsider);
  await t.asService("update public.profiles set is_active = false where id = $1", [sleeper]);
}, 120_000);

const directory = async (userId: string) =>
  t.asUser<{ user_id: string; label: string; is_admin: boolean }>(userId, "select * from public.colleague_directory()");

describe("колеги не читають профілі одне одного (база)", () => {
  it("AC-ORG-16: прямий запит до profiles віддає лише власний рядок — ролі, email, is_active колег недоступні", async () => {
    const rows = await t.asUser<{ id: string }>(worker, "select id from public.profiles");
    expect(rows.map((r) => r.id)).toEqual([worker]);
    expect(await t.asUser(worker, "select role, email, is_active from public.profiles where id = $1", [colleague])).toEqual([]);
  });

  it("AC-ORG-16: довідник віддає себе й активних колег зі спільного відділу лише як підпис і ознаку admin", async () => {
    const rows = await directory(worker);
    expect(Object.keys(rows[0]).sort()).toEqual(["is_admin", "label", "user_id"]);
    const byId = Object.fromEntries(rows.map((r) => [r.user_id, r]));
    expect(Object.keys(byId).sort()).toEqual([worker, colleague, nameless, boss].sort());
    expect(byId[colleague]).toMatchObject({ label: "Colleague Demo", is_admin: false });
    expect(byId[nameless].label).toBe("nameless@example.test"); // без імені — email як підпис
    expect(byId[boss].is_admin).toBe(true);
  });

  it("AC-ORG-16: деактивованого колеги й людей з інших відділів у довіднику немає", async () => {
    const ids = (await directory(worker)).map((r) => r.user_id);
    expect(ids).not.toContain(sleeper);
    expect(ids).not.toContain(outsider);
    expect((await directory(outsider)).map((r) => r.user_id)).toEqual([outsider]);
  });

  it("AC-ORG-16: деактивований працівник довідника не отримує, гість функцію не викликає", async () => {
    expect(await directory(sleeper)).toEqual([]);
    await expect(t.asAnon("select * from public.colleague_directory()")).rejects.toMatchObject({ code: "42501" });
  });

  it("AC-ORG-16: адміністратор і далі читає всі профілі напряму", async () => {
    const rows = await t.asUser<{ id: string }>(boss, "select id from public.profiles");
    expect(rows.map((r) => r.id)).toContain(outsider);
  });
});
