-- Зріз ORG, задача 1: відділи, заявники, схвалювачі, автосхвалення, похідна роль і мінімальна таблиця заявок.
-- План: openspec/changes/impl-org (design.md D1–D3, D5–D7; tasks.md 1.1). AC: AC-ORG-01…06, 11, 14, 15.
--
-- Правила (AGENTS.md → «База даних»): RLS на кожній таблиці, revoke all від anon/authenticated, явні grant,
-- окрема політика на кожну видану операцію `to authenticated` з `(select auth.uid())`; хелпери — у private,
-- security definer, set search_path = ''. Кожна нова політика, крім profiles_select_own, вимагає активного
-- користувача (D6): живий JWT деактивованого не має давати доступу до Data API.

-- ── D1. Набір ролей: requester / approver / admin ─────────────────────────────
-- Порядок важливий: старий constraint → дані → default → новий constraint.
alter table public.profiles drop constraint profiles_role_check;
update public.profiles set role = 'requester' where role = 'member';
alter table public.profiles alter column role set default 'requester';
alter table public.profiles add constraint profiles_role_check
  check (role in ('requester', 'approver', 'admin'));

-- ── D6. Активність працівника ─────────────────────────────────────────────────
alter table public.profiles add column is_active boolean not null default true;

comment on column public.profiles.is_active is
  'false — працівника деактивовано (AC-ORG-12): не входить, не рахується активним схвалювачем (AC-ORG-14).';

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_active from public.profiles as p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function private.is_active_user() from public, anon;
grant execute on function private.is_active_user() to authenticated;

-- Власний профіль — єдиний виняток без перевірки активності: login() має прочитати is_active (D6).
drop policy profiles_select_own_or_admin on public.profiles;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

-- ── D2. Відділи ───────────────────────────────────────────────────────────────
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  -- «Назва відділу — текст до 100 символів» (Припущення PM).
  constraint departments_name_length check (char_length(btrim(name)) >= 1 and char_length(name) <= 100)
);

-- «…унікальна без урахування регістру» (Припущення PM).
create unique index departments_name_unique on public.departments (lower(name));

comment on table public.departments is 'Відділ школи, від імені якого подають заявки (зріз ORG).';

