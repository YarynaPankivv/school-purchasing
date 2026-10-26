// Навігація між списками й карткою заявки: фільтри (статус, відділ), сортування за колонкою, сторінки, повернення
// «туди, звідки прийшов». Усе живе в адресі (працює без JS); видимість рядків,
// як і раніше, вирішує RLS.
import { isUuid } from "@/lib/org/departments";

export const STATUS_FILTERS = ["draft", "pending", "approved"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type ListView = "decide";

export const SORT_KEYS = ["number", "department", "author", "total", "status", "updated"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const PAGE_KEYS = ["decide", "awaiting", "mine", "all"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_SIZE = 20;

export function parseStatus(value: unknown): StatusFilter | null {
  return STATUS_FILTERS.find((status) => status === value) ?? null;
}

export function parseView(value: unknown): ListView | null {
  return value === "decide" ? "decide" : null;
}

export function parseSortKey(value: unknown): SortKey | null {
  return SORT_KEYS.find((key) => key === value) ?? null;
}

export function parseDir(value: unknown): SortDir | null {
  return value === "asc" || value === "desc" ? value : null;
}

export function parseDepartment(value: unknown): string | null {
  return isUuid(value) ? value : null;
}

// Номер сторінки з адреси: ціле ≥ 1, інакше 1.
export function parsePage(value: unknown): number {
  const page = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export type ListParams = {
  q?: string;
  status?: StatusFilter | null;
  view?: ListView | null;
  department?: string | null;
  sort?: SortKey | null;
  dir?: SortDir | null;
  pages?: Partial<Record<PageKey, number>>;
};

export function requestsHref({ q, status, view, department, sort, dir, pages }: ListParams): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (view) params.set("view", view);
  if (department) params.set("department", department);
  if (sort) {
    params.set("sort", sort);
    if (dir) params.set("dir", dir);
  }
  for (const key of PAGE_KEYS) {
    const page = pages?.[key];
    if (page && page > 1) params.set(`p_${key}`, String(page));
  }
  const query = params.toString();
  return query ? `/requests?${query}` : "/requests";
}

// Напрямок після кліку на заголовок: той самий стовпець — навпаки; інший — спершу «природний»
// (нові/великі зверху для дати, номера й суми, А→Я для тексту).
export function nextDir(key: SortKey, current: { key: SortKey | null; dir: SortDir }): SortDir {
  if (current.key === key) return current.dir === "asc" ? "desc" : "asc";
  return key === "updated" || key === "number" || key === "total" ? "desc" : "asc";
}

// Порядок статусів для сортування за колонкою «Status»: спершу те, що чекає на людей, чернетки — наприкінці.
const STATUS_ORDER = ["pending", "returned", "approved", "partially_approved", "processing", "processed", "rejected", "cancelled", "draft"];
export function statusRank(status: string): number {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
}

// Куди повертає «Back»: лише всередині застосунку (головна або /requests…), щоб адреса з параметра не вела назовні.
export function safeBack(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  if (value === "/" || value === "/requests" || value.startsWith("/requests?")) return value;
  return null;
}

export function detailHref(id: string, { back }: { back?: string }): string {
  if (!back) return `/requests/${id}`;
  return `/requests/${id}?${new URLSearchParams({ back }).toString()}`;
}
