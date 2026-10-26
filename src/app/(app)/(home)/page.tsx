import { Suspense } from "react";
import { HomeSkeleton } from "@/components/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert, LinkButton, PageShell, RowKeyNav, StatusLinks, type StatusLink } from "@/components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { purchaseNumberLabel } from "@/lib/pur/numbers";
import { PURCHASE_STATUS_LABELS } from "@/lib/pur/statuses";
import { detailHref, requestsHref } from "../requests/_lib/nav";
import { RequestList } from "../requests/_components/request-list";
import { loadOverview, type RequestListItem } from "../requests/_lib/overview";

export const metadata: Metadata = { title: "Home · School Purchasing" };

const LINK = "font-medium text-primary underline underline-offset-4 hover:no-underline";

const byOldestUpdate = (a: RequestListItem, b: RequestListItem) => a.request.updated_at.localeCompare(b.request.updated_at);
// Чернетки — наприкінці «Моїх заявок»: живі заявки не мають тонути під чернетками на $0.00. Сортування стабільне.
const draftsLast = (a: RequestListItem, b: RequestListItem) =>
  Number(a.request.status === "draft") - Number(b.request.status === "draft");

// Головна: що потребує уваги саме цієї людини (ті самі дані, що й /requests), а не друга копія навігації.
// requireActiveUser() перевіряє JWT через getClaims() і виводить деактивованого (design.md D6).
export async function HomeContent() {
  const { supabase, user } = await requireActiveUser();
  // Збій читання (наприклад, міграцію ще не застосовано) не має ламати головну, але й не має приховувати чергу:
  // у такому разі показуємо попередження й даємо відкрити повний список.
  const overview = await loadOverview(supabase, user).catch(() => null);
  const isAdmin = user.role === "admin";
  const firstName = user.fullName?.trim().split(/\s+/)[0];

  const toDecide = overview?.toDecide.length ?? 0;
  const awaiting = isAdmin ? (overview?.awaiting.length ?? 0) : 0;
  const countMine = (status: string) => overview?.mine.filter((item) => item.request.status === status).length ?? 0;
  const drafts = countMine("draft");
  const pending = countMine("pending");
  const approved = countMine("approved");

  // Підсумок говорить лише те, що підтверджують дані: «caught up» — коли немає ні рішень, ні власних чернеток.
  const plural = (n: number) => (n === 1 ? "request is" : "requests are");
  // Збій читання — не «все гаразд»: підсумок прямо каже, що даних немає.
  let summary = overview === null ? "Your request summary is unavailable." : "You are all caught up.";
  if (toDecide > 0) summary = `${toDecide} ${plural(toDecide)} waiting for your decision.`;
  else if (awaiting > 0) summary = `${awaiting} ${plural(awaiting)} waiting because the department has no approver who can decide.`;
  else if (drafts > 0) summary = `You have ${drafts} ${drafts === 1 ? "draft" : "drafts"} to submit.`;

  const showDecisions = isAdmin || user.role === "approver" || toDecide > 0;

  // Найтерміновіше — першим; на екрані не більше чотирьох (решта — на /requests).
  const links: StatusLink[] = [
    ...(showDecisions ? [{ href: requestsHref({ view: "decide" }), label: "To decide", count: toDecide, urgent: true }] : []),
    ...(isAdmin ? [{ href: "/requests", label: "Awaiting decision", count: awaiting, urgent: true }] : []),
    { href: requestsHref({ status: "draft" }), label: "Drafts", count: drafts },
    { href: requestsHref({ status: "pending" }), label: PURCHASE_STATUS_LABELS.pending, count: pending },
    { href: requestsHref({ status: "approved" }), label: PURCHASE_STATUS_LABELS.approved, count: approved },
  ]
    // Нулі не ведуть у порожні списки: лишаємо чип, коли в ньому є заявки або це черга на рішення (нуль там теж новина).
    .filter((link) => (link.count ?? 0) > 0 || link.urgent)
    .slice(0, 4);

  // Підсумок про чернетки — і одразу крок далі: найсвіжіша чернетка відкривається одним кліком.
  const newestDraft =
    toDecide === 0 && awaiting === 0 && drafts > 0
      ? overview?.mine.filter((item) => item.request.status === "draft").sort((a, b) => b.request.updated_at.localeCompare(a.request.updated_at))[0]
      : undefined;

  return (
    <PageShell
      title={firstName ? `Welcome, ${firstName}` : "Welcome"}
      description={summary}
      actions={
        newestDraft ? (
          <LinkButton href={detailHref(newestDraft.request.id, { back: "/" })} variant="outline">
            Open {purchaseNumberLabel(newestDraft.request.number)}
          </LinkButton>
        ) : null
      }
    >
      {overview === null ? (
        <Alert
          tone="warn"
          message={
            <>
              Your requests could not be loaded.{" "}
              <Link href="/requests" className={LINK}>
                Open Requests
              </Link>{" "}
              to try again.
            </>
          }
        />
      ) : (
        <>
          <RowKeyNav />
          <StatusLinks items={links} label="Request summary" />
          {/* Порожні списки рішень не показуємо: нуль уже видно в смузі лічильників. */}
          {overview.toDecide.length > 0 ? (
            <RequestList
              title="To decide"
              description="Pending requests from departments you approve, oldest first."
              items={[...overview.toDecide].sort(byOldestUpdate)}
              empty="No requests awaiting your decision"
              testId="to-decide"
              limit={5}
              viewAllHref={requestsHref({ view: "decide" })}
              backHref="/"
            />
          ) : null}
          {isAdmin && overview.awaiting.length > 0 ? (
            <RequestList
              title="Awaiting decision"
              description="Pending requests whose department has no approver who can decide."
              items={[...overview.awaiting].sort(byOldestUpdate)}
              empty="No requests are waiting for the purchasing department."
              testId="awaiting-decision"
              noApprover
              limit={5}
              viewAllHref="/requests"
              backHref="/"
            />
          ) : null}
          <RequestList
            title="My requests"
            description="Requests you created or that were submitted on your behalf."
            items={[...overview.mine].sort(draftsLast)}
            empty={
              <>
                <span>You have not submitted any requests yet</span>
                <LinkButton href="/requests/new" variant="outline">
                  New request
                </LinkButton>
              </>
            }
            testId="my-requests"
            mine
            viewerId={user.id}
            limit={5}
            viewAllHref="/requests"
            backHref="/"
          />
        </>
      )}
    </PageShell>
  );
}

// Скелет — частина відповіді саме цієї сторінки (Suspense тут, а не loading.tsx): при переході показується її власний скелет.
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
