-- Профілі користувачів і ролі застосунку (стартова міграція шаблону).
--
-- Правила для КОЖНОЇ міграції проєкту (див. AGENTS.md → «База даних»):
--   1) enable row level security на кожній таблиці в public;
--   2) revoke all from anon, authenticated, потім явні GRANT лише на потрібні операції
--      (нові проєкти Supabase — без автогрантів приблизно з 30.05.2026, усі — з 30.10.2026);
--   3) окрема політика на кожну операцію, завжди `to authenticated` (або `to anon` свідомо);
--   4) auth.uid() у політиках — лише як `(select auth.uid())`;
--   5) security definer функції — лише у схемі private, з `set search_path = ''`.
--
-- Ролі шаблону: member, admin. Проєкт замінює набір ролей новою міграцією, і порядок важливий:
-- спершу наявні дані, потім значення за замовчуванням колонки role, і лише тоді новий constraint.
-- Тригер on_auth_user_created вставляє профіль із role за замовчуванням: якщо лишити default 'member',
-- кожен createUser (npm run users:demo) впаде на новому constraint. Старий constraint знімаємо першим,
-- бо він не пропустить UPDATE на нову роль (23514), а користувачі з 'member' після users:demo вже є:
--   alter table public.profiles drop constraint profiles_role_check;
--   update public.profiles set role = 'employee' where role = 'member';   -- 1) дані
--   alter table public.profiles alter column role set default 'employee'; -- 2) default
--   alter table public.profiles add constraint profiles_role_check        -- 3) новий набір ролей
--     check (role in ('employee', 'manager', 'admin'));

-- Схема для службових функцій: її НЕ додаємо в [api] schemas, тож Data API її не бачить.
create schema if not exists private;

-- ── Таблиця profiles ────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'member',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('member', 'admin'))
);

comment on table public.profiles is
  'Профіль користувача застосунку. Рядок створює тригер on_auth_user_created; роль змінює лише адміністратор (service_role або міграція).';

alter table public.profiles enable row level security;

-- ── Права (GRANT) ───────────────────────────────────────────────────────────
revoke all on table public.profiles from anon, authenticated;
-- Читання — під політикою нижче.
grant select on table public.profiles to authenticated;
-- Колонковий grant: користувач може змінити лише full_name, а не role (захист від самопідвищення).
grant update (full_name) on table public.profiles to authenticated;
-- Серверні скрипти (scripts/create-demo-users.mjs) працюють із секретним ключем як service_role.
grant select, insert, update, delete on table public.profiles to service_role;
-- insert і delete для authenticated свідомо не видаємо: рядок створює тригер, видаляє каскад з auth.users.

-- ── Хелпер ролі ─────────────────────────────────────────────────────────────
-- security definer: читає profiles в обхід RLS, тож політики не зациклюються (42P17).
create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles as p where p.id = (select auth.uid());
$$;

revoke execute on function private.current_app_role() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_app_role() to authenticated;

-- ── Політики RLS (окремо на кожну операцію) ─────────────────────────────────
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.current_app_role()) = 'admin'
  );

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── Профіль для кожного нового користувача Auth (npm run users:demo, Admin API) ──
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
