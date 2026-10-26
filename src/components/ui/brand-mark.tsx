// Знак продукту: академічна шапка, китиця якої закінчується монетою (школа + закупівлі). Малюється SVG на токенах, без растрів.
// `primary` — для шапки (світла/темна теми беруть primary), `on-brand` — для фірмової панелі входу (інвертований).
import { cn } from "./cn";

type BrandMarkProps = { variant?: "primary" | "on-brand"; className?: string };

export function BrandMark({ variant = "primary", className }: BrandMarkProps) {
  const onBrand = variant === "on-brand";
  const tile = onBrand ? "fill-brand-foreground" : "fill-primary";
  const ink = onBrand ? "fill-brand" : "fill-primary-foreground";
  const inkStroke = onBrand ? "stroke-brand" : "stroke-primary-foreground";
  const coin = onBrand ? "fill-primary" : "fill-tint-butter";
  const coinStroke = onBrand ? "stroke-primary" : "stroke-tint-butter";
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx="16" className={tile} />
      <path
        d="M22 29v8c0 3.5 4.5 6 10 6s10-2.5 10-6v-8"
        fill="none"
        strokeWidth="4"
        strokeLinejoin="round"
        className={inkStroke}
      />
      <path d="M32 14 53 25 32 36 11 25Z" className={ink} />
      <path d="M50 27v13" fill="none" strokeWidth="2.4" strokeLinecap="round" className={coinStroke} />
      <circle cx="50" cy="44" r="4" className={coin} />
    </svg>
  );
}
