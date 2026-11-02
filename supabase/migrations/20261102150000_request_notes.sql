-- Нотатки до заявки: короткі коментарі автора й схвалювача в межах заявки.
create table public.request_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index request_notes_request_idx on public.request_notes (request_id);

alter table public.request_notes enable row level security;
revoke all on table public.request_notes from anon, authenticated;
grant select, insert on table public.request_notes to authenticated;
grant select, insert, update, delete on table public.request_notes to service_role;

create policy request_notes_select
  on public.request_notes
  for select
  to authenticated
  using ((select private.is_active_user()));

create policy request_notes_insert
  on public.request_notes
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and private.can_view_request(request_id)
  );

-- Скільки нотаток бачить користувач під заявкою: лише для тих, хто бачить саму заявку.
create or replace function private.request_note_count(target_request uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.request_notes as n
  where n.request_id = target_request
    and private.can_view_request(target_request);
$$;

revoke execute on function private.request_note_count(uuid) from public, anon;
grant execute on function private.request_note_count(uuid) to authenticated;
