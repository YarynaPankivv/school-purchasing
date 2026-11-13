// Дані для списку закупівель і лічильників на головній (design.md D6). Усе читаємо під RLS: вона вже віддає лише
// те, що людина має право бачити (D4); списки «На рішення» й «Чекають рішення» — TS-функції src/lib/pur/decisions.ts.
import { loadPeople } from "@/lib/org/people";
import type { CurrentUser } from "@/lib/auth/session";
import { personLabel, type Approver } from "@/lib/org/departments";
import { awaitingDecision, decisionQueue } from "@/lib/pur/decisions";
import { PAGE_SIZE, selectAll } from "@/lib/pur/paging";
import { toLineRow, toPurchaseRow } from "@/lib/pur/rows";
import { itemsSummary } from "@/lib/pur/summary";
import { isParticipant } from "@/lib/pur/visibility";
import { requestTotal } from "@/lib/pur/totals";
import type { Actor, LineRow, PurchaseRow } from "@/lib/pur/types";
import type { createClient } from "@/lib/supabase/server";
import { loadAuthorLabels } from "./author-labels";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RequestListItem = {
  request: PurchaseRow;
  total: number;
  departmentName: string | null;
  authorName: string;
  // «Markers +2 more»: що саме купують (назви рядків, які вже завантажені); null, якщо назв ще немає.
  items: string | null;
};

export type RequestOverview = {
  actor: Actor;
  mine: RequestListItem[];
  toDecide: RequestListItem[];
  awaiting: RequestListItem[];
  all: RequestListItem[];
};

export async function loadOverview(supabase: Supabase, user: CurrentUser): Promise<RequestOverview> {
  const [requests, lines, departments, approvers, personList, authorLabels] = await Promise.all([
    // Сторінками за курсором id: PostgREST обрізає відповідь на 1000 рядках, а зсув між сторінками міг би повторити чи
    // загубити рядок. Порядок «нові зверху» виставляємо нижче, вже після завантаження.
    selectAll((after) => {
      const query = supabase.from("requests").select("*").eq("type", "PUR").order("id").limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    selectAll((after) => {
      const query = supabase.from("request_lines").select("*").order("id").limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    supabase.from("departments").select("id, name"),
    supabase.from("department_approvers").select("department_id, user_id"),
    loadPeople(supabase, user.role),
    loadAuthorLabels(supabase),
  ]);
  // Збій бази — не «заявок немає»: нехай спрацює сторінка помилки.
  for (const result of [requests, lines, departments, approvers]) {
    if (result.error) throw new Error(`Failed to read requests: ${result.error.message}`);
  }

  const actor: Actor = { id: user.id, role: user.role, is_active: user.isActive };
  const purchases = (requests.data ?? [])
    .map(toPurchaseRow)
    .filter((r): r is PurchaseRow => r !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  const linesByRequest = new Map<string, LineRow[]>();
  for (const row of lines.data ?? []) {
    const line = toLineRow(row);
    if (line) linesByRequest.set(line.request_id, [...(linesByRequest.get(line.request_id) ?? []), line]);
  }
  const departmentNames = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  // Підписи з request_author_labels (усі автори видимих заявок) мають перевагу над профілями колег.
  const names = new Map([...personList.map((p): [string, string] => [p.id, personLabel(p)]), ...authorLabels]);
  const approverList: Approver[] = approvers.data ?? [];

  const item = (request: PurchaseRow): RequestListItem => ({
    request,
    // Сума заявки — усіх рядків, зокрема відхилених (AC-HIST-02): так само, як «Request total» на сторінці заявки.
    total: requestTotal(linesByRequest.get(request.id) ?? []),
    // Відділ є, але автор його не бачить (RLS віддає відділи лише заявникам) — «—», а не «ще без відділу».
    departmentName: request.department_id ? (departmentNames.get(request.department_id) ?? "—") : null,
    authorName: names.get(request.author_id) ?? "—",
    items: itemsSummary(linesByRequest.get(request.id) ?? []),
  });

  const isAdmin = user.role === "admin" && user.isActive;
  return {
    actor,
    mine: purchases.filter((r) => isParticipant(r, user.id)).map(item),
    toDecide: decisionQueue(purchases, actor, approverList).map(item),
    awaiting: awaitingDecision(purchases, actor, approverList, personList).map(item),
    all: isAdmin ? purchases.map(item) : [],
  };
}

// Найновіші заявки (за оновленням), які людині видно, для підказок пошуку: ліміт ставить база, а не пам'ять сервера.
// Рядки читаємо лише для цих заявок. Те, що людина бачить (RLS), — ті самі правила, що й у loadOverview.
export async function loadRecentRequests(supabase: Supabase, user: CurrentUser, limit: number): Promise<RequestListItem[]> {
  const requests = await supabase.from("requests").select("*").eq("type", "PUR").order("updated_at", { ascending: false }).order("id").limit(limit);
  if (requests.error) throw new Error(`Failed to read requests: ${requests.error.message}`);
  const purchases = (requests.data ?? []).map(toPurchaseRow).filter((r): r is PurchaseRow => r !== null);
  const ids = purchases.map((r) => r.id);
  const [lines, departments, personList, authorLabels] = await Promise.all([
    ids.length > 0 ? supabase.from("request_lines").select("*").in("request_id", ids) : Promise.resolve({ data: [], error: null }),
    supabase.from("departments").select("id, name"),
    loadPeople(supabase, user.role),
    loadAuthorLabels(supabase),
  ]);
  for (const result of [lines, departments]) {
    if (result.error) throw new Error(`Failed to read requests: ${result.error.message}`);
  }
  const linesByRequest = new Map<string, LineRow[]>();
  for (const row of lines.data ?? []) {
    const line = toLineRow(row);
    if (line) linesByRequest.set(line.request_id, [...(linesByRequest.get(line.request_id) ?? []), line]);
  }
  const departmentNames = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  const names = new Map([...personList.map((p): [string, string] => [p.id, personLabel(p)]), ...authorLabels]);
  return purchases.map((request) => ({
    request,
    total: requestTotal(linesByRequest.get(request.id) ?? []),
    departmentName: request.department_id ? (departmentNames.get(request.department_id) ?? "—") : null,
    authorName: names.get(request.author_id) ?? "—",
    items: itemsSummary(linesByRequest.get(request.id) ?? []),
  }));
}
