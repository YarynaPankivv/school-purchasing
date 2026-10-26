-- Зріз PUR, задача 1: чернетка, номер PUR-N, рядки, історія, видимість, подання, рішення, скасування й копія.
-- План: openspec/changes/impl-pur (design.md D1–D5; tasks.md 1.1). Рішення схвалювача й відділу закупівель
-- (decide_purchase, reopen_purchase, admin_reject_purchase) додано в цю ж міграцію, а не в окрему pur_decisions.
-- AC: AC-PUR-01…14, 16, 23, 26, 29…33, 35, 37, 38, 44, 45, 47…49, 53, 54 (+ рішення: 15, 17…22, 24, 25, 27, 28, 36,
-- 39…43, 50…52). Файли (AC-PUR-34) відкладено (design.md D8).
--
-- Правила (AGENTS.md → «База даних»): RLS на кожній таблиці, revoke all від anon/authenticated, явні (колонкові)
-- grant, політика на кожну видану операцію `to authenticated` з `(select auth.uid())`; кожна — з
-- `(select private.is_active_user())`; хелпери — у private, security definer, set search_path = ''; функції переходів —
-- private.* і тонка обгортка public.* security invoker. Помилки — `raise exception 'pur:<код>' using errcode = 'P0001'`.
-- Попередні міграції не змінюємо; порядок для constraint: знімаємо старий → оновлюємо дані → новий.

-- ── D1. Статуси й колонки requests ────────────────────────────────────────────
alter table public.requests drop constraint requests_status_check;
update public.requests set status = 'pending' where status = 'submitted';
alter table public.requests add constraint requests_status_check check (
  status in (
    'draft', 'pending', 'approved', 'partially_approved', 'rejected', 'returned',
    'cancelled', 'processing', 'processed'
  )
);

alter table public.requests
  add column number          bigint,
  add column note            text,
  add column delivery_date   date,
  add column editing         boolean not null default false,
  add column decision_reason text,
  add column archived_at     timestamptz,
  add column updated_at      timestamptz not null default now();

comment on column public.requests.number is 'Номер PUR-N закупівлі (D2): видає тригер, не повторюється навіть після видалення чернетки.';
comment on column public.requests.editing is 'Автор редагує подану заявку (AC-PUR-26): доки true, рішення не приймаються.';
comment on column public.requests.decision_reason is 'Причина останнього відхилення чи повернення на доопрацювання (AC-PUR-20, 43).';
comment on column public.requests.archived_at is 'Для зрізу ORD: коли закупівлю прибрано з черги обробки.';

-- on_behalf_of_id уже є (20261021120000_org_users.sql): лише CHECK «≠ автор». Адміністратор міг вказати себе —
-- такі значення прибираємо до додавання обмеження.
update public.requests set on_behalf_of_id = null where on_behalf_of_id = author_id;
alter table public.requests add constraint requests_on_behalf_not_author check (on_behalf_of_id <> author_id);

-- AC-PUR-10: нотатка до 2000 символів. AC-PUR-05: відділ обов'язковий для всього, крім чернетки.
alter table public.requests add constraint requests_note_length check (char_length(note) <= 2000);
alter table public.requests alter column department_id drop not null;
alter table public.requests add constraint requests_department_for_submitted
  check (status = 'draft' or department_id is not null);
alter table public.requests add constraint requests_editing_only_pending check (not editing or status = 'pending');

create index requests_status_idx on public.requests (status);

-- ── D2. Номер PUR-N ───────────────────────────────────────────────────────────
-- Послідовність не повертає видані значення: номер видаленої чернетки не використовується повторно (AC-PUR-30), а
-- одночасні вставки отримують різні номери (AC-PUR-02). Наявні закупівлі нумеруємо за created_at.
create sequence private.purchase_number_seq as bigint start with 1 minvalue 1;

update public.requests as r
set number = numbered.n
from (
  select id, row_number() over (order by created_at, id) as n
  from public.requests
  where type = 'PUR'
) as numbered
where r.id = numbered.id;

