// Смуга коротких посилань-лічильників («Drafts 3»): де людина зараз, і шлях до відповідного списку.
// Не «метрики на показ»: невеликі, у рядок, колір — лише за терміновістю (warn), решта нейтральні.
// `active` — обраний фільтр на /requests (aria-current + заливка accent; не лише кольором, а й aria).
import Link from "next/link";

export type StatusLink = { href: string; label: string; count?: number; urgent?: boolean; active?: boolean };

export function StatusLinks({ items, label }: { items: StatusLink[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              aria-current={item.active ? "true" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors sm:min-h-9 ${
                item.active
                  ? "border-primary bg-card font-medium text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
              {item.count === undefined ? null : (
                <span
                  className={`tabular-nums ${item.urgent && item.count > 0 ? "font-medium text-status-pending-foreground" : "text-muted-foreground"}`}
                >
                  {item.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
