// Список закупівель одного вигляду для всіх секцій /requests: номер, статус, відділ, автор, сума, дата.
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, Icon } from "@/components/ui";
import { purchaseNumberLabel } from "@/lib/pur/numbers";
import { formatDateTime, formatDay } from "@/lib/pur/time";
import { formatUsd } from "@/lib/pur/totals";
import { NO_APPROVER_LABEL } from "@/lib/org/departments";
import { detailHref } from "../_lib/nav";
import type { RequestListItem } from "../_lib/overview";
import { PurchaseStatusBadge } from "./status-badge";

// Картковий список для головної (перші `limit` рядків); повний список із сортуванням і сторінками — RequestTable.
export function RequestList({
  title,
  description,
  items,
  empty,
  testId,
  mine = false,
  viewerId,
  noApprover = false,
  limit,
  viewAllHref,
  backHref,
}: {
  title: string;
  description?: string;
  items: RequestListItem[];
  empty: ReactNode;
  testId: string;
  // «Мої заявки»: автору схваленої заявки показуємо позначку (AC-PUR-40).
  mine?: boolean;
  // Для «Мої заявки»: власну заявку підписуємо датою, а не власним ім’ям; чужого автора («від імені») лишаємо.
  viewerId?: string;
  // «Чекають рішення»: у відділі нема кому вирішити (AC-PUR-33, 47, 48).
  noApprover?: boolean;
  // Скорочений вигляд (головна): перші `limit` рядків і посилання «View all» на повний список.
  limit?: number;
  viewAllHref?: string;
  // Куди повертає «Back» на сторінці заявки (звідки людина прийшла: головна чи відфільтрований список).
  backHref?: string;
}) {
  // Порожня секція — приглушений підпис і один рядок, а не велика картка: список, де є що робити, лишається на першому екрані.
  if (items.length === 0) {
    return (
      <section aria-label={title} className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">{empty}</div>
      </section>
    );
  }
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <Card title={title} description={description} action={<Badge>{items.length}</Badge>}>
      <ul className="-my-4 flex flex-col divide-y divide-border" data-testid={testId}>
        {shown.map(({ request, total, departmentName, authorName, items: itemsText }) => (
          <li key={request.id}>
            <Link
              href={detailHref(request.id, { back: backHref })}
              data-testid="request-row"
              data-row-nav=""
              className="group -mx-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-muted"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  <span className="tabular-nums">{purchaseNumberLabel(request.number)}</span>
                  <span className="ml-2 font-normal text-muted-foreground">{departmentName ?? "No department yet"}</span>
                </span>
                {itemsText ? <span className="truncate text-sm text-foreground">{itemsText}</span> : null}
                <span className="truncate text-xs text-muted-foreground">
                  {mine && viewerId === request.author_id ? "Updated " : `${authorName} · `}
                  <time dateTime={request.updated_at} title={formatDateTime(request.updated_at)}>
                    {formatDay(request.updated_at)}
                  </time>
                </span>
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {noApprover ? <Badge tone="warn">{NO_APPROVER_LABEL}</Badge> : null}
                {mine && request.status === "approved" ? <Badge tone="ok">Request approved</Badge> : null}
                {/* Нульова сума — часто «ціни ще немає»: приглушена, щоб не читалась як остаточна. */}
                <span className={`min-w-20 text-right text-sm tabular-nums ${total === 0 ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                  {formatUsd(total)}
                </span>
                <PurchaseStatusBadge status={request.status} />
                <Icon
                  name="arrow-right"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {viewAllHref && items.length > shown.length ? (
        <Link
          href={viewAllHref}
          className="-mx-5 -mb-4 mt-4 flex items-center justify-between border-t border-border px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-muted"
        >
          View all {items.length}
          <Icon name="arrow-right" className="size-4" />
        </Link>
      ) : null}
    </Card>
  );
}
