// Спільні елементи інтерфейсу (Server Components, без стану): оболонка сторінки з шапкою, картки, бейджі, повідомлення.
// Кольори — лише токени з globals.css; кнопки й поля — button-styles.ts.
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { ORG_ERROR_MESSAGES } from "@/lib/org/errors";
import { ROLE_LABELS, isAppRole, type AppRole } from "@/lib/org/roles";
import { buttonStyles } from "./button-styles";
import { Icon, type IconName } from "./icons";
import { NavLinks, type NavItem } from "./nav-links";

export { inputClass } from "./button-styles";

export type ShellUser = { email: string | null; fullName: string | null; role: AppRole };

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-soft-ink ${
        size === "lg" ? "size-14 text-lg" : "size-9 text-xs"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export type BadgeTone = "neutral" | "primary" | "ok" | "warn" | "danger" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted",
  primary: "bg-primary-soft text-primary-soft-ink",
  ok: "bg-ok-soft text-ok-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
};

export function Badge({
  tone = "neutral",
  children,
  testId,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const ROLE_TONES: Record<AppRole, BadgeTone> = { admin: "primary", approver: "info", requester: "neutral" };

export function RoleBadge({ role }: { role: string }) {
  return isAppRole(role) ? <Badge tone={ROLE_TONES[role]}>{ROLE_LABELS[role]}</Badge> : <Badge>{role}</Badge>;
}

function AppHeader({ user }: { user: ShellUser }) {
  const items: NavItem[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/requests/new", label: "New request", icon: "file-plus" },
    { href: "/profile", label: "My profile", icon: "user" },
    ...(user.role === "admin"
      ? ([
          { href: "/admin/departments", label: "Departments", icon: "building" },
          { href: "/admin/users", label: "Employees", icon: "users" },
        ] satisfies NavItem[])
      : []),
  ];
  const name = user.fullName?.trim() || user.email || "—";
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-ink">
            <Icon name="file-plus" className="size-4" />
          </span>
          School Purchasing
        </Link>
        <div className="order-last w-full md:order-none md:w-auto md:flex-1">
          <NavLinks items={items} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight lg:block">
            <p className="max-w-48 truncate text-sm font-medium text-ink">{name}</p>
            <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
          </div>
          <Avatar name={name} />
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <Icon name="log-out" className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function PageShell({
  title,
  description,
  user,
  back,
  actions,
  size = "md",
  children,
}: {
  title: string;
  description?: ReactNode;
  user: ShellUser;
  back?: { href: string; label: string };
  actions?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <>
      <AppHeader user={user} />
      <main
        className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-8 sm:px-6 ${size === "lg" ? "max-w-5xl" : "max-w-3xl"}`}
      >
        <div className="flex flex-col gap-3">
          {back ? (
            <Link
              href={back.href}
              className="inline-flex w-fit items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
            >
              <Icon name="chevron-left" className="size-4" />
              {back.label}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
              {description ? <p className="max-w-prose text-sm text-muted">{description}</p> : null}
            </div>
            {actions}
          </div>
        </div>
        {children}
      </main>
    </>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  tone = "default",
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border bg-surface shadow-card ${tone === "danger" ? "border-danger/40" : "border-line"} ${className}`}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children ? <div className="px-5 py-4">{children}</div> : null}
    </section>
  );
}

const ALERT_TONES = {
  error: { box: "border-danger/30 bg-danger-soft text-danger-ink", icon: "alert" },
  ok: { box: "border-ok-ink/20 bg-ok-soft text-ok-ink", icon: "check" },
  warn: { box: "border-warn-ink/20 bg-warn-soft text-warn-ink", icon: "alert" },
  info: { box: "border-info-ink/20 bg-info-soft text-info-ink", icon: "info" },
} as const satisfies Record<string, { box: string; icon: IconName }>;

export function Alert({ message, tone = "error" }: { message?: ReactNode; tone?: keyof typeof ALERT_TONES }) {
  if (!message) return null;
  const { box, icon } = ALERT_TONES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${box}`}>
      <Icon name={icon} className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted"
    >
      {children}
    </p>
  );
}

// Підпис + поле форми. hint — пояснення під полем: стоїть поза <label>, щоб не потрапляти в доступне ім’я поля;
// з hint передайте hintId і той самий id в aria-describedby поля.
export function Field({
  label,
  hint,
  hintId,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {label}
        {children}
      </label>
      {hint ? (
        <span id={hintId} className="text-xs font-normal text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

// Рядок «підпис — значення» для карток профілю.
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode; testId?: string }> }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted">{item.label}</dt>
          <dd data-testid={item.testId} className="min-w-0 break-words text-ink">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={buttonStyles(variant)}>
      {children}
    </Link>
  );
}

// AC-ORG-09: без ролі admin — лише це повідомлення, без даних.
export function Forbidden({ user }: { user: ShellUser }) {
  return (
    <PageShell title="Access denied" user={user} back={{ href: "/", label: "Back to home" }}>
      <Card>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
            <Icon name="shield" className="size-5" />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <Alert message={ORG_ERROR_MESSAGES.forbidden} />
            <p className="mt-2 text-sm text-muted">This page is available to administrators only.</p>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
