-- AC-DEC-06, AC-PUR-20, 51, 52: причина відхилення чи повернення з самих табуляцій, переведень рядка чи нерозривного
-- пробілу — теж «без причини». btrim(text) без другого аргументу прибирає лише пробіл (U+0020), тож прямий виклик RPC
-- (форма вже робить trim() у JS) пропускав такий рядок, і заявка переходила в returned/rejected без змістовної причини.
-- Тіла private.decide_purchase і private.admin_reject_purchase — як у 20261021140000_pur_drafts.sql; змінено лише
-- спосіб очищення причини (private.pur_clean_reason). Підпис, права й grant-и функцій лишаються тими самими.

create or replace function private.pur_clean_reason(reason_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Пробіл, табуляція, \n, \r, \f, \v і нерозривний пробіл (U+00A0), як JS String.prototype.trim() для типових випадків.
  select nullif(btrim(reason_text, E' \t\r\n\f\v' || chr(160)), '');
$$;

revoke execute on function private.pur_clean_reason(text) from public, anon;

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
  clean_reason text := private.pur_clean_reason(reason_text);
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

create or replace function private.admin_reject_purchase(target_request uuid, reason_text text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.pur_require_actor();
  req public.requests;
  clean_reason text := private.pur_clean_reason(reason_text);
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
