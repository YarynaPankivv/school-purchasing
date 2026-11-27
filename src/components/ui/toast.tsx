"use client";

// Тост: результат дії (збережено, помилка) показуємо плаваючою карткою внизу справа, а не блоком у вмісті сторінки.
// Нейтральна картка (як решта поверхонь), колір несе лише кругла плитка зі значком і тонка смужка таймера внизу.
// Текст є вже в серверній відповіді (SSR), тож тести й скрінрідери бачать його одразу; на клієнті картка сама зникає
// (успіх — за 5 с, помилка — за 10 с) і має кнопку «Close». Постійні підказки (причина відхилення, «автор редагує») — це
// Alert у потоці сторінки, не тост.
import { useEffect, useState } from "react";
import { ORG_ERROR_MESSAGES } from "@/lib/org/errors";
import { Icon, type IconName } from "./icons";

const TONES = {
  error: { tile: "bg-status-rejected text-status-rejected-foreground", bar: "bg-status-rejected-foreground", icon: "alert", ms: 10_000 },
  ok: { tile: "bg-status-approved text-status-approved-foreground", bar: "bg-status-approved-foreground", icon: "check", ms: 5_000 },
  warn: { tile: "bg-status-pending text-status-pending-foreground", bar: "bg-status-pending-foreground", icon: "alert", ms: 8_000 },
  info: { tile: "bg-status-info text-status-info-foreground", bar: "bg-status-info-foreground", icon: "info", ms: 6_000 },
} as const satisfies Record<string, { tile: string; bar: string; icon: IconName; ms: number }>;

type ToastProps = { message?: string; tone?: keyof typeof TONES };

export function Toast({ message, tone = "error" }: ToastProps) {
  // Вимога PM («Вигляд і тон»): відмова в доступі — нейтральна, не червона: людина нічого не зламала.
  if (message === ORG_ERROR_MESSAGES.forbidden) tone = "info";
  // key: нове повідомлення (інший текст чи тон) показується знову, навіть якщо попереднє закрили.
  return message ? <ToastView key={`${tone}:${message}`} message={message} tone={tone} /> : null;
}

function ToastView({ message, tone }: { message: string; tone: keyof typeof TONES }) {
  const [open, setOpen] = useState(true);
  const { tile, bar, icon, ms } = TONES[tone];

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div
        role={tone === "error" ? "alert" : "status"}
        className="anim-toast pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-card py-3 pl-3 pr-2 text-card-foreground shadow-card sm:w-96"
      >
        <span aria-hidden="true" className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${tile}`}>
          <Icon name={icon} className="size-[18px]" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{message}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon name="x" className="size-4" />
        </button>
        <span
          aria-hidden="true"
          style={{ animationDuration: `${ms}ms` }}
          className={`toast-timer absolute inset-x-0 bottom-0 h-0.5 motion-reduce:hidden ${bar}`}
        />
      </div>
    </div>
  );
}
