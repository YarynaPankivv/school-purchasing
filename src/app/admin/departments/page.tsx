import Link from "next/link";
import { Alert, Forbidden, PageShell, buttonClass, inputClass } from "@/app/_components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { DEPARTMENT_NAME_MAX, NO_APPROVER_LABEL, departmentHasActiveApprover } from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { createDepartment } from "./actions";

// Список відділів (AC-ORG-14) і створення відділу. Лише для admin (AC-ORG-09).
export default async function DepartmentsPage({ searchParams }: PageProps<"/admin/departments">) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden />;
  const { supabase } = ctx;
  const { error } = await searchParams;

  const [{ data: departments }, { data: approvers }, { data: people }, { data: members }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("department_approvers").select("department_id, user_id"),
    supabase.from("profiles").select("id, is_active"),
    supabase.from("department_members").select("department_id, user_id"),
  ]);

  return (
    <PageShell title="Відділи">
      <Alert message={orgErrorMessage(error)} />

      <form action={createDepartment} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Назва нового відділу
          <input name="name" required maxLength={DEPARTMENT_NAME_MAX} className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>
          Створити
        </button>
      </form>

      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800" data-testid="departments">
        {(departments ?? []).map((d) => {
          const hasApprover = departmentHasActiveApprover(d.id, approvers ?? [], people ?? []);
          const memberCount = (members ?? []).filter((m) => m.department_id === d.id).length;
          return (
            <li key={d.id} className="flex items-center justify-between gap-4 py-3">
              <Link href={`/admin/departments/${d.id}`} className="font-medium underline">
                {d.name}
              </Link>
              <span className="flex items-center gap-3 text-sm text-zinc-500">
                <span>Заявників: {memberCount}</span>
                {hasApprover ? null : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900" data-testid="no-approver">
                    {NO_APPROVER_LABEL}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
