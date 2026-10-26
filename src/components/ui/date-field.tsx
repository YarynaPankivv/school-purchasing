"use client";

// Власний вибір дати замість рідного <input type="date">: календар на токенах, а не системний.
// У форму йде прихований <input name value> з датою «YYYY-MM-DD» (або порожній рядок). Тиждень починається з понеділка.
// Клавіатура в календарі: стрілки ±1 / ±7 днів, PageUp / PageDown — місяць, Home / End — початок і кінець тижня,
// Enter / Space — вибрати, Esc — закрити. Дати рахуємо в UTC: переходи літнього часу не зсувають день.
import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { Icon } from "./icons";
import { FIELD } from "./input";

const DAY = 86_400_000;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthTitle = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const longDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
// Дата без часу → мс UTC; недійсні (2026-02-31) відкидаємо.
function parseIso(value: string): number | null {
  const match = ISO_RE.exec(value);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toIso(ms) === value ? ms : null;
}
const todayIso = () => {
  const now = new Date();
  return toIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso: string, delta: number) => {
  const ms = parseIso(iso) ?? 0;
  const d = new Date(ms);
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1);
  const lastDay = new Date(Date.UTC(new Date(target).getUTCFullYear(), new Date(target).getUTCMonth() + 1, 0)).getUTCDate();
  return toIso(target + (Math.min(d.getUTCDate(), lastDay) - 1) * DAY);
};

export function DateField({
  name,
  defaultValue = "",
  id,
  disabled,
  className,
  onChange,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: {
  name?: string;
  defaultValue?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  onChange?: (value: string) => void;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const [value, setValue] = useState(parseIso(defaultValue) === null ? "" : defaultValue);
  const [open, setOpen] = useState(false);
  const [focusIso, setFocusIso] = useState(value || "");
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Фокус іде на день, який зараз «в руках»: після відкриття й після кожного руху стрілками.
  useEffect(() => {
    if (open && focusIso) grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focusIso}"]`)?.focus();
  }, [open, focusIso]);

  const openCalendar = () => {
    setFocusIso(value || todayIso());
    setOpen(true);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };
  const choose = (iso: string) => {
    setValue(iso);
    onChange?.(iso);
    close(true);
  };

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    const ms = parseIso(focusIso);
    if (ms === null) return;
    const dow = (new Date(ms).getUTCDay() + 6) % 7;
    const moves: Record<string, string> = {
      ArrowLeft: toIso(ms - DAY),
      ArrowRight: toIso(ms + DAY),
      ArrowUp: toIso(ms - 7 * DAY),
      ArrowDown: toIso(ms + 7 * DAY),
      Home: toIso(ms - dow * DAY),
      End: toIso(ms + (6 - dow) * DAY),
      PageUp: addMonths(focusIso, -1),
      PageDown: addMonths(focusIso, 1),
    };
    if (event.key in moves) {
      event.preventDefault();
      setFocusIso(moves[event.key]!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  };

  const viewIso = monthStart(focusIso || value || todayIso());
  const viewMs = parseIso(viewIso) ?? 0;
  const firstDow = (new Date(viewMs).getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => toIso(viewMs + (i - firstDow) * DAY));
  const today = open ? todayIso() : "";
  const selectedMs = value ? parseIso(value) : null;

  return (
    <span ref={root} className="relative block">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={trigger}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? close(false) : openCalendar())}
        className={cn(
          FIELD,
          "flex items-center justify-between gap-2 text-left transition-colors hover:border-ring aria-expanded:border-ring",
          className,
        )}
      >
        <span className={`truncate ${selectedMs === null ? "text-muted-foreground" : ""}`}>
          {selectedMs === null ? "Select a date" : shortDate.format(selectedMs)}
        </span>
        <Icon name="calendar" className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose a date"
          // Календар лежить усередині <label> (Field): без preventDefault клік «активує» мітку й повторно тисне кнопку.
          onClick={(event) => event.preventDefault()}
          className="anim-pop absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-card p-3 shadow-card"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setFocusIso(addMonths(focusIso || todayIso(), -1))}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon name="chevron-left" className="size-4" />
            </button>
            <p className="text-sm font-medium text-foreground" aria-live="polite">
              {monthTitle.format(viewMs)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setFocusIso(addMonths(focusIso || todayIso(), 1))}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon name="chevron-right" className="size-4" />
            </button>
          </div>
          <div ref={grid} role="grid" aria-label={monthTitle.format(viewMs)} onKeyDown={onGridKeyDown}>
            <div role="row" className="grid grid-cols-7 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} role="columnheader" className="py-1">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((iso) => {
                const inMonth = iso.slice(0, 7) === viewIso.slice(0, 7);
                const selected = iso === value;
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    data-date={iso}
                    tabIndex={iso === focusIso ? 0 : -1}
                    aria-selected={selected}
                    aria-label={longDate.format(parseIso(iso) ?? 0)}
                    aria-current={iso === today ? "date" : undefined}
                    onClick={() => choose(iso)}
                    className={`mx-auto inline-flex size-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${
                      selected
                        ? "bg-primary font-medium text-primary-foreground"
                        : `${inMonth ? "text-foreground" : "text-muted-foreground"} hover:bg-muted ${iso === today ? "border border-primary" : ""}`
                    }`}
                  >
                    {Number(iso.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                setValue("");
                onChange?.("");
                close(true);
              }}
              className="rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-muted"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => choose(todayIso())}
              className="rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-muted"
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
