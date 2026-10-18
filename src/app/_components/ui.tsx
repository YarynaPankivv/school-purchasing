// Спільні дрібні елементи сторінок (без стану, Server Components).
import Link from "next/link";
import type { ReactNode } from "react";
import { ORG_ERROR_MESSAGES } from "@/lib/org/errors";

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <nav className="flex gap-4 text-sm text-zinc-500">
        <Link href="/" className="underline">
          Головна
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export function Alert({ message, tone = "error" }: { message?: string; tone?: "error" | "ok" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={tone === "error" ? "text-sm text-red-600" : "text-sm text-green-700"}
    >
      {message}
    </p>
  );
}

// AC-ORG-09: без ролі admin — лише це повідомлення, без даних.
export function Forbidden() {
  return (
    <PageShell title="Доступ заборонено">
      <Alert message={ORG_ERROR_MESSAGES.forbidden} />
    </PageShell>
  );
}

export const inputClass = "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
export const buttonClass = "rounded bg-foreground px-3 py-2 text-sm font-medium text-background";
export const secondaryButtonClass = "rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700";
