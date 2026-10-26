import type { Metadata } from "next";
import { Suspense } from "react";
import { DepartmentsSkeleton } from "@/components/ui";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, Forbidden, Icon, PageShell } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { NO_APPROVER_LABEL, departmentHasActiveApprover } from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { AddDepartment } from "../_components/add-department";

const HEAD = "px-3 py-2.5 text-xs font-normal text-muted-foreground";

export const metadata: Metadata = { title: "Departments · School Purchasing" };

// Список відділів (AC-ORG-14) і створення відділу. Лише для admin (AC-ORG-09).
// Таблиця, як у списку заявок: відділи без схвалювача зверху (їм потрібна дія), далі за назвою; створення — кнопка
// «Add department» у заголовку, що відкриває форму.
export async function DepartmentsPageContent({ searchParams }: PageProps<"/admin/departments">) {
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

  const rows = (departments ?? [])
    .map((d) => ({
      id: d.id,
      name: d.name,
      hasApprover: departmentHasActiveApprover(d.id, approvers ?? [], people ?? []),
      requesters: (members ?? []).filter((m) => m.department_id === d.id).length,
      approvers: (approvers ?? []).filter((a) => a.department_id === d.id).length,
    }))
    .sort((a, b) => Number(a.hasApprover) - Number(b.hasApprover) || a.name.localeCompare(b.name));
  const withoutApprover = rows.filter((row) => !row.hasApprover).length;

  // Підзаголовок — про дані (скільки відділів і скільки з них без схвалювача), а не про інтерфейс.
  const summary =
    rows.length === 0
      ? "No departments yet."
      : `${rows.length} ${rows.length === 1 ? "department" : "departments"}${
          withoutApprover > 0 ? `, ${withoutApprover} without an approver who can decide` : ""
        }.`;

  return (
    <PageShell title="Departments" description={summary} actions={<AddDepartment count={rows.length} />}>
      <Alert message={orgErrorMessage(error)} />

      {rows.length === 0 ? (
        <EmptyState>No departments yet. Create the first one and add requesters to it.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="-mx-5 -my-4 overflow-x-auto" role="region" aria-label="Departments" tabIndex={0}>
            <table className="w-full text-left text-sm" data-testid="departments">
              <thead className="border-b border-border">
                <tr>
                  <th scope="col" className={`${HEAD} pl-5`}>
                    Department
                  </th>
                  <th scope="col" className={`${HEAD} text-right`}>
                    Requesters
                  </th>
                  <th scope="col" className={`${HEAD} text-right max-sm:hidden`}>
                    Approvers
                  </th>
                  <th scope="col" className={HEAD}>
                    Status
                  </th>
                  <th scope="col" className={`${HEAD} pr-5`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="group relative transition-colors hover:bg-muted">
                    <td className="py-3 pl-5 pr-3">
                      <Link
                        href={`/admin/departments/${row.id}`}
                        className="font-medium text-foreground after:absolute after:inset-0 after:content-['']"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{row.requesters}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground max-sm:hidden">{row.approvers}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.hasApprover ? null : (
                        <Badge tone="warn" testId="no-approver">
                          {NO_APPROVER_LABEL}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right">
                      <Icon
                        name="arrow-right"
                        className="inline size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </PageShell>
  );
}

// Скелет — частина відповіді саме цієї сторінки (Suspense тут, а не loading.tsx): при переході показується її власний скелет.
export default function DepartmentsPage(props: PageProps<"/admin/departments">) {
  return (
    <Suspense fallback={<DepartmentsSkeleton />}>
      <DepartmentsPageContent {...props} />
    </Suspense>
  );
}
