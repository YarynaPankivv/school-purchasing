// Які типи заявок і закупівлі доступні працівнику (design.md D4, D5; tasks.md 2.2).
// Останнє слово — за базою: private.can_create_request() у міграції 20261018200633_org_permissions.sql.
// Ця функція — дзеркало для вибору в UI, перевірки в server action і тестів; змінюйте їх разом.
import type { AppRole } from "./roles";
import { REQUEST_TYPE_LABELS, type PurchaseType, type RequestType } from "./requests";

export type Permissions = {
  card_expense: boolean;
  check_request: boolean;
  vendor_invoice: boolean;
  self_purchase: boolean;
};

export const NO_PERMISSIONS: Permissions = {
  card_expense: false,
  check_request: false,
  vendor_invoice: false,
  self_purchase: false,
};

export type PermissionKey = keyof Permissions;

export const PERMISSION_KEYS: readonly PermissionKey[] = ["card_expense", "check_request", "vendor_invoice", "self_purchase"];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  card_expense: "Card expense",
  check_request: "Check request",
  vendor_invoice: "Vendor invoice",
  self_purchase: "Self-purchase",
};

// Тип заявки, що вимагає дозволу (матриця прав PM). «Закупівля» й «Відшкодування» — без дозволу.
const PERMISSION_FOR_TYPE: Partial<Record<RequestType, PermissionKey>> = {
  CRE: "card_expense",
  RFC: "check_request",
  INV: "vendor_invoice",
};

export function permissionsFrom(row: Partial<Permissions> | null | undefined): Permissions {
  return {
    card_expense: row?.card_expense ?? false,
    check_request: row?.check_request ?? false,
    vendor_invoice: row?.vendor_invoice ?? false,
    self_purchase: row?.self_purchase ?? false,
  };
}

// AC-ORG-07, AC-ORG-17: тип із дозволом видно лише з дозволом; admin — без дозволу (матриця прав).
export function allowedRequestTypes(role: AppRole, permissions: Permissions): RequestType[] {
  return (Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).filter((type) => {
    const needed = PERMISSION_FOR_TYPE[type];
    return !needed || role === "admin" || permissions[needed];
  });
}

// AC-ORG-08: без дозволу «Самостійна закупівля» — лише «Відділ закупівель»; admin — будь-який тип без дозволу (AC-ORG-23).
export function allowedPurchaseTypes(role: AppRole, permissions: Permissions): PurchaseType[] {
  return role === "admin" || permissions.self_purchase ? ["procurement", "self"] : ["procurement"];
}

// Повна перевірка пари «тип заявки + тип закупівлі» — як у private.can_create_request().
export function canCreateRequest(
  role: AppRole,
  permissions: Permissions,
  type: RequestType,
  purchaseType: PurchaseType | null,
): boolean {
  if (!allowedRequestTypes(role, permissions).includes(type)) return false;
  if (type !== "PUR") return purchaseType === null;
  return purchaseType !== null && allowedPurchaseTypes(role, permissions).includes(purchaseType);
}
