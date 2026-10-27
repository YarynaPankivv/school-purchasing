// Підписи авторів для схвалювача на справжній базі (PGlite): AC-APR-08, 09, 10. Прямий запит до public.profiles для
// авторів поза спільним відділом порожній (profiles_select_colleagues), а public.request_author_labels() віддає лише
// (id, підпис) для заявок, які людина бачить крізь RLS: без ролі, email за наявності імені, is_active.
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let maria: string; // схвалювач Primary School
let olga: string; // автор: адміністратор без відділу, з іменем
let tom: string; // автор: заявник Primary School з іменем, потім деактивований
let nina: string; // автор: заявник Primary School без імені в профілі
let stranger: string; // не автор жодної заявки

async function submit(userId: string, departmentName: string) {
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

const labelsFor = async (userId: string) =>
  Object.fromEntries(
    (await t.asUser<{ user_id: string; label: string }>(userId, "select user_id, label from public.request_author_labels()")).map(
      (r) => [r.user_id, r.label],
    ),
  );

beforeAll(async () => {
  t = await createPurchasingDb();
  maria = await t.addUser("maria@example.test", { fullName: "Maria Demo" });
  olga = await t.addUser("olga@example.test", { fullName: "Olga Admin", admin: true });
  tom = await t.addUser("tom@example.test", { fullName: "Tom Author" });
  nina = await t.addUser("nina@example.test", { fullName: null });
  stranger = await t.addUser("stranger@example.test", { fullName: "Stranger Person" });
  await t.addMember("Primary School", maria, { approver: true });
  await t.addMember("Primary School", tom);
  await t.addMember("Primary School", nina);
  await submit(olga, "Primary School");
  await submit(tom, "Primary School");
  await submit(nina, "Primary School");
  // Автор пішов: деактивований профіль уже не «активний колега», але його заявка лишається у списку.
  await t.asService("update public.profiles set is_active = false where id = $1", [tom]);
}, 120_000);

describe("AC-APR: підписи авторів у списку для рішення (база)", () => {
  it("AC-APR-08: схвалювач бачить ім'я автора-адміністратора без відділу, хоча його профіль прямим запитом недоступний", async () => {
    const direct = await t.asUser(maria, "select id from public.profiles where id = $1", [olga]);
    expect(direct).toEqual([]);

    expect((await labelsFor(maria))[olga]).toBe("Olga Admin");
  });

  it("AC-APR-08: ім'я деактивованого автора теж показано", async () => {
    expect((await labelsFor(maria))[tom]).toBe("Tom Author");
  });

  it("AC-APR-09: без імені в профілі автора підпис — його email", async () => {
    expect((await labelsFor(maria))[nina]).toBe("nina@example.test");
  });

  it("AC-APR-10: ролі, email за наявності імені й is_active автора не віддаються, сторонніх людей немає", async () => {
    const rows = await t.asUser<Record<string, unknown>>(maria, "select * from public.request_author_labels()");

    expect(Object.keys(rows[0]).sort()).toEqual(["label", "user_id"]);
    expect(JSON.stringify(rows)).not.toContain("olga@example.test");
    expect(JSON.stringify(rows)).not.toMatch(/admin"|requester|approver/);
    expect(rows.map((r) => r.user_id)).not.toContain(stranger);
    expect(rows.map((r) => r.user_id)).not.toContain(maria);
  });

  it("AC-APR-10: працівник бачить підписи лише авторів заявок, які бачить сам; гість функцію не викликає", async () => {
    // Сторонній не автор і не бачить чужих заявок; Ніна бачить лише власну.
    expect(Object.keys(await labelsFor(stranger))).toEqual([]);
    expect(Object.keys(await labelsFor(nina))).toEqual([nina]);

    await expect(t.asAnon("select * from public.request_author_labels()")).rejects.toThrow(/permission denied/);
  });
});
