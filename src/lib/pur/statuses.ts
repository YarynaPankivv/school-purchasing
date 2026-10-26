// Статуси заявки й рядків закупівлі (design.md D1, D3, D4). Підписи інтерфейсу — англійською;
// у дужках — українські назви PM, які вони перекладають.
// Останнє слово — за базою (CHECK-и, RLS, функції D5); це дзеркало для UI і тестів: змінюйте їх разом.

export const PURCHASE_STATUS_LABELS = {
  draft: "Draft", // «Чернетка»
  pending: "Awaiting approval", // «Очікує схвалення» (таблиця PM, AC-LANG-06)
  approved: "Approved", // «Схвалено»
  partially_approved: "Partially approved", // «Частково схвалено»
  rejected: "Rejected", // «Відхилено»
  returned: "Returned for revision", // «Повернено на доопрацювання»
  cancelled: "Cancelled", // «Скасовано»
  processing: "Processing", // «В обробці» (встановлює зріз ORD)
  processed: "Processed", // «Оброблено» (встановлює зріз ORD)
} as const;

export type PurchaseStatus = keyof typeof PURCHASE_STATUS_LABELS;

export const LINE_STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  ready: "Ready to order", // для ORD
  ordered: "Ordered", // для ORD
} as const;

export type LineStatus = keyof typeof LINE_STATUS_LABELS;

// Object.hasOwn, а не `in`: ключі прототипу (toString, __proto__) з адреси чи форми не є статусами.
export function isPurchaseStatus(value: unknown): value is PurchaseStatus {
  return typeof value === "string" && Object.hasOwn(PURCHASE_STATUS_LABELS, value);
}

export function isLineStatus(value: unknown): value is LineStatus {
  return typeof value === "string" && Object.hasOwn(LINE_STATUS_LABELS, value);
}

// Підпис для невідомого значення з бази — саме значення, а не порожнє місце.
export function purchaseStatusLabel(status: string): string {
  return isPurchaseStatus(status) ? PURCHASE_STATUS_LABELS[status] : status;
}

export function lineStatusLabel(status: string): string {
  return isLineStatus(status) ? LINE_STATUS_LABELS[status] : status;
}

// «Скасовано» незмінний (AC-PUR-29); «Оброблено» — кінець шляху закупівлі. Відхилену ще може повернути на схвалення admin
// (AC-PUR-27), тож вона не кінцева.
export function isTerminal(status: PurchaseStatus): boolean {
  return status === "cancelled" || status === "processed";
}

// Рядки редагує автор: у чернетці й повернутій заявці, а в поданій — лише коли сам відкрив її на редагування
// (AC-PUR-26, 44: відхилену не редагують). Дзеркало політик request_lines (D4).
export function isEditableByAuthor(status: PurchaseStatus, editing: boolean): boolean {
  return status === "draft" || status === "returned" || (status === "pending" && editing);
}

// Поля заявки (відділ, тип, дата, нотатка, «від імені») — лише в чернетці й повернутій (requests_update, D4).
export function areFieldsEditable(status: PurchaseStatus): boolean {
  return status === "draft" || status === "returned";
}

// Відділ змінюють лише в чернетці (AC-PUR-38; повернена заявка подається знову для того ж відділу, AC-PUR-23).
export function isDepartmentChangeable(status: PurchaseStatus): boolean {
  return status === "draft";
}

// Результат скасування автором (AC-PUR-29, 30, 31): чернетку видаляють, подану переводять у «Скасовано»,
// «Відхилено»/«В обробці»/«Оброблено»/«Скасовано» скасувати не можна.
export type CancelOutcome = "delete" | "cancel";

export function cancelOutcome(status: PurchaseStatus): CancelOutcome | null {
  if (status === "draft") return "delete";
  if (status === "pending" || status === "approved" || status === "partially_approved" || status === "returned") {
    return "cancel";
  }
  return null;
}

// Чекає рішення схвалювача.
export function isAwaitingDecision(status: PurchaseStatus): boolean {
  return status === "pending";
}

// Може бути подана автором (draft — уперше, returned — повторно, AC-PUR-23).
export function isSubmittable(status: PurchaseStatus): boolean {
  return status === "draft" || status === "returned";
}
