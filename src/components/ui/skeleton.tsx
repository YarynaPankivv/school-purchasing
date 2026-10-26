// Скелети завантаження: лише для того, що залежить від даних сторінки (заголовок, списки, форми). Бічна панель — у спільному
// layout (app)/layout.tsx і не підміняється, верхня смуга — справжня. Кожна сторінка має скелет її власної розкладки
// (loading.tsx поруч зі сторінкою): ті самі ширина, кількість блоків і форма рядків, тож дані «вмикаються» без зсуву.
// Сірі рівні смуги без градієнта; пульс — лише коли рух дозволено.
import type { ReactNode } from "react";
import { cn } from "./cn";
import { TopBar } from "./ui";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} />;
}

// ── Кубики ────────────────────────────────────────────────────────────────────────────────────────────────────────

// Смуга на місці рядка тексту: зовнішня висота = висоті рядка справжнього тексту (`outer`), сама смуга нижча (`bar`), тож
// блок має ту саму висоту, що й текст, і сторінка не «стрибає», коли дані з'являються.
function Line({ outer, bar, width, className }: { outer: string; bar: string; width: string; className?: string }) {
  return (
    <div className={cn("flex items-center", outer, className)}>
      <Skeleton className={cn(bar, width)} />
    </div>
  );
}

function Card({ title = true, children }: { title?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      {title ? (
        // Висоти як у Card: заголовок text-base (24), опис text-sm (20), проміжок 2, вертикальні відступи по 16.
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <Line outer="h-6" bar="h-4" width="w-36" />
            <Line outer="h-5" bar="h-3.5" width="w-64 max-w-full" />
          </div>
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Chips({ count, withSelect = false }: { count: number; withSelect?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: count }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24" />
        ))}
      </div>
      {withSelect ? <Skeleton className="h-9 w-56 max-sm:w-full" /> : null}
    </div>
  );
}

