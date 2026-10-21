// Рішення по поданій закупівлі: хто вирішує, що станеться, списки «На рішення» й «Чекають рішення»
// (AC-PUR-15…28, 33, 47, 48, 50…54; design.md D5, D6).
// Останнє слово — за функціями Postgres decide_purchase, reopen_purchase, admin_reject_purchase (D5) і RLS.
// Ці функції — дзеркало для UI (які кнопки показати), перевірки в server action до rpc і тестів; змінюйте їх разом.
import { departmentHasActiveApprover, type Approver, type Membership, type Person } from "@/lib/org/departments";
import type { PurErrorCode } from "./errors";
import type { PurchaseStatus, LineStatus } from "./statuses";
import type { Actor, HistoryAction, LineRow, PurchaseRow } from "./types";
import { isActiveAdmin, isApproverOf, isParticipant } from "./visibility";

export type DecisionAction = "approve" | "reject" | "return";

type DecisionRequest = Pick<PurchaseRow, "author_id" | "on_behalf_of_id" | "department_id" | "status" | "editing">;

// Чому актор не може вирішити зараз; null — може. Порядок — як у decide_purchase (D5):
// неактивний → власна заявка → право → чернетка → статус → редагування автором.
export function decisionBlockReason(
  request: DecisionRequest,
  actor: Actor,
  approvers: readonly Approver[],
): PurErrorCode | null {
  if (!actor.is_active) return "forbidden";
  if (isParticipant(request, actor.id)) return "own_request"; // AC-PUR-24, 54: за жодної ролі
  if (!isActiveAdmin(actor) && !isApproverOf(actor, request.department_id, approvers)) return "forbidden"; // AC-PUR-35
  if (request.status === "draft") return "not_found"; // чернетку не вирішують
  if (request.status !== "pending") return "already_decided"; // AC-PUR-25: другому — «вже вирішено»
  if (request.editing) return "author_editing"; // AC-PUR-26
  return null;
}

// Показувати дії «схвалити», «відхилити», «повернути на доопрацювання» (AC-PUR-24, 54).
export function canDecide(request: DecisionRequest, actor: Actor, approvers: readonly Approver[]): boolean {
  return decisionBlockReason(request, actor, approvers) === null;
}

export type DecisionInput = {
  action: DecisionAction;
  reason?: string | null;
  lines: readonly Pick<LineRow, "id" | "status">[];
  // Рядки, які схвалювач відхилив (лише для approve; відхилення рядка — без причини, Припущення PM).
  rejectedLineIds?: readonly string[];
};

export type DecisionOutcome =
  | {
      ok: true;
      status: PurchaseStatus;
      historyAction: HistoryAction;
      reason: string | null;
      // Нові статуси рядків за id (порожньо, коли рядки не змінюються).
      lineStatuses: Record<string, LineStatus>;
    }
  | { ok: false; error: PurErrorCode };

const cleanReason = (reason: string | null | undefined) => (reason?.trim() ? reason.trim() : null);

// Що дає рішення схвалювача (D5):
// - reject/return без причини — «Вкажіть причину» (AC-PUR-20, 51); з причиною — «Відхилено» (AC-PUR-21) чи «Повернено» (AC-PUR-22);
// - approve з усіма відхиленими рядками — «Усі рядки відхилено…» (AC-PUR-19);
// - approve без відхилених — «Схвалено» (AC-PUR-17), з частиною — «Частково схвалено» (AC-PUR-18, 41, 42).
export function decisionOutcome(input: DecisionInput): DecisionOutcome {
  if (input.action === "approve") {
    const known = new Set(input.lines.map((l) => l.id));
    const rejected = new Set(input.rejectedLineIds ?? []);
    if ([...rejected].some((id) => !known.has(id))) return { ok: false, error: "invalid_input" };
    if (input.lines.length > 0 && rejected.size === input.lines.length) return { ok: false, error: "all_lines_rejected" };
    const lineStatuses: Record<string, LineStatus> = {};
    for (const line of input.lines) lineStatuses[line.id] = rejected.has(line.id) ? "rejected" : "approved";
    const partial = rejected.size > 0;
    return {
      ok: true,
      status: partial ? "partially_approved" : "approved",
      historyAction: partial ? "partially_approved" : "approved",
      reason: null,
      lineStatuses,
    };
  }
  const reason = cleanReason(input.reason);
  if (!reason) return { ok: false, error: "reason_required" };
  return input.action === "reject"
    ? { ok: true, status: "rejected", historyAction: "rejected", reason, lineStatuses: {} }
    : { ok: true, status: "returned", historyAction: "returned", reason, lineStatuses: {} };
}

