"use client";

// Тост: результат дії (збережено, помилка) показуємо плаваючою плашкою внизу справа, а не блоком у вмісті сторінки.
// Текст є вже в серверній відповіді (SSR), тож тести й скрінрідери бачать його одразу; на клієнті плашка сама зникає
// (успіх — за 5 с, помилка — за 10 с) і має кнопку «Close». Постійні підказки (причина відхилення, «автор редагує») — це
// Alert у потоці сторінки, не тост.
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

const TONES = {
  error: { box: "border-destructive/30 bg-status-rejected text-status-rejected-foreground", icon: "alert", ms: 10_000 },
  ok: { box: "border-status-approved-foreground/20 bg-status-approved text-status-approved-foreground", icon: "check", ms: 5_000 },
  warn: { box: "border-status-pending-foreground/20 bg-status-pending text-status-pending-foreground", icon: "alert", ms: 8_000 },
  info: { box: "border-status-info-foreground/20 bg-status-info text-status-info-foreground", icon: "info", ms: 6_000 },
} as const satisfies Record<string, { box: string; icon: IconName; ms: number }>;

type ToastProps = { message?: string; tone?: keyof typeof TONES };

export function Toast({ message, tone = "error" }: ToastProps) {
  // key: нове повідомлення (інший текст чи тон) показується знову, навіть якщо попереднє закрили.
  return message ? <ToastView key={`${tone}:${message}`} message={message} tone={tone} /> : null;
}

function ToastView({ message, tone }: { message: string; tone: keyof typeof TONES }) {
  const [open, setOpen] = useState(true);
  const { box, icon, ms } = TONES[tone];

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div
        role={tone === "error" ? "alert" : "status"}
        className={`anim-enter pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-card sm:w-96 ${box}`}
      >
        <Icon name={icon} className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1">{message}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="-mr-1 -mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
        >
          <Icon name="x" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
