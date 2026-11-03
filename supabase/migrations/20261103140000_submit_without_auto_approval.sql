-- Автосхвалення не застосовується в заявках (спрощений скоуп ДЗ7; зміна специфікації update-pur-auto-approval).
--
-- PM (requirements/product.md, знімок 2026-11-02): налаштування автосхвалення лишається з WS6, але подана заявка
-- завжди очікує схвалення. Раніше private.submit_purchase за department_members.auto_approve одразу ставила «Схвалено»
-- (AC-PUR-16, 53 — прибрані зі специфікації). Тепер подання завжди дає «pending», а історія — лише запис «submitted».
-- Саме налаштування (колонка department_members.auto_approve, AC-ORG-06, 15, 33) не змінюємо.
--
-- Уже схвалені автосхваленням заявки не чіпаємо: це історичні дані. Тіло функції — копія з
-- 20261027140119_submit_recheck_purchase_type.sql без блоку автосхвалення; `create or replace` зберігає наявні
-- revoke/grant, публічна обгортка public.submit_purchase не змінюється.
create or replace function private.submit_purchase(target_request uuid)
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

  -- AC-PUR-14, 23: подана (чи подана знову) заявка очікує схвалення; автосхвалення в заявках не діє.
  update public.requests
     set status = 'pending', editing = false, decision_reason = null
   where id = target_request;

  update public.request_lines
     set status = 'pending'
   where request_id = target_request;

  perform private.pur_log(target_request, actor, 'submitted');

  return 'pending';
end;
$$;
