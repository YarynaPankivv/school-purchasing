// Задача 1 зрізу PUR (tasks.md 1.2, 1.4): перевірка перед поданням, «від імені», результат подання, коди помилок.
// SQL-правила (submit_purchase, guard_request_update) перевіряє db-check і ручний прохід після db-deploy;
// тут — дзеркало, яке server action викликає до rpc (design.md D5, D9).
import { describe, expect, it } from "vitest";
import { PUR_ERROR_MESSAGES, mapPurDbError, purErrorMessage, purErrorText } from "@/lib/pur/errors";
import { purchaseOnBehalfCandidates, resolveOnBehalf } from "@/lib/pur/on-behalf";
import { checkSubmission, submitOutcome } from "@/lib/pur/submission";
import { ADMIN, AUTHOR, COLLEAGUE, OFFICE, PRIMARY, makePurchase, person } from "./helpers";

const completeLine = { position: 1, name: "Markers", purpose: "Class", quantity: 3, unit_price: 20 };
const noOnBehalf = { flag: false, colleagueId: null };

describe("перевірка перед поданням", () => {
  it("AC-PUR-05: чернетка без відділу не подається, автор бачить «Оберіть відділ» (англійською)", () => {
    const result = checkSubmission({ departmentId: null, onBehalf: noOnBehalf, lines: [completeLine] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([{ code: "department_required", message: "Select a department" }]);
    }
  });

  it("AC-PUR-09: незаповнені рядки названо в повідомленні — усі рядки й поля", () => {
    const result = checkSubmission({
      departmentId: PRIMARY,
      onBehalf: noOnBehalf,
      lines: [
        { position: 1, name: null, purpose: "Class", quantity: 3, unit_price: 20 },
        completeLine,
        { position: 3, name: "Paper", purpose: "", quantity: 0, unit_price: null },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe("lines_incomplete");
      expect(result.issues[0].message).toContain("Line 1: name");
      expect(result.issues[0].message).toContain("Line 3: purpose, quantity, unit price");
      expect(result.issues[0].message).not.toContain("Line 2");
    }
  });

  it("AC-PUR-12: позначка «від імені колеги» без вибору колеги — заявку не подано, текст з вимоги PM", () => {
    const result = checkSubmission({
      departmentId: PRIMARY,
      onBehalf: { flag: true, colleagueId: null },
      lines: [completeLine],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { code: "on_behalf_required", message: "Select the colleague you are submitting on behalf of" },
      ]);
    }
  });

  it("заявка без жодного рядка не подається", () => {
    const result = checkSubmission({ departmentId: PRIMARY, onBehalf: noOnBehalf, lines: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.code)).toEqual(["lines_required"]);
  });

  it("коректна чернетка проходить; помилки збираються разом", () => {
    expect(checkSubmission({ departmentId: PRIMARY, onBehalf: noOnBehalf, lines: [completeLine] })).toEqual({ ok: true });
    const all = checkSubmission({
      departmentId: null,
      onBehalf: { flag: true, colleagueId: null },
      lines: [{ position: 1, name: null, purpose: null, quantity: null, unit_price: null }],
    });
    expect(all.ok).toBe(false);
    if (!all.ok) expect(all.issues.map((i) => i.code)).toEqual(["department_required", "on_behalf_required", "lines_incomplete"]);
  });
});

describe("колеги «від імені»", () => {
  const people = [
    person(AUTHOR),
    person(COLLEAGUE),
    person("user-colleague-2"),
    person("user-office"), // не з відділу заявки
    person("user-sleeping", "requester", false), // деактивований
    person(ADMIN, "admin"),
  ];
  const memberships = [AUTHOR, COLLEAGUE, "user-colleague-2", "user-sleeping", ADMIN].map((user_id) => ({
    department_id: PRIMARY,
    user_id,
  }));
  memberships.push({ department_id: OFFICE, user_id: "user-office" });
  const request = { department_id: PRIMARY, author_id: AUTHOR };

  it("AC-PUR-13: у списку лише колеги з відділу заявки, крім автора, адміністраторів і деактивованих; адміністратор обирає будь-кого", () => {
    const ids = purchaseOnBehalfCandidates(request, memberships, people, "requester").map((p) => p.id);
    expect(ids.sort()).toEqual([COLLEAGUE, "user-colleague-2"].sort());

    const adminIds = purchaseOnBehalfCandidates({ department_id: PRIMARY, author_id: ADMIN }, memberships, people, "admin").map(
      (p) => p.id,
    );
    expect(adminIds).toContain("user-office");
    expect(adminIds).not.toContain(ADMIN);
    expect(adminIds).not.toContain("user-sleeping");
  });

  it("без відділу не-admin не отримує кандидатів; обраний поза списком не приймається", () => {
    expect(purchaseOnBehalfCandidates({ department_id: null, author_id: AUTHOR }, memberships, people, "requester")).toEqual([]);
    const candidates = purchaseOnBehalfCandidates(request, memberships, people, "requester");
    expect(resolveOnBehalf({ flag: true, colleagueId: "user-office" }, candidates)).toEqual({
      ok: false,
      error: "on_behalf_invalid",
    });
    expect(resolveOnBehalf({ flag: true, colleagueId: COLLEAGUE }, candidates)).toEqual({ ok: true, onBehalfId: COLLEAGUE });
    // Без позначки колега скидається, навіть якщо його лишили у формі.
    expect(resolveOnBehalf({ flag: false, colleagueId: COLLEAGUE }, candidates)).toEqual({ ok: true, onBehalfId: null });
    expect(resolveOnBehalf({ flag: true, colleagueId: null }, candidates)).toEqual({ ok: false, error: "on_behalf_required" });
  });
});

describe("результат подання", () => {
  const memberships = [
    { department_id: OFFICE, user_id: AUTHOR, auto_approve: true },
    { department_id: PRIMARY, user_id: AUTHOR, auto_approve: false },
    { department_id: PRIMARY, user_id: COLLEAGUE, auto_approve: true },
  ];

  it("автосхвалення автора у відділі заявки — одразу «Схвалено», історія «Подано» і «Схвалено»", () => {
    expect(submitOutcome({ author_id: AUTHOR, department_id: OFFICE }, memberships)).toEqual({
      status: "approved",
      history: ["submitted", "approved"],
      lineStatus: "approved",
    });
  });

  it("без автосхвалення (чужий відділ, чуже членство) — «Очікує схвалення» й запис «Подано»", () => {
    const expected = { status: "pending", history: ["submitted"], lineStatus: "pending" };
    expect(submitOutcome({ author_id: AUTHOR, department_id: PRIMARY }, memberships)).toEqual(expected);
    expect(submitOutcome({ author_id: "user-nobody", department_id: OFFICE }, memberships)).toEqual(expected);
    expect(submitOutcome({ author_id: AUTHOR, department_id: null }, memberships)).toEqual(expected);
    // Автосхвалення колеги ніяк не діє на заявку автора.
    expect(submitOutcome(makePurchase({ author_id: AUTHOR, department_id: PRIMARY }), memberships).status).toBe("pending");
  });
});

describe("помилки бази", () => {
  it("код pur:<код> у message винятку P0001 → код і текст", () => {
    expect(mapPurDbError({ code: "P0001", message: "pur:reason_required" })).toBe("reason_required");
    expect(mapPurDbError({ code: "P0001", message: "pur:already_decided" })).toBe("already_decided");
    expect(mapPurDbError({ code: "P0001", message: "pur:all_lines_rejected", details: null })).toBe("all_lines_rejected");
    expect(PUR_ERROR_MESSAGES.reason_required).toBe("Provide a reason");
  });

  it("усі коди з design.md D5 розпізнаються", () => {
    const codes = [
      "department_required",
      "lines_incomplete",
      "lines_required",
      "forbidden",
      "author_editing",
      "already_decided",
      "own_request",
      "all_lines_rejected",
      "reason_required",
      "cannot_reject",
      "cannot_cancel",
      "department_locked",
      "purchase_type_forbidden",
      "immutable",
      "on_behalf_invalid",
      "invalid_status",
      "not_found",
      "invalid_line",
      "invalid_action",
    ];
    for (const code of codes) {
      expect(mapPurDbError({ code: "P0001", message: `pur:${code}` })).toBe(code);
      expect(purErrorMessage(code)).toBe(PUR_ERROR_MESSAGES[code as keyof typeof PUR_ERROR_MESSAGES]);
    }
  });

  it("pur:lines_incomplete з DETAIL «позиція:поля;…» дає повідомлення з рядками й полями (AC-PUR-09)", () => {
    const error = { code: "P0001", message: "pur:lines_incomplete", details: "1:name,purpose;3:quantity,unit_price" };
    expect(purErrorText(error)).toBe(
      "Fill in all line fields before submitting. Line 1: name, purpose; Line 3: quantity, unit price.",
    );
    expect(purErrorText({ code: "P0001", message: "pur:lines_incomplete", details: null })).toBe(
      PUR_ERROR_MESSAGES.lines_incomplete,
    );
    expect(purErrorText({ code: "P0001", message: "pur:reason_required" })).toBe("Provide a reason");
  });

  it("клієнтські коди з тексту винятку не приймаються, RLS і CHECK мапляться, решта — unknown", () => {
    expect(mapPurDbError({ code: "P0001", message: "pur:on_behalf_required" })).toBe("unknown");
    expect(mapPurDbError({ code: "P0001", message: "something else" })).toBe("unknown");
    expect(mapPurDbError({ code: "42501" })).toBe("forbidden");
    expect(mapPurDbError({ code: "23514" })).toBe("invalid_input");
    expect(mapPurDbError(null)).toBe("unknown");
    expect(purErrorMessage("toString")).toBeUndefined();
    expect(purErrorMessage(undefined)).toBeUndefined();
  });
});
