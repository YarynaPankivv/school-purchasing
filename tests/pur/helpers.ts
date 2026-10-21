// Фабрики даних для тестів правил PUR. Не тест: Vitest запускає лише *.test.ts.
import type { Approver, Person } from "@/lib/org/departments";
import type { Actor, LineRow, PurchaseRow } from "@/lib/pur/types";

export const AUTHOR = "user-author";
export const COLLEAGUE = "user-colleague";
export const APPROVER = "user-approver";
export const OTHER_APPROVER = "user-approver-2";
export const ADMIN = "user-admin";
export const OUTSIDER = "user-outsider";

export const PRIMARY = "dep-primary";
export const OFFICE = "dep-office";

export function actor(id: string, role: string, isActive = true): Actor {
  return { id, role, is_active: isActive };
}

export function person(id: string, role = "requester", isActive = true): Person {
  return { id, email: `${id}@example.test`, full_name: null, is_active: isActive, role };
}

export function approver(departmentId: string, userId: string): Approver {
  return { department_id: departmentId, user_id: userId };
}

export function makePurchase(overrides: Partial<PurchaseRow> = {}): PurchaseRow {
  return {
    id: "req-1",
    type: "PUR",
    purchase_type: "procurement",
    number: 1,
    status: "pending",
    department_id: PRIMARY,
    author_id: AUTHOR,
    on_behalf_of_id: null,
    note: null,
    delivery_date: null,
    editing: false,
    decision_reason: null,
    archived_at: null,
    created_at: "2026-10-21T12:00:00Z",
    updated_at: "2026-10-21T12:00:00Z",
    ...overrides,
  };
}

export function makeLine(overrides: Partial<LineRow> = {}): LineRow {
  return {
    id: "line-1",
    request_id: "req-1",
    position: 1,
    name: "Markers",
    purpose: "Classroom",
    quantity: 3,
    unit_price: 20,
    status: "pending",
    ...overrides,
  };
}
