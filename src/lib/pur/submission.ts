// Перевірка перед поданням і результат подання (AC-PUR-05, 09, 12, 14, 16, 37, 53; design.md D5).
// Останнє слово — за submit_purchase (pur:department_required, pur:lines_incomplete); позначку «від імені колеги»
// без вибору колеги знає лише форма (у базі є тільки on_behalf_of_id), тож її перевіряє лише TS.
import type { Membership } from "@/lib/org/departments";
import { autoApproves } from "./decisions";
import { PUR_ERROR_MESSAGES, type PurErrorCode } from "./errors";
import { incompleteLines, incompleteLinesMessage, type IncompleteLine, type LineFields } from "./lines";
import type { OnBehalfChoice } from "./on-behalf";
import type { LineStatus, PurchaseStatus } from "./statuses";
import type { HistoryAction, PurchaseRow } from "./types";

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
  status: Extract<PurchaseStatus, "pending" | "approved">;
  // Записи історії в порядку додавання: «Подано» (AC-PUR-37) і, за автосхвалення, «Схвалено» автором (AC-PUR-16).
  history: HistoryAction[];
  // Статус рядків після подання: за автосхвалення — схвалені, інакше лишаються як були.
  lineStatus: Extract<LineStatus, "pending" | "approved">;
};

// Що дає подання (D5): автосхвалення автора у відділі заявки → «Схвалено»; інакше «Очікує схвалення» (AC-PUR-14, 23).
export function submitOutcome(
  request: Pick<PurchaseRow, "author_id" | "department_id">,
  memberships: readonly Membership[],
): SubmitOutcome {
  return autoApproves(request, memberships)
    ? { status: "approved", history: ["submitted", "approved"], lineStatus: "approved" }
    : { status: "pending", history: ["submitted"], lineStatus: "pending" };
}
