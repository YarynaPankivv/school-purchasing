import Link from "next/link";
import { Avatar, Badge, Card, EmptyState, Forbidden, PageShell, RoleBadge, inputClass } from "@/app/_components/ui";
import { buttonStyles } from "@/app/_components/button-styles";
import { Icon } from "@/app/_components/icons";
import { requireAdmin } from "@/lib/auth/session";
import { personLabel } from "@/lib/org/departments";
import { PERMISSION_KEYS, PERMISSION_LABELS, permissionsFrom } from "@/lib/org/request-options";
import { activeAdminCount } from "@/lib/org/users";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Deactivated" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

const asFilter = (value: unknown): Filter => (FILTERS.some((f) => f.key === value) ? (value as Filter) : "all");

// Список працівників для адміністратора (дозволи — AC-ORG-07, 08, 17; активність — AC-ORG-12). Лише для admin (AC-ORG-09).
export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden user={ctx.user} />;
  const { supabase, user } = ctx;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const filter = asFilter(params.status);

  const [{ data: people }, { data: permissionRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, is_active").order("email"),
    supabase.from("user_permissions").select("user_id, card_expense, check_request, vendor_invoice, self_purchase"),
  ]);
  const everyone = people ?? [];
  const byUser = new Map((permissionRows ?? []).map((row) => [row.user_id, permissionsFrom(row)]));

  const shown = everyone.filter(
    (p) =>
      (filter === "all" || (filter === "active") === p.is_active) &&
      (!q || `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)),
  );
  const counts = {
    all: everyone.length,
    active: everyone.filter((p) => p.is_active).length,
    inactive: everyone.filter((p) => !p.is_active).length,
  };
  const href = (status: Filter) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (q) query.set("q", q);
    const text = query.toString();
    return text ? `/admin/users?${text}` : "/admin/users";
  };

  return (
    <PageShell
      title="Employees"
      description={`${counts.all} in total, ${counts.active} active, ${activeAdminCount(everyone)} administrators.`}
      user={user}
      size="lg"
      back={{ href: "/", label: "Back to home" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex gap-1 rounded-lg bg-surface-muted p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href(f.key)}
              aria-current={filter === f.key ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              {f.label} <span className="text-muted">{counts[f.key]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" className="flex items-center gap-2">
          {filter === "all" ? null : <input type="hidden" name="status" value={filter} />}
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name or email"
              aria-label="Search employees"
              className={`${inputClass} w-56 pl-9`}
            />
          </div>
          <button type="submit" className={buttonStyles("secondary")}>
            Search
          </button>
        </form>
      </div>

      <Card>
        {shown.length === 0 ? (
          <EmptyState>No one found. Change the search or filter.</EmptyState>
        ) : (
          <ul className="-my-4 flex flex-col divide-y divide-line" data-testid="users">
            {shown.map((p) => {
              const granted = PERMISSION_KEYS.filter((key) => byUser.get(p.id)?.[key]);
              const label = personLabel(p);
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/users/${p.id}`}
                    className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={label} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-ink">{label}</span>
                        <span className="truncate text-xs text-muted">{p.email}</span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {granted.map((key) => (
                        <Badge key={key} tone="neutral">
                          {PERMISSION_LABELS[key]}
                        </Badge>
                      ))}
                      <RoleBadge role={p.role} />
                      {p.is_active ? null : <Badge tone="danger">Deactivated</Badge>}
                      <Icon name="arrow-right" className="ml-1 size-4 text-muted" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
