// Смуга коротких посилань-лічильників («Drafts 3»): де людина зараз, і шлях до відповідного списку.
// Два вигляди: `chips` — фільтри в рядок (на /requests; активний — заливка accent і петрольна рамка, aria-current), `cards` —
// картки-показники на головній (підпис, велике число, стрілка). Колір — лише за терміновістю (warn), решта нейтральні.
import Link from "next/link";
import { Icon } from "./icons";

export type StatusLink = { href: string; label: string; count?: number; urgent?: boolean; active?: boolean };

export function StatusLinks({ items, label, variant = "chips" }: { items: StatusLink[]; label: string; variant?: "chips" | "cards" }) {
  if (items.length === 0) return null;
  if (variant === "cards") return <StatCards items={items} label={label} />;
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
                  ? "border-primary bg-accent font-medium text-accent-foreground"
                  : "border-border bg-card text-foreground hover:border-input hover:bg-muted"
              }`}
            >
              {item.label}
              {item.count === undefined ? null : (
                <span
                  className={`tabular-nums ${item.active ? "text-accent-foreground" : item.urgent && item.count > 0 ? "font-medium text-status-pending-foreground" : "text-muted-foreground"}`}
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

function StatCards({ items, label }: { items: StatusLink[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const urgent = item.urgent === true && (item.count ?? 0) > 0;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`group flex h-full flex-col gap-2 rounded-xl border p-4 transition-colors ${
                  urgent
                    ? "border-status-pending-foreground/25 bg-status-pending text-status-pending-foreground hover:border-status-pending-foreground/50"
                    : "border-border bg-card text-foreground hover:border-input"
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className={urgent ? "" : "text-muted-foreground"}>{item.label}</span>
                  <Icon
                    name="arrow-right"
                    className="size-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </span>
                {item.count === undefined ? null : <span className="text-3xl font-semibold leading-none tabular-nums">{item.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
