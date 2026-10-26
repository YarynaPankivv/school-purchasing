import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileSkeleton } from "@/components/ui";
import { Avatar, Badge, Card, DetailList, EmptyState, PageShell, RoleBadge } from "@/components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { personLabel } from "@/lib/org/departments";
import { loadPermissions } from "@/lib/org/load-permissions";
import { PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/org/request-options";

export const metadata: Metadata = { title: "My profile · School Purchasing" };

// Власний профіль лише для читання: відділи, схвалення, автосхвалення, дозволи
// («Користувачі й ролі» вимоги PM, без AC).
export async function ProfilePageContent() {
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
  const name = personLabel({ email: user.email, full_name: user.fullName });

  return (
    <PageShell title="My profile">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-lg font-semibold text-foreground">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email ?? "—"}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <DetailList
            items={[
              { label: "Name", value: name },
              { label: "Email", value: user.email ?? "—" },
              { label: "Role", value: <RoleBadge role={user.role} />, testId: "profile-role" },
            ]}
          />
        </div>
      </Card>

      <Card title="My departments" description="You submit requests on behalf of these departments.">
        {(memberships ?? []).length === 0 ? (
          <EmptyState>You have not been added to any department yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="profile-departments">
            {(memberships ?? []).map((m) => (
              <li key={m.department_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0">
                <span className="font-medium text-foreground">{names.get(m.department_id) ?? m.department_id}</span>
                <span className="flex flex-wrap gap-1.5">
                  {approves.has(m.department_id) ? <Badge tone="info">Approver</Badge> : null}
                  {m.auto_approve ? <Badge tone="ok">Auto-approval</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="My permissions" description="Request types available to you beyond Purchase and Reimbursement.">
        {user.role === "admin" ? (
          // Матриця прав PM; «Самостійна закупівля» для admin — AC-ORG-23.
          <p className="text-sm text-muted-foreground">
            Administrators create every request type and can choose Self-purchase without separate permissions.
          </p>
        ) : granted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No extra permissions: Purchase and Reimbursement are available, with the Procurement department purchase type.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="profile-permissions">
            {granted.map((key) => (
              <li key={key}>
                <Badge tone="primary">{PERMISSION_LABELS[key]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

// Скелет — частина відповіді саме цієї сторінки (Suspense тут, а не loading.tsx): при переході показується її власний скелет.
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfilePageContent />
    </Suspense>
  );
}