select setval(
  'private.purchase_number_seq',
  coalesce((select max(number) from public.requests where type = 'PUR'), 0) + 1,
  false
);

create unique index requests_pur_number_unique on public.requests (number) where type = 'PUR';
alter table public.requests add constraint requests_number_for_pur check (type <> 'PUR' or number is not null);

-- Номер завжди видає база: надіслане клієнтом значення ігноруємо.
create or replace function private.assign_request_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'PUR' then
    new.number := nextval('private.purchase_number_seq');
  else
    new.number := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.assign_request_number() from public, anon, authenticated;

create trigger requests_assign_number
  before insert on public.requests
  for each row execute function private.assign_request_number();

-- ── D3. Рядки закупівлі ───────────────────────────────────────────────────────
create table public.request_lines (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  position   integer not null,
  name       text,
  purpose    text,
  quantity   integer,
  unit_price numeric(12, 2),
  status     text not null default 'pending',
  created_at timestamptz not null default now(),
  -- Порожні поля дозволені (чернетка); повноту перевіряє подання (AC-PUR-09).
  constraint request_lines_name_length check (char_length(name) <= 500),            -- AC-PUR-10
  constraint request_lines_quantity_check check (quantity >= 1),                     -- AC-PUR-07
  constraint request_lines_unit_price_check check (unit_price >= 0),                 -- AC-PUR-07, 08
  constraint request_lines_status_check check (status in ('pending', 'approved', 'rejected', 'ready', 'ordered')),
  constraint request_lines_position_unique unique (request_id, position)
);

create index request_lines_request_id_idx on public.request_lines (request_id);

comment on table public.request_lines is
  'Рядок закупівлі (D3). Статус рядка змінюють лише функції переходів; ready/ordered — зріз ORD.';

-- Позиція за замовчуванням — наступна за останньою в заявці.
create or replace function private.assign_line_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.position is null then
    select coalesce(max(l.position), 0) + 1
      into new.position
      from public.request_lines as l
     where l.request_id = new.request_id;
  end if;
  return new;
end;
$$;

revoke execute on function private.assign_line_position() from public, anon, authenticated;

-- Позиція — NOT NULL, але тригер BEFORE INSERT виконується раніше за перевірку NOT NULL.
create trigger request_lines_assign_position
  before insert on public.request_lines
  for each row execute function private.assign_line_position();

-- AC-PUR-01: нова закупівля має один порожній рядок.
create or replace function private.add_empty_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.request_lines (request_id, position) values (new.id, 1);
  return new;
end;
$$;

revoke execute on function private.add_empty_line() from public, anon, authenticated;

create trigger requests_add_empty_line
  after insert on public.requests
  for each row
  when (new.type = 'PUR')
  execute function private.add_empty_line();

-- ── D3. Історія заявки ────────────────────────────────────────────────────────
-- actor_name — знімок імені на момент дії: схвалювач чи адміністратор може не бути колегою автора за відділом,
-- і join із profiles у нього порожній (profiles_select_colleagues). created_at — clock_timestamp(), щоб записи
-- однієї транзакції («Подано» → «Схвалено» автосхваленням) мали порядок.
create table public.request_history (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete restrict,
  actor_name text,
  action     text not null,
  reason     text,
  created_at timestamptz not null default clock_timestamp(),
  constraint request_history_action_check check (
    action in ('submitted', 'approved', 'partially_approved', 'rejected', 'returned', 'reopened', 'cancelled')
  )
);

create index request_history_request_id_idx on public.request_history (request_id, created_at);

comment on table public.request_history is 'Історія дій над заявкою (AC-PUR-37, 39). Пишуть лише функції переходів.';

