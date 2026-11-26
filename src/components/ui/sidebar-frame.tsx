"use client";

// Рамка бічної панелі (lg+): розгорнута (w-64) чи згорнута до іконок (w-[4.5rem]). Стан зберігаємо в localStorage як
// зручність: без нього (приватне вікно, заблоковані дані) панель просто стартує розгорнутою. Дочірні елементи ховають
// підписи класами `group-data-[collapsed=true]/sidebar:…` — Server Components лишаються серверними.
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "./icons";

const STORAGE_KEY = "sidebar-collapsed";
const CHANGE_EVENT = "sidebar-collapsed-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // сховища немає — розгорнута
  }
}

export function SidebarFrame({ children }: { children: ReactNode }) {
  // На сервері й під час гідратації — розгорнута; збережений стан підхоплюється одразу після гідратації.
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  function toggle() {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      // стан не збережеться — панель лишиться як є
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <aside
      id="app-sidebar"
      data-collapsed={collapsed}
      className="group/sidebar hidden w-64 shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150 motion-reduce:transition-none data-[collapsed=true]:w-[4.5rem] lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-dvh"
    >
      {children}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3.5 top-4 z-30 inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} className="size-4" />
      </button>
    </aside>
  );
}
