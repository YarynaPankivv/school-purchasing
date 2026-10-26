// Задача 1 зрізу PUR (tasks.md 1.2, 1.4): дзеркала правил видимості й дій автора.
// Останнє слово — RLS (private.can_view_request, політики requests/request_lines) і функції D5: їх перевіряє
// ручний прохід після db-deploy; AC-PUR-03, 11, 32, 35, 38, 44, 45, 49 закриває координатор разом зі сторінками й actions.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canAdminReject, canDecide, canReopen, decisionBlockReason } from "@/lib/pur/decisions";
import {
  canCancel,
  canChangeDepartment,
  canEditFields,
  canEditLines,
  canSetEditing,
  canSubmit,
  canViewRequest,
} from "@/lib/pur/visibility";
import { canCopy, copyPurchase } from "@/lib/pur/copy";
import { ADMIN, APPROVER, AUTHOR, COLLEAGUE, OFFICE, OTHER_APPROVER, OUTSIDER, PRIMARY, actor, approver, makeLine, makePurchase } from "./helpers";

const approvers = [approver(PRIMARY, APPROVER), approver(OFFICE, OTHER_APPROVER)];
const author = actor(AUTHOR, "requester");

describe("хто бачить закупівлю", () => {
  const draft = makePurchase({ status: "draft", on_behalf_of_id: COLLEAGUE });
  const submitted = makePurchase({ status: "pending", on_behalf_of_id: COLLEAGUE });

  it("чернетку бачать лише автор, особа «від імені» й активний admin", () => {
    expect(canViewRequest(draft, author, approvers)).toBe(true);
    expect(canViewRequest(draft, actor(COLLEAGUE, "requester"), approvers)).toBe(true);
    expect(canViewRequest(draft, actor(ADMIN, "admin"), approvers)).toBe(true);
    // Схвалювач відділу, заявник відділу, чужий — ні.
    expect(canViewRequest(draft, actor(APPROVER, "approver"), approvers)).toBe(false);
    expect(canViewRequest(draft, actor(OUTSIDER, "requester"), approvers)).toBe(false);
    expect(canViewRequest(draft, actor(ADMIN, "admin", false), approvers)).toBe(false);
  });

  it("подану заявку бачить ще й схвалювач її відділу, але не схвалювач іншого відділу й не заявник відділу", () => {
    expect(canViewRequest(submitted, actor(APPROVER, "approver"), approvers)).toBe(true);
    expect(canViewRequest(submitted, actor(OTHER_APPROVER, "approver"), approvers)).toBe(false);
    expect(canViewRequest(submitted, actor(OUTSIDER, "requester"), approvers)).toBe(false);
    // Роль approver без рядка department_approvers не дає доступу: склад береться з відділу.
    expect(canViewRequest(submitted, actor("user-ex-approver", "approver"), approvers)).toBe(false);
  });
});

describe("видимість у межах відділів", () => {
  const colleagueB = actor("user-colleague-b", "requester");

  it("AC-PUR-49: заявник того самого відділу, що не автор, не «від імені» й не схвалювач, не бачить чужої поданої заявки", () => {
    for (const status of ["pending", "approved", "partially_approved", "rejected", "returned"] as const) {
      const submitted = makePurchase({ status, department_id: PRIMARY, on_behalf_of_id: null });
      expect(canViewRequest(submitted, colleagueB, approvers)).toBe(false);
      // Автор і схвалювач відділу її бачать.
      expect(canViewRequest(submitted, author, approvers)).toBe(true);
      expect(canViewRequest(submitted, actor(APPROVER, "approver"), approvers)).toBe(true);
    }
  });

  it("AC-PUR-35: схвалювач відділу «Початкова школа» не бачить закупівлі відділу «Офіс» і не може діяти", () => {
    const officePurchase = makePurchase({ status: "pending", department_id: OFFICE });
    const primaryApprover = actor(APPROVER, "approver");
    expect(canViewRequest(officePurchase, primaryApprover, approvers)).toBe(false);
    expect(canDecide(officePurchase, primaryApprover, approvers)).toBe(false);
    expect(decisionBlockReason(officePurchase, primaryApprover, approvers)).toBe("forbidden");
    expect(canAdminReject({ status: "approved" }, primaryApprover)).toBe(false);
    expect(canReopen({ status: "rejected" }, primaryApprover)).toBe(false);
  });

  it("AC-PUR-35, 49 у базі: can_view_request віддає не-чернетку лише схвалювачу її відділу, а не будь-якому заявнику відділу", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261021140000_pur_drafts.sql"), "utf8");
    const body = sql.slice(sql.indexOf("create or replace function private.can_view_request"));
    const fn = body.slice(0, body.indexOf("$$;", body.indexOf("as $$") + 5));
    expect(fn).toContain("r.status <> 'draft'");
    expect(fn).toContain("private.is_department_approver(r.department_id)");
    // Членство у відділі не дає доступу до чужих заявок.
    expect(fn).not.toContain("department_members");
  });
});

