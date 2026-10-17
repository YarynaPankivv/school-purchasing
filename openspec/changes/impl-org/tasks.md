# Tasks

Кожна група — окремий PR «Реалізація» (`task/<коротко>`) з однією міграцією; галочки ставимо в PR задачі, рядки
`docs/conformance.md` її AC — у тому самому PR. Рішення й тимчасові відповіді на Q1–Q6 — `design.md` (D1–D10).

## 1. Відділи, заявники, схвалювачі, автосхвалення й похідна роль (`task/org-departments`)

- [ ] 1.1 Міграція `org_departments`: набір ролей `requester`/`approver`/`admin` у порядку D1; `profiles.is_active`;
  таблиці `departments`, `department_members` (з `auto_approve`), `department_approvers` (складений FK з каскадом),
  мінімальна `requests` (без `on_behalf_of_id`); хелпери `private.is_member()`, `private.is_active_user()`,
  `private.sync_role()` + тригер на `department_approvers`; RLS, `revoke all`, явні `grant`, політика на кожну операцію
  `to authenticated` з `(select auth.uid())` (D2, D3, D5, D7). Перевірка: `node scripts/check-migration-order.mjs` і
  зелений `db-check`
- [ ] 1.2 `supabase/demo-users.json`: `member` → `requester`; `supabase/seed.sql`: відділи «Початкова школа», «Вища
  школа», «Офіс» (`on conflict do nothing`). Перевірка: `db-check` (сид на одноразовій базі)
- [ ] 1.3 Оновити `src/lib/supabase/database.types.ts` (Summary `db-check` або `npm run db:types`). Перевірка:
  `npm run typecheck`
- [ ] 1.4 `src/lib/org/roles.ts` (`deriveRole`), `src/lib/org/departments.ts` (`selectableDepartments`,
  `departmentHasActiveApprover`, `approverCandidates`), `src/lib/org/errors.ts` (`mapOrgDbError` для `23503`).
  Перевірка: тести 1.7
- [ ] 1.5 `src/lib/auth/session.ts` (`requireActiveUser`, `requireAdmin` з «Недостатньо прав»);
  `src/app/admin/departments/actions.ts` (`createDepartment`, `addMember`, `removeMember`, `setAutoApprove`,
  `addApprover`, `removeApprover`). Перевірка: тести 1.7
- [ ] 1.6 Сторінки `/admin/departments` (список, «Немає схвалювача»), `/admin/departments/[id]`, `/requests/new`
  (вибір лише своїх відділів, типи «Закупівля» й «Відшкодування»), `/profile` (лише читання). Перевірка: `npm run build`
  і ручний прохід на Preview з `admin@example.test` і `member1@example.test` (кроки — в описі PR)
- [ ] 1.7 `tests/org/departments.test.ts`: `it("AC-ORG-01: …")`, 02, 03, 04, 05, 06, 11, 14, 15 — чисті функції й
  actions із `vi.mock("@/lib/supabase/server")`, зокрема тимчасові Q3, Q4, Q6 (D10). Перевірка: `npm test`
- [ ] 1.8 `docs/decisions/0001-org-model.md` (D2–D6) і рядки AC задачі в `docs/conformance.md` → «реалізовано».
  Перевірка: `npm run ac:coverage`

Done when: AC-ORG-01, AC-ORG-02, AC-ORG-03, AC-ORG-04, AC-ORG-05, AC-ORG-06, AC-ORG-11, AC-ORG-14, AC-ORG-15

## 2. Дозволи на типи заявок і тип закупівлі (`task/org-permissions`)

- [ ] 2.1 Міграція `org_permissions`: `user_permissions` (D4) з RLS і grant; заміна політики `requests_insert` —
  відхилення `CRE`/`RFC`/`INV` без дозволу для не-`admin` і `purchase_type = 'self'` без `self_purchase` (D5, тимчасово
  Q5). Перевірка: зелений `db-check`
- [ ] 2.2 `src/lib/org/request-options.ts` (`allowedRequestTypes`, `allowedPurchaseTypes`); дозволи в
  `src/app/admin/users/actions.ts` (`setPermissions`) і `/admin/users/[id]`; у `/requests/new` — типи й тип закупівлі
  за дозволами, `createDraftRequest` перетворює відмову RLS на помилку. Перевірка: тести 2.3 і `npm run build`
- [ ] 2.3 `tests/org/permissions.test.ts`: `it("AC-ORG-07: …")`, 08, 17, зокрема тимчасове Q5 (D10). Перевірка:
  `npm test`
- [ ] 2.4 Рядки AC задачі в `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-ORG-07, AC-ORG-08, AC-ORG-17

## 3. Доступ лише для admin, захист єдиного адміністратора, деактивація й чернетки (`task/org-users`)

- [ ] 3.1 Міграція `org_users`: `grant update (full_name, role, is_active)`, політика `profiles_update_admin`, тригер
  `private.guard_profile_update()` (не-`admin` не змінює `role`/`is_active`; «Має лишитись хоча б один активний
  адміністратор»; похідна роль після зняття `admin`), `profiles_select_colleagues`, `requests.on_behalf_of_id` з
  перевіркою в `requests_insert`, `requests_delete` лише для чернеток (D5, D6, D7, тимчасово Q1, Q2). Перевірка:
  зелений `db-check`
- [ ] 3.2 `login()` і `requireActiveUser()` виходять для деактивованого; `src/app/admin/users/actions.ts`
  (`setAdminRole`, `setActive`, `deleteDraft`); `onBehalfCandidates()` і вибір особи «від імені» в `/requests/new`;
  `/admin/users` і `/admin/users/[id]` (роль, активність, чернетки); `mapOrgDbError` для винятку тригера.
  Перевірка: тести 3.3 і `npm run build`
- [ ] 3.3 `tests/org/users.test.ts`: `it("AC-ORG-09: …")`, 10, 12, 13, 16, 18, зокрема тимчасові Q1, Q2 (D10).
  Перевірка: `npm test`
- [ ] 3.4 Рядки AC задачі в `docs/conformance.md` → «реалізовано»; ручний прохід на Preview (деактивація, останній
  адміністратор) — у PR. Перевірка: `npm run ac:coverage`

Done when: AC-ORG-09, AC-ORG-10, AC-ORG-12, AC-ORG-13, AC-ORG-16, AC-ORG-18

## Workflow follow-up

- В останньому PR зрізу (задача 3): `npx openspec archive impl-org -y`, запис екрана з прод-URL.
- Після відповідей PM на Q1–Q6: `/requirements-sync` → нова зміна специфікації → правка тимчасових рішень D10.
