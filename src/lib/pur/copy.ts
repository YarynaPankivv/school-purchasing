// Копія закупівлі (AC-PUR-32; design.md D5 copy_purchase).
// Останнє слово — за функцією Postgres copy_purchase; це дзеркало для тестів і підказок у UI.
import type { PurchaseType } from "@/lib/org/requests";
import type { Actor, LineRow, PurchaseRow } from "./types";

// Тип закупівлі за замовчуванням — «Відділ закупівель» (Припущення PM; CHECK вимагає тип для PUR).
export const COPY_DEFAULT_PURCHASE_TYPE: PurchaseType = "procurement";

export type PurchaseCopy = {
  draft: Pick<
    PurchaseRow,
    "status" | "department_id" | "note" | "on_behalf_of_id" | "purchase_type" | "delivery_date" | "editing"
  >;
  lines: Pick<LineRow, "position" | "name" | "purpose" | "quantity" | "unit_price" | "status">[];
};

// Копіює лише автор (D5).
export function canCopy(request: Pick<PurchaseRow, "author_id">, actor: Actor): boolean {
  return actor.is_active && request.author_id === actor.id;
}

// AC-PUR-32: нова чернетка з тим самим відділом, нотаткою й особою «від імені»; усі рядки оригіналу, жоден не відхилений
// (статус — «pending», як у новій заявці); без дати доставки й файлів; тип — за замовчуванням.
// Номер видає база (D2), id нових рядків — теж. Особу «від імені» база переносить, лише поки вона ще допустима
// (private.can_act_on_behalf): викликач передає це в keepOnBehalf (за замовчуванням — переносимо).
export function copyPurchase(
  request: Pick<PurchaseRow, "department_id" | "note" | "on_behalf_of_id">,
  lines: readonly Pick<LineRow, "position" | "name" | "purpose" | "quantity" | "unit_price">[],
  keepOnBehalf = true,
): PurchaseCopy {
  return {
    draft: {
      status: "draft",
      department_id: request.department_id,
      note: request.note,
      on_behalf_of_id: keepOnBehalf ? request.on_behalf_of_id : null,
      purchase_type: COPY_DEFAULT_PURCHASE_TYPE,
      delivery_date: null,
      editing: false,
    },
    lines: [...lines]
      .sort((a, b) => a.position - b.position)
      .map((l, i) => ({
        position: i + 1,
        name: l.name,
        purpose: l.purpose,
        quantity: l.quantity,
        unit_price: l.unit_price,
        status: "pending" as const,
      })),
  };
}
