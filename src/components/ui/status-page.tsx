// Сторінка стану (404, помилка): іконка, короткий заголовок, пояснення й дії. Без хуків і серверних імпортів — годиться і для
// серверного not-found, і для клієнтського error. Колір — лише токени. Тон спокійний: людина нічого не зламала.
import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { Icon, type IconName } from "./icons";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-status-rejected text-status-rejected-foreground",
} as const;

export function StatusPage({
  icon,
  tone = "neutral",
  code,
  title,
  description,
  reference,
  actions,
  standalone = false,
}: {
  icon: IconName;
  tone?: keyof typeof TONES;
  code?: string;
  title: string;
  description: ReactNode;
  // Код помилки сервера (digest): допомагає знайти запис у журналі, людині нічого не пояснює.
  reference?: string;
  actions: ReactNode;
  // Без бічної панелі (вхід, помилка кореневого layout): з назвою продукту зверху й по центру екрана.
  standalone?: boolean;
}) {
  const panel = (
    <section className="anim-enter flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-10 text-center sm:py-12">
      <span className={`inline-flex size-12 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon name={icon} className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        {code ? <p className="text-sm font-medium tabular-nums text-muted-foreground">{code}</p> : null}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mx-auto max-w-prose text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      {reference ? <p className="text-xs text-muted-foreground">Reference: {reference}</p> : null}
    </section>
  );

  if (standalone) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-sm font-semibold text-foreground">School Purchasing</span>
        </div>
        {panel}
      </main>
    );
  }

  return <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">{panel}</main>;
}
