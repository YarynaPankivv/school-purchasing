import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Avatar, Badge, Card, EmptyState, Forbidden, PageShell, RoleBadge } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid, personLabel } from "@/lib/org/departments";
import { ORG_ERROR_MESSAGES, orgErrorMessage } from "@/lib/org/errors";
import { loadPermissions } from "@/lib/org/load-permissions";
import { PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/org/request-options";
import { PURCHASE_TYPE_LABELS, REQUEST_TYPE_LABELS, isPurchaseType, isRequestType } from "@/lib/org/requests";
import { draftsOf, isSoleActiveAdmin, submittedOf } from "@/lib/org/users";
import { deleteDraft, setActive, setAdminRole, setPermissions } from "../actions";

const SAVED_MESSAGES: Record<string, string> = {
  "1": "Permissions saved.",
  admin_on: "The employee is now an administrator.",
  admin_off: "Administrator role removed.",
  activated: "Employee activated — they can sign in again.",
  deactivated: "Employee deactivated — they can no longer sign in.",
  draft_deleted: "Draft deleted. The employee's submitted requests remain.",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

// Картка працівника: роль admin (AC-ORG-10, 18, 21), активність (AC-ORG-12), дозволи (AC-ORG-07, 08, 17),
// чернетки деактивованого (AC-ORG-13). Лише для admin (AC-ORG-09).
export default async function UserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden user={ctx.user} />;
  const { supabase, user } = ctx;
  const { id } = await params;
  const { error, saved } = await searchParams;
  if (!isUuid(id)) notFound();

  const [{ data: staff }, permissions, { data: requests }, { data: memberships }, { data: approvals }, { data: departments }] =
    await Promise.all([
      supabase.from("profiles").select("id, email, full_name, role, is_active").order("email"),
      loadPermissions(supabase, id),
      supabase
        .from("requests")
        .select("id, type, purchase_type, status, author_id, department_id, created_at")
        .eq("author_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("department_members").select("department_id, auto_approve").eq("user_id", id),
      supabase.from("department_approvers").select("department_id").eq("user_id", id),
      supabase.from("departments").select("id, name").order("name"),
    ]);
  const everyone = staff ?? [];
  const person = everyone.find((p) => p.id === id);
  if (!person) notFound();

  const label = personLabel(person);
  const isAdmin = person.role === "admin";
  const isSelf = person.id === user.id;
  // AC-ORG-10, AC-ORG-18: єдиного активного адміністратора не розжалувати й не деактивувати; те саме перевіряє база.
  const sole = isSoleActiveAdmin(everyone, id);
  const soleHint = ORG_ERROR_MESSAGES.last_admin;
  const drafts = draftsOf(requests ?? [], id);
  const submitted = submittedOf(requests ?? [], id);
  const names = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const approves = new Set((approvals ?? []).map((a) => a.department_id));
  const savedMessage = typeof saved === "string" && Object.hasOwn(SAVED_MESSAGES, saved) ? SAVED_MESSAGES[saved] : undefined;

  return (
    <PageShell title={label} user={user} back={{ href: "/admin/users", label: "All employees" }}>
      <Alert message={orgErrorMessage(error)} />
      <Alert tone="ok" message={savedMessage} />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={label} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="truncate text-sm text-muted">{person.email ?? "—"}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <RoleBadge role={person.role} />
              {person.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}
              {isSelf ? <Badge tone="info">You</Badge> : null}
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Administrator role"
        description="Administrators manage departments and employees and can create any request type."
      >
        <form action={setAdminRole} className="flex flex-wrap items-center justify-between gap-4">
          <input type="hidden" name="user_id" value={person.id} />
          <input type="hidden" name="make_admin" value={isAdmin ? "0" : "1"} />
          <p className="max-w-md text-sm text-muted">
            {isAdmin
              ? "After removal, the employee's role depends on whether they approve any department."
              : "The Requester or Approver role comes from departments. Making the employee an administrator replaces it."}
            {sole ? <span className="mt-1 block font-medium text-warn-ink">{soleHint}.</span> : null}
          </p>
          <SubmitButton
            variant={isAdmin ? "secondary" : "primary"}
            disabled={(isAdmin && sole) || !person.is_active}
            title={isAdmin && sole ? soleHint : !person.is_active ? "Activate the employee first" : undefined}
            confirm={isAdmin && isSelf ? "Remove the administrator role from yourself? You will lose access to administration." : undefined}
          >
            {isAdmin ? "Remove administrator role" : "Make administrator"}
          </SubmitButton>
        </form>
      </Card>

      <Card title="Permissions" description="Request types beyond Purchase and Reimbursement, and the Self-purchase purchase type.">
        <form action={setPermissions} className="flex flex-col gap-4">
          <input type="hidden" name="user_id" value={person.id} />
          <ul className="flex flex-col divide-y divide-line">
            {PERMISSION_KEYS.map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center justify-between gap-4 py-3 text-sm text-ink first:pt-0">
                  {PERMISSION_LABELS[key]}
                  <input type="checkbox" name={key} defaultChecked={permissions[key]} className="toggle" />
                </label>
              </li>
            ))}
          </ul>
          {isAdmin ? (
            <p className="text-xs text-muted">
              Administrators create these request types and can choose Self-purchase without permissions.
            </p>
          ) : null}
          <SubmitButton className="self-start">Save permissions</SubmitButton>
        </form>
      </Card>

      <Card title="Departments" description="The departments this employee submits requests for.">
        {(memberships ?? []).length === 0 ? (
          <EmptyState>This employee has not been added to any department.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {(memberships ?? []).map((m) => (
              <li key={m.department_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0">
                <Link href={`/admin/departments/${m.department_id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                  {names.get(m.department_id) ?? m.department_id}
                </Link>
                <span className="flex gap-1.5">
                  {approves.has(m.department_id) ? <Badge tone="info">Approver</Badge> : null}
                  {m.auto_approve ? <Badge tone="ok">Auto-approval</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="System access"
        description={
          person.is_active
            ? "A deactivated employee cannot sign in. Their submitted requests and drafts are kept."
            : "This employee is deactivated: they cannot sign in and do not appear when choosing an approver or an on-behalf person."
        }
        tone={person.is_active ? "default" : "danger"}
      >
        <form action={setActive} className="flex flex-wrap items-center justify-between gap-4">
          <input type="hidden" name="user_id" value={person.id} />
          <input type="hidden" name="active" value={person.is_active ? "0" : "1"} />
          <p className="max-w-md text-sm text-muted">
            {sole ? <span className="font-medium text-warn-ink">{soleHint}.</span> : "This can be undone — activate the employee again."}
          </p>
          <SubmitButton
            variant={person.is_active ? "danger" : "primary"}
            disabled={person.is_active && sole}
            title={person.is_active && sole ? soleHint : undefined}
            confirm={person.is_active ? `Deactivate ${label}? They will no longer be able to sign in.` : undefined}
          >
            {person.is_active ? "Deactivate" : "Activate"}
          </SubmitButton>
        </form>
      </Card>

      {person.is_active ? null : (
        <Card
          title="Drafts"
          description={`Deleting a draft does not affect the employee's submitted requests (${submitted.length}).`}
        >
          {drafts.length === 0 ? (
            <EmptyState testId="no-drafts">No drafts.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-line" data-testid="drafts">
              {drafts.map((d) => {
                const row = (requests ?? []).find((r) => r.id === d.id);
                const type = row && isRequestType(row.type) ? REQUEST_TYPE_LABELS[row.type] : row?.type;
                const purchase = row?.purchase_type && isPurchaseType(row.purchase_type) ? PURCHASE_TYPE_LABELS[row.purchase_type] : null;
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                    <span className="flex flex-col">
                      <span className="font-medium text-ink">
                        {type}
                        {purchase ? ` · ${purchase}` : ""}
                      </span>
                      <span className="text-xs text-muted">
                        {row ? names.get(row.department_id) : null}
                        {row ? ` · ${dateFormat.format(new Date(row.created_at))}` : null}
                      </span>
                    </span>
                    <form action={deleteDraft}>
                      <input type="hidden" name="user_id" value={person.id} />
                      <input type="hidden" name="request_id" value={d.id} />
                      <SubmitButton variant="danger-ghost" className="px-3 py-1.5" confirm="Delete this draft?">
                        Delete
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </PageShell>
  );
}
