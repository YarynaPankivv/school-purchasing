// Хто увійшов і чи має право діяти (design.md D6). Авторизація — лише через getClaims(), ніколи getSession().
// Викликати на початку кожної сторінки й server action: server actions доступні й прямим POST-запитом.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAppRole, type AppRole } from "@/lib/org/roles";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  isActive: boolean;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getSessionContext(): Promise<{ supabase: Supabase; user: CurrentUser | null }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { supabase, user: null };

  // Власний профіль читається навіть неактивним (політика profiles_select_own) — щоб перевірити is_active.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  // Збій бази — не привід розлогінювати активного користувача: нехай спрацює сторінка помилки.
  if (error) throw new Error(`Не вдалося прочитати профіль: ${error.message}`);

  if (!profile || !isAppRole(profile.role)) {
    return {
      supabase,
      user: { id: userId, email: null, fullName: null, role: "requester", isActive: false },
    };
  }
  return {
    supabase,
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      isActive: profile.is_active,
    },
  };
}

// Неактивний (або без профілю) — виходить і бачить той самий текст, що й за невірного пароля (AC-ORG-12, D6).
export async function requireActiveUser(): Promise<{ supabase: Supabase; user: CurrentUser }> {
  const { supabase, user } = await getSessionContext();
  if (!user) redirect("/login");
  if (!user.isActive) {
    await supabase.auth.signOut();
    redirect("/login?error=invalid");
  }
  return { supabase, user };
}

// Адміністрування — лише для admin (AC-ORG-09). Сторінка показує «Недостатньо прав», action — повертає помилку.
export async function requireAdmin(): Promise<
  { ok: true; supabase: Supabase; user: CurrentUser } | { ok: false; supabase: Supabase; user: CurrentUser }
> {
  const { supabase, user } = await requireActiveUser();
  return user.role === "admin" ? { ok: true, supabase, user } : { ok: false, supabase, user };
}
