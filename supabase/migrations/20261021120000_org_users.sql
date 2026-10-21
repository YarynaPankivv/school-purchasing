-- Зріз ORG, задача 3: адміністрування працівників — роль admin, деактивація, захист єдиного адміністратора,
-- вибір особи «від імені» й видалення чернеток.
-- План: openspec/changes/impl-org (design.md D5, D6, D7; tasks.md 3.1).
-- AC: AC-ORG-09, AC-ORG-10, AC-ORG-12, AC-ORG-13, AC-ORG-16, AC-ORG-18, AC-ORG-21.
--
-- Правила (AGENTS.md → «База даних»): RLS, явні grant, політика на кожну видану операцію `to authenticated`
-- з `(select auth.uid())`; кожна — з `(select private.is_active_user())` (D6); хелпери — у private,
-- security definer, set search_path = ''. Попередні міграції не змінюємо.

-- ── D6. Зміна role / is_active: лише через функції ────────────────────────────
-- Прямого `grant update (role, is_active)` для authenticated НЕМАЄ (AGENTS.md → «База даних»): `authenticated`
-- змінює в profiles лише full_name (grant із стартової міграції), а role і is_active адміністратор змінює функціями
-- public.admin_set_role / public.admin_set_active нижче. Тригер private.guard_profile_update() лишається
-- охоронцем інваріантів (єдиний активний admin, похідна роль) для будь-якого шляху запису.

-- «Оновлюю свій рядок» теж вимагає активного користувача (D6: живий JWT деактивованого не дає запису).
drop policy profiles_update_own on public.profiles;

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (
    (select private.is_active_user())
    and id = (select auth.uid())
  )
  with check (
    (select private.is_active_user())
    and id = (select auth.uid())
    -- Захист у глибину поряд із тригером: власним рядком не змінити ні роль, ні активність.
    and role = (select private.current_app_role())
    and is_active
  );

-- ── D6. Тригер-охоронець role / is_active ─────────────────────────────────────
-- 1) Сеанс authenticated (auth.uid() не null): змінювати role/is_active може лише активний admin
--    (код 42501). service_role і міграції (auth.uid() = null) — без цієї перевірки.
-- 2) Роль змінюється лише між admin і «не admin»: requester/approver — похідні від department_approvers (D3),
--    тож ручна зміна, що суперечить похідній ролі, відхиляється (22023). Зміну requester ↔ approver, що збігається
--    з похідною, пропускаємо без перевірки прав: її робить private.sync_role() у тригері на department_approvers.
-- 3) Знімаємо admin → нова роль похідна від D3 (AC-ORG-10, AC-ORG-21).
-- 4) Після зміни має лишитись хоча б один активний admin (AC-ORG-10, AC-ORG-18) — код ORG01. Дві одночасні зміни
--    серіалізує консультативне блокування транзакції: друга бачить результат першої й не залишить базу без адміна.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived_role text;
begin
  if new.role is not distinct from old.role and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  derived_role := case
    when exists (select 1 from public.department_approvers as a where a.user_id = old.id) then 'approver'
    else 'requester'
  end;

  -- Похідна зміна requester ↔ approver (private.sync_role): права не перевіряємо.
  if old.role <> 'admin'
     and new.role <> 'admin'
     and new.is_active is not distinct from old.is_active
     and new.role = derived_role then
    return new;
  end if;

  if (select auth.uid()) is not null
     and not (
       (select private.is_active_user())
       and (select private.current_app_role()) = 'admin'
     ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  -- AC-ORG-10, AC-ORG-21: після зняття admin роль похідна, а не те, що надіслав клієнт.
  if old.role = 'admin' and new.role <> 'admin' then
    new.role := derived_role;
  end if;

  if old.role <> 'admin' and new.role <> 'admin' and new.role <> old.role and new.role <> derived_role then
    raise exception 'A requester or approver role depends on department approvals' using errcode = '22023';
  end if;

  -- AC-ORG-10, AC-ORG-18: останній активний адміністратор не знімає роль і не деактивує себе.
  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active) then
    perform pg_advisory_xact_lock(hashtext('public.profiles:active-admin-guard'));
    if not exists (
      select 1
      from public.profiles as p
      where p.id <> old.id and p.role = 'admin' and p.is_active
    ) then
      raise exception 'At least one active administrator must remain' using errcode = 'ORG01';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_profile_update() from public, anon, authenticated;

create trigger profiles_guard_update
  before update of role, is_active on public.profiles
  for each row execute function private.guard_profile_update();

