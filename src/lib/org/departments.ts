// Правила відділів для сторінок і server actions (design.md D2, D7).
// Базу захищають FK, тригери й RLS міграції 20261018182200_org_departments.sql; тут — те саме для UI і тестів.

export type Department = { id: string; name: string };
export type Membership = { department_id: string; user_id: string; auto_approve: boolean };
export type Approver = { department_id: string; user_id: string };
export type Person = { id: string; email: string | null; full_name: string | null; is_active: boolean };

export const DEPARTMENT_NAME_MAX = 100;

const byName = (a: Department, b: Department) => a.name.localeCompare(b.name, "uk");

// Назва відділу — текст до 100 символів (Припущення PM). Повертає обрізану назву або null.
export function normalizeDepartmentName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (name.length < 1 || name.length > DEPARTMENT_NAME_MAX) return null;
  return name;
}

// AC-ORG-01: у виборі відділу — лише відділи, де працівник заявник.
// Діє й для admin (тимчасово Q1): без відділів вибір порожній.
export function selectableDepartments(
  departments: Department[],
  memberships: Pick<Membership, "department_id" | "user_id">[],
  userId: string,
): Department[] {
  const mine = new Set(memberships.filter((m) => m.user_id === userId).map((m) => m.department_id));
  return departments.filter((d) => mine.has(d.id)).sort(byName);
}

// AC-ORG-02: схвалювачем можна призначити лише заявника цього відділу.
export function canAssignApprover(
  memberships: Pick<Membership, "department_id" | "user_id">[],
  departmentId: string,
  userId: string,
): boolean {
  return memberships.some((m) => m.department_id === departmentId && m.user_id === userId);
}

// Варіанти у виборі схвалювача: активні працівники, які ще не схвалюють цей відділ.
// Членство навмисно не фільтруємо: призначення не-заявника відхиляє база з текстом PM (AC-ORG-02).
export function approverCandidates(departmentId: string, approvers: Approver[], people: Person[]): Person[] {
  const already = new Set(approvers.filter((a) => a.department_id === departmentId).map((a) => a.user_id));
  return people.filter((p) => p.is_active && !already.has(p.id));
}

// AC-ORG-14: відділ без жодного активного схвалювача позначаємо «Немає схвалювача».
export function departmentHasActiveApprover(
  departmentId: string,
  approvers: Approver[],
  people: Pick<Person, "id" | "is_active">[],
): boolean {
  const active = new Set(people.filter((p) => p.is_active).map((p) => p.id));
  return approvers.some((a) => a.department_id === departmentId && active.has(a.user_id));
}

export const NO_APPROVER_LABEL = "Немає схвалювача";

// AC-ORG-03, AC-ORG-15: що ще втратить працівник, якщо прибрати його як заявника відділу
// (у базі це робить каскад department_members → department_approvers і рядок членства з auto_approve).
export type RemovalEffect = "approver" | "auto_approve";

export function memberRemovalEffects(
  departmentId: string,
  userId: string,
  memberships: Membership[],
  approvers: Approver[],
): RemovalEffect[] {
  const effects: RemovalEffect[] = [];
  if (approvers.some((a) => a.department_id === departmentId && a.user_id === userId)) {
    effects.push("approver");
  }
  if (memberships.some((m) => m.department_id === departmentId && m.user_id === userId && m.auto_approve)) {
    effects.push("auto_approve");
  }
  return effects;
}

// AC-ORG-06: автосхвалення працівника — лише у відділах, де його ввімкнено для цього членства.
export function autoApproveDepartments(memberships: Membership[], userId: string): string[] {
  return memberships.filter((m) => m.user_id === userId && m.auto_approve).map((m) => m.department_id);
}

export function personLabel(person: Pick<Person, "email" | "full_name">): string {
  return person.full_name?.trim() || person.email || "—";
}
