// Бейджі статусів закупівлі й рядка (src/lib/pur/statuses.ts): колір — за змістом статусу, підпис — із довідника.
import { Badge, type BadgeTone } from "@/app/_components/ui";
import { isLineStatus, isPurchaseStatus, lineStatusLabel, purchaseStatusLabel, type LineStatus, type PurchaseStatus } from "@/lib/pur/statuses";

const PURCHASE_TONES: Record<PurchaseStatus, BadgeTone> = {
  draft: "neutral",
  pending: "warn",
  approved: "ok",
  partially_approved: "ok",
  rejected: "danger",
  returned: "info",
  cancelled: "neutral",
  processing: "info",
  processed: "ok",
};

const LINE_TONES: Record<LineStatus, BadgeTone> = {
  pending: "neutral",
  approved: "ok",
  rejected: "danger",
  ready: "info",
  ordered: "primary",
};

export function PurchaseStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={isPurchaseStatus(status) ? PURCHASE_TONES[status] : "neutral"} testId="request-status">
      {purchaseStatusLabel(status)}
    </Badge>
  );
}

export function LineStatusBadge({ status }: { status: string }) {
  return <Badge tone={isLineStatus(status) ? LINE_TONES[status] : "neutral"}>{lineStatusLabel(status)}</Badge>;
}
