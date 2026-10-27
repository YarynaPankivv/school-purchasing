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
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/(app)/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-10-26

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-ORG-01 | працівник без ролі `admin` подає заявки лише від імені своїх відділів, інших у виборі немає | `src/app/(app)/requests/new/actions.ts` (createDraftRequest; RLS requests_insert) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-02 | призначення схвалювачем не-заявника відхилено з повідомленням | `src/app/(app)/admin/departments/actions.ts` (addApprover; FK department_approvers_member_fkey) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-03 | зняття заявника відділу знімає його зі схвалювачів цього відділу | `src/app/(app)/admin/departments/actions.ts` (removeMember; каскад FK) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-15 | зняття заявника відділу вимикає його автосхвалення в цьому відділі | `supabase/migrations/20261018182200_org_departments.sql` (department_members.auto_approve) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-05 | призначення схвалювачем змінює роль не-admin на approver | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-04 | зняття з єдиного відділу схвалення повертає роль requester | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-11 | адміністратор без відділів лишається admin | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-06 | автосхвалення діє лише у відділі, де його ввімкнено | `src/app/(app)/admin/departments/actions.ts` (setAutoApprove) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-14 | відділ без активного схвалювача позначено «Немає схвалювача» | `src/lib/org/departments.ts` (departmentHasActiveApprover) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-19 | схвалювач двох відділів після зняття з одного лишається approver | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-20 | адміністратор, призначений схвалювачем, лишається admin | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-22 | адміністратор без відділів обирає будь-який відділ | `supabase/migrations/20261020182013_org_admin_any_department.sql` (requests_insert); `src/lib/org/departments.ts` (selectableDepartments) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-24 | зняття заявника, що схвалював лише цей відділ, дає роль requester | `supabase/migrations/20261018182200_org_departments.sql` (private.sync_role; каскад FK) | `tests/org/departments.test.ts` | реалізовано |
| AC-ORG-17 | з дозволом «Витрата карткою» вона серед дозволених типів працівника (профіль) | `src/app/(app)/admin/users/actions.ts` (setPermissions; allowedRequestTypes) | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-23 | адміністратор без дозволу обирає «Самостійну закупівлю» | `src/lib/org/request-options.ts` (allowedPurchaseTypes; private.can_create_request) | `tests/org/permissions.test.ts` | реалізовано |
| AC-ORG-09 | без ролі admin немає доступу до працівників і відділів, «Недостатньо прав» | `src/lib/auth/session.ts` (requireAdmin); `src/components/ui/ui.tsx` (Forbidden); `src/app/(app)/admin/users/actions.ts` | `tests/org/users.test.ts` | реалізовано |
| AC-ORG-10 | єдиний активний адміністратор не знімає з себе роль admin | `src/app/(app)/admin/users/actions.ts` (setAdminRole); `supabase/migrations/20261021120000_org_users.sql` (admin_set_role; private.guard_profile_update) | `tests/org/users.test.ts` | реалізовано |
| AC-ORG-18 | єдиний активний адміністратор не деактивує себе | `src/app/(app)/admin/users/actions.ts` (setActive); `supabase/migrations/20261021120000_org_users.sql` (private.guard_profile_update) | `tests/org/users.test.ts` | реалізовано |
| AC-ORG-12 | деактивований працівник не може увійти | `src/app/login/actions.ts` (login); `src/lib/auth/session.ts` (requireActiveUser); `src/app/(app)/admin/users/actions.ts` (setActive) | `tests/org/users.test.ts` | відкладено (PM 2026-10-22 вимагає повідомлення «Обліковий запис деактивовано. Зверніться до адміністратора» при вході; реалізація свідомо показує «invalid», ValiaBihun/2026-quitcode-dream-team#39) |
| AC-ORG-13 | видалення чернетки деактивованого не зачіпає поданих заявок | `src/app/(app)/admin/users/actions.ts` (deleteDraft); `supabase/migrations/20261021120000_org_users.sql` (requests_delete_draft_admin) | `tests/org/users.test.ts` | реалізовано |
| AC-ORG-16 | деактивованого немає у виборі схвалювача | `src/lib/org/departments.ts` (approverCandidates, onBehalfCandidates); `supabase/migrations/20261021120000_org_users.sql` (private.can_act_on_behalf, profiles_select_colleagues) | `tests/org/users.test.ts` | реалізовано |
| AC-ORG-21 | за двох активних адміністраторів можна зняти роль із себе | `src/app/(app)/admin/users/actions.ts` (setAdminRole); `supabase/migrations/20261021120000_org_users.sql` (private.guard_profile_update) | `tests/org/users.test.ts` | реалізовано |
| AC-PUR-01 | нова закупівля — «Чернетка», номер `PUR-N` без провідних нулів, один порожній рядок | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-02 | одночасне створення двох закупівель дає різні номери | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/new/actions.ts` (createDraftRequest); `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/numbering.test.ts` | реалізовано |
| AC-PUR-04 | автор обирає лише свої відділи, адміністратор — усі | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/lines.test.ts` | реалізовано |
| AC-PUR-06 | сума рядка — ціна × кількість, сума заявки — сума рядків | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/lines.test.ts` | реалізовано |
| AC-PUR-07 | кількість 0, неціла кількість чи від'ємна ціна не приймаються, повідомлення з назвою поля | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/lines.test.ts` | реалізовано |
| AC-PUR-08 | невідома ціна — лише 0, рядок приймається | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/lines.test.ts` | реалізовано |
| AC-PUR-10 | назва рядка понад 500 чи нотатка понад 2000 символів не приймаються | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/lines.test.ts` | реалізовано |
| AC-PUR-13 | колеги «від імені» — лише з відділу заявки, без автора й адміністраторів; адміністратор — будь-хто | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/submission.test.ts` | реалізовано |
| AC-PUR-34 | файли PDF, JPG, PNG, HEIC до 20 МБ; інші відхилено з причиною | — | — | відкладено (файли: Supabase Storage не вміщується в дедлайн зрізу 21.10, impl-pur design.md D8) |
| AC-PUR-30 | скасована чернетка видаляється з рядками й файлами, номер не повторюється | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-32 | копія — нова чернетка з усіма рядками без відхилень, без типу, дати й файлів | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-05 | чернетку без відділу не подано, «Оберіть відділ» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts`; `tests/pur/submission.test.ts` | реалізовано |
| AC-PUR-09 | незаповнені рядки й поля названо, заявку не подано | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts`; `tests/pur/submission.test.ts` | реалізовано |
| AC-PUR-11 | колега «від імені» бачить заявку, але не схвалює | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-12 | «від імені» без колеги не подано, «Оберіть, за кого подаєте заявку» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts`; `tests/pur/submission.test.ts` | реалізовано |
| AC-PUR-14 | подана заявка без автосхвалення — «Очікує схвалення» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-37 | після подання в історії запис «Подано» з автором і часом | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/submission.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-38 | відділ поданої заявки не змінюється | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-16 | автосхвалення — одразу «Схвалено», схвалювач в історії — автор | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-33 | відділ без схвалювачів — «Чекають рішення» з позначкою «Немає схвалювача» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-47 | єдиний схвалювач без автосхвалення подає власну — «Чекають рішення», вирішує відділ закупівель | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts` | реалізовано |
| AC-PUR-48 | подано від імені єдиного схвалювача — «Чекають рішення», вирішує відділ закупівель | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts` | реалізовано |
| AC-PUR-53 | автор з автосхваленням, єдиний схвалювач відділу — одразу «Схвалено», не в «Чекають рішення» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts` | реалізовано |
| AC-PUR-54 | єдиний активний адміністратор — автор: заявка в «Чекають рішення», дій рішення він не бачить | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-23 | повернену заявку після правок знову подано — «Очікує схвалення» того ж відділу | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-45 | повернену заявку не подає не автор | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-29 | автор скасовує заявку — «Скасовано», зникає з черги відділу закупівель | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-31 | заявку «Відхилено», «В обробці» чи «Оброблено» не скасувати | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-PUR-15 | схвалювач бачить у списку заявки лише свого відділу з позначкою | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-17 | схвалення без відхилених рядків — «Схвалено» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-39 | після схвалення в історії запис «Схвалено» з ім'ям і часом | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-40 | після схвалення автор бачить позначку «Заявку схвалено» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-18 | схвалення з відхиленим рядком — «Частково схвалено» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-41 | автор бачить, який рядок відхилено | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-42 | до відділу закупівель ідуть лише схвалені рядки | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-19 | усі рядки відхилено — схвалити не можна, підказка відхилити повністю | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-20 | відхилення без причини не виконано, «Вкажіть причину» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-51 | повернення на доопрацювання без причини не виконано, «Вкажіть причину» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-52 | відхилення схваленої заявки відділом закупівель без причини не виконано | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-21 | відхилення з причиною — «Відхилено» | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-43 | автор бачить причину відхилення | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decision-rules.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-44 | відхилену заявку не редагувати | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-22 | повернення на доопрацювання — автор бачить причину й редагує | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-24 | автор і особа «від імені» не бачать дій рішення | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-25 | з двох одночасних рішень застосовано перше | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-26 | відкрита автором на редагування заявка не схвалюється до збереження чи скасування | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts`; `tests/pur/drafts-actions.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-27 | відхилену заявку на схвалення повертає лише відділ закупівель | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-36 | повернену на доопрацювання відділ закупівель повертає на схвалення | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-28 | відділ закупівель відхиляє схвалену закупівлю з причиною | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-50 | закупівлю «В обробці» не відхилити | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/decisions-actions.test.ts` | реалізовано |
| AC-PUR-03 | чужу чернетку не бачить ніхто, крім автора, особи «від імені» й адміністратора | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-49 | заявник не бачить чужої поданої заявки свого відділу | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/visibility.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-PUR-35 | схвалювач не бачить закупівель іншого відділу | `supabase/migrations/20261021140000_pur_drafts.sql`; `src/app/(app)/requests/[id]/actions.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/pur/visibility.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-ORD-01 | у черзі «Очікують обробки» лише «Схвалено», «Частково схвалено», «В обробці» поза архівом | — | — | відкладено (чекає реалізації) |
| AC-ORD-27 | без ролі admin немає доступу до черги обробки, «Недостатньо прав» | — | — | відкладено (чекає реалізації) |
| AC-ORD-28 | архівна закупівля зникає з черги й лічильників, лишається в пошуку | — | — | відкладено (чекає реалізації) |
| AC-ORD-02 | вибір постачальника — рядок «Готовий до замовлення», зняття — знову «Схвалено» | — | — | відкладено (чекає реалізації) |
| AC-ORD-03 | постачальника відхиленого чи замовленого рядка не змінити | — | — | відкладено (чекає реалізації) |
| AC-ORD-04 | без готових рядків замовлення не створено, «Оберіть постачальника хоча б для одного рядка» | — | — | відкладено (чекає реалізації) |
| AC-ORD-05 | по замовленню на кожного постачальника готових рядків | — | — | відкладено (чекає реалізації) |
| AC-ORD-29 | рядки створених замовлень мають статус «Замовлено» | — | — | відкладено (чекає реалізації) |
| AC-ORD-30 | після створення замовлень закупівля «В обробці» | — | — | відкладено (чекає реалізації) |
| AC-ORD-08 | повторне створення — лише для нових готових рядків, наявні замовлення без змін | — | — | відкладено (чекає реалізації) |
| AC-ORD-36 | постачальник з назвою, що збігається без урахування регістру, не додається | — | — | відкладено (чекає реалізації) |
| AC-ORD-06 | номери замовлень п'ятизначні, різні, послідовні, більші за 10000 | — | — | відкладено (чекає реалізації) |
| AC-ORD-34 | перше замовлення в системі — 10001 | — | — | відкладено (чекає реалізації) |
| AC-ORD-07 | одночасне створення не дає однакових номерів | — | — | відкладено (чекає реалізації) |
| AC-ORD-31 | після видалення не найбільшого номера наступний — найбільший + 1 | — | — | відкладено (чекає реалізації) |
| AC-ORD-33 | після видалення найбільшого номера він видається знову | — | — | відкладено (чекає реалізації) |
| AC-ORD-09 | кількість і ціна рядка замовлення — зі схваленої оцінки, сума — добуток | — | — | відкладено (чекає реалізації) |
| AC-ORD-10 | фактична ціна змінює суму рядка замовлення, рядок закупівлі без змін | — | — | відкладено (чекає реалізації) |
| AC-ORD-11 | рядок лише для замовлення відсутній у закупівлі | — | — | відкладено (чекає реалізації) |
| AC-ORD-12 | прибраний із замовлення рядок — знову «Готовий до замовлення» з тим самим постачальником | — | — | відкладено (чекає реалізації) |
| AC-ORD-23 | повністю видалене замовлення зникає з платформи | — | — | відкладено (чекає реалізації) |
| AC-ORD-32 | рядки видаленого замовлення — знову «Готовий до замовлення» | — | — | відкладено (чекає реалізації) |
| AC-ORD-37 | рядок замовлення: кількість 0, неціла чи від'ємна ціна не приймаються | — | — | відкладено (чекає реалізації) |
| AC-ORD-38 | рядок замовлення: ціна 0 з цілою кількістю від 1 приймається | — | — | відкладено (чекає реалізації) |
| AC-ORD-39 | після видалення останнього замовлення закупівля лишається «В обробці» | — | — | відкладено (чекає реалізації) |
| AC-ORD-13 | без рахунку чи класу в рядку замовлення не відправлено, рядки названо | — | — | відкладено (чекає реалізації) |
| AC-ORD-14 | «Підсумок» без файлу не відправити | — | — | відкладено (чекає реалізації) |
| AC-ORD-15 | «Підсумок» — один рядок на суму в бухгалтерську систему | — | — | відкладено (чекає реалізації) |
| AC-ORD-35 | «Детально» — по рядку в бухгалтерську систему на кожен рядок замовлення | — | — | відкладено (чекає реалізації) |
| AC-ORD-17 | під час відправки замовлення «В обробці», не змінити й не відправити вдруге | — | — | відкладено (чекає реалізації) |
| AC-ORD-18 | успішна відправка — «Відправлено», номер документа й посилання | — | — | відкладено (чекає реалізації) |
| AC-ORD-19 | помилка відправки — знову «Створено», причина простими словами | — | — | відкладено (чекає реалізації) |
| AC-ORD-20 | незавершена відправка лишає закупівлю «В обробці» | — | — | відкладено (чекає реалізації) |
| AC-ORD-21 | усе замовлено й відправлено — закупівля «Оброблено» | — | — | відкладено (чекає реалізації) |
| AC-ORD-22 | видалене з бухгалтерської системи замовлення — «Створено» з тим самим номером | — | — | відкладено (чекає реалізації) |
| AC-ORD-24 | автор «Самостійної закупівлі» бачить номер, постачальника, статус і суму замовлень | — | — | відкладено (чекає реалізації) |
| AC-ORD-25 | автор закупівлі «Відділ закупівель» не бачить замовлень | — | — | відкладено (чекає реалізації) |
| AC-ORD-26 | друк відправленого замовлення вміщується на A4 чи Letter | — | — | відкладено (чекає реалізації) |
| AC-FRM-01 | у виборі відділу працівника без `admin` лише відділи, де він заявник | `src/app/(app)/requests/new/page.tsx`; `src/lib/org/departments.ts` (selectableDepartments) | `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-FRM-02 | подання у відділ без права напряму не подає закупівлі, нової заявки «Очікує схвалення» немає | `supabase/migrations/20261021140000_pur_drafts.sql` (requests_insert, requests_update_author) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-FRM-03 | без дозволу «Самостійна закупівля» у виборі типу лише «Відділ закупівель» | `src/app/(app)/requests/new/page.tsx`; `src/lib/org/request-options.ts` (allowedPurchaseTypes) | `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-FRM-04 | подання «Самостійної закупівлі» без дозволу напряму не подає закупівлі, нової заявки «Очікує схвалення» немає | `supabase/migrations/20261018200633_org_permissions.sql` (can_create_request); `supabase/migrations/20261021140000_pur_drafts.sql` (guard_request_update); `supabase/migrations/20261027140119_submit_recheck_purchase_type.sql` (submit_purchase: дозвіл під час подання) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-FRM-05 | працівник без відділів бачить пояснення замість полів форми | `src/app/(app)/requests/new/page.tsx` | `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-FRM-06 | подання без рядків відхилено, відділ і тип лишаються у формі, закупівлю не подано | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, pur_check_lines_complete) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-FRM-07 | подана закупівля з одним рядком має статус «Очікує схвалення» | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-FRM-08 | заявник того ж відділу не бачить чужої поданої закупівлі, «Недостатньо прав» | `supabase/migrations/20261021140000_pur_drafts.sql` (requests_select, can_view_request); `src/app/(app)/requests/[id]/page.tsx` (Forbidden) | `tests/db/frm-apr.test.ts`; `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-FRM-09 | гість за прямим посиланням на форму бачить сторінку входу | `src/lib/auth/session.ts` (requireActiveUser); `supabase/migrations/20261012000000_profiles_and_roles.sql` (revoke від anon); `src/lib/supabase/proxy.ts` (isPublicPath) | `tests/ui/frm-apr-pages.test.tsx`; `tests/db/frm-apr.test.ts` | реалізовано |
| AC-APR-01 | у списку для рішення лише подані заявки відділів схвалювача | `supabase/migrations/20261021140000_pur_drafts.sql` (requests_select, is_department_approver); `src/lib/pur/decisions.ts` (decisionQueue: без власних заявок) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-APR-02 | схвалення заявки свого відділу ставить статус «Схвалено» | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-APR-03 | заявка чужого відділу за прямим посиланням — «Недостатньо прав», статус без змін | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests); `src/app/(app)/requests/[id]/page.tsx` (Forbidden) | `tests/db/frm-apr.test.ts`; `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-APR-04 | заявник не відкриває списку для рішення, «Недостатньо прав» | `src/app/(app)/requests/(list)/page.tsx`; `supabase/migrations/20261021140000_pur_drafts.sql` (decide_purchase) | `tests/ui/frm-apr-pages.test.tsx`; `tests/db/frm-apr.test.ts` | реалізовано |
| AC-APR-05 | автор-схвалювач не схвалює власної заявки напряму | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-APR-06 | відхилення без причини — «Вкажіть причину», статус без змін | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests); `src/lib/pur/errors.ts` (reason_required) | `tests/db/frm-apr.test.ts`; `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-LANG-01 | усі написи інтерфейсу англійською за таблицею PM | `src/lib/org/requests.ts`; `src/lib/org/errors.ts`; `src/lib/pur/errors.ts`; `src/lib/pur/statuses.ts`; `src/lib/org/roles.ts` | `tests/ui/interface-language.test.ts` | реалізовано |
| AC-LANG-02 | сторінка входу й помилка входу англійською | `src/app/login/page.tsx` | `tests/ui/interface-language.test.ts` | реалізовано |
| AC-LANG-03 | «Not enough permissions» замість «Недостатньо прав» (чужий відділ, налаштування) | `src/lib/org/errors.ts`; `src/lib/pur/errors.ts`; `src/components/ui/ui.tsx` (Forbidden) | `tests/ui/interface-language.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-LANG-04 | «Add at least one line» замість «Додайте хоча б один рядок» | `src/lib/pur/errors.ts` | `tests/ui/interface-language.test.ts` | реалізовано |
| AC-LANG-05 | відхилення без причини — «Provide a reason» замість «Вкажіть причину» | `src/lib/pur/errors.ts` | `tests/ui/interface-language.test.ts` | реалізовано |
| AC-LANG-06 | статус заявки підписано англійським текстом, не лише кольором | `src/lib/pur/statuses.ts`; `src/app/(app)/requests/_components/status-badge.tsx` | `tests/ui/interface-language.test.ts`; `tests/pur/pages.test.tsx` | реалізовано |
| AC-LANG-08 | ідентифікатори ролей без змін, підпис ролі англійською | `src/lib/org/roles.ts` | `tests/ui/interface-language.test.ts` | реалізовано |
| AC-FRM-10 | сторінка «Мої заявки» показує власні заявки зі статусами, чужих немає | `src/app/(app)/requests/(list)/page.tsx`; `src/app/(app)/requests/_lib/overview.ts` (mine) | `tests/pur/pages.test.tsx` | реалізовано |
| AC-FRM-11 | після подання — сторінка «Мої заявки» з повідомленням «Закупівлю подано» | `src/app/(app)/requests/[id]/actions.ts` (submitPurchase); `src/app/(app)/requests/(list)/page.tsx` | `tests/ui/frm-apr-pages.test.tsx`; `tests/pur/drafts-actions.test.ts` | реалізовано |
| AC-FRM-12 | відділ без активного схвалювача не блокує подання, статус «Очікує схвалення» | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-FRM-13 | закупівля єдиного схвалювача-автора чекає іншого схвалювача | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests) | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-FRM-14 | порожня сторінка «Мої заявки»: «Ви ще не подали жодної заявки» | `src/app/(app)/requests/(list)/page.tsx` | `tests/pur/pages.test.tsx` | реалізовано |
| AC-FRM-15 | рядок лише з назвою не подається, «Заповніть усі поля рядка» | `supabase/migrations/20261021140000_pur_drafts.sql` (pur_check_lines_complete); `src/lib/pur/errors.ts` | `tests/db/frm-apr.test.ts` | реалізовано |
| AC-APR-07 | відхилення з причиною: статус «Відхилено», причину збережено й показано | `supabase/migrations/20261021140000_pur_drafts.sql` (submit_purchase, decide_purchase, політики requests) | `tests/db/frm-apr.test.ts`; `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-APR-08 | схвалювач бачить автора заявки за іменем у списку для рішення й на сторінці заявки | `src/app/(app)/requests/_lib/overview.ts`; `src/app/(app)/requests/[id]/page.tsx`; `src/lib/org/departments.ts` (personLabel); `src/app/(app)/requests/_components/request-table.tsx` (автор підрядком на телефоні) | `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-APR-09 | без імені в профілі автора вказано його email | `src/lib/org/departments.ts` (personLabel); `src/app/(app)/requests/_lib/overview.ts` | `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-APR-10 | ролі, відділів і дозволів автора схвалювач не бачить | `src/app/(app)/requests/_lib/overview.ts`; `src/app/(app)/requests/[id]/page.tsx` | `tests/ui/frm-apr-pages.test.tsx` | реалізовано |
| AC-ORG-25 | адміністратор без дозволу має «Витрату карткою» серед дозволених типів у профілі | — | — | відкладено (чекає реалізації) |
| AC-ORG-26 | працівник без дозволу не має «Витрати карткою» серед дозволених типів у профілі | — | — | відкладено (чекає реалізації) |
| AC-ORG-27 | без дозволу «Самостійна закупівля» серед дозволених типів закупівлі лише «Відділ закупівель» | — | — | відкладено (чекає реалізації) |
| AC-ORG-28 | деактивованого немає у виборі особи «від імені» | — | — | відкладено (чекає реалізації) |
| AC-ORG-29 | адміністратор із відділом обирає будь-який відділ, зокрема чужий | — | — | відкладено (чекає реалізації) |
| AC-ORG-30 | повторно активований схвалювач лишається схвалювачем з роллю approver | — | — | відкладено (чекає реалізації) |
| AC-ORG-31 | зняття ролі admin іншим адміністратором: без схвалення відділів — requester | — | — | відкладено (чекає реалізації) |
| AC-ORG-32 | зняття ролі admin іншим адміністратором: схвалює відділ — approver | — | — | відкладено (чекає реалізації) |
| AC-ORG-33 | автосхвалення не вмикається не-заявнику відділу, повідомлення про додавання заявником | — | — | відкладено (чекає реалізації) |
| AC-ORG-34 | дубль назви відділу без урахування регістру відхилено, «Відділ з такою назвою вже є» | — | — | відкладено (чекає реалізації) |
