// Смуга підсумку об'єкта (заявки): один контейнер, розділений 1px лініями, підпис над значенням. Без значків і плиток.
// Значення — звичайна вага й tabular-nums; на вузьких екранах пункти стають рядками.
import type { ReactNode } from "react";

export type SummaryItem = { label: string; value: ReactNode; testId?: string };

export function SummaryStrip({ items, label }: { items: SummaryItem[]; label: string }) {
  return (
    <dl
      aria-label={label}
      className="grid divide-y divide-border rounded-xl border border-border bg-card sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0"
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 px-5 py-3">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd data-testid={item.testId} className="flex min-h-7 items-center text-xl font-medium tabular-nums text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
