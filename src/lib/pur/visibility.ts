// Хто бачить закупівлю і що з нею може робити автор (AC-PUR-03, 11, 35, 38, 44, 45, 49; design.md D4, D5).
// Останнє слово — за базою: private.can_view_request() і політики requests/request_lines (RLS), функції D5.
// Ці функції — дзеркало для UI (що показати чи сховати) і тестів; змінюйте їх разом.
import type { Approver } from "@/lib/org/departments";
import {
  areFieldsEditable,
  cancelOutcome,
  isDepartmentChangeable,
  isEditableByAuthor,
  isSubmittable,
} from "./statuses";
import type { Actor, PurchaseRow } from "./types";

type Who = Pick<PurchaseRow, "author_id" | "on_behalf_of_id">;

export const isActiveAdmin = (actor: Actor): boolean => actor.is_active && actor.role === "admin";

// Автор або особа, від імені якої подано, — учасники заявки (AC-PUR-11).
export function isParticipant(request: Who, userId: string): boolean {
  return request.author_id === userId || request.on_behalf_of_id === userId;
}

// Склад схвалювачів — на момент запиту (Припущення PM): рядок department_approvers, а не роль profiles.
export function isApproverOf(actor: Actor, departmentId: string | null, approvers: readonly Approver[]): boolean {
  return (
    actor.is_active &&
    departmentId !== null &&
    approvers.some((a) => a.department_id === departmentId && a.user_id === actor.id)
  );
}

// AC-PUR-03: чужу чернетку бачать лише автор, особа «від імені» й admin (усе, включно з чернетками).
// AC-PUR-35, 49: схвалювач відділу бачить лише подані (не чернетки) заявки свого відділу; заявник того самого відділу,
// що не схвалює, і схвалювач іншого відділу — нічого чужого.
export function canViewRequest(
  request: Pick<PurchaseRow, "author_id" | "on_behalf_of_id" | "department_id" | "status">,
  actor: Actor,
  approvers: readonly Approver[],
): boolean {
  if (!actor.is_active) return false;
  if (isParticipant(request, actor.id) || isActiveAdmin(actor)) return true;
  return request.status !== "draft" && isApproverOf(actor, request.department_id, approvers);
}

// Рядки правлять лише автор, коли заявка draft, returned або pending з editing = true (AC-PUR-26, 44).
export function canEditLines(request: Pick<PurchaseRow, "author_id" | "status" | "editing">, actor: Actor): boolean {
  return actor.is_active && request.author_id === actor.id && isEditableByAuthor(request.status, request.editing);
}

// Поля заявки (нотатка, дата, тип, «від імені») — лише автор у чернетці й повернутій.
export function canEditFields(request: Pick<PurchaseRow, "author_id" | "status">, actor: Actor): boolean {
  return actor.is_active && request.author_id === actor.id && areFieldsEditable(request.status);
}

// Відділ — лише автор у чернетці (AC-PUR-38).
export function canChangeDepartment(request: Pick<PurchaseRow, "author_id" | "status">, actor: Actor): boolean {
  return actor.is_active && request.author_id === actor.id && isDepartmentChangeable(request.status);
}

// Подає автор: draft уперше, returned повторно; інший працівник — ні (AC-PUR-23, 45).
export function canSubmit(request: Pick<PurchaseRow, "author_id" | "status">, actor: Actor): boolean {
  return actor.is_active && request.author_id === actor.id && isSubmittable(request.status);
}

// Скасовує автор: чернетку видаляє, подану переводить у «Скасовано»; відхилену чи оброблювану — не може (AC-PUR-29, 30, 31).
export function canCancel(request: Pick<PurchaseRow, "author_id" | "status">, actor: Actor): boolean {
  return actor.is_active && request.author_id === actor.id && cancelOutcome(request.status) !== null;
}

// Редагування поданої заявки автор починає явно (AC-PUR-26); поки вона pending.
export function canSetEditing(request: Pick<PurchaseRow, "author_id" | "status">, actor: Actor): boolean {
  return actor.is_active && request.author_id === actor.id && request.status === "pending";
}
