// Типи заявок і закупівлі (глосарій PM; design.md D5).

export const REQUEST_TYPE_LABELS = {
  PUR: "Закупівля",
  RMB: "Відшкодування",
  CRE: "Витрата карткою",
  RFC: "Запит на чек",
  INV: "Рахунок постачальника",
} as const;

export type RequestType = keyof typeof REQUEST_TYPE_LABELS;

// «Закупівля» і «Відшкодування» створюють усі ролі (матриця прав PM). Інші три — за дозволом (задача 2).
// Поки дозволів немає, база теж приймає лише ці два типи (початкова політика requests_insert).
export const BASE_REQUEST_TYPES: readonly RequestType[] = ["PUR", "RMB"];

export const PURCHASE_TYPE_LABELS = {
  procurement: "Відділ закупівель",
  self: "Самостійна закупівля",
} as const;

export type PurchaseType = keyof typeof PURCHASE_TYPE_LABELS;

export function isRequestType(value: unknown): value is RequestType {
  // Object.hasOwn, а не `in`: ключі прототипу (toString, __proto__) не є типом заявки.
  return typeof value === "string" && Object.hasOwn(REQUEST_TYPE_LABELS, value);
}

// purchase_type обов'язковий для PUR і порожній для інших (CHECK requests_purchase_type_for_pur).
// Задача 1: для PUR — лише «Відділ закупівель».
export function purchaseTypeFor(type: RequestType): PurchaseType | null {
  return type === "PUR" ? "procurement" : null;
}
