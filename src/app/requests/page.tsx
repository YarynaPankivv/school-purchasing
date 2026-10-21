import { Alert, LinkButton, PageShell } from "@/app/_components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { orgErrorMessage } from "@/lib/org/errors";
import { purErrorMessage } from "@/lib/pur/errors";
import { loadOverview } from "./_lib/overview";
import { RequestList } from "./_components/request-list";

const SAVED: Record<string, string> = {
  deleted: "Draft deleted.",
};

// Закупівлі: мої (автор чи особа «від імені»), «На рішення» для схвалювача й відділу закупівель (admin),
// «Чекають рішення» для admin (відділ без активного схвалювача) і всі заявки admin (AC-PUR-15, 33, 40, 47, 48).
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const { supabase, user } = await requireActiveUser();
  const { saved, error } = await searchParams;
  const overview = await loadOverview(supabase, user);
  const isAdmin = user.role === "admin";
  const showDecisions = isAdmin || overview.toDecide.length > 0 || user.role === "approver";

  const savedMessage = typeof saved === "string" && Object.hasOwn(SAVED, saved) ? SAVED[saved] : undefined;
  const errorMessage = purErrorMessage(error) ?? orgErrorMessage(error);

  return (
    <PageShell
      title="Requests"
      description="Purchase requests you submitted, requests waiting for your decision and, for administrators, everything."
      user={user}
      size="lg"
      back={{ href: "/", label: "Back to home" }}
      actions={<LinkButton href="/requests/new">New request</LinkButton>}
    >
      <Alert message={errorMessage} />
      <Alert tone="ok" message={savedMessage} />

      {showDecisions ? (
        <RequestList
          title="To decide"
          description="Pending requests from departments you approve."
          items={overview.toDecide}
          empty="Nothing is waiting for your decision."
          testId="to-decide"
        />
      ) : null}

      {isAdmin ? (
        <RequestList
          title="Awaiting decision"
          description="Pending requests whose department has no approver who can decide."
          items={overview.awaiting}
          empty="No requests are waiting for the procurement department."
          testId="awaiting-decision"
          noApprover
        />
      ) : null}

      <RequestList
        title="My requests"
        description="Requests you created or that were submitted on your behalf."
        items={overview.mine}
        empty="You have no requests yet."
        testId="my-requests"
        mine
      />

      {isAdmin ? (
        <RequestList
          title="All requests"
          items={overview.all}
          empty="There are no requests yet."
          testId="all-requests"
        />
      ) : null}
    </PageShell>
  );
}
