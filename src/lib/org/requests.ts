// Типи заявок і закупівлі (глосарій PM; design.md D5). Хто що може обрати — request-options.ts.

export const REQUEST_TYPE_LABELS = {
  PUR: "Закупівля",
  RMB: "Відшкодування",
  CRE: "Витрата карткою",
  RFC: "Запит на чек",
  INV: "Рахунок постачальника",
} as const;

export type RequestType = keyof typeof REQUEST_TYPE_LABELS;

export const PURCHASE_TYPE_LABELS = {
  procurement: "Відділ закупівель",
  self: "Самостійна закупівля",
} as const;

export type PurchaseType = keyof typeof PURCHASE_TYPE_LABELS;

// Object.hasOwn, а не `in`: ключі прототипу (toString, __proto__) не є ні типом заявки, ні типом закупівлі.
export function isRequestType(value: unknown): value is RequestType {
  return typeof value === "string" && Object.hasOwn(REQUEST_TYPE_LABELS, value);
}

export function isPurchaseType(value: unknown): value is PurchaseType {
  return typeof value === "string" && Object.hasOwn(PURCHASE_TYPE_LABELS, value);
}

// purchase_type обов'язковий для PUR і порожній для інших (CHECK requests_purchase_type_for_pur):
// для інших типів обране у формі ігноруємо.
export function purchaseTypeFor(type: RequestType, requested: unknown): PurchaseType | null {
  if (type !== "PUR") return null;
  return isPurchaseType(requested) ? requested : null;
}
