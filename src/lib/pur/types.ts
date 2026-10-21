// Рядки таблиць зрізу PUR для UI, server actions і тестів (design.md D1, D3).
// Назви колонок — як у міграції; повний тип бази — database.types.ts. Тут лише те, що читають правила src/lib/pur/*.
import type { PurchaseType, RequestType } from "@/lib/org/requests";
import type { LineStatus, PurchaseStatus } from "./statuses";

export type PurchaseRow = {
  id: string;
  type: RequestType;
  purchase_type: PurchaseType | null;
  // Номер PUR-N: до вставки його немає в локальних даних, у базі присвоює тригер (D2).
  number: number | null;
  status: PurchaseStatus;
  // Порожній лише у чернетці (CHECK status = 'draft' or department_id is not null).
  department_id: string | null;
  author_id: string;
  on_behalf_of_id: string | null;
  note: string | null;
  delivery_date: string | null;
  // Автор відкрив подану заявку на редагування (AC-PUR-26).
  editing: boolean;
  decision_reason: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// Поля рядка можуть бути порожніми, доки це чернетка; повноту перевіряє подання (D3).
export type LineRow = {
  id: string;
  request_id: string;
  position: number;
  name: string | null;
  purpose: string | null;
  quantity: number | null;
  unit_price: number | null;
  status: LineStatus;
};

export type HistoryAction =
  | "submitted"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "returned"
  | "reopened"
  | "cancelled";

export type HistoryRow = {
  id: string;
  request_id: string;
  actor_id: string;
  action: HistoryAction;
  reason: string | null;
  created_at: string;
};

// Хто діє: профіль сеансу. Роль — з profiles.role, ніколи з user_metadata (AGENTS.md).
export type Actor = { id: string; role: string; is_active: boolean };
