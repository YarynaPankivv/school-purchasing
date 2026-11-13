// Захист від прямого запису й межі довжини на рівні бази (рев'ю PM до WS9, пункти 11 і 12): справжні міграції в PGlite,
// запити від імені користувачів. Колонкові grant-и правильні, але регресію (хтось додав grant чи прибрав CHECK) ніщо
// не ловило, тож кожне правило має тест, що падає, коли його зламати.
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let andrii: string; // автор, заявник Primary School
let maria: string; // схвалювач Primary School
let admin: string;

const DENIED = /permission denied|row-level security|violates row-level/i;
const long = (n: number) => "x".repeat(n);

async function createDraft(userId: string) {
  const [row] = await t.asUser<{ id: string }>(
    userId,
    "insert into public.requests (type, purchase_type, department_id, author_id, status) values ('PUR', 'procurement', $1, $2, 'draft') returning id",
    [t.departments["Primary School"], userId],
  );
  return row.id;
}

async function submitted() {
  const id = await createDraft(andrii);
  await t.asUser(
    andrii,
    "update public.request_lines set name = 'Paper A4', purpose = 'For printing', quantity = 3, unit_price = 20.00 where request_id = $1 and position = 1",
    [id],
  );
  await t.asUser(andrii, "select public.submit_purchase($1)", [id]);
  return id;
}

const requestOf = async (id: string) =>
  (
    await t.asService<{ status: string; number: number | null; editing: boolean; decision_reason: string | null }>(
      "select status, number, editing, decision_reason from public.requests where id = $1",
      [id],
    )
  )[0];
const historyCount = async (id: string) =>
  Number((await t.asService<{ n: string }>("select count(*) as n from public.request_history where request_id = $1", [id]))[0].n);

beforeAll(async () => {
  t = await createPurchasingDb();
  andrii = await t.addUser("andrii@example.test");
  maria = await t.addUser("maria@example.test");
  admin = await t.addUser("admin@example.test", { admin: true });
  await t.addMember("Primary School", andrii);
  await t.addMember("Primary School", maria, { approver: true });
}, 120_000);

describe("пряме записування службових колонок заборонене", () => {
  it("автор не змінює status, number, editing і decision_reason своєї заявки прямим update", async () => {
    const id = await submitted();
    const before = await requestOf(id);
    for (const column of ["status = 'approved'", "number = 999", "editing = true", "decision_reason = 'x'"]) {
      await expect(t.asUser(andrii, `update public.requests set ${column} where id = $1`, [id])).rejects.toThrow(DENIED);
    }
    expect(await requestOf(id)).toEqual(before);
  });

  it("автор не вставляє заявку зі status 'approved', number, editing чи decision_reason", async () => {
    for (const columns of ["status, number", "status, editing", "status, decision_reason"]) {
      const values = columns.includes("number") ? "'approved', 5" : columns.includes("editing") ? "'draft', true" : "'draft', 'x'";
      await expect(
        t.asUser(
          andrii,
          `insert into public.requests (type, purchase_type, department_id, author_id, ${columns}) values ('PUR', 'procurement', $1, $2, ${values})`,
          [t.departments["Primary School"], andrii],
        ),
      ).rejects.toThrow(DENIED);
    }
  });

  it("схвалювач не змінює status заявки прямим update (лише decide_purchase)", async () => {
    const id = await submitted();
    await expect(t.asUser(maria, "update public.requests set status = 'approved' where id = $1", [id])).rejects.toThrow(DENIED);
    expect((await requestOf(id)).status).toBe("pending");
  });

  it("request_history: автор і схвалювач не вставляють, не змінюють і не видаляють записи", async () => {
    const id = await submitted();
    const count = await historyCount(id);
    for (const userId of [andrii, maria]) {
      await expect(
        t.asUser(userId, "insert into public.request_history (request_id, actor_id, action) values ($1, $2, 'approved')", [id, userId]),
      ).rejects.toThrow(DENIED);
      await expect(t.asUser(userId, "update public.request_history set reason = 'x' where request_id = $1", [id])).rejects.toThrow(DENIED);
      await expect(t.asUser(userId, "delete from public.request_history where request_id = $1", [id])).rejects.toThrow(DENIED);
    }
    expect(await historyCount(id)).toBe(count);
  });

  it("request_lines.status: автор і схвалювач не змінюють статус рядка прямим update", async () => {
    const id = await submitted();
    for (const userId of [andrii, maria]) {
      await expect(t.asUser(userId, "update public.request_lines set status = 'approved' where request_id = $1", [id])).rejects.toThrow(DENIED);
    }
    const lines = await t.asService<{ status: string }>("select status from public.request_lines where request_id = $1", [id]);
    expect(lines.map((l) => l.status)).toEqual(["pending"]);
  });
});

