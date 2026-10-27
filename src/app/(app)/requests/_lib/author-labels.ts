// Підписи авторів і осіб «від імені» для заявок, які людина бачить (AC-APR-08, 09, 10): ім'я, а без імені — email.
// Профілі колег RLS віддає лише зі спільного відділу, тож автор-адміністратор без відділу чи деактивований автор
// не прочитались би напряму; функція request_author_labels віддає лише (id, підпис), без ролі й інших полів.
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadAuthorLabels(supabase: Supabase): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("request_author_labels");
  // PGRST202: функції ще немає в базі (міграцію db-deploy застосовує трохи пізніше за деплой застосунку, а прев'ю Vercel
  // працює з тією самою базою). Тоді імена беремо з профілів колег, як раніше, а не віддаємо сторінку помилки.
  if (error?.code === "PGRST202") return new Map();
  if (error) throw new Error(`Failed to read author names: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.user_id, row.label]));
}
