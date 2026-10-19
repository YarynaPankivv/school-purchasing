import { notFound } from "next/navigation";
import { Alert, Forbidden, PageShell, buttonClass } from "@/app/_components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid, personLabel } from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { loadPermissions } from "@/lib/org/load-permissions";
import { PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/org/request-options";
import { ROLE_LABELS, isAppRole } from "@/lib/org/roles";
import { setPermissions } from "../actions";

// Картка працівника: дозволи на типи заявок і «Самостійну закупівлю» (AC-ORG-07, 08, 17). Лише для admin.
export default async function UserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden />;
  const { supabase } = ctx;
  const { id } = await params;
  const { error, saved } = await searchParams;
  if (!isUuid(id)) notFound();

  const [{ data: person }, permissions] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, is_active").eq("id", id).maybeSingle(),
    loadPermissions(supabase, id),
  ]);
  if (!person) notFound();

  return (
    <PageShell title={personLabel(person)}>
      <Alert message={orgErrorMessage(error)} />
      <Alert tone="ok" message={saved === "1" ? "Дозволи збережено." : undefined} />
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Email</dt>
        <dd>{person.email ?? "—"}</dd>
        <dt className="text-zinc-500">Роль</dt>
        <dd>{isAppRole(person.role) ? ROLE_LABELS[person.role] : person.role}</dd>
      </dl>

      <form action={setPermissions} className="flex flex-col gap-3">
        <input type="hidden" name="user_id" value={person.id} />
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-2 text-lg font-medium">Дозволи</legend>
          {PERMISSION_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" name={key} defaultChecked={permissions[key]} />
              {PERMISSION_LABELS[key]}
            </label>
          ))}
        </fieldset>
        {person.role === "admin" ? (
          <p className="text-xs text-zinc-500">
            Адміністратор створює ці типи заявок і обирає «Самостійну закупівлю» без дозволів.
          </p>
        ) : null}
        <button type="submit" className={`${buttonClass} self-start`}>
          Зберегти дозволи
        </button>
      </form>
    </PageShell>
  );
}