describe("межі довжини вільного тексту", () => {
  it("AC-DEC-06: причина повернення понад 2000 символів відхилена, статус і історія не змінюються; рівно 2000 — приймається", async () => {
    const id = await submitted();
    const historyBefore = await historyCount(id);

    await expect(t.asUser(maria, "select public.decide_purchase($1, 'return', $2::text)", [id, long(2001)])).rejects.toThrow(
      /requests_decision_reason_length|violates check constraint/i,
    );
    expect((await requestOf(id)).status).toBe("pending");
    expect(await historyCount(id)).toBe(historyBefore);

    await t.asUser(maria, "select public.decide_purchase($1, 'return', $2::text)", [id, long(2000)]);
    expect((await requestOf(id)).status).toBe("returned");
    expect((await requestOf(id)).decision_reason).toHaveLength(2000);
  });

  it("причина відхилення схваленої заявки відділом закупівель понад 2000 символів відхилена, заявка лишається схваленою", async () => {
    const id = await submitted();
    await t.asUser(maria, "select public.decide_purchase($1, 'approve')", [id]);
    const historyBefore = await historyCount(id);

    await expect(t.asUser(admin, "select public.admin_reject_purchase($1, $2::text)", [id, long(2001)])).rejects.toThrow(
      /decision_reason_length|violates check constraint/i,
    );
    expect((await requestOf(id)).status).toBe("approved");
    expect(await historyCount(id)).toBe(historyBefore);
  });

  it("CHECK діє й поза функціями переходів: навіть service_role не записує причину понад 2000 символів ні в заявку, ні в історію", async () => {
    const id = await submitted();
    await expect(t.asService("update public.requests set decision_reason = $2 where id = $1", [id, long(2001)])).rejects.toThrow(
      /requests_decision_reason_length|violates check constraint/i,
    );
    await expect(
      t.asService("insert into public.request_history (request_id, actor_id, action, reason) values ($1, $2, 'returned', $3)", [id, maria, long(2001)]),
    ).rejects.toThrow(/request_history_reason_length|violates check constraint/i);
    expect((await requestOf(id)).decision_reason).toBeNull();
  });

  it("мета рядка понад 500 символів відхилена і при вставці, і при зміні; рівно 500 — приймається", async () => {
    const id = await createDraft(andrii);
    await expect(
      t.asUser(andrii, "insert into public.request_lines (request_id, name, purpose, quantity, unit_price) values ($1, 'Pens', $2, 1, 1)", [id, long(501)]),
    ).rejects.toThrow(/request_lines_purpose_length|violates check constraint/i);
    await expect(
      t.asUser(andrii, "update public.request_lines set purpose = $2 where request_id = $1 and position = 1", [id, long(501)]),
    ).rejects.toThrow(/request_lines_purpose_length|violates check constraint/i);
    await t.asUser(andrii, "update public.request_lines set purpose = $2 where request_id = $1 and position = 1", [id, long(500)]);
    const [row] = await t.asService<{ purpose: string }>("select purpose from public.request_lines where request_id = $1 and position = 1", [id]);
    expect(row.purpose).toHaveLength(500);
  });
});
