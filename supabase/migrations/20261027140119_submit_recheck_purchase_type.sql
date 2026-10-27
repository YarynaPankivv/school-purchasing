-- Подання чернетки перевіряє дозвіл на тип заявки ще раз (AC-ORG-07, AC-ORG-08, AC-FRM-04).
--
-- Прогалина: дозвіл перевіряли лише під час створення (requests_insert) і зміни типу (guard_request_update). Працівник міг
-- створити чернетку «Самостійної закупівлі», адміністратор знімав дозвіл, а подання все одно проходило. Тепер
-- private.submit_purchase для чернетки викликає private.can_create_request. Повернена заявка (returned) зі збереженим
-- типом не блокується, як і в guard_request_update: дозвіл могли зняти вже після створення (AC-ORG-08).
--
-- Тіло функції — копія з 20261021140000_pur_drafts.sql з одним доданим блоком; `create or replace` зберігає наявні
-- revoke/grant, тож публічна обгортка public.submit_purchase не змінюється.
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

  -- AC-ORG-07, AC-ORG-08: дозвіл на тип перевіряємо й під час подання чернетки (його могли зняти після створення).
  if req.status = 'draft' and not private.can_create_request(req.type, req.purchase_type) then
    perform private.pur_fail('purchase_type_forbidden');
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
