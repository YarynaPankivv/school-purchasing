// Задача 1 зрізу PUR (openspec/changes/impl-pur/tasks.md 1.2, 1.4): рядки, суми, ліміти, номер, статуси, час.
// Чисті правила src/lib/pur/* без бази. SQL-правила (CHECK-и, тригери номера й порожнього рядка) перевіряє db-check;
// тут — дзеркало для форм і server actions (design.md D9).
import { describe, expect, it } from "vitest";
import { selectableDepartments } from "@/lib/org/departments";
import {
  DELIVERY_DATE_INVALID,
  LINE_NAME_MAX,
  NOTE_MAX,
  emptyLine,
  incompleteLines,
  incompleteLinesMessage,
  isKnownInvalidDetail,
  isLineComplete,
  parseLineFields,
  parseLineName,
  parseNote,
  parseQuantity,
  parseUnitPrice,
} from "@/lib/pur/lines";
import { formatPurchaseNumber, nextPurchaseNumber, parsePurchaseNumber, purchaseNumberLabel } from "@/lib/pur/numbers";
import {
  PURCHASE_STATUS_LABELS,
  areFieldsEditable,
  cancelOutcome,
  isEditableByAuthor,
  isLineStatus,
  isPurchaseStatus,
  isTerminal,
  purchaseStatusLabel,
} from "@/lib/pur/statuses";
import { formatDate, formatDateTime } from "@/lib/pur/time";
import { formatUsd, lineTotal, lineTotalCents, requestTotal } from "@/lib/pur/totals";

describe("AC-PUR-04: вибір відділу", () => {
  const departments = [
    { id: "dep-office", name: "Офіс" },
    { id: "dep-primary", name: "Початкова школа" },
    { id: "dep-high", name: "Вища школа" },
  ];
  const memberships = [
    { department_id: "dep-primary", user_id: "author" },
    { department_id: "dep-office", user_id: "author" },
    { department_id: "dep-high", user_id: "someone-else" },
  ];

  it("AC-PUR-04: автор бачить лише відділи, де він заявник, а адміністратор — усі", () => {
    const own = selectableDepartments(departments, memberships, "author", "requester");
    expect(own.map((d) => d.name).sort()).toEqual(["Офіс", "Початкова школа"]);
    expect(selectableDepartments(departments, memberships, "admin", "admin")).toHaveLength(3);
  });
});

describe("суми рядка й заявки", () => {
  it("AC-PUR-06: кількість 3 і ціна 20.00 дають 60.00, а сума заявки — суму всіх рядків", () => {
    expect(lineTotal({ quantity: 3, unit_price: 20 })).toBe(60);
    const lines = [
      { quantity: 3, unit_price: 20 },
      { quantity: 2, unit_price: 12.5 },
      { quantity: 1, unit_price: 0 },
    ];
    expect(requestTotal(lines)).toBe(85);
    expect(requestTotal(lines)).toBe(lines.reduce((s, l) => s + lineTotal(l), 0));
  });

  it("порожній рядок чернетки дає 0, а копійки не накопичують похибку float", () => {
    expect(lineTotalCents({ quantity: null, unit_price: 20 })).toBe(0);
    expect(lineTotalCents({ quantity: 3, unit_price: null })).toBe(0);
    expect(lineTotal({ quantity: 3, unit_price: 0.1 })).toBe(0.3);
    expect(requestTotal([])).toBe(0);
  });

  it("сума форматується як долари США з двома знаками", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(60)).toBe("$60.00");
  });
});

