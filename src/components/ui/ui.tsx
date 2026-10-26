// Спільні елементи інтерфейсу (Server Components, без стану): оболонка сторінки з шапкою, картки, бейджі, повідомлення.
// Кольори — лише токени з globals.css; кнопки й поля — button.tsx, input.tsx.
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { loadSearchIndex } from "@/app/(app)/requests/search-actions";
import { ORG_ERROR_MESSAGES } from "@/lib/org/errors";
import { ROLE_LABELS, isAppRole, type AppRole } from "@/lib/org/roles";
import { buttonVariants, type ButtonVariant } from "./button";
import { BrandMark } from "./brand-mark";
import { Label } from "./label";
import { SearchBox } from "./search-box";
import { Icon, type IconName } from "./icons";
import { MobileMenu } from "./mobile-menu";
import { NavLinks, type NavItem } from "./nav-links";
import { StatusPage } from "./status-page";

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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground ${
        size === "lg" ? "size-14 text-lg" : "size-9 text-xs"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export type BadgeTone = "neutral" | "primary" | "ok" | "warn" | "danger" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-accent text-accent-foreground",
  ok: "bg-status-approved text-status-approved-foreground",
  warn: "bg-status-pending text-status-pending-foreground",
  danger: "bg-status-rejected text-status-rejected-foreground",
  info: "bg-status-info text-status-info-foreground",
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {tone === "ok" || tone === "warn" || tone === "danger" || tone === "info" ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

const ROLE_TONES: Record<AppRole, BadgeTone> = { admin: "primary", approver: "info", requester: "neutral" };

export function RoleBadge({ role }: { role: string }) {
  return isAppRole(role) ? <Badge tone={ROLE_TONES[role]}>{ROLE_LABELS[role]}</Badge> : <Badge>{role}</Badge>;
}

// user === null — скелет завантаження: навігація справжня (вона статична), адмінського блоку ще немає (роль невідома).
function navItems(user: ShellUser | null): { main: NavItem[]; admin: NavItem[] } {
  return {
    main: [
      { href: "/", label: "Home", icon: "home" },
      { href: "/requests", label: "Requests", icon: "list" },
      { href: "/profile", label: "My profile", icon: "user" },
    ],
    admin:
      user?.role === "admin"
        ? [
            { href: "/admin/departments", label: "Departments", icon: "building" },
            { href: "/admin/users", label: "Employees", icon: "users" },
          ]
        : [],
  };
}

function SidebarNav({ user }: { user: ShellUser | null }) {
  const { main, admin } = navItems(user);
  return (
    <div className="flex flex-col gap-5">
      <NavLinks items={main} />
      {admin.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="px-3 text-xs font-medium text-muted-foreground">Administration</p>
          <NavLinks items={admin} label="Administration" />
        </div>
      ) : null}
    </div>
  );
}

function UserBlock({ user }: { user: ShellUser | null }) {
  const name = user ? user.fullName?.trim() || user.email || "—" : "";
  return (
    <div className="flex items-center gap-3">
      {user ? (
        <>
          <Avatar name={name} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
        </>
      ) : (
        // Ім'я й роль ще не прочитані — рівні плашки на їхньому місці (єдине, що в бічній панелі залежить від даних).
        <>
          <span aria-hidden="true" className="size-9 shrink-0 rounded-full bg-muted" />
          <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-24 rounded bg-muted" />
            <span className="h-3 w-14 rounded bg-muted" />
          </div>
        </>
      )}
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:size-9"
        >
          <Icon name="log-out" className="size-4" />
        </button>
      </form>
    </div>
  );
}

// Бічна панель (lg+): бренд, навігація, користувач. На вузьких екранах — верхня смуга з меню, що розкривається.
export function AppSidebar({ user }: { user: ShellUser | null }) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh">
        {/* Висота рядка бренду = висоті TopBar (h-15.25), тож лінія під ним продовжує лінію під верхньою смугою. */}
        <div className="flex h-15.25 shrink-0 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground">
            <BrandMark />
            School Purchasing
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav user={user} />
        </div>
        <div className="border-t border-border px-3 pb-5 pt-4">
          <UserBlock user={user} />
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-2 lg:hidden">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground">
          <BrandMark />
          School Purchasing
        </Link>
        <MobileMenu>
          <SidebarNav user={user} />
          <div className="border-t border-border pt-3">
            <UserBlock user={user} />
          </div>
        </MobileMenu>
      </header>
    </>
  );
}