-- ── Хелпери видимості й редагування ───────────────────────────────────────────
-- Чи схвалює поточний користувач відділ (department_approvers). Аргумент — колонка рядка → без обгортки `(select …)`.
create or replace function private.is_department_approver(target_department uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.department_approvers as a
    where a.department_id = target_department
      and a.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_department_approver(uuid) from public, anon;
grant execute on function private.is_department_approver(uuid) to authenticated;

-- D4: автор, особа «від імені», admin (усе, і чернетки) або схвалювач відділу — лише не-чернетки (AC-PUR-03, 35, 49).
-- Для таблиць-нащадків. Сама requests_select читає колонки рядка без повторного запиту: stable-функція не бачить
-- рядка, вставленого тим самим запитом, і `insert … returning` не пройшов би політику select.
create or replace function private.can_view_request(target_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.requests as r
    where r.id = target_request
      and (
        r.author_id = (select auth.uid())
        or r.on_behalf_of_id = (select auth.uid())
        or (select private.current_app_role()) = 'admin'
        or (r.status <> 'draft' and r.department_id is not null and private.is_department_approver(r.department_id))
      )
  );
$$;

revoke execute on function private.can_view_request(uuid) from public, anon;
grant execute on function private.can_view_request(uuid) to authenticated;

-- D4: рядки редагує автор, коли заявка draft, returned або pending з editing = true (AC-PUR-26, 44).
create or replace function private.can_edit_request_lines(target_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.requests as r
    where r.id = target_request
      and r.author_id = (select auth.uid())
      and (
        r.status in ('draft', 'returned')
        or (r.status = 'pending' and r.editing)
      )
  );
$$;

revoke execute on function private.can_edit_request_lines(uuid) from public, anon;
grant execute on function private.can_edit_request_lines(uuid) to authenticated;

-- ── RLS і grant ───────────────────────────────────────────────────────────────
alter table public.request_lines enable row level security;
alter table public.request_history enable row level security;

revoke all on table public.request_lines from anon, authenticated;
revoke all on table public.request_history from anon, authenticated;

-- requests: insert лише переліченими колонками (number, editing, decision_reason… — тільки база й функції переходів);
-- update — колонки чернетки (D4); delete лишається з 20261021120000_org_users.sql.
revoke insert on table public.requests from authenticated;
grant insert (type, purchase_type, department_id, author_id, on_behalf_of_id, status, note, delivery_date)
  on table public.requests to authenticated;
grant update (department_id, purchase_type, note, delivery_date, on_behalf_of_id, updated_at)
  on table public.requests to authenticated;

-- Статус рядка (pending/approved/rejected) змінюють лише функції переходів.
grant select, delete on table public.request_lines to authenticated;
grant insert (request_id, position, name, purpose, quantity, unit_price) on table public.request_lines to authenticated;
grant update (position, name, purpose, quantity, unit_price) on table public.request_lines to authenticated;
grant select on table public.request_history to authenticated;

grant select, insert, update, delete on table public.request_lines to service_role;
grant select, insert, update, delete on table public.request_history to service_role;

-- ── requests: політики ────────────────────────────────────────────────────────
drop policy requests_select on public.requests;
drop policy requests_insert on public.requests;

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
      -- AC-PUR-35, 49: схвалювач відділу бачить лише подані заявки; заявник відділу без цієї ролі — нічого чужого.
      or (status <> 'draft' and department_id is not null and private.is_department_approver(department_id))
    )
  );

-- Відділ необов'язковий для чернетки (AC-PUR-05); якщо вказано — як у ORG: не-admin лише свій (AC-ORG-01), admin — будь-який
-- (AC-ORG-22). Решта умов — без змін.
create policy requests_insert
  on public.requests
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and author_id = (select auth.uid())
    and status = 'draft'
    and (
      department_id is null
      or (select private.current_app_role()) = 'admin'
      or private.is_member(department_id)
    )
    and private.can_create_request(type, purchase_type)
    and private.can_act_on_behalf(on_behalf_of_id, department_id)
  );

