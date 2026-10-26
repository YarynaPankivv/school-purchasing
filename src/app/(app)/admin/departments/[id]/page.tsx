import type { Metadata } from "next";
import { Suspense } from "react";
import { DepartmentDetailSkeleton } from "@/components/ui";
import { notFound } from "next/navigation";
import { Alert, Avatar, Badge, Card, EmptyState, Field, Forbidden, PageShell, RoleBadge, Select, SubmitButton, Switch } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/session";
import {
  NO_APPROVER_LABEL,
  approverCandidates,
  departmentHasActiveApprover,
  isUuid,
  memberRemovalEffects,
  personLabel,
  type RemovalEffect,
} from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { addApprover, addMember, removeApprover, removeMember, setAutoApprove } from "../actions";

const EFFECT_LABELS: Record<RemovalEffect, string> = {
  approver: "approver of this department",
  auto_approve: "auto-approval in this department",
};

export const metadata: Metadata = { title: "Department · School Purchasing" };

// Заявники (AC-ORG-01, 03, 15), автосхвалення (AC-ORG-06), схвалювачі (AC-ORG-02, 04, 05, 16). Лише для admin.
export async function DepartmentPageContent({ params, searchParams }: PageProps<"/admin/departments/[id]">) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden />;
  const { supabase } = ctx;
  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound();

  const [{ data: department }, { data: members }, { data: approvers }, { data: people }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("department_members").select("department_id, user_id, auto_approve").eq("department_id", id),
    supabase.from("department_approvers").select("department_id, user_id").eq("department_id", id),
    supabase.from("profiles").select("id, email, full_name, role, is_active").order("email"),
  ]);
  if (!department) notFound();

  const memberRows = members ?? [];
  const approverRows = approvers ?? [];
  const everyone = people ?? [];
  const byId = new Map(everyone.map((p) => [p.id, p]));
  const memberIds = new Set(memberRows.map((m) => m.user_id));
  const notMembers = everyone.filter((p) => p.is_active && !memberIds.has(p.id));
  // AC-ORG-16: деактивованих у виборі схвалювача немає.
  const candidates = approverCandidates(id, approverRows, everyone);
  const hasApprover = departmentHasActiveApprover(id, approverRows, everyone);

  return (
    <PageShell
      title={department.name}
      description={`Requesters: ${memberRows.length} · Approvers: ${approverRows.length}`}
      back={{ href: "/admin/departments", label: "All departments" }}
      actions={hasApprover ? undefined : <Badge tone="warn">{NO_APPROVER_LABEL}</Badge>}
    >
      <Alert message={orgErrorMessage(error)} />

      <Card title="Requesters" description="Employees who submit requests on behalf of this department.">
        {memberRows.length === 0 ? (
          <EmptyState>This department has no requesters yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="members">
            {memberRows.map((m) => {
              const person = byId.get(m.user_id);
              const label = person ? personLabel(person) : m.user_id;
              const isApprover = approverRows.some((a) => a.user_id === m.user_id);
              const effects = memberRemovalEffects(id, m.user_id, memberRows, approverRows);
              return (
                <li key={m.user_id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={label} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">{label}</span>
                        <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {person ? <RoleBadge role={person.role} /> : null}
                          {isApprover ? <Badge tone="info">Approver</Badge> : null}
                          {person && !person.is_active ? <Badge tone="danger">Deactivated</Badge> : null}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <form action={setAutoApprove} className="flex items-center gap-2">
                        <input type="hidden" name="department_id" value={id} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                          <Switch name="auto_approve" defaultChecked={m.auto_approve} />
                          Auto-approval
                        </label>
                        <SubmitButton variant="outline" className="px-3 py-1.5">
                          Save
                        </SubmitButton>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="department_id" value={id} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <SubmitButton
                          variant="destructive-ghost"
                          className="px-3 py-1.5"
                          confirm={
                            effects.length
                              ? `Remove ${label}? This will also remove: ${effects.map((e) => EFFECT_LABELS[e]).join(", ")}.`
                              : `Remove ${label} from the department?`
                          }
                        >
                          Remove
                        </SubmitButton>
                      </form>
                    </span>
                  </div>
                  {effects.length ? (
                    <p className="text-xs text-muted-foreground">
                      Removing will also remove: {effects.map((e) => EFFECT_LABELS[e]).join(", ")}.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <form action={addMember} className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
          <input type="hidden" name="department_id" value={id} />
          <div className="min-w-60 flex-1">
            <Field label="Add requester">
              <Select name="user_id" required disabled={notMembers.length === 0}>
                {notMembers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <SubmitButton disabled={notMembers.length === 0}>Add</SubmitButton>
        </form>
      </Card>

      <Card title="Approvers" description="They approve the department's requests. An approver must be a requester of this department.">
        {approverRows.length === 0 ? (
          <EmptyState>No approvers yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="approvers">
            {approverRows.map((a) => {
              const person = byId.get(a.user_id);
              const label = person ? personLabel(person) : a.user_id;
              return (
                <li key={a.user_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={label} />
                    <span className="truncate text-sm font-medium text-foreground">{label}</span>
                  </span>
                  <form action={removeApprover}>
                    <input type="hidden" name="department_id" value={id} />
                    <input type="hidden" name="user_id" value={a.user_id} />
                    <SubmitButton variant="outline" className="px-3 py-1.5">
                      Unassign
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <form action={addApprover} className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
          <input type="hidden" name="department_id" value={id} />
          <div className="min-w-60 flex-1">
            <Field label="Assign approver">
              <Select name="user_id" required disabled={candidates.length === 0}>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                    {memberIds.has(p.id) ? "" : " — not a requester"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <SubmitButton disabled={candidates.length === 0}>Assign</SubmitButton>
        </form>
      </Card>
    </PageShell>
  );
}

// Скелет — частина відповіді саме цієї сторінки (Suspense тут, а не loading.tsx): при переході показується її власний скелет.
export default function DepartmentPage(props: PageProps<"/admin/departments/[id]">) {
  return (
    <Suspense fallback={<DepartmentDetailSkeleton />}>
      <DepartmentPageContent {...props} />
    </Suspense>
  );
}