describe("кількість, ціна й ліміти тексту", () => {
  it("AC-PUR-07: кількість 0, неціла кількість і від'ємна ціна не приймаються, повідомлення називає поле", () => {
    for (const bad of [0, "0", 1.5, "2.5", -1, "abc"]) {
      const result = parseQuantity(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/^Quantity /);
    }
    for (const bad of [-1, "-0.01", "-5", "1.234", "abc"]) {
      const result = parseUnitPrice(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/^Unit price /);
    }
    const form = parseLineFields({ name: "Markers", purpose: "Class", quantity: "0", unit_price: "-1" });
    expect(form.ok).toBe(false);
    if (!form.ok) expect(Object.keys(form.errors).sort()).toEqual(["quantity", "unit_price"]);
  });

  it("AC-PUR-08: ціна 0 (невідома) приймається; допустимі кількість і ціна проходять", () => {
    expect(parseUnitPrice(0)).toEqual({ ok: true, value: 0 });
    expect(parseUnitPrice("0")).toEqual({ ok: true, value: 0 });
    expect(parseUnitPrice("0.00")).toEqual({ ok: true, value: 0 });
    expect(parseUnitPrice("20.5")).toEqual({ ok: true, value: 20.5 });
    expect(parseQuantity("3")).toEqual({ ok: true, value: 3 });
    expect(isLineComplete({ name: "Markers", purpose: "Class", quantity: 1, unit_price: 0 })).toBe(true);
  });

  it("порожнє поле чернетки дозволено й дає null", () => {
    expect(parseQuantity("")).toEqual({ ok: true, value: null });
    expect(parseUnitPrice("  ")).toEqual({ ok: true, value: null });
    expect(parseLineName(null)).toEqual({ ok: true, value: null });
    expect(parseNote(undefined)).toEqual({ ok: true, value: null });
  });

  it("AC-PUR-10: назва понад 500 і нотатка понад 2000 символів не приймаються з лімітом у повідомленні", () => {
    expect(parseLineName("a".repeat(LINE_NAME_MAX))).toEqual({ ok: true, value: "a".repeat(LINE_NAME_MAX) });
    const longName = parseLineName("a".repeat(LINE_NAME_MAX + 1));
    expect(longName.ok).toBe(false);
    if (!longName.ok) expect(longName.error).toContain("500");

    expect(parseNote("b".repeat(NOTE_MAX)).ok).toBe(true);
    const longNote = parseNote("b".repeat(NOTE_MAX + 1));
    expect(longNote.ok).toBe(false);
    if (!longNote.ok) expect(longNote.error).toContain("2000");
  });

  it("ліміт рахує символи як Postgres char_length: емодзі — один символ", () => {
    expect(parseLineName("😀".repeat(LINE_NAME_MAX)).ok).toBe(true);
    expect(parseLineName("😀".repeat(LINE_NAME_MAX + 1)).ok).toBe(false);
  });
});

describe("повнота рядків для подання", () => {
  it("незаповнені рядки: повідомлення називає всі незаповнені рядки й поля, ціна 0 — заповнена", () => {
    const lines = [
      { position: 1, name: "Markers", purpose: "Class", quantity: 3, unit_price: 0 },
      { position: 2, name: "", purpose: " ", quantity: 2, unit_price: 5 },
      { position: 3, name: "Paper", purpose: "Office", quantity: null, unit_price: null },
    ];
    const list = incompleteLines(lines);
    expect(list).toEqual([
      { number: 2, position: 2, fields: ["name", "purpose"] },
      { number: 3, position: 3, fields: ["quantity", "unit_price"] },
    ]);
    expect(incompleteLinesMessage(list)).toBe(
      "Fill in all line fields. Line 2: name, purpose; Line 3: quantity, unit price.",
    );
  });

  it("порожній рядок нової чернетки — неповний, усі чотири поля", () => {
    const line = emptyLine();
    expect(line).toMatchObject({ position: 1, name: null, purpose: null, quantity: null, unit_price: null, status: "pending" });
    expect(isLineComplete(line)).toBe(false);
    expect(incompleteLines([line])[0].fields).toEqual(["name", "purpose", "quantity", "unit_price"]);
  });
});

