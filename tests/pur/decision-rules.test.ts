// Правила рішень і списків зрізу PUR (tasks.md 1.2, 1.4, 2.3): чисті функції src/lib/pur/decisions.ts без бази.
// Останнє слово — decide_purchase, reopen_purchase, admin_reject_purchase і RLS (design.md D5); це дзеркало, яке
// server action викликає до rpc, а сторінка — щоб показати чи сховати дії (D6, D9).
import { describe, expect, it } from "vitest";
import { NO_APPROVER_LABEL } from "@/lib/org/departments";
import {
  adminRejectAllowed,
  adminRejectOutcome,
  autoApproves,
  awaitingDecision,
  canAdminReject,
  canDecide,
  canReopen,
  decisionBlockReason,
  decisionOutcome,
  decisionQueue,
  forwardedLines,
  reopenAllowed,
} from "@/lib/pur/decisions";
import { submitOutcome } from "@/lib/pur/submission";
import { ADMIN, APPROVER, AUTHOR, COLLEAGUE, OFFICE, OTHER_APPROVER, PRIMARY, actor, approver, makeLine, makePurchase, person } from "./helpers";

const approvers = [approver(PRIMARY, APPROVER), approver(PRIMARY, OTHER_APPROVER), approver(OFFICE, "user-office-head")];
const people = [
  person(AUTHOR),
  person(COLLEAGUE),
  person(APPROVER, "approver"),
  person(OTHER_APPROVER, "approver"),
  person("user-office-head", "approver"),
  person(ADMIN, "admin"),
];

describe("списки для рішення", () => {
  it("AC-PUR-15: схвалювач бачить заявки pending лише своїх відділів, без власних", () => {
    const mine = makePurchase({ id: "r1", department_id: PRIMARY, status: "pending" });
    const otherDepartment = makePurchase({ id: "r2", department_id: OFFICE, status: "pending" });
    const decided = makePurchase({ id: "r3", department_id: PRIMARY, status: "approved" });
    const draft = makePurchase({ id: "r4", department_id: PRIMARY, status: "draft" });
    const own = makePurchase({ id: "r5", department_id: PRIMARY, status: "pending", author_id: APPROVER });
    const onBehalfOfMe = makePurchase({ id: "r6", department_id: PRIMARY, status: "pending", on_behalf_of_id: APPROVER });
    const all = [mine, otherDepartment, decided, draft, own, onBehalfOfMe];

    expect(decisionQueue(all, actor(APPROVER, "approver"), approvers).map((r) => r.id)).toEqual(["r1"]);
    // Інший схвалювач того самого відділу бачить її теж (рішення — будь-якого одного).
    expect(decisionQueue(all, actor(OTHER_APPROVER, "approver"), approvers).map((r) => r.id)).toEqual(["r1", "r5", "r6"]);
    // Заявник без схвалювальних відділів і неактивний схвалювач — порожньо.
    expect(decisionQueue(all, actor(AUTHOR, "requester"), approvers)).toEqual([]);
    expect(decisionQueue(all, actor(APPROVER, "approver", false), approvers)).toEqual([]);
  });

  it("AC-PUR-33: відділ без схвалювачів — заявка очікує, у списку «Чекають рішення» з позначкою, admin вирішує за відділ", () => {
    const request = makePurchase({ department_id: "dep-no-approvers", status: "pending" });
    const admin = actor(ADMIN, "admin");
    expect(awaitingDecision([request], admin, approvers, people)).toEqual([request]);
    expect(NO_APPROVER_LABEL).toBe("No approver");
    expect(canDecide(request, admin, approvers)).toBe(true);
    // Не-admin цього списку не бачить, а схвалювач іншого відділу вирішити не може.
    expect(awaitingDecision([request], actor(APPROVER, "approver"), approvers, people)).toEqual([]);
    expect(canDecide(request, actor(APPROVER, "approver"), approvers)).toBe(false);
    // Відділ зі схвалювачем у список не потрапляє.
    expect(awaitingDecision([makePurchase({ department_id: PRIMARY })], admin, approvers, people)).toEqual([]);
  });

  it("AC-PUR-47: єдиний схвалювач без автосхвалення подає власну закупівлю — «Чекають рішення», вирішує admin", () => {
    const sole = [approver(OFFICE, "user-office-head")];
    const request = makePurchase({ department_id: OFFICE, author_id: "user-office-head", status: "pending" });
    const admin = actor(ADMIN, "admin");
    expect(awaitingDecision([request], admin, sole, people)).toEqual([request]);
    expect(canDecide(request, actor("user-office-head", "approver"), sole)).toBe(false);
    expect(canDecide(request, admin, sole)).toBe(true);
    expect(decisionQueue([request], actor("user-office-head", "approver"), sole)).toEqual([]);
  });

  it("AC-PUR-48: заявку подано від імені єдиного схвалювача — «Чекають рішення», вирішує admin", () => {
    const sole = [approver(OFFICE, "user-office-head")];
    const request = makePurchase({
      department_id: OFFICE,
      author_id: COLLEAGUE,
      on_behalf_of_id: "user-office-head",
      status: "pending",
    });
    const admin = actor(ADMIN, "admin");
    expect(awaitingDecision([request], admin, sole, people)).toEqual([request]);
    expect(canDecide(request, actor("user-office-head", "approver"), sole)).toBe(false);
    expect(canDecide(request, admin, sole)).toBe(true);
    // Другий схвалювач відділу знімає заявку зі списку.
    const two = [...sole, approver(OFFICE, APPROVER)];
    expect(awaitingDecision([request], admin, two, people)).toEqual([]);
  });

  it("AC-PUR-54: єдиний адміністратор — автор заявки відділу без схвалювача: у списку, але без дій, доки не з'явиться інший", () => {
    const request = makePurchase({ department_id: "dep-no-approvers", author_id: ADMIN, status: "pending" });
    const soleAdmin = actor(ADMIN, "admin");
    expect(awaitingDecision([request], soleAdmin, approvers, people)).toEqual([request]);
    expect(canDecide(request, soleAdmin, approvers)).toBe(false);
    expect(decisionBlockReason(request, soleAdmin, approvers)).toBe("own_request");

    // Те саме, коли її подано від імені адміністратора.
    const onBehalf = makePurchase({ department_id: "dep-no-approvers", author_id: AUTHOR, on_behalf_of_id: ADMIN });
    expect(canDecide(onBehalf, soleAdmin, approvers)).toBe(false);

    // З'явився інший активний адміністратор — він вирішує; або схвалювач відділу — заявка зникає зі списку.
    expect(canDecide(request, actor("user-admin-2", "admin"), approvers)).toBe(true);
    const withApprover = [...approvers, approver("dep-no-approvers", APPROVER)];
    expect(awaitingDecision([request], soleAdmin, withApprover, people)).toEqual([]);
    expect(canDecide(request, actor(APPROVER, "approver"), withApprover)).toBe(true);
  });

  it("автосхвалена заявка (approved) і заявки з деактивованим єдиним схвалювачем", () => {
    const admin = actor(ADMIN, "admin");
    expect(awaitingDecision([makePurchase({ status: "approved" })], admin, [], people)).toEqual([]);
    const inactive = [...people.filter((p) => p.id !== APPROVER), person(APPROVER, "approver", false)];
    const request = makePurchase({ department_id: "dep-x", status: "pending" });
    expect(awaitingDecision([request], admin, [approver("dep-x", APPROVER)], inactive)).toEqual([request]);
  });
});

