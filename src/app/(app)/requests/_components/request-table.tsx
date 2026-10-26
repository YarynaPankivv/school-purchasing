// Таблиця закупівель для /requests: нумерація рядків (наскрізна по сторінках), сортування за заголовками колонок,
// сторінки. Правила видимості, суми й підписи — ті самі, що в RequestList (картки на головній).
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, Icon, Pagination } from "@/components/ui";
import { purchaseNumberLabel } from "@/lib/pur/numbers";
import { formatDateTime, formatDay } from "@/lib/pur/time";
import { formatUsd } from "@/lib/pur/totals";
import { NO_APPROVER_LABEL } from "@/lib/org/departments";
import { PAGE_SIZE, detailHref, type SortDir, type SortKey } from "../_lib/nav";
import type { RequestListItem } from "../_lib/overview";
import { PurchaseStatusBadge } from "./status-badge";

// Заголовки таблиці — 12px сірим у реченнєвому регістрі, без верхнього регістру й розрядки (правило app-екранів).
const HEAD = "px-3 py-2.5 text-xs font-normal text-muted-foreground";

function SortHeader({
  label,
  active,
  dir,
  href,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  href: string;
  className?: string;
}) {
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined} className={`${HEAD} ${className}`}>
      <Link
        href={href}
        aria-label={`Sort by ${label}`}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon name={active ? (dir === "asc" ? "arrow-up" : "arrow-down") : "sort"} className={`size-3.5 ${active ? "" : "opacity-50"}`} />
      </Link>
    </th>
  );
}

export function RequestTable({
  title,
  description,
  items,
  empty,
  testId,
  mine = false,
  noApprover = false,
  backHref,
  sort,
  sortHref,
  page,
  pageHref,
}: {
  title: string;
  description?: string;
  items: RequestListItem[];
  empty: ReactNode;
  testId: string;
  // «Мої заявки»: автору схваленої заявки показуємо позначку (AC-PUR-40).
  mine?: boolean;
  // «Чекають рішення»: у відділі нема кому вирішити (AC-PUR-33, 47, 48).
  noApprover?: boolean;
  backHref: string;
  sort: { key: SortKey | null; dir: SortDir };
  sortHref: (key: SortKey) => string;
  page: number;
  pageHref: (page: number) => string;
}) {
  if (items.length === 0) {
    return (
      <section aria-label={title} className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <div className="text-sm text-muted-foreground">{empty}</div>
      </section>
    );
  }
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const offset = (current - 1) * PAGE_SIZE;
  const shown = items.slice(offset, offset + PAGE_SIZE);
  const header = (label: string, sortKey: SortKey, className = "") => (
    <SortHeader label={label} active={sort.key === sortKey} dir={sort.dir} href={sortHref(sortKey)} className={className} />
  );

  return (
    <Card title={title} description={description} action={<Badge>{items.length}</Badge>} className="overflow-hidden">
      <div className="-mx-5 -my-4 overflow-x-auto" role="region" aria-label={title} tabIndex={0}>
        <table className="w-full text-left text-sm" data-testid={testId}>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={`${HEAD} w-12 pl-5 text-right max-sm:hidden`}>
                <span className="sr-only">Row </span>#
              </th>
              {header("Request", "number", "max-sm:pl-5")}
              {header("Department", "department", "max-sm:hidden")}
              {header("Author", "author", "max-md:hidden")}
              {header("Total", "total", "text-right")}
              {header("Status", "status")}
              {header("Updated", "updated", "max-md:hidden pr-5")}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map(({ request, total, departmentName, authorName, items: itemsText }, index) => (
              <tr key={request.id} data-testid="request-row" className="relative transition-colors hover:bg-muted">
                <td className="w-12 py-3 pl-5 pr-3 text-right tabular-nums text-muted-foreground max-sm:hidden">{offset + index + 1}</td>
                <td className="px-3 py-3 max-sm:pl-5">
                  <Link
                    href={detailHref(request.id, { back: backHref })}
                    data-row-nav=""
                    className="whitespace-nowrap font-medium text-foreground tabular-nums after:absolute after:inset-0 after:content-['']"
                  >
                    {purchaseNumberLabel(request.number)}
                  </Link>
                  {/* На телефоні колонки «#» і «Department» сховані: відділ іде підрядком під номером. */}
                  <span className="block text-xs text-muted-foreground sm:hidden">{departmentName ?? "No department yet"}</span>
                  {itemsText ? <span className="block max-w-56 truncate text-xs text-muted-foreground">{itemsText}</span> : null}
                </td>
                <td className="px-3 py-3 text-foreground max-sm:hidden">{departmentName ?? "No department yet"}</td>
                <td className="px-3 py-3 text-muted-foreground max-md:hidden">{authorName}</td>
                {/* Нульова сума — часто «ціни ще немає»: приглушена, щоб не читалась як остаточна. */}
                <td
                  className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${total === 0 ? "text-muted-foreground" : "font-medium text-foreground"}`}
                >
                  {formatUsd(total)}
                </td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <PurchaseStatusBadge status={request.status} />
                    {noApprover ? <Badge tone="warn">{NO_APPROVER_LABEL}</Badge> : null}
                    {mine && request.status === "approved" ? <Badge tone="ok">Request approved</Badge> : null}
                  </span>
                </td>
                <td className="whitespace-nowrap py-3 pl-3 pr-5 text-xs text-muted-foreground max-md:hidden">
                  <time dateTime={request.updated_at} title={formatDateTime(request.updated_at)}>
                    {formatDay(request.updated_at)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="-mx-5 -mb-4 mt-4">
        <Pagination page={current} pageSize={PAGE_SIZE} total={items.length} hrefFor={pageHref} label={`${title} pages`} />
      </div>
    </Card>
  );
}