-- D4: автор змінює свою чернетку чи повернену заявку. Відділ поза draft змінити не можна (AC-PUR-38) — тригер нижче.
create policy requests_update_author
  on public.requests
  for update
  to authenticated
  using (
    (select private.is_active_user())
    and author_id = (select auth.uid())
    and status in ('draft', 'returned')
  )
  with check (
    (select private.is_active_user())
    and author_id = (select auth.uid())
    and status in ('draft', 'returned')
    and (
      department_id is null
      or (select private.current_app_role()) = 'admin'
      or private.is_member(department_id)
    )
    and private.can_act_on_behalf(on_behalf_of_id, department_id)
  );

-- AC-PUR-30: автор видаляє лише свою чернетку (рядки й історія — каскадом). Політика адміністратора
-- requests_delete_draft_admin (ORG) лишається.
create policy requests_delete_draft_author
  on public.requests
  for delete
  to authenticated
  using (
    (select private.is_active_user())
    and author_id = (select auth.uid())
    and status = 'draft'
  );

-- ── Тригер-охоронець оновлення заявки ─────────────────────────────────────────
-- Працює для будь-якого шляху запису (і для service_role).
create or replace function private.guard_request_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type is distinct from old.type
     or new.author_id is distinct from old.author_id
     or new.number is distinct from old.number then
    raise exception 'pur:immutable' using errcode = 'P0001';
  end if;

  -- AC-PUR-38: відділ змінюють лише в чернетці.
  if new.department_id is distinct from old.department_id and old.status <> 'draft' then
    raise exception 'pur:department_locked' using errcode = 'P0001';
  end if;

  -- Дозвіл на «Самостійну закупівлю» перевіряємо лише за зміни типу (AC-ORG-08): повернена заявка зі збереженим
  -- типом не блокується, якщо дозвіл зняли вже після створення.
  if new.type = 'PUR'
     and new.purchase_type is distinct from old.purchase_type
     and (select auth.uid()) is not null
     and not private.can_create_request(new.type, new.purchase_type) then
    raise exception 'pur:purchase_type_forbidden' using errcode = 'P0001';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.guard_request_update() from public, anon, authenticated;

create trigger requests_guard_update
  before update on public.requests
  for each row execute function private.guard_request_update();

-- ── request_lines / request_history: політики ────────────────────────────────
create policy request_lines_select
  on public.request_lines
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and private.can_view_request(request_id)
  );

create policy request_lines_insert_author
  on public.request_lines
  for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and private.can_edit_request_lines(request_id)
  );

create policy request_lines_update_author
  on public.request_lines
  for update
  to authenticated
  using (
    (select private.is_active_user())
    and private.can_edit_request_lines(request_id)
  )
  with check (
    (select private.is_active_user())
    and private.can_edit_request_lines(request_id)
  );

create policy request_lines_delete_author
  on public.request_lines
  for delete
  to authenticated
  using (
    (select private.is_active_user())
    and private.can_edit_request_lines(request_id)
  );

create policy request_history_select
  on public.request_history
  for select
  to authenticated
  using (
    (select private.is_active_user())
    and private.can_view_request(request_id)
  );