describe("рішення схвалювача", () => {
  const lines = [makeLine({ id: "l1", position: 1 }), makeLine({ id: "l2", position: 2 }), makeLine({ id: "l3", position: 3 })];

  it("AC-PUR-19: схвалити, відхиливши всі рядки, не можна — «Усі рядки відхилено: відхиліть заявку повністю»", () => {
    const outcome = decisionOutcome({ action: "approve", lines, rejectedLineIds: ["l1", "l2", "l3"] });
    expect(outcome).toEqual({ ok: false, error: "all_lines_rejected" });
  });

  it("AC-PUR-20: відхилення без причини не виконується — «Вкажіть причину»", () => {
    for (const reason of [undefined, null, "", "   "]) {
      expect(decisionOutcome({ action: "reject", reason, lines })).toEqual({ ok: false, error: "reason_required" });
    }
  });

  it("AC-PUR-51: повернення на доопрацювання без причини не виконується — «Вкажіть причину»", () => {
    for (const reason of [undefined, null, "", "\n "]) {
      expect(decisionOutcome({ action: "return", reason, lines })).toEqual({ ok: false, error: "reason_required" });
    }
  });

  it("AC-PUR-52: відхилення схваленої заявки відділом закупівель без причини не виконується — «Вкажіть причину»", () => {
    expect(adminRejectOutcome("approved", "")).toEqual({ ok: false, error: "reason_required" });
    expect(adminRejectOutcome("partially_approved", "  ")).toEqual({ ok: false, error: "reason_required" });
    expect(adminRejectOutcome("approved", undefined)).toEqual({ ok: false, error: "reason_required" });
  });

  it("схвалення без відхилених рядків — «Схвалено»; з відхиленим рядком 2 з 3 — «Частково схвалено», рядки 1 і 3 далі", () => {
    const full = decisionOutcome({ action: "approve", lines });
    expect(full).toMatchObject({ ok: true, status: "approved", historyAction: "approved", reason: null });
    if (full.ok) expect(Object.values(full.lineStatuses)).toEqual(["approved", "approved", "approved"]);

    const partial = decisionOutcome({ action: "approve", lines, rejectedLineIds: ["l2"] });
    expect(partial).toMatchObject({ ok: true, status: "partially_approved", historyAction: "partially_approved" });
    if (partial.ok) {
      expect(partial.lineStatuses).toEqual({ l1: "approved", l2: "rejected", l3: "approved" });
      const after = lines.map((l) => ({ ...l, status: partial.lineStatuses[l.id] }));
      expect(forwardedLines(after).map((l) => l.id)).toEqual(["l1", "l3"]);
    }
  });

  it("AC-PUR-39: схвалення без відхилених рядків додає в історію запис «approved» (автора й час додає база)", () => {
    const outcome = decisionOutcome({ action: "approve", lines });
    expect(outcome).toMatchObject({ ok: true, status: "approved", historyAction: "approved" });
  });

  it("AC-PUR-41: відхилений рядок 2 з 3 позначено «rejected», рядки 1 і 3 — «approved»", () => {
    const outcome = decisionOutcome({ action: "approve", lines, rejectedLineIds: ["l2"] });
    expect(outcome).toMatchObject({ ok: true, status: "partially_approved" });
    if (outcome.ok) expect(outcome.lineStatuses).toEqual({ l1: "approved", l2: "rejected", l3: "approved" });
  });

  it("AC-PUR-42: далі до відділу закупівель ідуть лише 2 схвалені рядки з 3, відхилений рядок 2 — ні", () => {
    const outcome = decisionOutcome({ action: "approve", lines, rejectedLineIds: ["l2"] });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const decided = lines.map((l) => ({ ...l, status: outcome.lineStatuses[l.id] }));
      expect(forwardedLines(decided).map((l) => l.id)).toEqual(["l1", "l3"]);
    }
  });

  it("AC-PUR-43: відхилення з причиною «Не передбачено бюджетом» зберігає її для автора", () => {
    const outcome = decisionOutcome({ action: "reject", reason: "Не передбачено бюджетом", lines });
    expect(outcome).toMatchObject({ ok: true, status: "rejected", reason: "Не передбачено бюджетом" });
  });

  it("відхилення й повернення з причиною: статус, запис історії, рядки не змінюються", () => {
    expect(decisionOutcome({ action: "reject", reason: " Не передбачено бюджетом ", lines })).toEqual({
      ok: true,
      status: "rejected",
      historyAction: "rejected",
      reason: "Не передбачено бюджетом",
      lineStatuses: {},
    });
    expect(decisionOutcome({ action: "return", reason: "Уточніть кількість", lines })).toEqual({
      ok: true,
      status: "returned",
      historyAction: "returned",
      reason: "Уточніть кількість",
      lineStatuses: {},
    });
  });

  it("відхилений рядок, якого немає в заявці, не приймається", () => {
    expect(decisionOutcome({ action: "approve", lines, rejectedLineIds: ["nope"] })).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("хто може вирішити", () => {
  const request = makePurchase({ status: "pending", on_behalf_of_id: COLLEAGUE });

  it("автор і особа «від імені» не вирішують за жодної ролі; схвалювач відділу й admin — вирішують", () => {
    expect(canDecide(request, actor(AUTHOR, "requester"), approvers)).toBe(false);
    expect(canDecide(request, actor(AUTHOR, "admin"), approvers)).toBe(false);
    expect(canDecide(request, actor(COLLEAGUE, "approver"), [...approvers, approver(PRIMARY, COLLEAGUE)])).toBe(false);
    expect(decisionBlockReason(request, actor(COLLEAGUE, "requester"), approvers)).toBe("own_request");
    expect(canDecide(request, actor(APPROVER, "approver"), approvers)).toBe(true);
    expect(canDecide(request, actor(ADMIN, "admin"), approvers)).toBe(true);
  });

  it("схвалювач іншого відділу, неактивний admin і не-схвалювач не вирішують", () => {
    expect(canDecide(request, actor("user-office-head", "approver"), approvers)).toBe(false);
    expect(canDecide(request, actor(ADMIN, "admin", false), approvers)).toBe(false);
    expect(canDecide(request, actor(AUTHOR + "-2", "requester"), approvers)).toBe(false);
  });

  it("причини блокування — у порядку decide_purchase: власна заявка, право, чернетка, статус, редагування автором", () => {
    const approverActor = actor(APPROVER, "approver");
    expect(decisionBlockReason(makePurchase({ status: "approved" }), approverActor, approvers)).toBe("already_decided");
    expect(decisionBlockReason(makePurchase({ status: "draft" }), approverActor, approvers)).toBe("not_found");
    expect(decisionBlockReason(makePurchase({ status: "approved" }), actor(AUTHOR + "-2", "requester"), approvers)).toBe("forbidden");
    expect(decisionBlockReason(makePurchase({ status: "pending", editing: true }), approverActor, approvers)).toBe("author_editing");
    expect(decisionBlockReason(makePurchase({ status: "pending", editing: true }), actor(AUTHOR, "requester"), approvers)).toBe(
      "own_request",
    );
    expect(decisionBlockReason(makePurchase({ status: "pending" }), actor(AUTHOR, "requester"), approvers)).toBe("own_request");
    expect(decisionBlockReason(makePurchase({ status: "pending" }), approverActor, approvers)).toBeNull();
  });
});

describe("автосхвалення", () => {
  const memberships = [
    { department_id: OFFICE, user_id: AUTHOR, auto_approve: true },
    { department_id: PRIMARY, user_id: AUTHOR, auto_approve: false },
  ];

  it("лише автор з автосхваленням саме цього відділу", () => {
    expect(autoApproves({ author_id: AUTHOR, department_id: OFFICE }, memberships)).toBe(true);
    expect(autoApproves({ author_id: AUTHOR, department_id: PRIMARY }, memberships)).toBe(false);
    expect(autoApproves({ author_id: COLLEAGUE, department_id: OFFICE }, memberships)).toBe(false);
    expect(autoApproves({ author_id: AUTHOR, department_id: null }, memberships)).toBe(false);
  });
});

describe("автосхвалення єдиного схвалювача", () => {
  // Автор — водночас єдиний схвалювач відділу «Офіс» і має там автосхвалення.
  const memberships = [{ department_id: OFFICE, user_id: APPROVER, auto_approve: true }];
  const soleApprover = [approver(OFFICE, APPROVER)];
  const own = makePurchase({ author_id: APPROVER, department_id: OFFICE, status: "pending" });

  it("AC-PUR-53: власна закупівля єдиного схвалювача з автосхваленням — одразу «Схвалено», не «Чекають рішення»", () => {
    const outcome = submitOutcome(own, memberships);
    expect(outcome.status).toBe("approved");

    // Після подання заявка вже approved: у списках рішення її немає ні в схвалювача, ні в admin.
    const submitted = { ...own, status: outcome.status };
    const approverActor = actor(APPROVER, "approver");
    expect(decisionQueue([submitted], approverActor, soleApprover)).toEqual([]);
    expect(awaitingDecision([submitted], actor(ADMIN, "admin"), soleApprover, people)).toEqual([]);
    expect(canDecide(submitted, approverActor, soleApprover)).toBe(false);
  });
});

describe("дії відділу закупівель", () => {
  it("відхилити можна схвалену й частково схвалену, «В обробці» й «Оброблено» — ні", () => {
    expect(adminRejectAllowed("approved")).toBe(true);
    expect(adminRejectAllowed("partially_approved")).toBe(true);
    for (const status of ["processing", "processed", "pending", "draft", "rejected", "cancelled"] as const) {
      expect(adminRejectAllowed(status)).toBe(false);
    }
    expect(adminRejectOutcome("processing", "Закупівлю скасовано")).toEqual({ ok: false, error: "cannot_reject" });
    expect(adminRejectOutcome("approved", " Закупівлю скасовано ")).toEqual({ ok: true, reason: "Закупівлю скасовано" });
    expect(canAdminReject({ status: "approved" }, actor(ADMIN, "admin"))).toBe(true);
    expect(canAdminReject({ status: "approved" }, actor(APPROVER, "approver"))).toBe(false);
    expect(canAdminReject({ status: "processing" }, actor(ADMIN, "admin"))).toBe(false);
  });

  it("повернути на схвалення відхилену й повернуту може лише admin", () => {
    expect(reopenAllowed("rejected")).toBe(true);
    expect(reopenAllowed("returned")).toBe(true);
    expect(reopenAllowed("approved")).toBe(false);
    expect(reopenAllowed("cancelled")).toBe(false);
    expect(canReopen({ status: "rejected" }, actor(ADMIN, "admin"))).toBe(true);
    expect(canReopen({ status: "returned" }, actor(ADMIN, "admin"))).toBe(true);
    expect(canReopen({ status: "rejected" }, actor(APPROVER, "approver"))).toBe(false);
    expect(canReopen({ status: "rejected" }, actor(AUTHOR, "requester"))).toBe(false);
    expect(canReopen({ status: "rejected" }, actor(ADMIN, "admin", false))).toBe(false);
  });
});
