// Зріз WS7 (FRM, APR) на рівні бази: справжні міграції в PGlite, запити від імені користувачів (asUser) і без входу
// (asAnon). Кожен відмовний AC перевіряє і відмову, і те, що дані не змінилися; тест падає, якщо прибрати відповідну
// політику чи перевірку в міграції (мутаційні прогони — в описі PR задачі).
import { beforeAll, describe, expect, it } from "vitest";
import { decisionQueue } from "@/lib/pur/decisions";
import type { PurchaseStatus } from "@/lib/pur/statuses";
import { actor } from "../pur/helpers";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let andrii: string; // працівник 1: заявник Primary School і Office, не заявник Upper School
let marta: string; // працівник 2: заявник Primary School, не автор і не схвалювач
let maria: string; // схвалювач Primary School
let tom: string; // заявник Upper School, де немає схвалювача
let petro: string; // єдиний схвалювач й заявник відділу «Library»

const ROW_SECURITY = /row-level security/;

async function createDraft(userId: string, departmentName: string, purchaseType: "procurement" | "self" = "procurement") {
  const [row] = await t.asUser<{ id: string }>(
    userId,
    "insert into public.requests (type, purchase_type, department_id, author_id, status) values ('PUR', $1, $2, $3, 'draft') returning id",
    [purchaseType, t.departments[departmentName], userId],
  );
  return row.id;
}

// Рядок «Папір А4», мета «Для друку», кількість 3, ціна 20.00 — як у AC-FRM-07.
async function fillLine(userId: string, requestId: string) {
  await t.asUser(
    userId,
    "update public.request_lines set name = 'A4 paper', purpose = 'For printing', quantity = 3, unit_price = 20.00 where request_id = $1",
    [requestId],
  );
}

async function submitted(userId: string, departmentName: string) {
  const id = await createDraft(userId, departmentName);
  await fillLine(userId, id);
  await t.asUser(userId, "select public.submit_purchase($1)", [id]);
  return id;
}

const statusOf = async (id: string) =>
  (await t.asService<{ status: string }>("select status from public.requests where id = $1", [id]))[0]?.status;
const pendingCount = async (userId: string) =>
  Number(
    (
      await t.asService<{ n: string }>(
        "select count(*) as n from public.requests where author_id = $1 and status = 'pending'",
        [userId],
      )
    )[0].n,
  );

beforeAll(async () => {
  t = await createPurchasingDb();
  andrii = await t.addUser("andrii@example.test");
  marta = await t.addUser("marta@example.test");
  maria = await t.addUser("maria@example.test");
  tom = await t.addUser("tom@example.test");
  petro = await t.addUser("petro@example.test");
  await t.addMember("Primary School", andrii);
  await t.addMember("Office", andrii);
  await t.addMember("Primary School", marta);
  await t.addMember("Primary School", maria, { approver: true });
  await t.addMember("Office", maria);
  await t.addMember("Upper School", tom);
  await t.addDepartment("Library");
  await t.addMember("Library", petro, { approver: true });
  // Схвалювач Office — окрема людина: Марія в Office лише заявник, схвалює лише «Primary School».
  const olena = await t.addUser("olena@example.test");
  await t.addMember("Office", olena, { approver: true });
}, 120_000);

