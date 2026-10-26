"use client";

// Навігація: підсвічує розділ, у якому ми зараз (потрібен usePathname — тому клієнтський компонент).
// Вертикальний список — для бічної панелі й меню на вузьких екранах.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName };

export function NavLinks({ items, label = "Main navigation" }: { items: NavItem[]; label?: string }) {
  const pathname = usePathname();
  // Активний — найдовший збіг: на /requests/new підсвічується «New request», а не ще й «Requests».
  const activeHref = items
    .filter((item) => (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .reduce<string | null>((best, item) => (best === null || item.href.length > best.length ? item.href : best), null);
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2 ${
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon name={item.icon} className={`size-[18px] shrink-0 ${active ? "text-primary" : ""}`} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
