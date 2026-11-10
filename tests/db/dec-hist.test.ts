// Зріз WS9 (DEC, HIST) на рівні бази: справжні міграції в PGlite, запити від імені користувачів (asUser).
// Правила рішення схвалювача й повторного подання живуть у SQL (private.decide_purchase, private.submit_purchase),
// тому доводимо їх тут, а не моком rpc: кожен відмовний AC перевіряє і відмову, і те, що дані не змінилися.
// Тест падає, якщо зламати відповідне правило в міграції (мутанти D1–D3 у scripts/mutants.mjs, npm run mutation:sql).
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let andrii: string; // автор: заявник Primary School
let marta: string; // заявник Primary School, не автор і не схвалювач
let maria: string; // схвалювач Primary School

type LineRow = { id: string; position: number; name: string; quantity: number; status: string };

async function createDraft(userId: string, departmentName: string) {
  const [row] = await t.asUser<{ id: string }>(
    userId,
    "insert into public.requests (type, purchase_type, department_id, author_id, status) values ('PUR', 'procurement', $1, $2, 'draft') returning id",
    [t.departments[departmentName], userId],
  );
  return row.id;
}

// Заповнює перший (порожній) рядок і додає ще `names.length - 1` рядків: кількість 3, ціна 20.00.
async function fillLines(userId: string, requestId: string, names: readonly string[]) {
  await t.asUser(
    userId,
    "update public.request_lines set name = $2, purpose = 'For printing', quantity = 3, unit_price = 20.00 where request_id = $1 and position = 1",
    [requestId, names[0]],
  );
  for (const name of names.slice(1)) {
    await t.asUser(
      userId,
      "insert into public.request_lines (request_id, name, purpose, quantity, unit_price) values ($1, $2, 'For printing', 3, 20.00)",
      [requestId, name],
    );
  }
}

async function submitted(userId: string, names: readonly string[]) {
  const id = await createDraft(userId, "Primary School");
  await fillLines(userId, id, names);
  await t.asUser(userId, "select public.submit_purchase($1)", [id]);
  return id;
}

const requestOf = async (id: string) =>
  (
    await t.asService<{ status: string; decision_reason: string | null; department_id: string }>(
      "select status, decision_reason, department_id from public.requests where id = $1",
      [id],
    )
  )[0];

const linesOf = (id: string) =>
  t.asService<LineRow>(
    "select id, position, name, quantity, status from public.request_lines where request_id = $1 order by position",
    [id],
  );

const historyOf = (id: string) =>
  t.asService<{ action: string; reason: string | null; actor_name: string | null }>(
    "select action, reason, actor_name from public.request_history where request_id = $1",
    [id],
  );

beforeAll(async () => {
  t = await createPurchasingDb();
  andrii = await t.addUser("andrii@example.test");
  marta = await t.addUser("marta@example.test");
  maria = await t.addUser("maria@example.test");
  await t.addMember("Primary School", andrii);
  await t.addMember("Primary School", marta);
  await t.addMember("Primary School", maria, { approver: true });
}, 120_000);

