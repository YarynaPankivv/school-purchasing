"use client";

// Меню для вузьких екранів: розкривається під верхньою смугою й закривається при переході на іншу сторінку
// і при виборі будь-якого пункту (також того, що веде на поточний шлях, — тоді pathname не змінюється).
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";

export function MobileMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="group relative lg:hidden">
      <summary
        aria-label="Menu"
        className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"
      >
        <Icon name="list" className="size-5" />
      </summary>
      <div
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="absolute right-0 top-12 z-20 flex w-72 flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
      >
        {children}
      </div>
    </details>
  );
}
