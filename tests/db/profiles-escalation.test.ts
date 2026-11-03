// Самопідвищення ролі на справжній базі (PGlite): AC-ORG-09 (без ролі admin адміністрування недоступне) — прямі запити
// до public.profiles, оминаючи сторінки застосунку. Колонковий grant, with check політики й тригер-охоронець мають
// не пустити звичайного працівника ні в admin, ні в чужий профіль; власне ім'я змінювати можна.
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let worker: string; // заявник Primary School
let maria: string; // схвалювач Primary School
let olga: string; // єдиний активний адміністратор

const profile = async (id: string) =>
  (await t.asService<{ role: string; is_active: boolean; full_name: string | null }>(
    "select role, is_active, full_name from public.profiles where id = $1",
    [id],
  ))[0];

beforeAll(async () => {
  t = await createPurchasingDb();
  worker = await t.addUser("worker@example.test", { fullName: "Worker Demo" });
  maria = await t.addUser("maria@example.test", { fullName: "Maria Demo" });
  olga = await t.addUser("olga@example.test", { fullName: "Olga Admin", admin: true });
  await t.addMember("Primary School", worker);
  await t.addMember("Primary School", maria, { approver: true });
}, 120_000);

describe("AC-ORG-09: працівник без ролі admin не підвищує собі роль (база)", () => {
  it("AC-ORG-09: прямий UPDATE власної ролі на admin відхилено, роль лишилась requester", async () => {
    await expect(
      t.asUser(worker, "update public.profiles set role = 'admin' where id = $1", [worker]),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await profile(worker)).role).toBe("requester");
  });

  it("AC-ORG-09: схвалювач теж не підвищує собі роль прямим UPDATE", async () => {
    await expect(
      t.asUser(maria, "update public.profiles set role = 'admin' where id = $1", [maria]),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await profile(maria)).role).toBe("approver");
  });

  it("AC-ORG-09: прямий UPDATE is_active відхилено, обліковий запис лишився активним", async () => {
    await expect(
      t.asUser(worker, "update public.profiles set is_active = false where id = $1", [worker]),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await profile(worker)).is_active).toBe(true);
  });

  it("AC-ORG-09: чужий профіль працівник змінити не може: рядок невидимий для UPDATE, ім'я лишилось", async () => {
    const changed = await t.asUser(
      worker,
      "update public.profiles set full_name = 'Hacked' where id = $1 returning id",
      [maria],
    );
    expect(changed).toEqual([]);
    expect((await profile(maria)).full_name).toBe("Maria Demo");
  });

  it("AC-ORG-09: функцію admin_set_role працівник викликати не може, ролі не змінились", async () => {
    await expect(t.asUser(worker, "select public.admin_set_role($1, true)", [worker])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(t.asUser(worker, "select public.admin_set_role($1, false)", [olga])).rejects.toMatchObject({
      code: "42501",
    });
    expect((await profile(worker)).role).toBe("requester");
    expect((await profile(olga)).role).toBe("admin");
  });

  it("AC-ORG-09: нового профілю з роллю admin працівник не вставить", async () => {
    await expect(
      t.asUser(
        worker,
        "insert into public.profiles (id, email, role) values ('b0000000-0000-0000-0000-000000000001', 'x@example.test', 'admin')",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("AC-ORG-09: власне ім'я працівник змінити може, роль і активність при цьому не змінюються", async () => {
    await t.asUser(worker, "update public.profiles set full_name = 'Worker Renamed' where id = $1", [worker]);
    expect(await profile(worker)).toEqual({ role: "requester", is_active: true, full_name: "Worker Renamed" });
  });
});