-- Заявник відділу. Автосхвалення — властивість членства: діє лише в цьому відділі (AC-ORG-06)
-- і зникає разом із членством (AC-ORG-15).
create table public.department_members (
  department_id uuid not null references public.departments (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  auto_approve  boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (department_id, user_id)
);

create index department_members_user_id_idx on public.department_members (user_id);

comment on table public.department_members is 'Заявник відділу (AC-ORG-01) з прапорцем автосхвалення (AC-ORG-06, AC-ORG-15).';

-- Схвалювач відділу. Складений FK: схвалювачем може бути лише заявник цього відділу (AC-ORG-02, код 23503),
-- а зняття заявника каскадно знімає схвалювача (AC-ORG-03).
create table public.department_approvers (
  department_id uuid not null,
  user_id       uuid not null,
  created_at    timestamptz not null default now(),
  primary key (department_id, user_id),
  constraint department_approvers_member_fkey
    foreign key (department_id, user_id)
    references public.department_members (department_id, user_id)
    on delete cascade
);

create index department_approvers_user_id_idx on public.department_approvers (user_id);

comment on table public.department_approvers is 'Схвалювач відділу; лише заявник цього відділу (AC-ORG-02, AC-ORG-03).';

-- Чи поточний користувач — заявник відділу. security definer: читає department_members в обхід RLS,
-- тож політики самої department_members не зациклюються (42P17). Аргумент — колонка рядка, тому в політиках
-- її викликаємо без обгортки `(select …)`: обгортка кешує лише вирази без залежності від рядка.
create or replace function private.is_member(target_department uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.department_members as m
    where m.department_id = target_department
      and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

-- ── D3. Похідна роль ──────────────────────────────────────────────────────────
-- approver — поки людина схвалює хоча б один відділ (AC-ORG-05; тимчасово Q3), інакше requester (AC-ORG-04;
-- тимчасово Q6 — і після каскаду з AC-ORG-03). Роль admin не чіпаємо (AC-ORG-11; тимчасово Q4).
-- TS-дзеркало: src/lib/org/roles.ts (deriveRole).
create or replace function private.sync_role(target_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles as p
  set role = case
    when exists (select 1 from public.department_approvers as a where a.user_id = target_user)
      then 'approver'
    else 'requester'
  end
  where p.id = target_user
    and p.role <> 'admin';
$$;

revoke execute on function private.sync_role(uuid) from public, anon, authenticated;

create or replace function private.on_department_approvers_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_role(old.user_id);
    return old;
  end if;
  perform private.sync_role(new.user_id);
  return new;
end;
$$;

revoke execute on function private.on_department_approvers_change() from public, anon, authenticated;

create trigger department_approvers_sync_role
  after insert or delete on public.department_approvers
  for each row execute function private.on_department_approvers_change();

-- ── D5. Мінімальна таблиця заявок (WS7 розширить її новою міграцією) ──────────
create table public.requests (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  purchase_type text,
  department_id uuid not null references public.departments (id) on delete restrict,
  author_id     uuid not null references public.profiles (id) on delete restrict,
  status        text not null default 'draft',
  created_at    timestamptz not null default now(),
  constraint requests_type_check check (type in ('PUR', 'RMB', 'CRE', 'RFC', 'INV')),
  constraint requests_purchase_type_check check (purchase_type in ('procurement', 'self')),
  -- purchase_type обов'язковий для PUR і порожній для інших типів (CHECK вище сам NULL пропускає).
  constraint requests_purchase_type_for_pur check ((type = 'PUR') = (purchase_type is not null)),
  constraint requests_status_check check (status in ('draft', 'submitted'))
);

create index requests_author_id_idx on public.requests (author_id);
create index requests_department_id_idx on public.requests (department_id);

comment on table public.requests is
  'Заявка (мінімум для зрізу ORG: відділ, тип, тип закупівлі, автор, статус). Рядки, номери й схвалення — WS7.';

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.departments enable row level security;
alter table public.department_members enable row level security;
alter table public.department_approvers enable row level security;
alter table public.requests enable row level security;

revoke all on table public.departments from anon, authenticated;
revoke all on table public.department_members from anon, authenticated;
revoke all on table public.department_approvers from anon, authenticated;
revoke all on table public.requests from anon, authenticated;

-- Перейменування й видалення відділів — поза межами зрізу: update/delete не видаємо.
grant select, insert on table public.departments to authenticated;
-- Змінюється лише прапорець автосхвалення (AC-ORG-06).
grant select, insert, delete on table public.department_members to authenticated;
grant update (auto_approve) on table public.department_members to authenticated;
grant select, insert, delete on table public.department_approvers to authenticated;
-- update і delete заявок — у наступних задачах і зрізах (delete чернеток — задача 3, AC-ORG-13).
grant select, insert on table public.requests to authenticated;

grant select, insert, update, delete on table public.departments to service_role;
grant select, insert, update, delete on table public.department_members to service_role;
grant select, insert, update, delete on table public.department_approvers to service_role;
grant select, insert, update, delete on table public.requests to service_role;

-- departments
create policy departments_select
  on public.departments
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      (select private.current_app_role()) = 'admin'
      or private.is_member(id)
    )
  );

create policy departments_insert_admin
  on public.departments
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

-- department_members
create policy department_members_select
  on public.department_members
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      (select private.current_app_role()) = 'admin'
      or user_id = (select auth.uid())
      or private.is_member(department_id)
    )
  );

create policy department_members_insert_admin
  on public.department_members
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

create policy department_members_update_admin
  on public.department_members
  for update
  to authenticated
  using (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  )
  with check (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

create policy department_members_delete_admin
  on public.department_members
  for delete
  to authenticated
  using (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

-- department_approvers
create policy department_approvers_select
  on public.department_approvers
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      (select private.current_app_role()) = 'admin'
      or user_id = (select auth.uid())
      or private.is_member(department_id)
    )
  );

create policy department_approvers_insert_admin
  on public.department_approvers
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

create policy department_approvers_delete_admin
  on public.department_approvers
  for delete
  to authenticated
  using (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

-- requests: автор бачить свої, admin — усі, включно з чернетками (матриця прав).
create policy requests_select
  on public.requests
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      author_id = (select auth.uid())
      or (select private.current_app_role()) = 'admin'
    )
  );

-- Початкова політика до задачі 2 (D5): лише PUR + procurement або RMB без purchase_type — для всіх, і для admin.
-- CRE/RFC/INV і self база відхиляє, доки задача 2 не замінить політику повною версією з user_permissions.
-- Заявка — лише від імені відділу, де автор заявник (AC-ORG-01; тимчасово Q1 — і для admin).
create policy requests_insert
  on public.requests
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and author_id = (select auth.uid())
    and status = 'draft'
    and private.is_member(department_id)
    and (
      (type = 'PUR' and purchase_type = 'procurement')
      or (type = 'RMB' and purchase_type is null)
    )
  );
