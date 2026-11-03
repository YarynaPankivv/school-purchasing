// Автосхвалення в заявках не діє (спрощений скоуп ДЗ7, requirements/product.md) на справжній базі (PGlite):
// налаштування автосхвалення (WS6) лишається, але подана заявка завжди очікує схвалення.
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let solo: string; // заявник Upper School з ввімкненим автосхваленням, він же єдиний схвалювач

beforeAll(async () => {
  t = await createPurchasingDb();
  solo = await t.addUser("solo@example.test");
  await t.addMember("Upper School", solo, { autoApprove: true });
}, 120_000);

describe("автосхвалення в заявках не діє (база)", () => {
  it("AC-PUR-14, AC-PUR-37: автор із ввімкненим автосхваленням подає — «Очікує схвалення», в історії лише «Подано»", async () => {
    const [row] = await t.asUser<{ id: string }>(
      solo,
      "insert into public.requests (type, purchase_type, department_id, author_id, status) values ('PUR', 'procurement', $1, $2, 'draft') returning id",
      [t.departments["Upper School"], solo],
    );
    await t.asUser(
      solo,
      "update public.request_lines set name = 'A4 paper', purpose = 'For printing', quantity = 3, unit_price = 20.00 where request_id = $1",
      [row.id],
    );
    const [submitted] = await t.asUser<{ submit_purchase: string }>(solo, "select public.submit_purchase($1)", [row.id]);
    expect(submitted.submit_purchase).toBe("pending");

    const [request] = await t.asService<{ status: string }>("select status from public.requests where id = $1", [row.id]);
    expect(request.status).toBe("pending");
    const history = await t.asService<{ action: string }>(
      "select action from public.request_history where request_id = $1 order by created_at",
      [row.id],
    );
    expect(history.map((h) => h.action)).toEqual(["submitted"]);
    const lines = await t.asService<{ status: string }>("select status from public.request_lines where request_id = $1", [row.id]);
    expect(lines.every((l) => l.status === "pending")).toBe(true);
  });

  it("AC-ORG-06: саме налаштування автосхвалення лишилось ввімкненим після подання", async () => {
    const [member] = await t.asService<{ auto_approve: boolean }>(
      "select auto_approve from public.department_members where user_id = $1",
      [solo],
    );
    expect(member.auto_approve).toBe(true);
  });
});