// AC-PUR-42: далі до відділу закупівель йдуть лише схвалені (не відхилені) рядки.
export function forwardedLines<T extends Pick<LineRow, "status">>(lines: readonly T[]): T[] {
  return lines.filter((l) => l.status !== "rejected");
}

// AC-PUR-16, 53: автор, якому в цьому відділі ввімкнено автосхвалення, подає закупівлю цього відділу — одразу «Схвалено».
// Лише автор (особа «від імені» й admin окремо не виділяються), лише відділ заявки.
export function autoApproves(
  request: Pick<PurchaseRow, "author_id" | "department_id">,
  memberships: readonly Membership[],
): boolean {
  return (
    request.department_id !== null &&
    memberships.some(
      (m) => m.department_id === request.department_id && m.user_id === request.author_id && m.auto_approve,
    )
  );
}

// AC-PUR-15: «На рішення» — заявки pending відділів, де людина схвалює, крім власних (автор чи «від імені»).
// Заявки з editing лишаються в списку: дії для них блокує decisionBlockReason (AC-PUR-26). Admin без схвалювальної
// ролі у відділі бачить такі заявки лише в «Чекають рішення», якщо там немає кому вирішити.
export function decisionQueue<T extends DecisionRequest>(
  requests: readonly T[],
  actor: Actor,
  approvers: readonly Approver[],
): T[] {
  return requests.filter(
    (r) => r.status === "pending" && !isParticipant(r, actor.id) && isApproverOf(actor, r.department_id, approvers),
  );
}

// Чи є у відділі заявки активний схвалювач, що може вирішити: не автор і не особа «від імені» (AC-PUR-47, 48, 54).
export function requestHasEligibleApprover(
  request: Pick<PurchaseRow, "author_id" | "on_behalf_of_id" | "department_id">,
  approvers: readonly Approver[],
  people: readonly Pick<Person, "id" | "is_active">[],
): boolean {
  if (request.department_id === null) return false;
  const eligible = approvers.filter((a) => a.user_id !== request.author_id && a.user_id !== request.on_behalf_of_id);
  return departmentHasActiveApprover(request.department_id, eligible, [...people]);
}

// AC-PUR-33, 47, 48, 54: «Чекають рішення» для admin — заявки pending, у відділі яких нема кому вирішити, з позначкою
// «Немає схвалювача» (NO_APPROVER_LABEL). Автосхвалена заявка вже approved, тож сюди не потрапляє (AC-PUR-53).
// Заявка, де сам admin — автор, лишається в списку, але дій рішення він не бачить (canDecide, AC-PUR-54).
export function awaitingDecision<T extends DecisionRequest>(
  requests: readonly T[],
  actor: Actor,
  approvers: readonly Approver[],
  people: readonly Pick<Person, "id" | "is_active">[],
): T[] {
  if (!isActiveAdmin(actor)) return [];
  return requests.filter((r) => r.status === "pending" && !requestHasEligibleApprover(r, approvers, people));
}

export type AdminRejectResult = { ok: true; reason: string } | { ok: false; error: PurErrorCode };

// admin_reject_purchase (D5): лише «Схвалено»/«Частково схвалено» (AC-PUR-28); «В обробці»/«Оброблено» — ні (AC-PUR-50);
// без причини — «Вкажіть причину» (AC-PUR-52).
export function adminRejectAllowed(status: PurchaseStatus): boolean {
  return status === "approved" || status === "partially_approved";
}

export function adminRejectOutcome(status: PurchaseStatus, reason: string | null | undefined): AdminRejectResult {
  if (!adminRejectAllowed(status)) return { ok: false, error: "cannot_reject" };
  const clean = cleanReason(reason);
  return clean ? { ok: true, reason: clean } : { ok: false, error: "reason_required" };
}

export function canAdminReject(request: Pick<PurchaseRow, "status">, actor: Actor): boolean {
  return isActiveAdmin(actor) && adminRejectAllowed(request.status);
}

// reopen_purchase (D5): відхилену чи повернуту на доопрацювання повертає на схвалення лише admin (AC-PUR-27, 36).
export function reopenAllowed(status: PurchaseStatus): boolean {
  return status === "rejected" || status === "returned";
}

export function canReopen(request: Pick<PurchaseRow, "status">, actor: Actor): boolean {
  return isActiveAdmin(actor) && reopenAllowed(request.status);
}
