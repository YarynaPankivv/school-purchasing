// Ролі застосунку і похідна роль (design.md D1, D3).
// Останнє слово — за базою: private.sync_role() у міграції 20261018182200_org_departments.sql.
// Ця функція — дзеркало для підказок в UI і тестів; змінюйте їх разом.

export const APP_ROLES = ["requester", "approver", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

// Роль після зміни схвалювачів працівника:
// - admin лишається admin (AC-ORG-11; AC-ORG-20 — і коли його призначили схвалювачем);
// - approver, поки людина схвалює хоча б один відділ (AC-ORG-05, AC-ORG-19);
// - requester, коли не схвалює жодного (AC-ORG-04; AC-ORG-24 — і після каскаду з AC-ORG-03).
export function deriveRole(current: AppRole, approvedDepartmentCount: number): AppRole {
  if (current === "admin") return "admin";
  return approvedDepartmentCount > 0 ? "approver" : "requester";
}

export const ROLE_LABELS: Record<AppRole, string> = {
  requester: "Requester",
  approver: "Approver",
  admin: "Administrator",
};
