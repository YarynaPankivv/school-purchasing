-- Підписи авторів (і осіб «від імені») для заявок, які людина вже бачить (AC-APR-08, AC-APR-09, AC-APR-10).
--
-- Прогалина: схвалювач читав авторів із public.profiles, а політика profiles_select_colleagues віддає лише АКТИВНИХ
-- колег зі СПІЛЬНОГО відділу. Автор-адміністратор без відділу, деактивований автор чи той, кого вже немає у відділі,
-- давали «—» замість імені чи email. А щоб показати ім'я, застосунок брав і роль, email та is_active — зайві поля.
--
-- Рішення: функція повертає лише (id, підпис), де підпис — ім'я, а за його відсутності email (як personLabel у
-- src/lib/org/departments.ts). Видимість заявок не дублюємо: public.request_author_labels — security invoker, тож
-- перелік id авторів і осіб «від імені» береться із requests під RLS викликача; пошук підписів робить private.profile_labels
-- (security definer, схема private недоступна через Data API) і лише для цього переліку. Ролі, email за наявності імені,
-- is_active і відділи не віддаються. Ліпити нову політику на profiles не можна: вона відкрила б усі колонки профілю.
--
-- Правила (AGENTS.md → «База даних»): security definer лише в private з set search_path = ''; revoke від anon/public,
-- явний grant authenticated. Таблиць не додаємо.

create or replace function private.profile_labels(target_ids uuid[])
returns table (user_id uuid, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.email), ''), '—')
  from public.profiles as p
  where (select private.is_active_user())
    and p.id = any (target_ids);
$$;

revoke execute on function private.profile_labels(uuid[]) from public, anon;
grant execute on function private.profile_labels(uuid[]) to authenticated;

create or replace function public.request_author_labels()
returns table (user_id uuid, label text)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.user_id, l.label
  from private.profile_labels(
    array(
      select r.author_id from public.requests as r
      union
      select r.on_behalf_of_id from public.requests as r where r.on_behalf_of_id is not null
    )
  ) as l;
$$;

revoke execute on function public.request_author_labels() from public, anon;
grant execute on function public.request_author_labels() to authenticated;
