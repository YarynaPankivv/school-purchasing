// Рядки закупівлі: перевірка введеного, повнота для подання (AC-PUR-05…10; design.md D3).
// Останнє слово — за базою: CHECK-и request_lines (quantity ≥ 1, unit_price ≥ 0, name ≤ 500) і функція submit_purchase.
// Ці функції — дзеркало для форм, server actions і тестів; змінюйте їх разом.
import type { LineRow } from "./types";

export const LINE_NAME_MAX = 500; // AC-PUR-10
export const NOTE_MAX = 2000; // AC-PUR-10
// Межі колонок: quantity integer, unit_price numeric(12,2). Поза ними Postgres віддає 22003, тож відсікаємо раніше.
export const QUANTITY_MAX = 2_147_483_647;
export const UNIT_PRICE_MAX_CENTS = 999_999_999_999; // 9 999 999 999.99

// Поля, які вводить автор, — підмножина LineRow (без id, заявки й статусу).
export type LineFields = Pick<LineRow, "name" | "purpose" | "quantity" | "unit_price">;

export type LineField = keyof LineFields;

// Назви полів у повідомленнях (AC-PUR-07, 09: повідомлення називає поле).
export const LINE_FIELD_LABELS: Record<LineField, string> = {
  name: "name",
  purpose: "purpose",
  quantity: "quantity",
  unit_price: "unit price",
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const isBlank = (raw: unknown) => raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");

// Postgres char_length рахує символи (кодові точки), а JS length — одиниці UTF-16: емодзі дає 2.
const charLength = (text: string) => Array.from(text).length;

// Порожнє поле чернетки дозволено (null): повноту перевіряє подання (isLineComplete).
export function parseQuantity(raw: unknown): ParseResult<number | null> {
  if (isBlank(raw)) return { ok: true, value: null };
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  const value = /^[0-9]+$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(value) || value < 1 || value > QUANTITY_MAX) {
    return { ok: false, error: "Quantity must be a whole number of 1 or more." }; // AC-PUR-07
  }
  return { ok: true, value };
}

