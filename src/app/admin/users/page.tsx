import Link from "next/link";
import { Forbidden, PageShell } from "@/app/_components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { personLabel } from "@/lib/org/departments";
import { PERMISSION_KEYS, PERMISSION_LABELS, permissionsFrom } from "@/lib/org/request-options";
import { ROLE_LABELS, isAppRole } from "@/lib/org/roles";

// Список працівників для адміністратора (дозволи — AC-ORG-07, 08, 17). Лише для admin (AC-ORG-09).
export default async function UsersPage() {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden />;
  const { supabase } = ctx;

  const [{ data: people }, { data: permissionRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, is_active").order("email"),
    supabase.from("user_permissions").select("user_id, card_expense, check_request, vendor_invoice, self_purchase"),
  ]);
  const byUser = new Map((permissionRows ?? []).map((row) => [row.user_id, permissionsFrom(row)]));

  return (
    <PageShell title="Працівники">
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800" data-testid="users">
        {(people ?? []).map((p) => {
          const granted = PERMISSION_KEYS.filter((key) => byUser.get(p.id)?.[key]).map((key) => PERMISSION_LABELS[key]);
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span>
                <Link href={`/admin/users/${p.id}`} className="font-medium underline">
                  {personLabel(p)}
                </Link>
                <span className="ml-2 text-zinc-500">{p.email}</span>
                {p.is_active ? null : <span className="ml-2 text-zinc-500">деактивований</span>}
              </span>
              <span className="text-zinc-500">
                {isAppRole(p.role) ? ROLE_LABELS[p.role] : p.role}
                {granted.length ? `, дозволи: ${granted.join(", ")}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
