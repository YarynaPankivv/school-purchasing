import type { ReactNode } from "react";
import { AppSidebar } from "@/components/ui";
import { requireActiveUser } from "@/lib/auth/session";

// Спільна оболонка всіх екранів застосунку (все, крім входу): бічна панель живе тут, а не в кожній сторінці. Між сторінками
// вона не перемальовується й не підміняється скелетом: меню, блок Administration і користувач лишаються на місці.
// Роль і ім'я читаємо один раз на вхід у групу (не на кожен перехід); вихід веде на /login — поза групою.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireActiveUser();
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <AppSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
