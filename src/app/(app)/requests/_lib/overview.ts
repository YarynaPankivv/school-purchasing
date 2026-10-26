// Дані для списку закупівель і лічильників на головній (design.md D6). Усе читаємо під RLS: вона вже віддає лише
// те, що людина має право бачити (D4); списки «На рішення» й «Чекають рішення» — TS-функції src/lib/pur/decisions.ts.
import type { CurrentUser } from "@/lib/auth/session";
import { personLabel, type Approver, type Person } from "@/lib/org/departments";
import { awaitingDecision, decisionQueue, forwardedLines } from "@/lib/pur/decisions";
import { toLineRow, toPurchaseRow } from "@/lib/pur/rows";
import { itemsSummary } from "@/lib/pur/summary";
import { isParticipant } from "@/lib/pur/visibility";
import { requestTotal } from "@/lib/pur/totals";
import type { Actor, LineRow, PurchaseRow } from "@/lib/pur/types";
import type { createClient } from "@/lib/supabase/server";

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
  const [requests, lines, departments, approvers, people] = await Promise.all([
    supabase.from("requests").select("*").eq("type", "PUR").order("created_at", { ascending: false }),
    supabase.from("request_lines").select("*"),
    supabase.from("departments").select("id, name"),
    supabase.from("department_approvers").select("department_id, user_id"),
    supabase.from("profiles").select("id, email, full_name, is_active, role"),
  ]);
  // Збій бази — не «заявок немає»: нехай спрацює сторінка помилки.
  for (const result of [requests, lines, departments, approvers, people]) {
    if (result.error) throw new Error(`Failed to read requests: ${result.error.message}`);
  }

  const actor: Actor = { id: user.id, role: user.role, is_active: user.isActive };
  const purchases = (requests.data ?? []).map(toPurchaseRow).filter((r): r is PurchaseRow => r !== null);
  const linesByRequest = new Map<string, LineRow[]>();
  for (const row of lines.data ?? []) {
    const line = toLineRow(row);
    if (line) linesByRequest.set(line.request_id, [...(linesByRequest.get(line.request_id) ?? []), line]);
  }
  const departmentNames = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  const personList: Person[] = people.data ?? [];
  const names = new Map(personList.map((p) => [p.id, personLabel(p)]));
  const approverList: Approver[] = approvers.data ?? [];

  const item = (request: PurchaseRow): RequestListItem => ({
    request,
    // Відхилені рядки в суму не входять (AC-PUR-42): далі йдуть лише схвалені.
    total: requestTotal(forwardedLines(linesByRequest.get(request.id) ?? [])),
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