describe("що може автор", () => {
  it("рядки правляться в чернетці, повернутій і поданій з editing; відхилену не редагують", () => {
    expect(canEditLines(makePurchase({ status: "draft" }), author)).toBe(true);
    expect(canEditLines(makePurchase({ status: "returned" }), author)).toBe(true);
    expect(canEditLines(makePurchase({ status: "pending", editing: false }), author)).toBe(false);
    expect(canEditLines(makePurchase({ status: "pending", editing: true }), author)).toBe(true);
    expect(canEditLines(makePurchase({ status: "rejected" }), author)).toBe(false);
    // Не автор не править.
    expect(canEditLines(makePurchase({ status: "draft", on_behalf_of_id: COLLEAGUE }), actor(COLLEAGUE, "requester"))).toBe(false);
    expect(canEditLines(makePurchase({ status: "draft" }), actor(ADMIN, "admin"))).toBe(false);
  });

  it("відділ змінюється лише в чернетці; поля заявки — в чернетці й повернутій", () => {
    expect(canChangeDepartment(makePurchase({ status: "draft" }), author)).toBe(true);
    expect(canChangeDepartment(makePurchase({ status: "pending" }), author)).toBe(false);
    expect(canChangeDepartment(makePurchase({ status: "returned" }), author)).toBe(false);
    expect(canEditFields(makePurchase({ status: "returned" }), author)).toBe(true);
    expect(canEditFields(makePurchase({ status: "pending" }), author)).toBe(false);
  });

  it("подає лише автор: чернетку й повернену; не автор повернену не подає", () => {
    expect(canSubmit(makePurchase({ status: "draft" }), author)).toBe(true);
    expect(canSubmit(makePurchase({ status: "returned" }), author)).toBe(true);
    expect(canSubmit(makePurchase({ status: "returned" }), actor(COLLEAGUE, "requester"))).toBe(false);
    expect(canSubmit(makePurchase({ status: "returned" }), actor(ADMIN, "admin"))).toBe(false);
    expect(canSubmit(makePurchase({ status: "pending" }), author)).toBe(false);
  });

  it("скасування: чернетку, подану, схвалену, частково схвалену й повернену; відхилену й оброблювану — ні", () => {
    for (const status of ["draft", "pending", "approved", "partially_approved", "returned"] as const) {
      expect(canCancel(makePurchase({ status }), author)).toBe(true);
    }
    for (const status of ["rejected", "processing", "processed", "cancelled"] as const) {
      expect(canCancel(makePurchase({ status }), author)).toBe(false);
    }
    expect(canCancel(makePurchase({ status: "pending" }), actor(ADMIN, "admin"))).toBe(false);
  });

  it("редагування поданої автор починає лише поки заявка pending", () => {
    expect(canSetEditing(makePurchase({ status: "pending" }), author)).toBe(true);
    expect(canSetEditing(makePurchase({ status: "approved" }), author)).toBe(false);
    expect(canSetEditing(makePurchase({ status: "pending" }), actor(APPROVER, "approver"))).toBe(false);
  });
});

describe("копія закупівлі", () => {
  it("нова чернетка з тим самим відділом, нотаткою й особою «від імені», усіма рядками без відхилень, без дати доставки", () => {
    const original = makePurchase({
      status: "partially_approved",
      department_id: OFFICE,
      note: "For the spring fair",
      on_behalf_of_id: COLLEAGUE,
      purchase_type: "self",
      delivery_date: "2026-11-01",
    });
    const lines = [
      makeLine({ id: "l2", position: 2, name: "Paper", status: "rejected" }),
      makeLine({ id: "l1", position: 1, name: "Markers", status: "approved" }),
      makeLine({ id: "l3", position: 3, name: "Glue", status: "approved", quantity: 10, unit_price: 1.5 }),
    ];
    const copy = copyPurchase(original, lines);
    expect(copy.draft).toEqual({
      status: "draft",
      department_id: OFFICE,
      note: "For the spring fair",
      on_behalf_of_id: COLLEAGUE,
      purchase_type: "procurement", // тип за замовчуванням, а не скопійований «Самостійна закупівля»
      delivery_date: null,
      editing: false,
    });
    // Усі рядки оригіналу, у порядку позицій; жоден не відхилений.
    expect(copy.lines.map((l) => l.name)).toEqual(["Markers", "Paper", "Glue"]);
    expect(copy.lines.map((l) => l.position)).toEqual([1, 2, 3]);
    expect(copy.lines.every((l) => l.status === "pending")).toBe(true);
    expect(copy.lines[2]).toMatchObject({ quantity: 10, unit_price: 1.5 });
  });

  it("особа «від імені», що вже не допустима, у копію не переноситься", () => {
    const copy = copyPurchase(makePurchase({ on_behalf_of_id: COLLEAGUE }), [makeLine()], false);
    expect(copy.draft.on_behalf_of_id).toBeNull();
  });

  it("копіює лише автор", () => {
    expect(canCopy(makePurchase(), author)).toBe(true);
    expect(canCopy(makePurchase(), actor(ADMIN, "admin"))).toBe(false);
  });
});
