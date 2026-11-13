"use server";

// Індекс для підказок рядка пошуку: одна відповідь з найновішими заявками, які людині видно (RLS, як на /requests), щоб
// клієнт фільтрував набраний текст миттєво, без запиту на кожну літеру. Лише читання, нічого не змінює.
import { requireActiveUser } from "@/lib/auth/session";
import { purchaseNumberLabel } from "@/lib/pur/numbers";
import { purchaseStatusLabel } from "@/lib/pur/statuses";
import { detailHref, requestsHref } from "./_lib/nav";
import { loadRecentRequests } from "./_lib/overview";
import { requestHaystack } from "./_lib/search";

// Скільки заявок віддаємо клієнту (найновіші за оновленням): достатньо для підказок; повний пошук — на /requests.
const INDEX_LIMIT = 300;

export type SearchEntry = {
  id: string;
  number: string;
  department: string | null;
  items: string | null;
  statusLabel: string;
  href: string;
  // Нижній регістр: те, у чому шукає клієнт (номер, відділ, автор, статус, позиції).
  haystack: string;
};

export async function loadSearchIndex(): Promise<SearchEntry[]> {
  const { supabase, user } = await requireActiveUser();
  // Ліміт і порядок «найновіші за оновленням» виконує база: сервер не читає й не зберігає всі заявки.
  const recent = await loadRecentRequests(supabase, user, INDEX_LIMIT);
  // «Back» з картки веде на повний пошук без запиту (клієнт підставляє свій текст у «All results»).
  const back = requestsHref({});
  return recent
    .map((item) => ({
      id: item.request.id,
      number: purchaseNumberLabel(item.request.number),
      department: item.departmentName,
      items: item.items,
      statusLabel: purchaseStatusLabel(item.request.status),
      href: detailHref(item.request.id, { back }),
      haystack: requestHaystack(item),
    }));
}
