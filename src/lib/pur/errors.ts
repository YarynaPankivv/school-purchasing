// Помилки бази й перевірок → тексти для користувача (design.md D5, D7).
// Інтерфейс — англійською (рішення замовника). Тексти з лапок «…» вимог PM подано англійським перекладом,
// не дослівно: PM їх задав українською. Місце тексту PM позначено коментарем.
import type { DbError } from "@/lib/org/errors";
import { incompleteLinesFromDetail, incompleteLinesMessage } from "./lines";

export const PUR_ERROR_MESSAGES = {
  // Коди функцій Postgres (D5): `raise exception 'pur:<код>'`, SQLSTATE P0001.
  department_required: "Select a department", // AC-PUR-05 «Оберіть відділ» (переклад тексту PM)
  lines_incomplete: "Fill in all line fields before submitting.", // AC-PUR-09; конкретні рядки — incompleteLinesMessage
  lines_required: "Add at least one line before submitting.", // submit_purchase: у заявці немає жодного рядка
  forbidden: "Insufficient permissions",
  author_editing: "The author is editing this request. It can be decided once they save or discard the changes.", // AC-PUR-26
  already_decided: "This request has already been decided.", // AC-PUR-25
  own_request: "You cannot decide on your own request.", // AC-PUR-24, 54
  all_lines_rejected: "All lines are rejected: reject the whole request instead", // AC-PUR-19 (переклад тексту PM)
  reason_required: "Provide a reason", // AC-PUR-20, 51, 52 «Вкажіть причину» (переклад тексту PM)
  cannot_reject: "A request that is being processed or is already processed cannot be rejected.", // AC-PUR-50
  cannot_cancel: "This request can no longer be cancelled.", // AC-PUR-31
  department_locked: "The department of a submitted request cannot be changed.", // AC-PUR-38 (тригер guard_request_update)
  purchase_type_forbidden: "This purchase type is not available to you.", // AC-ORG-08 (тригер guard_request_update)
  immutable: "The request type, author and number cannot be changed.", // тригер guard_request_update
  // Коди, яких база не видає: перевіряє лише TS до запиту, або технічний збій.
  on_behalf_required: "Select the colleague you are submitting on behalf of", // AC-PUR-12 «Оберіть, за кого подаєте заявку» (переклад тексту PM)
  on_behalf_invalid: "This colleague is not available for this request.", // AC-PUR-13
  invalid_input: "Some of the entered values are not valid.",
  unknown: "Could not save the changes. Please try again.",
} as const;

export type PurErrorCode = keyof typeof PUR_ERROR_MESSAGES;

// Код `pur:<код>` у тексті винятку функції Postgres (PostgREST віддає його в `message`).
const PUR_CODE_RE = /\bpur:([a-z_]+)\b/;

// Коди, які може віддати база (решта — лише клієнтські, їх у тексті винятку бути не може).
const DB_CODES: ReadonlySet<string> = new Set([
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
]);

export function mapPurDbError(error: DbError): PurErrorCode {
  if (!error) return "unknown";
  const match = PUR_CODE_RE.exec(`${error.message ?? ""} ${error.details ?? ""}`);
  if (match && DB_CODES.has(match[1])) return match[1] as PurErrorCode;
  switch (error.code) {
    case "42501": // RLS: рядок не пройшов with check / немає права
      return "forbidden";
    case "23514": // CHECK: довжина тексту, кількість, ціна, відділ у поданій заявці
    case "22003": // числове значення поза межами колонки
    case "22P02": // не-UUID чи не число
      return "invalid_input";
    default:
      return "unknown";
  }
}

// Текст для користувача: для pur:lines_incomplete — з рядками й полями з DETAIL винятку («1:name,purpose;3:quantity»,
// AC-PUR-09), для решти — PUR_ERROR_MESSAGES.
export function purErrorText(error: DbError): string {
  const code = mapPurDbError(error);
  if (code === "lines_incomplete") {
    const lines = incompleteLinesFromDetail(error?.details);
    if (lines.length > 0) return incompleteLinesMessage(lines);
  }
  return PUR_ERROR_MESSAGES[code];
}

export function purErrorMessage(code: unknown): string | undefined {
  // Object.hasOwn, а не `in`: ключі прототипу (toString, __proto__) з адреси не мають пройти.
  return typeof code === "string" && Object.hasOwn(PUR_ERROR_MESSAGES, code)
    ? PUR_ERROR_MESSAGES[code as PurErrorCode]
    : undefined;
}
