-- Відповіді PM на Q1–Q6 (ValiaBihun/2026-quitcode-dream-team#9…#14), специфікація update-org-answers.
-- AC-ORG-22: адміністратор без відділів створює «Закупівлю» чи «Відшкодування» від імені будь-якого відділу.
-- Тимчасове рішення Q1 (design.md D10: адміністратор подає лише від імені своїх відділів) замінюємо:
-- private.is_member обмежує лише не-admin (AC-ORG-01 після MODIFIED). Решта умов — як у 20261018200633_org_permissions.sql.
-- AC-ORG-19, 20, 24 і AC-ORG-23 база вже виконує (private.sync_role не чіпає admin; private.can_create_request
-- дозволяє admin будь-який тип закупівлі) — їх тут не змінюємо.

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
  );