// Верхній рядок над вмістом (робоча панель): ліворуч пошук заявок — головний шлях, праворуч одна основна дія.
// Пошук — GET на /requests?q= (сервер фільтрує те, що людина вже має право бачити); «/» фокусує поле.
// На самій сторінці створення заявки кнопки «New request» немає: на екрані одна основна дія — «Create draft».
// Контейнер один на всі сторінки (max-w-5xl), а пошук обмежений за шириною: при переході між сторінками смуга не стрибає.
export function TopBar({ query, showNewRequest }: { query?: string; showNewRequest: boolean }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background max-lg:top-[3.75rem] lg:h-15.25">
      {/* Пошук і дія — одна група біля правого краю вмісту (пошук упритул до кнопки); на телефоні пошук займає решту рядка. */}
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5 sm:justify-end sm:px-8 lg:h-full lg:py-0">
        <div className="flex min-w-0 flex-1 sm:w-[28rem] sm:flex-none">
          <SearchBox
            action="/requests"
            defaultValue={query}
            label="Search requests by number, department, author or status"
            placeholder="Search requests…"
            loadIndex={loadSearchIndex}
          />
        </div>
        {showNewRequest ? (
          <Link href="/requests/new" className={buttonVariants("default", "h-11 shrink-0 gap-1.5! px-3! font-normal! shadow-none! sm:h-9")}>
            <Icon name="file-plus" className="size-4" />
            <span className="max-sm:sr-only">New request</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// Вміст сторінки: верхня смуга (пошук, «New request»), заголовок і тіло. Бічна панель — у спільному layout (app)/layout.tsx:
// вона не перемальовується між сторінками, тож на час завантаження нічого не підміняє (меню, блок Administration лишаються).
export function PageShell({
  title,
  description,
  back,
  actions,
  searchQuery,
  hideNewRequest = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  searchQuery?: string;
  // Сторінка сама про створення заявки: верхня смуга без дублювальної кнопки.
  hideNewRequest?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar query={searchQuery} showNewRequest={!hideNewRequest} />
      <main
        className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-6 px-4 pb-12 pt-6 sm:px-8 sm:pt-8"
      >
        <div className="flex flex-col gap-3">
          {back ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <Link
                href={back.href}
                className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon name="chevron-left" className="size-4" />
                {back.label}
              </Link>
            </div>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
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
      className={`rounded-xl border bg-card ${tone === "danger" ? "border-destructive/40" : "border-border"} ${className}`}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children ? <div className="px-5 py-4">{children}</div> : null}
    </section>
  );
}

const ALERT_TONES = {
  error: { box: "border-destructive/30 bg-status-rejected text-status-rejected-foreground", icon: "alert" },
  ok: { box: "border-status-approved-foreground/20 bg-status-approved text-status-approved-foreground", icon: "check" },
  warn: { box: "border-status-pending-foreground/20 bg-status-pending text-status-pending-foreground", icon: "alert" },
  info: { box: "border-status-info-foreground/20 bg-status-info text-status-info-foreground", icon: "info" },
} as const satisfies Record<string, { box: string; icon: IconName }>;

export function Alert({ message, tone = "error", id }: { message?: ReactNode; tone?: keyof typeof ALERT_TONES; id?: string }) {
  if (!message) return null;
  const { box, icon } = ALERT_TONES[tone];
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className={`anim-enter flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${box}`}>
      <Icon name={icon} className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className="rounded-lg bg-muted px-4 py-5 text-center text-sm text-muted-foreground"
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
      <Label className="flex flex-col gap-1.5">
        {label}
        {children}
      </Label>
      {hint ? (
        <span id={hintId} className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

// Рядок «підпис — значення» для карток профілю. `columns={2}` — два стовпці від sm, підпис над значенням; запис із
// `wide` займає обидва.
export function DetailList({
  items,
  columns = 1,
}: {
  items: Array<{ label: string; value: ReactNode; testId?: string; wide?: boolean }>;
  columns?: 1 | 2;
}) {
  if (columns === 2) {
    return (
      <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={`flex min-w-0 flex-col gap-0.5 ${item.wide ? "sm:col-span-2" : ""}`}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd data-testid={item.testId} className="min-w-0 break-words text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd data-testid={item.testId} className="min-w-0 break-words text-foreground">
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
  variant = "default",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonVariants(variant, className)}>
      {children}
    </Link>
  );
}

// AC-ORG-09: без ролі admin — лише це повідомлення, без даних. Нейтрально (DESIGN.md): людина нічого не зламала,
// тож не червоний Alert, а спокійна сторінка стану в тій самій оболонці (бічна панель і верхня смуга лишаються).
export function Forbidden() {
  return (
    <>
      <TopBar showNewRequest />
      <StatusPage
        icon="shield"
        code="403"
        title={ORG_ERROR_MESSAGES.forbidden}
        description="This page is available to administrators only."
        actions={<LinkButton href="/">Back to home</LinkButton>}
      />
    </>
  );
}
