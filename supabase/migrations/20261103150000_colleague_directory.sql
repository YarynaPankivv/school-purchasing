-- Колеги без ролі, email і is_active: довідник замість політики profiles_select_colleagues (зауваження WS7, блок C).
--
-- Прогалина: політика profiles_select_colleagues давала активному працівнику читати весь рядок профілю активних колег зі
-- спільного відділу, тобто role, email, is_active, а не лише те, що потрібно інтерфейсу (вибір особи «від імені»,
-- підписи, «Немає схвалювача»). RLS не розрізняє колонки, тож політику прибираємо, а потрібне віддає функція.
--
-- Рішення: public.colleague_directory() (security invoker) викликає private.colleague_directory() (security definer, схема
-- private недоступна через Data API) і віддає лише (user_id, label, is_admin): підпис — ім'я, а за його відсутності email
-- (як private.profile_labels), is_admin — щоб не-admin не обирав адміністратора «від імені» (AC-PUR-13). Лише активні
-- працівники зі спільного відділу й сам викликач; роль, email за наявності імені й is_active не віддаються. Адміністратор
-- і далі читає профілі напряму (profiles_select_own_or_admin).
--
-- Правила (AGENTS.md → «База даних»): security definer лише в private з set search_path = ''; revoke від anon/public,
-- явний grant authenticated. Таблиць не додаємо.

drop policy profiles_select_colleagues on public.profiles;

create or replace function private.colleague_directory()
returns table (user_id uuid, label text, is_admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.email), ''), '—'),
         p.role = 'admin'
  from public.profiles as p
  where (select private.is_active_user())
    and p.is_active
    and (p.id = (select auth.uid()) or private.shares_department(p.id));
$$;

revoke execute on function private.colleague_directory() from public, anon;
grant execute on function private.colleague_directory() to authenticated;

create or replace function public.colleague_directory()
returns table (user_id uuid, label text, is_admin boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.user_id, d.label, d.is_admin from private.colleague_directory() as d;
$$;

revoke execute on function public.colleague_directory() from public, anon;
grant execute on function public.colleague_directory() to authenticated;
