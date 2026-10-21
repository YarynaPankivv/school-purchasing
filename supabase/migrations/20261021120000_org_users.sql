-- Зріз ORG, задача 3: адміністрування працівників — роль admin, деактивація, захист єдиного адміністратора,
-- вибір особи «від імені» й видалення чернеток.
-- План: openspec/changes/impl-org (design.md D5, D6, D7; tasks.md 3.1).
-- AC: AC-ORG-09, AC-ORG-10, AC-ORG-12, AC-ORG-13, AC-ORG-16, AC-ORG-18, AC-ORG-21.
--
-- Правила (AGENTS.md → «База даних»): RLS, явні grant, політика на кожну видану операцію `to authenticated`
-- з `(select auth.uid())`; кожна — з `(select private.is_active_user())` (D6); хелпери — у private,
-- security definer, set search_path = ''. Попередні міграції не змінюємо.

-- ── D6. Зміна role / is_active: колонковий grant + політики ───────────────────
-- Колонковий grant тепер охоплює role і is_active. Захист від самопідвищення — не відсутність grant,
-- а тригер private.guard_profile_update() нижче: зміну цих колонок пропускає лише активний admin.
grant update (full_name, role, is_active) on table public.profiles to authenticated;

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

-- Адміністратор змінює профілі працівників (роль, активність, ім'я).
create policy profiles_update_admin
  on public.profiles
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
-- Порожня особа — завжди так; інакше активний працівник, для не-admin — ще й заявник цього відділу.
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
          or exists (
            select 1
            from public.department_members as m
            where m.department_id = target_department and m.user_id = p.id
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

-- AC-ORG-13: адміністратор видаляє лише чернетки; подані заявки база не віддає на видалення.
grant delete on table public.requests to authenticated;

create policy requests_delete_draft_admin
  on public.requests
  for delete
  to authenticated
  using (
    (select private.is_active_user())
    and (select private.current_app_role()) = 'admin'
    and status = 'draft'
  );
