import Link from "next/link";
import { Alert, Badge, Card, EmptyState, Field, Forbidden, PageShell, inputClass } from "@/app/_components/ui";
import { Icon } from "@/app/_components/icons";
import { SubmitButton } from "@/app/_components/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { DEPARTMENT_NAME_MAX, NO_APPROVER_LABEL, departmentHasActiveApprover } from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { createDepartment } from "./actions";

// Список відділів (AC-ORG-14) і створення відділу. Лише для admin (AC-ORG-09).
export default async function DepartmentsPage({ searchParams }: PageProps<"/admin/departments">) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden user={ctx.user} />;
  const { supabase, user } = ctx;
  const { error } = await searchParams;

  const [{ data: departments }, { data: approvers }, { data: people }, { data: members }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("department_approvers").select("department_id, user_id"),
    supabase.from("profiles").select("id, is_active"),
    supabase.from("department_members").select("department_id, user_id"),
  ]);

  return (
    <PageShell
      title="Departments"
      description="Set who submits requests for a department and who approves them."
      user={user}
      back={{ href: "/", label: "Back to home" }}
    >
      <Alert message={orgErrorMessage(error)} />

      <Card title="New department">
        <form action={createDepartment} className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <Field label="Department name" hint={`Up to ${DEPARTMENT_NAME_MAX} characters, no duplicates.`}>
              <input name="name" required maxLength={DEPARTMENT_NAME_MAX} className={inputClass} />
            </Field>
          </div>
          <SubmitButton>Create department</SubmitButton>
        </form>
      </Card>

      {(departments ?? []).length === 0 ? (
        <EmptyState>No departments yet. Create the first one and add requesters to it.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="departments">
          {(departments ?? []).map((d) => {
            const hasApprover = departmentHasActiveApprover(d.id, approvers ?? [], people ?? []);
            const memberCount = (members ?? []).filter((m) => m.department_id === d.id).length;
            const approverCount = (approvers ?? []).filter((a) => a.department_id === d.id).length;
            return (
              <li key={d.id}>
                <Link
                  href={`/admin/departments/${d.id}`}
                  className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-primary/50"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-ink">
                        <Icon name="building" className="size-4" />
                      </span>
                      <span className="font-semibold text-ink">{d.name}</span>
                    </span>
                    <Icon
                      name="arrow-right"
                      className="mt-1 size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span>Requesters: {memberCount}</span>
                    <span aria-hidden="true">·</span>
                    <span>Approvers: {approverCount}</span>
                    {hasApprover ? null : (
                      <Badge tone="warn" testId="no-approver">
                        {NO_APPROVER_LABEL}
                      </Badge>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