-- ── D6. Зміна ролі admin й активності: функції для адміністратора ─────────────
-- Єдиний шлях змінити role / is_active із застосунку (прямого grant немає). Логіка — у private (security definer,
-- set search_path = ''), у public — тонка обгортка security invoker для supabase.rpc(…): Data API бачить лише public.
-- Функція перевіряє, що викликає активний admin (42501), і повертає true, якщо профіль знайдено. Решту інваріантів
-- (єдиний активний admin — ORG01, похідна роль) тримає тригер вище, тож AC-ORG-10, 18, 21 діють для будь-якого шляху.
-- Знімаючи admin, ставимо похідну роль одразу, а не 'requester': для схвалювача інакше тригер відхилив би зміну.
create or replace function private.admin_set_role(target_user uuid, make_admin boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  update public.profiles as p
  set role = case
    when make_admin then 'admin'
    when exists (select 1 from public.department_approvers as a where a.user_id = p.id) then 'approver'
    else 'requester'
  end
  where p.id = target_user;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function private.admin_set_active(target_user uuid, make_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
  ) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  update public.profiles as p set is_active = make_active where p.id = target_user;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke execute on function private.admin_set_role(uuid, boolean) from public, anon;
revoke execute on function private.admin_set_active(uuid, boolean) from public, anon;
grant execute on function private.admin_set_role(uuid, boolean) to authenticated;
grant execute on function private.admin_set_active(uuid, boolean) to authenticated;

create or replace function public.admin_set_role(target_user uuid, make_admin boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_role(target_user, make_admin);
$$;

create or replace function public.admin_set_active(target_user uuid, make_active boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_active(target_user, make_active);
$$;

revoke execute on function public.admin_set_role(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_role(uuid, boolean) to authenticated;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;

-- ── D7. Колеги зі спільного відділу ───────────────────────────────────────────
-- Чи є поточний користувач і target_user заявниками одного відділу. security definer — щоб не зациклити RLS (42P17).
create or replace function private.shares_department(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.department_members as mine
    join public.department_members as theirs on theirs.department_id = mine.department_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user
  );
$$;

revoke execute on function private.shares_department(uuid) from public, anon;
grant execute on function private.shares_department(uuid) to authenticated;

-- Активний працівник бачить профілі лише АКТИВНИХ колег зі спільного відділу (вибір особи «від імені»):
-- деактивованого колегу не прочитати й прямим запитом до Data API (AC-ORG-16).
create policy profiles_select_colleagues
  on public.profiles
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and is_active
    and private.shares_department(id)
  );

-- ── D5. Особа «від імені» ─────────────────────────────────────────────────────
alter table public.requests
  add column on_behalf_of_id uuid references public.profiles (id) on delete restrict;

create index requests_on_behalf_of_id_idx on public.requests (on_behalf_of_id);

comment on column public.requests.on_behalf_of_id is
  'Особа, від імені якої автор подає заявку (AC-ORG-16): активний працівник; не-admin — лише заявник того самого відділу.';

-- Чи можна вказати target_user як особу «від імені» у відділі target_department.
-- Порожня особа — завжди так; інакше активний працівник, для не-admin — ще й заявник цього відділу, але не
-- адміністратор (вимоги PM, AC-PUR-13: у списку «колеги з відділу, крім нього й адміністраторів»). Схвалювач —
-- теж заявник відділу (складений FK department_approvers), тож його вибрати можна.
-- TS-дзеркало: src/lib/org/departments.ts (onBehalfCandidates).
create or replace function private.can_act_on_behalf(target_user uuid, target_department uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_user is null
    or exists (
      select 1
      from public.profiles as p
      where p.id = target_user
        and p.is_active
        and (
          (select private.current_app_role()) = 'admin'
          or (
            p.role <> 'admin'
            and exists (
              select 1
              from public.department_members as m
              where m.department_id = target_department and m.user_id = p.id
            )
          )
        )
    );
$$;

revoke execute on function private.can_act_on_behalf(uuid, uuid) from public, anon;
grant execute on function private.can_act_on_behalf(uuid, uuid) to authenticated;

-- ── requests: insert (з особою «від імені»), select (+ особа «від імені»), delete чернеток ─────────────────
drop policy requests_insert on public.requests;

create policy requests_insert
  on public.requests
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and author_id = (select auth.uid())
    and status = 'draft'
    -- AC-ORG-01: не-admin — лише від імені відділів, де він заявник; AC-ORG-22: admin — будь-який відділ.
    and (
      (select private.current_app_role()) = 'admin'
      or private.is_member(department_id)
    )
    -- AC-ORG-07, AC-ORG-08, AC-ORG-17, AC-ORG-23; аргументи — колонки рядка, тому без обгортки `(select …)`.
    and private.can_create_request(type, purchase_type)
    -- AC-ORG-16: особа «від імені» — лише активний працівник (не-admin — заявник того самого відділу).
    and private.can_act_on_behalf(on_behalf_of_id, department_id)
  );

drop policy requests_select on public.requests;

create policy requests_select
  on public.requests
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      author_id = (select auth.uid())
      or on_behalf_of_id = (select auth.uid())
      or (select private.current_app_role()) = 'admin'
    )
  );

-- AC-ORG-13: адміністратор видаляє лише чернетки ДЕАКТИВОВАНОГО автора; подані заявки база не віддає на видалення.
-- Стан автора перевіряє сама політика в тому ж запиті, що й видалення: перевірка в застосунку перед delete
-- лишала б вікно, у якому інший адміністратор активує автора й чернетка активного працівника буде видалена.
-- security definer — щоб політика читала profiles в обхід RLS; аргумент — колонка рядка, тож без обгортки (select …).
-- plpgsql volatile + for share: кожен виклик читає актуальний стан, а блокування рядка автора до кінця
-- транзакції видалення змушує паралельну активацію (update profiles) чекати, тож перевірка й видалення серіалізуються.
create or replace function private.is_inactive_user(target_user uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  active boolean;
begin
  select p.is_active
    into active
    from public.profiles as p
   where p.id = target_user
     for share;

  return found and not active;
end;
$$;

revoke execute on function private.is_inactive_user(uuid) from public, anon;
grant execute on function private.is_inactive_user(uuid) to authenticated;

grant delete on table public.requests to authenticated;

create policy requests_delete_draft_admin
  on public.requests
  for delete
  to authenticated
  using (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
    and status = 'draft'
    and private.is_inactive_user(author_id)
  );
