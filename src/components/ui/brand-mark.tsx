// Знак продукту: академічна шапка, китиця якої закінчується монетою (школа + закупівлі). Малюється SVG на токенах, без
// растрів і без плитки-тла: сам знак стоїть на сторінці. Напис «School Purchasing» ставлять поруч там, де він потрібен.
// `primary` — для світлих поверхонь (шапка, бічна панель), `on-brand` — для фірмової панелі входу (інвертований).
import { cn } from "./cn";

type BrandMarkProps = { variant?: "primary" | "on-brand"; className?: string };

export function BrandMark({ variant = "primary", className }: BrandMarkProps) {
  const onBrand = variant === "on-brand";
  const ink = onBrand ? "fill-brand-foreground" : "fill-primary";
  const inkStroke = onBrand ? "stroke-brand-foreground" : "stroke-primary";
  // Монета: на світлому — світло-жовта з петроль-контуром (інакше зникає на білому), на фірмовій панелі — просто жовта.
  const coin = onBrand ? "fill-tint-butter stroke-transparent" : "fill-tint-butter stroke-primary";
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <path d="M18 30v10c0 4 6 7 14 7s14-3 14-7V30" fill="none" strokeWidth="5" strokeLinejoin="round" className={inkStroke} />
      <path d="M32 10 58 23 32 36 6 23Z" className={ink} />
      <path d="M54 25v16" fill="none" strokeWidth="3" strokeLinecap="round" className={inkStroke} />
      <circle cx="54" cy="46" r="5" strokeWidth="2.5" className={coin} />
    </svg>
  );
}