describe("номер PUR-N", () => {
  it("формат без провідних нулів і розбір", () => {
    expect(formatPurchaseNumber(1)).toBe("PUR-1");
    expect(formatPurchaseNumber(1042)).toBe("PUR-1042");
    expect(parsePurchaseNumber("PUR-1042")).toBe(1042);
    expect(parsePurchaseNumber("pur-7")).toBe(7);
    expect(parsePurchaseNumber("PUR-007")).toBeNull();
    expect(parsePurchaseNumber("PUR-0")).toBeNull();
    expect(parsePurchaseNumber("RMB-5")).toBeNull();
    expect(parsePurchaseNumber(5)).toBeNull();
    expect(purchaseNumberLabel(null)).toBe("—");
    expect(() => formatPurchaseNumber(0)).toThrow(RangeError);
  });

  it("найперша закупівля — PUR-1, далі — на одиницю більше за останній виданий", () => {
    expect(nextPurchaseNumber(null)).toBe(1);
    expect(nextPurchaseNumber(0)).toBe(1);
    expect(nextPurchaseNumber(41)).toBe(42);
  });
});

describe("статуси", () => {
  it("type-guards не пропускають ключі прототипу", () => {
    expect(isPurchaseStatus("pending")).toBe(true);
    expect(isPurchaseStatus("toString")).toBe(false);
    expect(isPurchaseStatus("__proto__")).toBe(false);
    expect(isLineStatus("rejected")).toBe(true);
    expect(isLineStatus("constructor")).toBe(false);
    expect(purchaseStatusLabel("pending")).toBe(PURCHASE_STATUS_LABELS.pending);
    expect(purchaseStatusLabel("weird")).toBe("weird");
  });

  it("редагування: чернетка, повернена й подана з editing; відхилену не редагують", () => {
    expect(isEditableByAuthor("draft", false)).toBe(true);
    expect(isEditableByAuthor("returned", false)).toBe(true);
    expect(isEditableByAuthor("pending", false)).toBe(false);
    expect(isEditableByAuthor("pending", true)).toBe(true);
    for (const status of ["rejected", "approved", "partially_approved", "cancelled", "processing", "processed"] as const) {
      expect(isEditableByAuthor(status, true)).toBe(false);
    }
    expect(areFieldsEditable("pending")).toBe(false);
  });

  it("скасування: чернетка видаляється, подана — «Скасовано», відхилену й оброблювану не скасувати", () => {
    expect(cancelOutcome("draft")).toBe("delete");
    for (const status of ["pending", "approved", "partially_approved", "returned"] as const) {
      expect(cancelOutcome(status)).toBe("cancel");
    }
    for (const status of ["rejected", "processing", "processed", "cancelled"] as const) {
      expect(cancelOutcome(status)).toBeNull();
    }
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("rejected")).toBe(false);
  });
});

describe("час у America/New_York", () => {
  it("момент показується за часом Нью-Йорка, зима й літо різні", () => {
    expect(formatDateTime("2026-10-21T19:45:00Z")).toBe("Oct 21, 2026, 3:45 PM EDT");
    expect(formatDateTime("2026-12-21T19:45:00Z")).toBe("Dec 21, 2026, 2:45 PM EST");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("not a date")).toBe("—");
  });

  it("календарна дата не зсувається часовим поясом", () => {
    expect(formatDate("2026-10-21")).toBe("Oct 21, 2026");
    expect(formatDate("2026-02-31")).toBe("—");
    expect(formatDate(null)).toBe("—");
  });
});

// Без AC PM: текст помилки приходить на сторінку в адресі, тож підроблене «системне» повідомлення не показуємо.
describe("isKnownInvalidDetail", () => {
  it("accepts messages built from our own validation phrases", () => {
    expect(isKnownInvalidDetail(DELIVERY_DATE_INVALID)).toBe(true);
    expect(isKnownInvalidDetail("Quantity must be a whole number of 1 or more. Purpose must be text.")).toBe(true);
    expect(isKnownInvalidDetail(`Note must be at most ${NOTE_MAX} characters.`)).toBe(true);
  });

  it("rejects text that did not come from our validators", () => {
    expect(isKnownInvalidDetail("Your account is locked. Call 555-0100 to unlock it.")).toBe(false);
    expect(isKnownInvalidDetail(`${DELIVERY_DATE_INVALID} Call 555-0100.`)).toBe(false);
    expect(isKnownInvalidDetail("")).toBe(false);
  });
});
