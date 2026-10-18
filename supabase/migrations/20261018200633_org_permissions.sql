-- Зріз ORG, задача 2: дозволи на типи заявок і тип закупівлі «Самостійна закупівля».
-- План: openspec/changes/impl-org (design.md D4, D5; tasks.md 2.1). AC: AC-ORG-07, AC-ORG-08, AC-ORG-17.
--
-- Правила (AGENTS.md → «База даних»): RLS, revoke all від anon/authenticated, явні grant, політика на кожну видану
-- операцію `to authenticated` з `(select auth.uid())`; кожна — з `(select private.is_active_user())` (D6).

-- ── D4. Дозволи працівника ────────────────────────────────────────────────────
-- Окрема таблиця, а не колонки profiles: на profiles є політика «оновлюю свій рядок», і колонковий grant
-- дав би працівнику змінити собі дозвіл.
create table public.user_permissions (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  card_expense   boolean not null default false, -- «Витрата карткою» (CRE)
  check_request  boolean not null default false, -- «Запит на чек» (RFC)
  vendor_invoice boolean not null default false, -- «Рахунок постачальника» (INV)
  self_purchase  boolean not null default false, -- тип закупівлі «Самостійна закупівля»
  updated_at     timestamptz not null default now()
);

comment on table public.user_permissions is
  'Дозволи працівника на типи заявок і «Самостійну закупівлю» (AC-ORG-07, AC-ORG-08, AC-ORG-17). Немає рядка — немає дозволів.';

alter table public.user_permissions enable row level security;

revoke all on table public.user_permissions from anon, authenticated;
-- upsert з адмінки = insert … on conflict do update: потрібні обидва права.
grant select, insert, delete on table public.user_permissions to authenticated;
grant update (card_expense, check_request, vendor_invoice, self_purchase, updated_at)
  on table public.user_permissions to authenticated;
grant select, insert, update, delete on table public.user_permissions to service_role;

-- Працівник бачить свої дозволи (профіль, вибір типу заявки), admin — усі.
create policy user_permissions_select
  on public.user_permissions
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      user_id = (select auth.uid())
      or (select private.current_app_role()) = 'admin'
    )
  );

create policy user_permissions_insert_admin
  on public.user_permissions
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

create policy user_permissions_update_admin
  on public.user_permissions
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

create policy user_permissions_delete_admin
  on public.user_permissions
  for delete
  to authenticated
  using (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  );

-- ── D5. Чи може поточний користувач створити заявку цього типу ────────────────
-- Матриця прав PM: «Закупівля» й «Відшкодування» — усі ролі; «Витрата карткою», «Запит на чек», «Рахунок
-- постачальника» — requester/approver лише з дозволом, admin — без дозволу (AC-ORG-07, AC-ORG-17).
-- «Самостійна закупівля» — лише з дозволом self_purchase; admin — без дозволу (AC-ORG-08; тимчасово Q5).
-- purchase_type: для PUR — обов'язковий, для інших — порожній (дублює CHECK requests_purchase_type_for_pur).
-- TS-дзеркало: src/lib/org/request-options.ts (canCreateRequest).
create or replace function private.can_create_request(request_type text, request_purchase_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select
      (select private.current_app_role()) = 'admin' as is_admin,
      coalesce(up.card_expense, false) as card_expense,
      coalesce(up.check_request, false) as check_request,
      coalesce(up.vendor_invoice, false) as vendor_invoice,
      coalesce(up.self_purchase, false) as self_purchase
    from (select 1) as one
    left join public.user_permissions as up on up.user_id = (select auth.uid())
  )
  select case
    when request_type = 'PUR' then
      request_purchase_type = 'procurement'
      or (request_purchase_type = 'self' and (me.is_admin or me.self_purchase))
    when request_type = 'RMB' then request_purchase_type is null
    when request_type = 'CRE' then request_purchase_type is null and (me.is_admin or me.card_expense)
    when request_type = 'RFC' then request_purchase_type is null and (me.is_admin or me.check_request)
    when request_type = 'INV' then request_purchase_type is null and (me.is_admin or me.vendor_invoice)
    else false
  end
  from me;
$$;

revoke execute on function private.can_create_request(text, text) from public, anon;
grant execute on function private.can_create_request(text, text) to authenticated;

-- ── Повна requests_insert замість початкової з задачі 1 ───────────────────────
drop policy requests_insert on public.requests;

create policy requests_insert
  on public.requests
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and author_id = (select auth.uid())
    and status = 'draft'
    -- AC-ORG-01; тимчасово Q1 — і для admin.
    and private.is_member(department_id)
    -- AC-ORG-07, AC-ORG-08, AC-ORG-17; аргументи — колонки рядка, тому без обгортки `(select …)`.
    and private.can_create_request(type, purchase_type)
  );
