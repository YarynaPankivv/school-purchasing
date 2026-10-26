"use client";

// Клавіатура для списків заявок: J / K — до наступного / попереднього рядка, Enter відкриває (це звичайне посилання).
// Лише навігація: жодне рішення (схвалити, відхилити) на клавішу не вішається. Не втручається, поки людина друкує.
import { useEffect } from "react";

const ROW = "a[data-row-nav]";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function RowKeyNav() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const step = event.key === "j" ? 1 : event.key === "k" ? -1 : 0;
      if (step === 0) return;
      const rows = Array.from(document.querySelectorAll<HTMLAnchorElement>(ROW));
      if (rows.length === 0) return;
      event.preventDefault();
      const current = rows.indexOf(document.activeElement as HTMLAnchorElement);
      const next = current === -1 ? (step === 1 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, current + step));
      rows[next]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
