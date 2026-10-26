// Пошук заявок за текстом: номер («PUR-6» чи «6»), відділ, автор, статус і назви позицій — усе в межах того,
// що людина вже бачить (RLS). Один пошук для сторінки /requests і для підказок у рядку пошуку.
import { purchaseNumberLabel } from "@/lib/pur/numbers";
import { purchaseStatusLabel } from "@/lib/pur/statuses";
import type { RequestListItem } from "./overview";

// Рядок, у якому шукаємо (нижній регістр): номер, відділ, автор, статус, позиції.
export function requestHaystack(item: RequestListItem): string {
  return [
    purchaseNumberLabel(item.request.number),
    item.departmentName ?? "",
    item.authorName,
    purchaseStatusLabel(item.request.status),
    item.items ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function matchesRequest(item: RequestListItem, needle: string): boolean {
  return requestHaystack(item).includes(needle);
}

// Одна заявка може бути в кількох списках (мої, на рішення, всі): для підказок рахуємо її раз.
export function uniqueRequests(lists: RequestListItem[][]): RequestListItem[] {
  return [...new Map(lists.flat().map((item) => [item.request.id, item])).values()];
}
