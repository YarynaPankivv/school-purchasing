import type { Metadata } from "next";
import { Suspense } from "react";
import { NewRequestSkeleton } from "@/components/ui";
import { Alert, Card, EmptyState, PageShell } from "@/components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { onBehalfCandidates, personLabel, selectableDepartments } from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { loadPermissions } from "@/lib/org/load-permissions";
import { allowedPurchaseTypes, allowedRequestTypes } from "@/lib/org/request-options";
import { PURCHASE_TYPE_LABELS, REQUEST_TYPE_LABELS } from "@/lib/org/requests";
import { createDraftRequest } from "./actions";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "New request · School Purchasing" };

// Нова чернетка заявки: не-admin — лише від імені відділів, де він заявник (AC-ORG-01), admin — будь-якого
// (AC-ORG-22); типи заявки й закупівлі — за дозволами (AC-ORG-07, AC-ORG-08, AC-ORG-17, AC-ORG-23);
// особа «від імені» — лише активні (AC-ORG-16).
export async function NewRequestPageContent({ searchParams }: PageProps<"/requests/new">) {
  const { supabase, user } = await requireActiveUser();
  const { error, created } = await searchParams;

  const [{ data: departments }, { data: memberships }, { data: people }, permissions] = await Promise.all([
    supabase.from("departments").select("id, name"),
    supabase.from("department_members").select("department_id, user_id"),
    // RLS: не-admin бачить себе й активних колег зі спільних відділів (profiles_select_colleagues), admin — усіх.
    supabase.from("profiles").select("id, email, full_name, is_active, role"),
    loadPermissions(supabase, user.id),
  ]);
  const options = selectableDepartments(departments ?? [], memberships ?? [], user.id, user.role);
  const types = allowedRequestTypes(user.role, permissions);
  const purchaseTypes = allowedPurchaseTypes(user.role, permissions);
  const candidatesByDepartment = Object.fromEntries(
    options.map((d) => [
      d.id,
      onBehalfCandidates(d.id, memberships ?? [], people ?? [], user.id, user.role).map((p) => ({
        value: p.id,
        label: personLabel(p),
      })),
    ]),
  );

  return (
    <PageShell
      title="New request"
      description="The request is created as a draft on behalf of one of your departments."
      hideNewRequest
    >
      <Alert message={orgErrorMessage(error)} />
      <Alert tone="ok" message={created === "1" ? "Draft request created." : undefined} />

      <Card title={options.length > 0 ? "Details" : undefined}>
        {options.length === 0 ? (
          <EmptyState testId="no-departments">
            {user.role === "admin"
              ? "There are no departments yet, so a request cannot be created."
              : "You have not been added to any department as a requester, so a request cannot be created."}
          </EmptyState>
        ) : (
          <RequestForm
            action={createDraftRequest}
            departments={options.map((d) => ({ value: d.id, label: d.name }))}
            candidatesByDepartment={candidatesByDepartment}
            types={types.map((t) => ({ value: t, label: REQUEST_TYPE_LABELS[t] }))}
            purchaseTypes={purchaseTypes.map((p) => ({ value: p, label: PURCHASE_TYPE_LABELS[p] }))}
            purchaseTypeRequestType={{ value: "PUR", label: REQUEST_TYPE_LABELS.PUR }}
          />
        )}
      </Card>
    </PageShell>
  );
}

// Скелет — частина відповіді саме цієї сторінки (Suspense тут, а не loading.tsx): при переході показується її власний скелет.
export default function NewRequestPage(props: PageProps<"/requests/new">) {
  return (
    <Suspense fallback={<NewRequestSkeleton />}>
      <NewRequestPageContent {...props} />
    </Suspense>
  );
}