// Ціна 0 — «ціна невідома» (AC-PUR-08); від'ємну й із понад двома знаками відхиляємо (AC-PUR-07).
export function parseUnitPrice(raw: unknown): ParseResult<number | null> {
  if (isBlank(raw)) return { ok: true, value: null };
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  const match = /^([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(text);
  const cents = match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : NaN;
  if (!Number.isSafeInteger(cents) || cents > UNIT_PRICE_MAX_CENTS) {
    return { ok: false, error: "Unit price must be 0 or more, with at most 2 decimal places." }; // AC-PUR-07
  }
  return { ok: true, value: cents / 100 };
}

// Назва рядка ≤ 500 символів (AC-PUR-10); пробіли по краях відкидаємо, порожнє → null.
export function parseLineName(raw: unknown): ParseResult<string | null> {
  if (isBlank(raw)) return { ok: true, value: null };
  const text = typeof raw === "string" ? raw.trim() : "";
  if (typeof raw !== "string" || charLength(text) > LINE_NAME_MAX) {
    return { ok: false, error: `Name must be at most ${LINE_NAME_MAX} characters.` };
  }
  return { ok: true, value: text };
}

// Мета рядка: ліміту в специфікації немає, лише текст; порожнє → null.
export function parseLinePurpose(raw: unknown): ParseResult<string | null> {
  if (isBlank(raw)) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Purpose must be text." };
  return { ok: true, value: raw.trim() };
}

// Нотатка заявки ≤ 2000 символів (AC-PUR-10).
export function parseNote(raw: unknown): ParseResult<string | null> {
  if (isBlank(raw)) return { ok: true, value: null };
  const text = typeof raw === "string" ? raw.trim() : "";
  if (typeof raw !== "string" || charLength(text) > NOTE_MAX) {
    return { ok: false, error: `Note must be at most ${NOTE_MAX} characters.` };
  }
  return { ok: true, value: text };
}

// Усі поля рядка з форми: або нормалізований рядок, або повідомлення по кожному хибному полю.
export function parseLineFields(raw: {
  name?: unknown;
  purpose?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
}): { ok: true; value: LineFields } | { ok: false; errors: Partial<Record<LineField, string>> } {
  const name = parseLineName(raw.name);
  const purpose = parseLinePurpose(raw.purpose);
  const quantity = parseQuantity(raw.quantity);
  const unitPrice = parseUnitPrice(raw.unit_price);
  if (name.ok && purpose.ok && quantity.ok && unitPrice.ok) {
    return {
      ok: true,
      value: { name: name.value, purpose: purpose.value, quantity: quantity.value, unit_price: unitPrice.value },
    };
  }
  const errors: Partial<Record<LineField, string>> = {};
  if (!name.ok) errors.name = name.error;
  if (!purpose.ok) errors.purpose = purpose.error;
  if (!quantity.ok) errors.quantity = quantity.error;
  if (!unitPrice.ok) errors.unit_price = unitPrice.error;
  return { ok: false, errors };
}

// Порожній рядок нової чернетки (AC-PUR-01; у базі його додає тригер after insert, D3).
export function emptyLine(position = 1): LineFields & Pick<LineRow, "position" | "status"> {
  return { position, name: null, purpose: null, quantity: null, unit_price: null, status: "pending" };
}

const hasText = (value: string | null | undefined) => typeof value === "string" && value.trim() !== "";

// Поля, яких бракує рядку для подання. Ціна 0 — заповнена (AC-PUR-08), порожня — ні (AC-PUR-09).
export function missingLineFields(line: LineFields): LineField[] {
  const missing: LineField[] = [];
  if (!hasText(line.name)) missing.push("name");
  if (!hasText(line.purpose)) missing.push("purpose");
  if (line.quantity === null || line.quantity === undefined || !Number.isInteger(line.quantity) || line.quantity < 1) {
    missing.push("quantity");
  }
  if (line.unit_price === null || line.unit_price === undefined || !(line.unit_price >= 0)) missing.push("unit_price");
  return missing;
}

export function isLineComplete(line: LineFields): boolean {
  return missingLineFields(line).length === 0;
}

export type IncompleteLine = { number: number; position: number; fields: LineField[] };

// Усі незаповнені рядки й поля (AC-PUR-09). number — порядковий номер у списку, який бачить автор (від 1).
export function incompleteLines(lines: readonly (LineFields & { position?: number })[]): IncompleteLine[] {
  const ordered = lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => (a.line.position ?? a.index + 1) - (b.line.position ?? b.index + 1) || a.index - b.index);
  const result: IncompleteLine[] = [];
  ordered.forEach(({ line, index }, i) => {
    const fields = missingLineFields(line);
    if (fields.length > 0) result.push({ number: i + 1, position: line.position ?? index + 1, fields });
  });
  return result;
}

// DETAIL винятку pur:lines_incomplete — «позиція:поле,поле;позиція:поле» (submit_purchase). Невідомі поля відкидаємо.
export function incompleteLinesFromDetail(detail: string | null | undefined): IncompleteLine[] {
  if (!detail) return [];
  const result: IncompleteLine[] = [];
  for (const part of detail.split(";")) {
    const [rawPosition, rawFields = ""] = part.split(":");
    const position = Number(rawPosition);
    const fields = rawFields.split(",").filter((f): f is LineField => Object.hasOwn(LINE_FIELD_LABELS, f));
    if (Number.isInteger(position) && fields.length > 0) result.push({ number: position, position, fields });
  }
  return result;
}

// «Line 1: name, purpose; Line 3: unit price» — повідомлення називає всі рядки й поля (AC-PUR-09).
export function incompleteLinesMessage(list: readonly IncompleteLine[]): string {
  const parts = list.map((l) => `Line ${l.number}: ${l.fields.map((f) => LINE_FIELD_LABELS[f]).join(", ")}`);
  return `Fill in all line fields. ${parts.join("; ")}.`;
}
