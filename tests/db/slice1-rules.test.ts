// Правила зрізу 1 (ORG, PUR) на справжній базі (PGlite), а не на моках чи тексті міграції: єдиний активний адміністратор
// (AC-ORG-10, AC-ORG-18), рішення по власній заявці й одночасні рішення (AC-PUR-24, AC-PUR-25), видимість заявок
// (AC-PUR-35, AC-PUR-49). Кожен відмовний AC перевіряє і відмову, і те, що дані не змінилися.
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let olga: string; // єдиний активний адміністратор
let andrii: string; // заявник Primary School і Office
let marta: string; // заявник Primary School, не автор і не схвалювач
let maria: string; // схвалювач Primary School
let nazar: string; // другий схвалювач Primary School
let olena: string; // схвалювач Office

async function submitted(userId: string, departmentName: string) {
  const [row] = await t.asUser<{ id: string }>(
    userId,
    "insert into public.requests (type, purchase_type, department_id, author_id, status) values ('PUR', 'procurement', $1, $2, 'draft') returning id",
    [t.departments[departmentName], userId],
  );
  await t.asUser(
    userId,
    "update public.request_lines set name = 'A4 paper', purpose = 'For printing', quantity = 3, unit_price = 20.00 where request_id = $1",
    [row.id],
  );
  await t.asUser(userId, "select public.submit_purchase($1)", [row.id]);
  return row.id;
}

const statusOf = async (id: string) =>
  (await t.asService<{ status: string }>("select status from public.requests where id = $1", [id]))[0]?.status;
const profile = async (id: string) =>
  (await t.asService<{ role: string; is_active: boolean }>("select role, is_active from public.profiles where id = $1", [id]))[0];
const visibleIds = async (userId: string) =>
  (await t.asUser<{ id: string }>(userId, "select id from public.requests")).map((r) => r.id);

beforeAll(async () => {
  t = await createPurchasingDb();
  olga = await t.addUser("olga@example.test", { admin: true });
  andrii = await t.addUser("andrii@example.test");
  marta = await t.addUser("marta@example.test");
  maria = await t.addUser("maria@example.test");
  nazar = await t.addUser("nazar@example.test");
  olena = await t.addUser("olena@example.test");
  await t.addMember("Primary School", andrii);
  await t.addMember("Office", andrii);
  await t.addMember("Primary School", marta);
  await t.addMember("Primary School", maria, { approver: true });
  await t.addMember("Primary School", nazar, { approver: true });
  await t.addMember("Office", olena, { approver: true });
}, 120_000);

describe("єдиний активний адміністратор (база)", () => {
  it("AC-ORG-10: єдиний активний адміністратор не знімає з себе роль — відмова ORG01, роль admin лишилась", async () => {
    await expect(t.asUser(olga, "select public.admin_set_role($1, false)", [olga])).rejects.toMatchObject({
      code: "ORG01",
      message: "At least one active administrator must remain",
    });
    expect((await profile(olga)).role).toBe("admin");
  });

  it("AC-ORG-18: єдиний активний адміністратор не деактивує себе — відмова ORG01, профіль активний", async () => {
    await expect(t.asUser(olga, "select public.admin_set_active($1, false)", [olga])).rejects.toMatchObject({
      code: "ORG01",
    });
    expect((await profile(olga)).is_active).toBe(true);
  });

  it("AC-ORG-10, AC-ORG-18: з другим активним адміністратором ті самі дії проходять, а деактивованого другого не враховує", async () => {
    const second = await t.addUser("second-admin@example.test", { admin: true });
    await t.asService("update public.profiles set is_active = false where id = $1", [second]);
    // Другий адміністратор неактивний: олга лишається єдиним активним.
    await expect(t.asUser(olga, "select public.admin_set_active($1, false)", [olga])).rejects.toMatchObject({
      code: "ORG01",
    });

    await t.asService("update public.profiles set is_active = true where id = $1", [second]);
    await t.asUser(olga, "select public.admin_set_role($1, false)", [olga]);
    expect((await profile(olga)).role).not.toBe("admin");
    expect((await profile(second)).role).toBe("admin");
    // Повертаємо стан для наступних тестів.
    await t.asService("update public.profiles set role = 'admin' where id = $1", [olga]);
    await t.asService("update public.profiles set is_active = false, role = 'requester' where id = $1", [second]);
  });
});

describe("рішення по заявці (база)", () => {
  it("AC-PUR-24: схвалювач не вирішує власної заявки — pur:own_request, статус «Очікує схвалення»", async () => {
    const id = await submitted(maria, "Primary School");
    expect(await statusOf(id)).toBe("pending");
    await expect(t.asUser(maria, "select public.decide_purchase($1, 'approve')", [id])).rejects.toThrow("pur:own_request");
    await expect(
      t.asUser(maria, "select public.decide_purchase($1, 'reject', 'No reason')", [id]),
    ).rejects.toThrow("pur:own_request");
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-PUR-24: особа «від імені» не вирішує заявки — pur:own_request, статус не змінився", async () => {
    const id = await submitted(andrii, "Primary School");
    await t.asService("update public.requests set on_behalf_of_id = $1 where id = $2", [maria, id]);
    await expect(t.asUser(maria, "select public.decide_purchase($1, 'approve')", [id])).rejects.toThrow("pur:own_request");
    expect(await statusOf(id)).toBe("pending");
    // Інший схвалювач відділу, не пов'язаний із заявкою, вирішує її.
    await t.asUser(nazar, "select public.decide_purchase($1, 'approve')", [id]);
    expect(await statusOf(id)).toBe("approved");
  });

  it("AC-PUR-25: з двох рішень застосовано перше, друге — pur:already_decided, статус від першого", async () => {
    const id = await submitted(andrii, "Primary School");
    await t.asUser(maria, "select public.decide_purchase($1, 'approve')", [id]);
    await expect(
      t.asUser(nazar, "select public.decide_purchase($1, 'reject', 'Too late')", [id]),
    ).rejects.toThrow("pur:already_decided");
    expect(await statusOf(id)).toBe("approved");
    expect(
      await t.asService("select decision_reason from public.requests where id = $1 and decision_reason is not null", [id]),
    ).toEqual([]);
  });
});

describe("видимість заявок (база)", () => {
  it("AC-PUR-35: схвалювач Primary School не бачить заявки Office і не вирішує її; свою бачить", async () => {
    const office = await submitted(andrii, "Office");
    const primary = await submitted(andrii, "Primary School");

    const seen = await visibleIds(maria);
    expect(seen).toContain(primary);
    expect(seen).not.toContain(office);
    await expect(t.asUser(maria, "select public.decide_purchase($1, 'approve')", [office])).rejects.toThrow("pur:forbidden");
    expect(await statusOf(office)).toBe("pending");
    // Схвалювач Office, навпаки, свою бачить.
    expect(await visibleIds(olena)).toContain(office);
  });

  it("AC-PUR-49: заявник того ж відділу, що не автор, не бачить чужої поданої заявки і не вирішує її; автор бачить", async () => {
    const id = await submitted(andrii, "Primary School");

    expect(await visibleIds(marta)).not.toContain(id);
    expect(await t.asUser(marta, "select id from public.request_lines where request_id = $1", [id])).toEqual([]);
    await expect(t.asUser(marta, "select public.decide_purchase($1, 'approve')", [id])).rejects.toThrow("pur:forbidden");
    expect(await statusOf(id)).toBe("pending");
    expect(await visibleIds(andrii)).toContain(id);
  });
});
