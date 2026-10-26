import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestsSkeleton } from "@/components/ui";
import Link from "next/link";
import { Alert, EmptyState, PageShell, RowKeyNav, StatusLinks, type StatusLink } from "@/components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { orgErrorMessage } from "@/lib/org/errors";
import { purErrorMessage } from "@/lib/pur/errors";
import { PURCHASE_STATUS_LABELS } from "@/lib/pur/statuses";
import {
  PAGE_KEYS,
  nextDir,
  parseDepartment,
  parseDir,
  parsePage,
  parseSortKey,
  parseStatus,
  parseView,
  requestsHref,
  statusRank,
  type ListParams,
  type PageKey,
  type SortDir,
  type SortKey,
} from "../_lib/nav";
import { loadOverview, type RequestListItem } from "../_lib/overview";
import { matchesRequest } from "../_lib/search";
import { DepartmentFilter } from "../_components/department-filter";
import { RequestTable } from "../_components/request-table";

const SAVED: Record<string, string> = {
  deleted: "Draft deleted.",
};

// Порівняння за колонкою таблиці; текст — з урахуванням локалі, числа й дати — за значенням.
const COMPARE: Record<SortKey, (a: RequestListItem, b: RequestListItem) => number> = {
  number: (a, b) => (a.request.number ?? 0) - (b.request.number ?? 0),
  department: (a, b) => (a.departmentName ?? "").localeCompare(b.departmentName ?? ""),
  author: (a, b) => a.authorName.localeCompare(b.authorName),
  total: (a, b) => a.total - b.total,
  status: (a, b) => statusRank(a.request.status) - statusRank(b.request.status),
  updated: (a, b) => a.request.updated_at.localeCompare(b.request.updated_at),
};

export const metadata: Metadata = { title: "Requests · School Purchasing" };