describe("AC-FRM: подання закупівлі з урахуванням прав (база)", () => {
  it("AC-FRM-02: подання у відділ, де працівник не заявник, відхилено, нової заявки «Очікує схвалення» немає", async () => {
    await expect(createDraft(andrii, "Upper School")).rejects.toThrow(ROW_SECURITY);

    // Обхід через зміну відділу вже створеної чернетки теж закрито політикою update.
    const own = await createDraft(andrii, "Primary School");
    await fillLine(andrii, own);
    await expect(
      t.asUser(andrii, "update public.requests set department_id = $1 where id = $2", [t.departments["Upper School"], own]),
    ).rejects.toThrow(ROW_SECURITY);

    expect(await pendingCount(andrii)).toBe(0);
    const [{ department_id }] = await t.asService<{ department_id: string }>(
      "select department_id from public.requests where id = $1",
      [own],
    );
    expect(department_id).toBe(t.departments["Primary School"]);
  });

  it("AC-FRM-04: «Самостійна закупівля» без дозволу відхилено, нової заявки «Очікує схвалення» немає", async () => {
    const before = await pendingCount(andrii);
    await expect(createDraft(andrii, "Primary School", "self")).rejects.toThrow(ROW_SECURITY);

    // Зміна типу вже створеної чернетки — тригер guard_request_update.
    const own = await createDraft(andrii, "Primary School");
    await fillLine(andrii, own);
    await expect(
      t.asUser(andrii, "update public.requests set purchase_type = 'self' where id = $1", [own]),
    ).rejects.toThrow("pur:purchase_type_forbidden");

    expect(await pendingCount(andrii)).toBe(before);
    const [{ purchase_type }] = await t.asService<{ purchase_type: string }>(
      "select purchase_type from public.requests where id = $1",
      [own],
    );
    expect(purchase_type).toBe("procurement");
  });

  it("AC-FRM-04: чернетка «Самостійної закупівлі» після зняття дозволу не подається, статус лишається «Draft»", async () => {
    const sam = await t.addUser("sam@example.test");
    await t.addMember("Primary School", sam);
    await t.allowSelfPurchase(sam);
    const id = await createDraft(sam, "Primary School", "self");
    await fillLine(sam, id);
    // Адміністратор забирає дозвіл уже після створення чернетки.
    await t.asService("update public.user_permissions set self_purchase = false where user_id = $1", [sam]);

    await expect(t.asUser(sam, "select public.submit_purchase($1)", [id])).rejects.toThrow("pur:purchase_type_forbidden");

    expect(await statusOf(id)).toBe("draft");
    expect(await pendingCount(sam)).toBe(0);
  });

  it("AC-FRM-04: з дозволом той самий запит проходить — відмова залежить саме від дозволу", async () => {
    const colleague = await t.addUser("with-permission@example.test");
    await t.addMember("Primary School", colleague);
    await t.allowSelfPurchase(colleague);
    await expect(createDraft(colleague, "Primary School", "self")).resolves.toBeTruthy();
  });

  it("AC-FRM-06: подання без жодного рядка відхилено, відділ і тип лишаються, закупівлю не подано", async () => {
    const id = await createDraft(andrii, "Primary School");
    await t.asUser(andrii, "delete from public.request_lines where request_id = $1", [id]);

    await expect(t.asUser(andrii, "select public.submit_purchase($1)", [id])).rejects.toThrow("pur:lines_required");

    const [row] = await t.asService<{ status: string; department_id: string; purchase_type: string }>(
      "select status, department_id, purchase_type from public.requests where id = $1",
      [id],
    );
    expect(row).toEqual({
      status: "draft",
      department_id: t.departments["Primary School"],
      purchase_type: "procurement",
    });
  });

  it("AC-FRM-15: рядок лише з назвою не подається, закупівлю не подано", async () => {
    const id = await createDraft(andrii, "Primary School");
    await t.asUser(andrii, "update public.request_lines set name = 'A4 paper' where request_id = $1", [id]);

    await expect(t.asUser(andrii, "select public.submit_purchase($1)", [id])).rejects.toThrow("pur:lines_incomplete");
    expect(await statusOf(id)).toBe("draft");
  });

  it("AC-FRM-07: закупівля з повним рядком після подання має статус «Очікує схвалення»", async () => {
    const id = await createDraft(andrii, "Primary School");
    await fillLine(andrii, id);

    const [{ submit_purchase }] = await t.asUser<{ submit_purchase: string }>(andrii, "select public.submit_purchase($1)", [id]);

    expect(submit_purchase).toBe("pending");
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-FRM-08: заявник того ж відділу не бачить чужої поданої закупівлі, її статус не змінюється", async () => {
    const id = await submitted(andrii, "Primary School");

    const requests = await t.asUser(marta, "select id from public.requests where id = $1", [id]);
    const lines = await t.asUser(marta, "select id from public.request_lines where request_id = $1", [id]);
    const history = await t.asUser(marta, "select id from public.request_history where request_id = $1", [id]);

    expect(requests).toEqual([]);
    expect(lines).toEqual([]);
    expect(history).toEqual([]);
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-FRM-09: гість без входу (anon) не читає закупівель і не подає їх", async () => {
    const id = await submitted(andrii, "Primary School");

    await expect(t.asAnon("select id from public.requests")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select public.submit_purchase($1)", [id])).rejects.toThrow(/permission denied/);
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-FRM-12: відділ без активного схвалювача не блокує подання — «Очікує схвалення»", async () => {
    const id = await createDraft(tom, "Upper School");
    await fillLine(tom, id);

    const [{ submit_purchase }] = await t.asUser<{ submit_purchase: string }>(tom, "select public.submit_purchase($1)", [id]);

    expect(submit_purchase).toBe("pending");
  });

  it("AC-FRM-13: закупівля єдиного схвалювача-автора лишається «Очікує схвалення», доки її не вирішить інший", async () => {
    const id = await submitted(petro, "Library");
    expect(await statusOf(id)).toBe("pending");

    await expect(
      t.asUser(petro, "select public.decide_purchase($1, 'approve')", [id]),
    ).rejects.toThrow("pur:own_request");
    expect(await statusOf(id)).toBe("pending");
  });
});

describe("AC-APR: схвалювач вирішує лише по заявках свого відділу (база)", () => {
  it("AC-APR-01: у списку схвалювача лише подані заявки його відділу, заявок іншого відділу немає", async () => {
    const first = await submitted(andrii, "Primary School");
    const second = await submitted(andrii, "Primary School");
    const office = await submitted(andrii, "Office");

    const visible = await t.asUser<{ id: string; department_id: string }>(
      maria,
      "select id, department_id from public.requests where id = any($1::uuid[]) and status = 'pending'",
      [[first, second, office]],
    );

    expect(visible.map((r) => r.id).sort()).toEqual([first, second].sort());
    expect(visible.every((r) => r.department_id === t.departments["Primary School"])).toBe(true);
  });

  it("AC-APR-01: власної поданої заявки схвалювача у списку для рішення немає", async () => {
    const first = await submitted(andrii, "Primary School");
    const office = await submitted(andrii, "Office");
    const own = await submitted(maria, "Primary School");

    // Рядки, які Марія бачить крізь RLS (власна заявка серед них є), проходять через справжній відбір списку для рішення.
    const rows = await t.asUser<{
      id: string;
      status: PurchaseStatus;
      department_id: string;
      author_id: string;
      on_behalf_of_id: string | null;
      editing: boolean;
    }>(maria, "select id, status, department_id, author_id, on_behalf_of_id, editing from public.requests where id = any($1::uuid[])", [
      [first, office, own],
    ]);
    expect(rows.map((r) => r.id)).toContain(own);
    const approvers = await t.asService<{ department_id: string; user_id: string }>(
      "select department_id, user_id from public.department_approvers",
    );

    const queue = decisionQueue(rows, actor(maria, "approver"), approvers);

    expect(queue.map((r) => r.id)).toEqual([first]);
    expect(await statusOf(own)).toBe("pending");
  });

  it("AC-APR-02: схвалення заявки свого відділу ставить статус «Схвалено»", async () => {
    const id = await submitted(andrii, "Primary School");

    const [{ decide_purchase }] = await t.asUser<{ decide_purchase: string }>(
      maria,
      "select public.decide_purchase($1, 'approve')",
      [id],
    );

    expect(decide_purchase).toBe("approved");
    expect(await statusOf(id)).toBe("approved");
  });

  it("AC-APR-03: заявка чужого відділу — даних не видно, рішення відхилено, статус «Очікує схвалення»", async () => {
    const id = await submitted(andrii, "Office");

    expect(await t.asUser(maria, "select id from public.requests where id = $1", [id])).toEqual([]);
    expect(await t.asUser(maria, "select id from public.request_lines where request_id = $1", [id])).toEqual([]);
    await expect(t.asUser(maria, "select public.decide_purchase($1, 'approve')", [id])).rejects.toThrow("pur:forbidden");
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-APR-04: заявник (requester) не вирішує заявок і не бачить чужих, статуси не змінюються", async () => {
    const id = await submitted(andrii, "Primary School");

    // Марта — заявник того ж відділу без ролі схвалювача.
    await expect(t.asUser(marta, "select public.decide_purchase($1, 'approve')", [id])).rejects.toThrow("pur:forbidden");
    expect(await t.asUser(marta, "select id from public.requests where id = $1", [id])).toEqual([]);
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-APR-05: автор-схвалювач не схвалює власної заявки напряму, статус «Очікує схвалення»", async () => {
    const id = await submitted(petro, "Library");

    await expect(t.asUser(petro, "select public.decide_purchase($1, 'approve')", [id])).rejects.toThrow("pur:own_request");
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-APR-06: відхилення без причини не виконується, статус «Очікує схвалення»", async () => {
    const id = await submitted(andrii, "Primary School");

    await expect(t.asUser(maria, "select public.decide_purchase($1, 'reject')", [id])).rejects.toThrow("pur:reason_required");
    await expect(
      t.asUser(maria, "select public.decide_purchase($1, 'reject', '   ')", [id]),
    ).rejects.toThrow("pur:reason_required");
    expect(await statusOf(id)).toBe("pending");
  });

  it("AC-APR-07: відхилення з причиною — статус «Відхилено», причину збережено й видно автору та схвалювачу", async () => {
    const id = await submitted(andrii, "Primary School");

    const [{ decide_purchase }] = await t.asUser<{ decide_purchase: string }>(
      maria,
      "select public.decide_purchase($1, 'reject', 'No budget')",
      [id],
    );

    expect(decide_purchase).toBe("rejected");
    for (const viewer of [andrii, maria]) {
      const [row] = await t.asUser<{ status: string; decision_reason: string }>(
        viewer,
        "select status, decision_reason from public.requests where id = $1",
        [id],
      );
      expect(row).toEqual({ status: "rejected", decision_reason: "No budget" });
    }
    // Заявник того ж відділу, який не автор і не схвалювач, причини не бачить.
    expect(await t.asUser(marta, "select decision_reason from public.requests where id = $1", [id])).toEqual([]);
  });

  it("AC-APR-03: схвалювач третього відділу теж не вирішує заявку Office — статус «Очікує схвалення»", async () => {
    const id = await submitted(andrii, "Office");
    const outsider = await t.addUser("outsider-approver@example.test");
    await t.addMember("Upper School", outsider, { approver: true });

    await expect(t.asUser(outsider, "select public.decide_purchase($1, 'reject', 'No')", [id])).rejects.toThrow(
      "pur:forbidden",
    );
    expect(await statusOf(id)).toBe("pending");
  });
});
