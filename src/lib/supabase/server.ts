// Клієнт Supabase для серверу (Server Components, Server Actions, Route Handlers).
// Створюйте новий клієнт на кожен запит — ніколи не тримайте його в змінній модуля.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Другий аргумент setAll (заголовки кешування) застосовує лише proxy
        // (src/lib/supabase/proxy.ts), тому тут його не оголошуємо.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll викликано із Server Component — це можна ігнорувати,
            // бо сесію оновлює proxy.
          }
        },
      },
    },
  );
}
