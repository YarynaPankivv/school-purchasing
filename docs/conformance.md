# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-10-20

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-ORG-01 | працівник без ролі `admin` подає заявки лише від імені своїх відділів, інших у виборі немає | `src/app/requests/new/actions.ts` (createDraftRequest; RLS requests_insert) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-02 | призначення схвалювачем не-заявника відхилено з повідомленням | `src/app/admin/departments/actions.ts` (addApprover; FK department_approvers_member_fkey) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-03 | зняття заявника відділу знімає його зі схвалювачів цього відділу | `src/app/admin/departments/actions.ts` (removeMember; каскад FK) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-15 | зняття заявника відділу вимикає його автосхвалення в цьому відділі | `supabase/migrations/20261018182200_org_departments.sql` (department_members.auto_approve) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-05 | призначення схвалювачем змінює роль не-admin на approver | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-04 | зняття з єдиного відділу схвалення повертає роль requester | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-11 | адміністратор без відділів лишається admin | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-06 | автосхвалення діє лише у відділі, де його ввімкнено | `src/app/admin/departments/actions.ts` (setAutoApprove) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-14 | відділ без активного схвалювача позначено «Немає схвалювача» | `src/lib/org/departments.ts` (departmentHasActiveApprover) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-19 | схвалювач двох відділів після зняття з одного лишається approver | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-20 | адміністратор, призначений схвалювачем, лишається admin | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-22 | адміністратор без відділів обирає будь-який відділ | `supabase/migrations/20261020182013_org_admin_any_department.sql` (requests_insert); `src/lib/org/departments.ts` (selectableDepartments) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-24 | зняття заявника, що схвалював лише цей відділ, дає роль requester | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role; каскад FK) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-07 | без дозволу «Витрати карткою» немає у виборі типу заявки | `src/lib/org/request-options.ts` (allowedRequestTypes; RLS requests_insert → private.can_create_request) | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-17 | з дозволом «Витрата карткою» є у виборі типу заявки | `src/app/admin/users/actions.ts` (setPermissions; allowedRequestTypes) | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-08 | не-admin без дозволу «Самостійна закупівля» — лише тип «Відділ закупівель» | `src/lib/org/request-options.ts` (allowedPurchaseTypes; private.can_create_request) | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-23 | адміністратор без дозволу обирає «Самостійну закупівлю» | `src/lib/org/request-options.ts` (allowedPurchaseTypes; private.can_create_request) | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-09 | без ролі admin немає доступу до працівників і відділів, «Недостатньо прав» | — | — | відкладено (чекає реалізації) |
| AC-ORG-10 | єдиний активний адміністратор не знімає з себе роль admin | — | — | відкладено (чекає реалізації) |
| AC-ORG-18 | єдиний активний адміністратор не деактивує себе | — | — | відкладено (чекає реалізації) |
| AC-ORG-12 | деактивований працівник не може увійти | — | — | відкладено (чекає реалізації) |
| AC-ORG-13 | видалення чернетки деактивованого не зачіпає поданих заявок | — | — | відкладено (чекає реалізації) |
| AC-ORG-16 | деактивованого немає у виборі схвалювача й особи «від імені» | — | — | відкладено (чекає реалізації) |
| AC-ORG-21 | за двох активних адміністраторів можна зняти роль із себе | — | — | відкладено (чекає реалізації) |
