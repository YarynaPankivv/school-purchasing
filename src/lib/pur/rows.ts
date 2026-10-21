// Рядки бази → типи правил PUR (src/lib/pur/types.ts). База віддає `status` і `type` текстом, тож перед правилами
// перевіряємо, що це відомі значення; невідомі рядки пропускаємо (їх додасть наступний зріз).
import { isPurchaseType, isRequestType } from "@/lib/org/requests";
import type { Database } from "@/lib/supabase/database.types";
import { isLineStatus, isPurchaseStatus } from "./statuses";
import type { LineRow, PurchaseRow } from "./types";

type DbRequest = Database["public"]["Tables"]["requests"]["Row"];
type DbLine = Database["public"]["Tables"]["request_lines"]["Row"];

export function toPurchaseRow(row: DbRequest): PurchaseRow | null {
  if (!isRequestType(row.type) || !isPurchaseStatus(row.status)) return null;
  if (row.purchase_type !== null && !isPurchaseType(row.purchase_type)) return null;
  return {
    id: row.id,
    type: row.type,
    purchase_type: row.purchase_type as PurchaseRow["purchase_type"],
    number: row.number,
    status: row.status,
    department_id: row.department_id,
    author_id: row.author_id,
    on_behalf_of_id: row.on_behalf_of_id,
    note: row.note,
    delivery_date: row.delivery_date,
    editing: row.editing,
    decision_reason: row.decision_reason,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toLineRow(row: DbLine): LineRow | null {
  if (!isLineStatus(row.status)) return null;
  return {
    id: row.id,
    request_id: row.request_id,
    position: row.position,
    name: row.name,
    purpose: row.purpose,
    quantity: row.quantity,
    unit_price: row.unit_price,
    status: row.status,
  };
}