-- ── D5. Допоміжні функції переходів ───────────────────────────────────────────
-- Помилка переходу: код після `pur:` розбирає застосунок (PUR_ERROR_MESSAGES).
create or replace function private.pur_fail(code text, details text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- RAISE … DETAIL = NULL — помилка («option cannot be null»), тому гілки.
  if details is null then
    raise exception 'pur:%', code using errcode = 'P0001';
  end if;
  raise exception 'pur:%', code using errcode = 'P0001', detail = details;
end;
$$;

revoke execute on function private.pur_fail(text, text) from public, anon, authenticated;

-- Вхід кожної функції переходу: активний користувач із JWT (AC-ORG-12: живий JWT деактивованого нічого не робить).
create or replace function private.pur_require_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not (select private.is_active_user()) then
    perform private.pur_fail('forbidden');
  end if;
  return actor;
end;
$$;

revoke execute on function private.pur_require_actor() from public, anon, authenticated;

-- Ім'я для історії: імʼя працівника, інакше email.
create or replace function private.pur_actor_name(actor uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profiles as p where p.id = actor;
$$;

revoke execute on function private.pur_actor_name(uuid) from public, anon, authenticated;

create or replace function private.pur_log(target_request uuid, actor uuid, log_action text, log_reason text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.request_history (request_id, actor_id, actor_name, action, reason)
  values (target_request, actor, private.pur_actor_name(actor), log_action, log_reason);
$$;

revoke execute on function private.pur_log(uuid, uuid, text, text) from public, anon, authenticated;

-- Рядки з незаповненими полями: помилка pur:lines_incomplete з деталями «позиція:поля;…» (AC-PUR-09) чи
-- pur:lines_required, коли рядків немає. Лише для заявки, що вже заблокована викликачем.
create or replace function private.pur_check_lines_complete(target_request uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  total integer;
  problems text;
begin
  select count(*) into total from public.request_lines as l where l.request_id = target_request;
  if total = 0 then
    perform private.pur_fail('lines_required');
  end if;

  select string_agg(
           l.position::text || ':' || concat_ws(
             ',',
             case when l.name is null or btrim(l.name) = '' then 'name' end,
             case when l.purpose is null or btrim(l.purpose) = '' then 'purpose' end,
             case when l.quantity is null then 'quantity' end,
             case when l.unit_price is null then 'unit_price' end
           ),
           ';' order by l.position
         )
    into problems
    from public.request_lines as l
   where l.request_id = target_request
     and (
       l.name is null or btrim(l.name) = ''
       or l.purpose is null or btrim(l.purpose) = ''
       or l.quantity is null
       or l.unit_price is null
     );

  if problems is not null then
    perform private.pur_fail('lines_incomplete', problems);
  end if;
end;
$$;

revoke execute on function private.pur_check_lines_complete(uuid) from public, anon, authenticated;

-- Заблокувати закупівлю для зміни; немає такої — pur:not_found.
create or replace function private.pur_lock(target_request uuid)
returns public.requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.requests;
begin
  select * into req from public.requests as r where r.id = target_request and r.type = 'PUR' for update;
  if not found then
    perform private.pur_fail('not_found');
  end if;
  return req;
end;
$$;

revoke execute on function private.pur_lock(uuid) from public, anon, authenticated;

-- ── D5. submit_purchase ───────────────────────────────────────────────────────
-- Подає чернетку чи повернену заявку. Повертає новий статус: pending або approved (автосхвалення).
create or replace function private.submit_purchase(target_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  req public.requests;
  auto_approved boolean;
  new_status text;
begin
  req := private.pur_lock(target_request);

  -- AC-PUR-45: подає лише автор.
  if req.author_id <> actor then
    perform private.pur_fail('forbidden');
  end if;
  if req.status not in ('draft', 'returned') then
    perform private.pur_fail('invalid_status');
  end if;

  -- AC-PUR-05: відділ обов'язковий; не-admin подає лише від імені відділу, де він заявник (AC-ORG-01).
  if req.department_id is null then
    perform private.pur_fail('department_required');
  end if;
  if not ((select private.current_app_role()) = 'admin' or private.is_member(req.department_id)) then
    perform private.pur_fail('forbidden');
  end if;

  -- AC-PUR-13: особа «від імені» перевіряється й під час подання (могла змінитися після збереження).
  if not private.can_act_on_behalf(req.on_behalf_of_id, req.department_id) then
    perform private.pur_fail('on_behalf_invalid');
  end if;

  -- AC-PUR-09: повні рядки.
  perform private.pur_check_lines_complete(target_request);

  -- AC-PUR-16, 53: автосхвалення — властивість членства автора у відділі заявки.
  select exists (
    select 1
    from public.department_members as m
    where m.department_id = req.department_id and m.user_id = actor and m.auto_approve
  ) into auto_approved;

  new_status := case when auto_approved then 'approved' else 'pending' end;

  update public.requests
     set status = new_status, editing = false, decision_reason = null
   where id = target_request;

  update public.request_lines
     set status = case when auto_approved then 'approved' else 'pending' end
   where request_id = target_request;

  perform private.pur_log(target_request, actor, 'submitted');
  if auto_approved then
    perform private.pur_log(target_request, actor, 'approved');
  end if;

  return new_status;
end;
$$;

-- ── D5. set_purchase_editing ──────────────────────────────────────────────────
-- Автор вмикає/вимикає редагування поданої заявки (AC-PUR-26). Вимкнення вимагає повних рядків.
create or replace function private.set_purchase_editing(target_request uuid, make_editing boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  req public.requests;
begin
  req := private.pur_lock(target_request);
  if req.author_id <> actor then
    perform private.pur_fail('forbidden');
  end if;
  if req.status <> 'pending' then
    perform private.pur_fail('invalid_status');
  end if;

  if not make_editing then
    perform private.pur_check_lines_complete(target_request);
  end if;

  update public.requests set editing = make_editing where id = target_request;
  return make_editing;
end;
$$;

-- ── D5. decide_purchase ───────────────────────────────────────────────────────
-- Рішення схвалювача відділу чи admin: decision = 'approve' | 'reject' | 'return'. Повертає новий статус.
create or replace function private.decide_purchase(
  target_request uuid,
  decision text,
  reason_text text default null,
  rejected_line_ids uuid[] default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  req public.requests;
  total_lines integer;
  rejected_count integer;
  new_status text;
  clean_reason text := nullif(btrim(reason_text), '');
begin
  req := private.pur_lock(target_request);

  -- AC-PUR-24, 54: автор і особа «від імені» не вирішують за будь-якої ролі.
  if req.author_id = actor or req.on_behalf_of_id = actor then
    perform private.pur_fail('own_request');
  end if;
  -- AC-PUR-35: вирішує активний схвалювач відділу заявки чи admin.
  if not (
    (select private.current_app_role()) = 'admin'
    or (req.department_id is not null and private.is_department_approver(req.department_id))
  ) then
    perform private.pur_fail('forbidden');
  end if;
  if req.status = 'draft' then
    perform private.pur_fail('not_found');
  end if;
  -- AC-PUR-25: рядок заблоковано; друге рішення бачить уже змінений статус.
  if req.status <> 'pending' then
    perform private.pur_fail('already_decided');
  end if;
  -- AC-PUR-26: автор редагує подану заявку.
  if req.editing then
    perform private.pur_fail('author_editing');
  end if;

  if decision = 'approve' then
    select count(*) into total_lines from public.request_lines as l where l.request_id = target_request;
    select count(*)
      into rejected_count
      from public.request_lines as l
     where l.request_id = target_request
       and l.id = any (coalesce(rejected_line_ids, '{}'::uuid[]));

    -- Рядок, якого немає в заявці, — помилка, а не мовчазне ігнорування.
    if rejected_count <> (select count(distinct x) from unnest(coalesce(rejected_line_ids, '{}'::uuid[])) as x) then
      perform private.pur_fail('invalid_line');
    end if;
    -- AC-PUR-19: схвалювати нічого.
    if total_lines = 0 or rejected_count = total_lines then
      perform private.pur_fail('all_lines_rejected');
    end if;

    update public.request_lines as l
       set status = case when l.id = any (coalesce(rejected_line_ids, '{}'::uuid[])) then 'rejected' else 'approved' end
     where l.request_id = target_request;

    new_status := case when rejected_count = 0 then 'approved' else 'partially_approved' end;
    update public.requests set status = new_status, decision_reason = null where id = target_request;
    perform private.pur_log(target_request, actor, new_status);

  elsif decision = 'reject' or decision = 'return' then
    -- AC-PUR-20, 51: причина обов'язкова.
    if clean_reason is null then
      perform private.pur_fail('reason_required');
    end if;
    new_status := case when decision = 'reject' then 'rejected' else 'returned' end;
    update public.requests set status = new_status, decision_reason = clean_reason where id = target_request;
    perform private.pur_log(target_request, actor, new_status, clean_reason);

  else
    perform private.pur_fail('invalid_action');
  end if;

  return new_status;
end;
$$;

-- ── D5. reopen_purchase ───────────────────────────────────────────────────────
-- Лише admin: відхилену чи повернену заявку знову на схвалення (AC-PUR-27, 36). Рядки знову pending.
create or replace function private.reopen_purchase(target_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  req public.requests;
begin
  req := private.pur_lock(target_request);
  if (select private.current_app_role()) <> 'admin' then
    perform private.pur_fail('forbidden');
  end if;
  if req.status not in ('rejected', 'returned') then
    perform private.pur_fail('invalid_status');
  end if;

  update public.requests set status = 'pending', editing = false, decision_reason = null where id = target_request;
  update public.request_lines set status = 'pending' where request_id = target_request;
  perform private.pur_log(target_request, actor, 'reopened');
  return 'pending';
end;
$$;

-- ── D5. admin_reject_purchase ─────────────────────────────────────────────────
-- Лише admin: відхилення схваленої закупівлі з причиною (AC-PUR-28, 52); «В обробці»/«Оброблено» — ні (AC-PUR-50).
create or replace function private.admin_reject_purchase(target_request uuid, reason_text text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  req public.requests;
  clean_reason text := nullif(btrim(reason_text), '');
begin
  req := private.pur_lock(target_request);
  if (select private.current_app_role()) <> 'admin' then
    perform private.pur_fail('forbidden');
  end if;
  if req.status in ('processing', 'processed') then
    perform private.pur_fail('cannot_reject');
  end if;
  if req.status not in ('approved', 'partially_approved') then
    perform private.pur_fail('invalid_status');
  end if;
  if clean_reason is null then
    perform private.pur_fail('reason_required');
  end if;

  update public.requests set status = 'rejected', decision_reason = clean_reason where id = target_request;
  perform private.pur_log(target_request, actor, 'rejected', clean_reason);
  return 'rejected';
end;
$$;

-- ── D5. cancel_purchase ───────────────────────────────────────────────────────
-- Автор: чернетка видаляється (повертає 'deleted', AC-PUR-30), решта дозволених статусів → 'cancelled' (AC-PUR-29);
-- «Відхилено», «В обробці», «Оброблено» й уже скасовану — pur:cannot_cancel (AC-PUR-31).
create or replace function private.cancel_purchase(target_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  req public.requests;
begin
  req := private.pur_lock(target_request);
  if req.author_id <> actor then
    perform private.pur_fail('forbidden');
  end if;

  if req.status = 'draft' then
    delete from public.requests where id = target_request;
    return 'deleted';
  end if;
  if req.status not in ('pending', 'approved', 'partially_approved', 'returned') then
    perform private.pur_fail('cannot_cancel');
  end if;

  update public.requests set status = 'cancelled', editing = false where id = target_request;
  perform private.pur_log(target_request, actor, 'cancelled');
  return 'cancelled';
end;
$$;

-- ── D5. copy_purchase ─────────────────────────────────────────────────────────
-- Автор копіює свою закупівлю: нова чернетка з тим самим відділом, нотаткою, особою «від імені» (якщо ще допустима) і
-- всіма рядками без відхилень; без дати доставки. Тип закупівлі — за замовчуванням «Відділ закупівель» (CHECK
-- вимагає тип для PUR). Повертає id нової чернетки (AC-PUR-32).
create or replace function private.copy_purchase(target_request uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  src public.requests;
  new_id uuid;
begin
  src := private.pur_lock(target_request);
  if src.author_id <> actor then
    perform private.pur_fail('forbidden');
  end if;

  insert into public.requests (type, purchase_type, department_id, author_id, on_behalf_of_id, status, note)
  values (
    'PUR',
    'procurement',
    src.department_id,
    actor,
    case when private.can_act_on_behalf(src.on_behalf_of_id, src.department_id) then src.on_behalf_of_id end,
    'draft',
    src.note
  )
  returning id into new_id;

  -- Тригер уже додав порожній рядок; замінюємо його рядками оригіналу, якщо вони є.
  if exists (select 1 from public.request_lines as l where l.request_id = src.id) then
    delete from public.request_lines as l where l.request_id = new_id;
    insert into public.request_lines (request_id, position, name, purpose, quantity, unit_price, status)
    select new_id, row_number() over (order by l.position), l.name, l.purpose, l.quantity, l.unit_price, 'pending'
      from public.request_lines as l
     where l.request_id = src.id;
  end if;

  return new_id;
end;
$$;

-- ── Права на функції й обгортки public.* (security invoker) ───────────────────
revoke execute on function private.submit_purchase(uuid) from public, anon;
revoke execute on function private.set_purchase_editing(uuid, boolean) from public, anon;
revoke execute on function private.decide_purchase(uuid, text, text, uuid[]) from public, anon;
revoke execute on function private.reopen_purchase(uuid) from public, anon;
revoke execute on function private.admin_reject_purchase(uuid, text) from public, anon;
revoke execute on function private.cancel_purchase(uuid) from public, anon;
revoke execute on function private.copy_purchase(uuid) from public, anon;
grant execute on function private.submit_purchase(uuid) to authenticated;
grant execute on function private.set_purchase_editing(uuid, boolean) to authenticated;
grant execute on function private.decide_purchase(uuid, text, text, uuid[]) to authenticated;
grant execute on function private.reopen_purchase(uuid) to authenticated;
grant execute on function private.admin_reject_purchase(uuid, text) to authenticated;
grant execute on function private.cancel_purchase(uuid) to authenticated;
grant execute on function private.copy_purchase(uuid) to authenticated;

create or replace function public.submit_purchase(target_request uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.submit_purchase(target_request);
$$;

create or replace function public.set_purchase_editing(target_request uuid, make_editing boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.set_purchase_editing(target_request, make_editing);
$$;

create or replace function public.decide_purchase(
  target_request uuid,
  decision text,
  reason_text text default null,
  rejected_line_ids uuid[] default null
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.decide_purchase(target_request, decision, reason_text, rejected_line_ids);
$$;

create or replace function public.reopen_purchase(target_request uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.reopen_purchase(target_request);
$$;

create or replace function public.admin_reject_purchase(target_request uuid, reason_text text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_reject_purchase(target_request, reason_text);
$$;

create or replace function public.cancel_purchase(target_request uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_purchase(target_request);
$$;

create or replace function public.copy_purchase(target_request uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.copy_purchase(target_request);
$$;

revoke execute on function public.submit_purchase(uuid) from public, anon;
revoke execute on function public.set_purchase_editing(uuid, boolean) from public, anon;
revoke execute on function public.decide_purchase(uuid, text, text, uuid[]) from public, anon;
revoke execute on function public.reopen_purchase(uuid) from public, anon;
revoke execute on function public.admin_reject_purchase(uuid, text) from public, anon;
revoke execute on function public.cancel_purchase(uuid) from public, anon;
revoke execute on function public.copy_purchase(uuid) from public, anon;
grant execute on function public.submit_purchase(uuid) to authenticated;
grant execute on function public.set_purchase_editing(uuid, boolean) to authenticated;
grant execute on function public.decide_purchase(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.reopen_purchase(uuid) to authenticated;
grant execute on function public.admin_reject_purchase(uuid, text) to authenticated;
grant execute on function public.cancel_purchase(uuid) to authenticated;
grant execute on function public.copy_purchase(uuid) to authenticated;
