// Перевірка перед поданням і результат подання (AC-PUR-05, 09, 12, 14, 37; design.md D5).
// Останнє слово — за submit_purchase (pur:department_required, pur:lines_incomplete); позначку «від імені колеги»
// без вибору колеги знає лише форма (у базі є тільки on_behalf_of_id), тож її перевіряє лише TS.
import { PUR_ERROR_MESSAGES, type PurErrorCode } from "./errors";
import { incompleteLines, incompleteLinesMessage, type IncompleteLine, type LineFields } from "./lines";
import type { OnBehalfChoice } from "./on-behalf";
import type { LineStatus, PurchaseStatus } from "./statuses";
import type { HistoryAction } from "./types";

export type SubmissionIssue = { code: PurErrorCode; message: string };

export type SubmissionInput = {
  departmentId: string | null;
  onBehalf: OnBehalfChoice;
  lines: readonly (LineFields & { position?: number })[];
};

export type SubmissionCheck =
  | { ok: true }
  | { ok: false; issues: SubmissionIssue[]; incomplete: IncompleteLine[] };

// Усі причини, чому заявку ще не можна подати, — разом, щоб автор виправив їх за один раз:
// відділ (AC-PUR-05), колега «від імені» (AC-PUR-12), незаповнені рядки з назвами рядків і полів (AC-PUR-09).
export function checkSubmission(input: SubmissionInput): SubmissionCheck {
  const issues: SubmissionIssue[] = [];
  if (!input.departmentId) issues.push({ code: "department_required", message: PUR_ERROR_MESSAGES.department_required });
  if (input.onBehalf.flag && !input.onBehalf.colleagueId) {
    issues.push({ code: "on_behalf_required", message: PUR_ERROR_MESSAGES.on_behalf_required });
  }
  // Без жодного рядка подати не можна (submit_purchase: pur:lines_required).
  if (input.lines.length === 0) issues.push({ code: "lines_required", message: PUR_ERROR_MESSAGES.lines_required });
  const incomplete = incompleteLines(input.lines);
  if (incomplete.length > 0) issues.push({ code: "lines_incomplete", message: incompleteLinesMessage(incomplete) });
  return issues.length === 0 ? { ok: true } : { ok: false, issues, incomplete };
}

export type SubmitOutcome = {
  status: Extract<PurchaseStatus, "pending">;
  // Записи історії в порядку додавання: лише «Подано» (AC-PUR-37).
  history: HistoryAction[];
  // Статус рядків після подання.
  lineStatus: Extract<LineStatus, "pending">;
};

// Що дає подання (D5): подана заявка завжди «Очікує схвалення» (AC-PUR-14, 23). Автосхвалення в заявках не діє
// (спрощений скоуп ДЗ7, requirements/product.md): налаштування лишається з WS6, але на подання не впливає.
export function submitOutcome(): SubmitOutcome {
  return { status: "pending", history: ["submitted"], lineStatus: "pending" };
}
