import { PageShell } from "@/app/_components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { personLabel } from "@/lib/org/departments";
import { loadPermissions } from "@/lib/org/load-permissions";
import { PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/org/request-options";
import { ROLE_LABELS } from "@/lib/org/roles";

// Власний профіль лише для читання: відділи, схвалення, автосхвалення, дозволи
// («Користувачі й ролі» вимоги PM, без AC).
export default async function ProfilePage() {
  const { supabase, user } = await requireActiveUser();

  const [{ data: departments }, { data: memberships }, { data: approvals }, permissions] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("department_members").select("department_id, auto_approve").eq("user_id", user.id),
    supabase.from("department_approvers").select("department_id").eq("user_id", user.id),
    loadPermissions(supabase, user.id),
  ]);
  const granted = PERMISSION_KEYS.filter((key) => permissions[key]);
  const names = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const approves = new Set((approvals ?? []).map((a) => a.department_id));

  return (
    <PageShell title="Мій профіль">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Ім’я</dt>
        <dd>{personLabel({ email: user.email, full_name: user.fullName })}</dd>
        <dt className="text-zinc-500">Email</dt>
        <dd>{user.email ?? "—"}</dd>
        <dt className="text-zinc-500">Роль</dt>
        <dd data-testid="profile-role">{ROLE_LABELS[user.role]}</dd>
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Мої відділи</h2>
        {(memberships ?? []).length === 0 ? (
          <p className="text-sm text-zinc-600">Вас ще не додано до жодного відділу.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm" data-testid="profile-departments">
            {(memberships ?? []).map((m) => (
              <li key={m.department_id}>
                {names.get(m.department_id) ?? m.department_id}
                {approves.has(m.department_id) ? " — схвалювач" : ""}
                {m.auto_approve ? " — автосхвалення" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Мої дозволи</h2>
        {user.role === "admin" ? (
          // Матриця прав PM; «Самостійна закупівля» для admin — тимчасово Q5.
          <p className="text-sm text-zinc-600">
            Адміністратор створює всі типи заявок і обирає «Самостійну закупівлю» без окремих дозволів.
          </p>
        ) : granted.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Окремих дозволів немає: доступні «Закупівля» й «Відшкодування» з типом закупівлі «Відділ закупівель».
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm" data-testid="profile-permissions">
            {granted.map((key) => (
              <li key={key}>{PERMISSION_LABELS[key]}</li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
