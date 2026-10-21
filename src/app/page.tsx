import Link from "next/link";
import { Card, DetailList, PageShell, RoleBadge } from "@/app/_components/ui";
import { Icon, type IconName } from "@/app/_components/icons";
import { requireActiveUser } from "@/lib/auth/session";
import { personLabel } from "@/lib/org/departments";

type Tile = { href: string; title: string; text: string; icon: IconName };

// Головна: хто увійшов, з якою роллю (з таблиці profiles) і куди можна перейти.
// requireActiveUser() перевіряє JWT через getClaims() і виводить деактивованого (design.md D6).
export default async function Home() {
  const { user } = await requireActiveUser();
  const name = personLabel({ email: user.email, full_name: user.fullName });
  const firstName = name.split(/\s+/)[0];

  const tiles: Tile[] = [
    { href: "/requests/new", title: "New request", text: "Draft a purchase or reimbursement on behalf of your department.", icon: "file-plus" },
    { href: "/profile", title: "My profile", text: "Your departments, approvals and request-type permissions.", icon: "user" },
    ...(user.role === "admin"
      ? ([
          { href: "/admin/departments", title: "Departments", text: "Requesters, approvers and auto-approval for each department.", icon: "building" },
          { href: "/admin/users", title: "Employees", text: "Roles, permissions, deactivation and drafts of employees.", icon: "users" },
        ] satisfies Tile[])
      : []),
  ];

  return (
    <PageShell
      title={`Welcome, ${firstName}`}
      description="Choose where to start."
      user={user}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-primary/50"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-ink">
              <Icon name={tile.icon} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                {tile.title}
                <Icon
                  name="arrow-right"
                  className="size-4 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                />
              </span>
              <span className="text-sm text-muted">{tile.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <Card title="Account">
        <DetailList
          items={[
            { label: "Email", value: user.email ?? "—", testId: "user-email" },
            { label: "Role", value: <RoleBadge role={user.role} />, testId: "user-role" },
          ]}
        />
      </Card>
    </PageShell>
  );
}