describe("AC-DEC: рішення схвалювача й повторне подання (база)", () => {
  it("AC-DEC-01: відхилений рядок 2 і схвалення дають «Частково схвалено», автор бачить рядок 2 «rejected», рядки 1 і 3 «approved»", async () => {
    const id = await submitted(andrii, ["Paper A4", "Markers", "Folders"]);
    const [line1, line2, line3] = await linesOf(id);
    expect([line1.status, line2.status, line3.status]).toEqual(["pending", "pending", "pending"]);

    const [{ decide_purchase }] = await t.asUser<{ decide_purchase: string }>(
      maria,
      "select public.decide_purchase($1, 'approve', null, $2::uuid[])",
      [id, [line2.id]],
    );

    expect(decide_purchase).toBe("partially_approved");
    expect((await requestOf(id)).status).toBe("partially_approved");
    // Автор бачить статуси рядків через RLS — від його імені, а не в обхід неї.
    const seenByAuthor = await t.asUser<LineRow>(
      andrii,
      "select id, position, name, quantity, status from public.request_lines where request_id = $1 order by position",
      [id],
    );
    expect(seenByAuthor.map((l) => [l.position, l.status])).toEqual([
      [1, "approved"],
      [2, "rejected"],
      [3, "approved"],
    ]);
    expect((await historyOf(id)).map((h) => h.action).sort()).toEqual(["partially_approved", "submitted"]);
  });

  it("AC-DEC-04: повернення на доопрацювання з причиною «Уточніть кількість» дає статус «Повернено на доопрацювання»", async () => {
    const id = await submitted(andrii, ["Paper A4"]);

    const [{ decide_purchase }] = await t.asUser<{ decide_purchase: string }>(
      maria,
      "select public.decide_purchase($1, 'return', 'Уточніть кількість')",
      [id],
    );

    expect(decide_purchase).toBe("returned");
    const request = await requestOf(id);
    expect(request.status).toBe("returned");
    expect(request.decision_reason).toBe("Уточніть кількість");
    // Склад історії без залежності від порядку: записи з однаковим created_at мають довільний порядок за id.
    const history = await historyOf(id);
    expect(history.map((h) => h.action).sort()).toEqual(["returned", "submitted"]);
    expect(history.filter((h) => h.action === "returned")).toEqual([
      expect.objectContaining({ reason: "Уточніть кількість" }),
    ]);
  });

  it("AC-DEC-06: повернення без причини відхилено — «Вкажіть причину» (pur:reason_required), статус лишається «Очікує схвалення»", async () => {
    const id = await submitted(andrii, ["Paper A4"]);
    const historyBefore = (await historyOf(id)).length;

    await expect(t.asUser(maria, "select public.decide_purchase($1, 'return')", [id])).rejects.toThrow("pur:reason_required");
    // Порожня причина з пробільних символів (пробіл, табуляція, \v, \f, перенос рядка, нерозривний пробіл) — теж «без причини».
    for (const blank of ["   ", "\t\t", "\n", " \r\n\t ", "\v", "\f", "\u00a0"]) {
      await expect(t.asUser(maria, "select public.decide_purchase($1, 'return', $2::text)", [id, blank])).rejects.toThrow(
        "pur:reason_required",
      );
    }

    const request = await requestOf(id);
    expect(request.status).toBe("pending");
    expect(request.decision_reason).toBeNull();
    expect(await historyOf(id)).toHaveLength(historyBefore);
  });

  it("AC-DEC-06: причина, що починається чи закінчується на «v», зберігається без змін, а пробільні краї обрізаються", async () => {
    const id = await submitted(andrii, ["Paper A4"]);

    await t.asUser(maria, "select public.decide_purchase($1, 'return', $2::text)", [id, "\t valid reason v\v\n"]);

    expect((await requestOf(id)).decision_reason).toBe("valid reason v");
  });

  it("AC-DEC-07: виправлена повернена заявка після повторного подання знову «Очікує схвалення», відділ той самий", async () => {
    const id = await submitted(andrii, ["Paper A4", "Markers"]);
    const departmentBefore = (await requestOf(id)).department_id;
    await t.asUser(maria, "select public.decide_purchase($1, 'return', 'Уточніть кількість')", [id]);
    expect((await requestOf(id)).status).toBe("returned");

    // Не автор (заявник того ж відділу) повторно не подає, заявка лишається повернутою.
    await expect(t.asUser(marta, "select public.submit_purchase($1)", [id])).rejects.toThrow("pur:forbidden");
    expect((await requestOf(id)).status).toBe("returned");

    // Автор виправляє рядок 1 і подає знову.
    await t.asUser(andrii, "update public.request_lines set quantity = 5 where request_id = $1 and position = 1", [id]);
    const [{ submit_purchase }] = await t.asUser<{ submit_purchase: string }>(andrii, "select public.submit_purchase($1)", [id]);

    expect(submit_purchase).toBe("pending");
    const request = await requestOf(id);
    expect(request.status).toBe("pending");
    expect(request.department_id).toBe(departmentBefore);
    expect(request.decision_reason).toBeNull();
    const lines = await linesOf(id);
    expect(lines[0].quantity).toBe(5);
    expect(lines.map((l) => l.status)).toEqual(["pending", "pending"]);
  });
});
