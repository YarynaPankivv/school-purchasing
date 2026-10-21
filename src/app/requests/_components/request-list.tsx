// Список закупівель одного вигляду для всіх секцій /requests: номер, статус, відділ, автор, сума, дата.
import Link from "next/link";
import { Badge, Card, EmptyState } from "@/app/_components/ui";
import { Icon } from "@/app/_components/icons";
import { purchaseNumberLabel } from "@/lib/pur/numbers";
import { formatDateTime } from "@/lib/pur/time";
import { formatUsd } from "@/lib/pur/totals";
import { NO_APPROVER_LABEL } from "@/lib/org/departments";
import type { RequestListItem } from "../_lib/overview";
import { PurchaseStatusBadge } from "./status-badge";

export function RequestList({
  title,
  description,
  items,
  empty,
  testId,
  mine = false,
  noApprover = false,
}: {
  title: string;
  description?: string;
  items: RequestListItem[];
  empty: string;
  testId: string;
  // «Мої заявки»: автору схваленої заявки показуємо позначку (AC-PUR-40).
  mine?: boolean;
  // «Чекають рішення»: у відділі нема кому вирішити (AC-PUR-33, 47, 48).
  noApprover?: boolean;
}) {
  return (
    <Card title={title} description={description} action={<Badge>{items.length}</Badge>}>
      {items.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="-my-4 flex flex-col divide-y divide-line" data-testid={testId}>
          {items.map(({ request, total, departmentName, authorName }) => (
            <li key={request.id}>
              <Link
                href={`/requests/${request.id}`}
                data-testid="request-row"
                className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">
                    {purchaseNumberLabel(request.number)}
                    <span className="ml-2 font-normal text-muted">{departmentName ?? "No department yet"}</span>
                  </span>
                  <span className="truncate text-xs text-muted">
                    {authorName} · {formatDateTime(request.updated_at)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {noApprover ? <Badge tone="warn">{NO_APPROVER_LABEL}</Badge> : null}
                  {mine && request.status === "approved" ? <Badge tone="ok">Request approved</Badge> : null}
                  <span className="text-sm tabular-nums text-ink">{formatUsd(total)}</span>
                  <PurchaseStatusBadge status={request.status} />
                  <Icon name="arrow-right" className="size-4 text-muted" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
