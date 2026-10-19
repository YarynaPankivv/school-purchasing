import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/session";
import { signOut } from "./login/actions";

// Головна: хто увійшов, з якою роллю (з таблиці profiles) і куди можна перейти.
// requireActiveUser() перевіряє JWT через getClaims() і виводить деактивованого (design.md D6).
export default async function Home() {
  const { user } = await requireActiveUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Purchasing App</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Email</dt>
        <dd data-testid="user-email">{user.email ?? "—"}</dd>
        <dt className="text-zinc-500">Роль</dt>
        <dd data-testid="user-role">{user.role}</dd>
      </dl>
      <nav className="flex flex-col gap-2 text-sm">
        <Link href="/requests/new" className="underline">
          Нова заявка
        </Link>
        <Link href="/profile" className="underline">
          Мій профіль
        </Link>
        {user.role === "admin" ? (
          <>
            <Link href="/admin/departments" className="underline">
              Відділи
            </Link>
            <Link href="/admin/users" className="underline">
              Працівники
            </Link>
          </>
        ) : null}
      </nav>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Вийти
        </button>
      </form>
    </main>
  );
}