// Рядок картки зі списку заявок (головна): номер і відділ, позиції, дрібний підпис — ліворуч; сума й статус — праворуч.
function RequestRows({ rows }: { rows: number }) {
  return (
    <div className="-mx-5 -my-4 divide-y divide-border">
      {Array.from({ length: rows }, (_, index) => (
        // Рядки як у RequestList: номер і відділ (20), позиції (20), підпис (16), проміжки по 2, вертикальні відступи по 12.
        <div key={index} className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <Line outer="h-5" bar="h-3.5" width="w-40" />
            <Line outer="h-5" bar="h-3.5" width="w-48" />
            <Line outer="h-4" bar="h-3" width="w-36" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Таблиця: шапка (сірі підписи) і рядки; перша колонка вужча, остання — статус.
function TableRows({ columns, rows, numbered = false }: { columns: number; rows: number; numbered?: boolean }) {
  return (
    <div className="-mx-5 -my-4 overflow-hidden">
      {/* Шапка: 12px-підписи з py-2.5 (16 + 20 = 36); рядок: py-3 і два рядки в першій комірці (20 + 16 = 60). */}
      <div className="flex h-9 items-center gap-6 border-b border-border px-5">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className={cn("h-3", index === 0 && numbered ? "w-6" : "w-16")} />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex h-15 items-center gap-6 px-5">
            {Array.from({ length: columns }, (_, index) => (
              <Skeleton
                key={index}
                className={cn(
                  "h-4",
                  index === 0 && numbered ? "w-6" : index === columns - 1 ? "h-5 w-20 rounded-full" : "w-16",
                  index > 2 && "max-md:hidden",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Fields({ count, columns = 2 }: { count: number; columns?: 1 | 2 }) {
  return (
    <div className={cn("grid gap-5", columns === 2 && "sm:grid-cols-2")}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function KeyValues({ count }: { count: number }) {
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-4 w-36" />
        </div>
      ))}
    </div>
  );
}

function Strip() {
  return (
    <div className="grid divide-y divide-border rounded-xl border border-border bg-card sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0">
      {[0, 1, 2].map((cell) => (
        <div key={cell} className="flex flex-col gap-2 px-5 py-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

function PeopleRows({ rows }: { rows: number }) {
  return (
    <div className="-my-4 divide-y divide-border">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-52 max-w-full" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Каркас сторінки ───────────────────────────────────────────────────────────────────────────────────────────────

export function PageSkeleton({
  newRequest = true,
  back = false,
  action = false,
  children,
}: {
  // Сторінки створення й картки заявки мають верхню смугу без кнопки «New request» (як і справжні).
  newRequest?: boolean;
  back?: boolean;
  // Кнопка праворуч у рядку заголовка.
  action?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <span role="status" className="sr-only">
        Loading…
      </span>
      <TopBar showNewRequest={newRequest} />
      <main
        className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-6 px-4 pb-12 pt-6 sm:px-8 sm:pt-8"
      >
        <div className="flex flex-col gap-3">
          {back ? <Skeleton className="h-4 w-28" /> : null}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Line outer="h-8" bar="h-6" width="w-48" />
              <Line outer="h-5" bar="h-3.5" width="w-72 max-w-full" />
            </div>
            {action ? <Skeleton className="h-8 w-36" /> : null}
          </div>
        </div>
        {children}
      </main>
    </>
  );
}

// ── Скелети сторінок ──────────────────────────────────────────────────────────────────────────────────────────────

// Головна: смуга чипів і картка «My requests» (вона є завжди; списки рішень з'являються лише коли в них є заявки).
export function HomeSkeleton() {
  return (
    <PageSkeleton>
      <Chips count={3} />
      <Card>
        <RequestRows rows={4} />
      </Card>
    </PageSkeleton>
  );
}

// /requests: фільтри + відділ, таблиця з нумерацією.
export function RequestsSkeleton() {
  return (
    <PageSkeleton>
      <Chips count={5} withSelect />
      <Card>
        <TableRows columns={7} rows={6} numbered />
      </Card>
    </PageSkeleton>
  );
}

// /requests/new: одна картка з полями у два стовпці й рядок дій.
export function NewRequestSkeleton() {
  return (
    <PageSkeleton newRequest={false}>
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex flex-col gap-6 px-5 py-4">
          <Fields count={4} />
          <div className="flex items-center gap-3 border-t border-border pt-5">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}

// /requests/[id]: «Back», дії в заголовку, смуга підсумку, деталі, рядки, історія.
export function RequestDetailSkeleton() {
  return (
    <PageSkeleton newRequest={false} back action>
      <Strip />
      <Card>
        <KeyValues count={6} />
      </Card>
      <Card>
        <TableRows columns={6} rows={3} numbered />
      </Card>
      <Card>
        <PeopleRows rows={2} />
      </Card>
    </PageSkeleton>
  );
}

// /profile: картка з аватаром і даними, відділи, дозволи.
export function ProfileSkeleton() {
  return (
    <PageSkeleton>
      <Card title={false}>
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <KeyValues count={3} />
        </div>
      </Card>
      <Card>
        <PeopleRows rows={2} />
      </Card>
      <Card>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </Card>
    </PageSkeleton>
  );
}

// /admin/departments: заголовок із кнопкою «Add department» і таблиця відділів.
export function DepartmentsSkeleton() {
  return (
    <PageSkeleton action>
      <Card title={false}>
        <TableRows columns={5} rows={4} />
      </Card>
    </PageSkeleton>
  );
}

// /admin/departments/[id]: «Back», два списки (заявники, схвалювачі), у кожному рядок додавання внизу.
export function DepartmentDetailSkeleton() {
  return (
    <PageSkeleton back>
      {[0, 1].map((block) => (
        <Card key={block}>
          <PeopleRows rows={2} />
          <div className="mt-5 flex items-end gap-3 border-t border-border pt-5">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-20" />
          </div>
        </Card>
      ))}
    </PageSkeleton>
  );
}

// /admin/users: фільтри статусу й пошук, список працівників.
export function UsersSkeleton() {
  return (
    <PageSkeleton>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <Card title={false}>
        <PeopleRows rows={6} />
      </Card>
    </PageSkeleton>
  );
}

// /admin/users/[id]: «Back», картка працівника, ролі, дозволи, відділи.
export function UserDetailSkeleton() {
  return (
    <PageSkeleton back>
      <Card title={false}>
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
      </Card>
      <Card>
        <Fields count={2} columns={1} />
      </Card>
      <Card>
        <PeopleRows rows={2} />
      </Card>
    </PageSkeleton>
  );
}