// Закупівлі: мої (автор чи особа «від імені»), «На рішення» для схвалювача й відділу закупівель (admin),
// «Чекають рішення» для admin (відділ без активного схвалювача) і всі заявки admin (AC-PUR-15, 33, 40, 47, 48).
// Фільтри (?status=, ?view=decide, ?department=), сортування (?sort=&dir=) і сторінки (?p_<список>=) живуть в адресі.
export async function RequestsPageContent({ searchParams }: PageProps<"/requests">) {
  const { supabase, user } = await requireActiveUser();
  const params = await searchParams;
  const { saved, error, q: rawQuery } = params;
  const loaded = await loadOverview(supabase, user);
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 100) : "";
  const needle = query.toLowerCase();
  const status = parseStatus(params.status);
  const view = parseView(params.view);
  const department = parseDepartment(params.department);
  const sortKey = parseSortKey(params.sort);
  const dir: SortDir = parseDir(params.dir) ?? (sortKey === "updated" || sortKey === "number" || sortKey === "total" ? "desc" : "asc");
  const pages = Object.fromEntries(PAGE_KEYS.map((key) => [key, parsePage(params[`p_${key}`])])) as Record<PageKey, number>;

  const search = (items: RequestListItem[]) => (needle ? items.filter((item) => matchesRequest(item, needle)) : items);
  const bySearch = {
    mine: search(loaded.mine),
    toDecide: search(loaded.toDecide),
    awaiting: search(loaded.awaiting),
    all: search(loaded.all),
  };
  const unique = (lists: RequestListItem[][]) => [...new Map(lists.flat().map((item) => [item.request.id, item])).values()];
  // Відділи для фільтра — з усього, що людина бачить за пошуком (щоб вибір не зникав після вибору відділу).
  const departments = [
    ...new Map(
      unique(Object.values(bySearch))
        .filter((item) => item.request.department_id)
        .map((item) => [item.request.department_id as string, item.departmentName ?? "—"]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const byDepartment = (items: RequestListItem[]) => (department ? items.filter((item) => item.request.department_id === department) : items);
  const searched = {
    mine: byDepartment(bySearch.mine),
    toDecide: byDepartment(bySearch.toDecide),
    awaiting: byDepartment(bySearch.awaiting),
    all: byDepartment(bySearch.all),
  };
  // Один рядок може бути в кількох списках: для лічильників рахуємо кожну заявку раз.
  const pool = unique(Object.values(searched));

  const byStatus = (items: RequestListItem[]) => (status ? items.filter((item) => item.request.status === status) : items);
  // Без вибраної колонки: «На рішення» й «Чекають» — найстаріші першими, решта — як віддала база.
  const order = (items: RequestListItem[], oldestFirst = false) => {
    if (sortKey) return [...items].sort((a, b) => (dir === "asc" ? 1 : -1) * COMPARE[sortKey](a, b));
    return oldestFirst ? [...items].sort(COMPARE.updated) : items;
  };
  const overview = {
    mine: order(byStatus(searched.mine)),
    toDecide: order(byStatus(searched.toDecide), true),
    awaiting: order(byStatus(searched.awaiting), true),
    all: order(byStatus(searched.all)),
  };

  const isAdmin = user.role === "admin";
  const showDecisions = isAdmin || searched.toDecide.length > 0 || user.role === "approver";
  const decideOnly = view === "decide" && showDecisions;
  // Нічого, крім порожніх списків: без цього сторінка лишилась би зовсім порожньою.
  const nothingToShow =
    overview.mine.length === 0 &&
    overview.toDecide.length === 0 &&
    (!isAdmin || (overview.awaiting.length === 0 && overview.all.length === 0));
  const filtered = Boolean(query || status || view || department);
  const resultCount = unique(decideOnly ? [overview.toDecide] : Object.values(overview)).length;

  // Адреса поточного вигляду з перевизначеннями: фільтри скидають сторінки, сортування теж.
  const base: ListParams = { q: query, status, view, department, sort: sortKey, dir: sortKey ? dir : null };
  const hrefWith = (override: ListParams) => requestsHref({ ...base, ...override });
  const countOf = (value: string) => pool.filter((item) => item.request.status === value).length;
  const chip = (label: string, override: ListParams, count: number, active: boolean, urgent = false): StatusLink => ({
    href: hrefWith({ status: null, view: null, ...override }),
    label,
    count,
    active,
    urgent,
  });
  const chips: StatusLink[] = [
    chip("All", {}, pool.length, !status && !decideOnly),
    ...(showDecisions ? [chip("To decide", { view: "decide" }, searched.toDecide.length, decideOnly, true)] : []),
    chip("Drafts", { status: "draft" }, countOf("draft"), status === "draft"),
    chip(PURCHASE_STATUS_LABELS.pending, { status: "pending" }, countOf("pending"), status === "pending"),
    chip(PURCHASE_STATUS_LABELS.approved, { status: "approved" }, countOf("approved"), status === "approved"),
  ];

  const backHref = requestsHref({ ...base, pages });
  const sortHref = (key: SortKey) => hrefWith({ sort: key, dir: nextDir(key, { key: sortKey, dir }) });
  const table = (key: PageKey) => ({
    backHref,
    sort: { key: sortKey, dir },
    sortHref,
    page: pages[key],
    pageHref: (page: number) => requestsHref({ ...base, pages: { ...pages, [key]: page } }),
  });

  const savedMessage = typeof saved === "string" && Object.hasOwn(SAVED, saved) ? SAVED[saved] : undefined;
  const errorMessage = purErrorMessage(error) ?? orgErrorMessage(error);

  return (
    <PageShell
      title="Requests"
      description={
        filtered ? (
          <>
            {resultCount} {resultCount === 1 ? "result" : "results"}
            {query ? <> for “{query}”</> : null}.{" "}
            <Link href="/requests" className="font-medium text-primary underline-offset-4 hover:underline">
              Clear search
            </Link>
          </>
        ) : (
          "Purchase requests you submitted, requests waiting for your decision and, for administrators, everything."
        )
      }
      searchQuery={query}
    >
      <RowKeyNav />
      <Alert message={errorMessage} />
      {searched.toDecide.length > 0 ? (
        <Alert
          tone="warn"
          message={`${searched.toDecide.length} ${searched.toDecide.length === 1 ? "request is" : "requests are"} waiting for your decision.`}
        />
      ) : null}
      <Alert tone="ok" message={savedMessage} />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <StatusLinks items={chips} label="Filter requests" />
        {departments.length > 1 ? (
          <div className="w-full sm:w-56">
            <DepartmentFilter
              current={department ?? ""}
              options={departments.map(([value, label]) => ({ value, label }))}
              hrefs={{
                "": hrefWith({ department: null }),
                ...Object.fromEntries(departments.map(([id]) => [id, hrefWith({ department: id })])),
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Порожні секції не показуємо; якщо порожньо скрізь — один рядок про це (див. nothingToShow). */}
      {showDecisions && (overview.toDecide.length > 0 || decideOnly) ? (
        <RequestTable
          title="To decide"
          description="Pending requests from departments you approve."
          items={overview.toDecide}
          empty="Nothing is waiting for your decision."
          testId="to-decide"
          {...table("decide")}
        />
      ) : null}

      {!decideOnly && isAdmin && overview.awaiting.length > 0 ? (
        <RequestTable
          title="Awaiting decision"
          description="Pending requests whose department has no approver who can decide."
          items={overview.awaiting}
          empty="No requests are waiting for the procurement department."
          testId="awaiting-decision"
          noApprover
          {...table("awaiting")}
        />
      ) : null}

      {!decideOnly && (overview.mine.length > 0 || (nothingToShow && !filtered)) ? (
        <RequestTable
          title="My requests"
          description="Requests you created or that were submitted on your behalf."
          items={overview.mine}
          empty="You have no requests yet."
          testId="my-requests"
          mine
          {...table("mine")}
        />
      ) : null}

      {!decideOnly && isAdmin && overview.all.length > 0 ? (
        <RequestTable
          title="All requests"
          items={overview.all}
          empty="There are no requests yet."
          testId="all-requests"
          {...table("all")}
        />
      ) : null}

      {!decideOnly && nothingToShow && filtered ? (
        <EmptyState testId="no-results">
          {query ? <>No requests match “{query}”.</> : "No requests match the selected filter."}
        </EmptyState>
      ) : null}
    </PageShell>
  );
}

// Скелет — частина відповіді саме цієї сторінки (Suspense тут, а не loading.tsx): при переході показується її власний скелет.
export default function RequestsPage(props: PageProps<"/requests">) {
  return (
    <Suspense fallback={<RequestsSkeleton />}>
      <RequestsPageContent {...props} />
    </Suspense>
  );
}
