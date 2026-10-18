# Design

## Context

Мотивація — у `proposal.md`, поведінка — в `openspec/specs/{departments,request-permissions,user-administration}`.

Поточний стан репо:

- одна міграція `20261012000000_profiles_and_roles.sql`: `public.profiles` (ролі шаблону `member`/`admin`), хелпер
  `private.current_app_role()`, тригер `on_auth_user_created`; колонковий `grant update (full_name)`;
- `src/proxy.ts` оновлює сесію й пускає без входу лише `/login`; вхід — `src/app/login/actions.ts`
  (`signInWithPassword`); авторизація на сервері — `supabase.auth.getClaims()`;
- користувачів створює `npm run users:demo` (Admin API із `SUPABASE_SECRET_KEY`, лише локально); у Vercel секретного
  ключа немає й не буде (AGENTS.md → «Секрети»);
- CI: job `app` запускає Vitest **без бази**; `db-check` лише застосовує міграції й сид на одноразовій базі.

Обмеження з AGENTS.md: схема — лише міграцією в PR; на кожній таблиці RLS, `revoke all` від `anon, authenticated`,
явні `grant`, окрема політика на кожну операцію `to authenticated` з `(select auth.uid())`; хелпери — `private`,
`security definer`, `set search_path = ''`; кілька записів чи перевірка + запис — одна функція Postgres; без нових
залежностей.

## Goals / Non-Goals

**Goals:**

- база сама тримає правила зрізу (RLS, FK, тригери), а UI лише не показує недоступних варіантів;
- кожне правило має чисту TS-функцію, яку викликає сторінка чи server action і перевіряє Vitest-тест з AC ID;
- мінімальна таблиця заявок, без якої не перевірити AC-ORG-01, 07, 08, 13, 16, 17 (вибір відділу, типу, особи
  «від імені», чернетки й подані заявки).

**Non-Goals:**

- створення користувачів і запрошення в застосунку: у «Поза межами» PM — вхід і видача запрошень; Admin API потребує
  секретного ключа, якого у Vercel немає. Користувачів створює `npm run users:demo` (`supabase/demo-users.json`);
- рядки заявки, суми, номери `PUR-…`, подання на схвалення, схвалення, видимість заявок відділу для схвалювача —
  зріз WS7; таблицю `requests` він розширить новою міграцією;
- перейменування й видалення відділів, імпорт, історія змін налаштувань (Non-goals специфікації).

## Decisions

### D1. Набір ролей — міграцією, у порядку з AGENTS.md (AC-ORG-04, 05, 11)

У міграції задачі 1: `drop constraint profiles_role_check` → `update profiles set role = 'requester' where role =
'member'` → `alter column role set default 'requester'` → `add constraint profiles_role_check check (role in
('requester', 'approver', 'admin'))`. У `supabase/demo-users.json` `member` → `requester` у тому самому PR, інакше
`users:demo` упаде. Альтернатива — лишити `member` і перейменувати лише в UI — ні: ідентифікатори ролей задав PM.

### D2. Модель відділів (AC-ORG-01, 02, 03, 06, 14, 15)

- `public.departments(id uuid pk, name text not null check (char_length(name) between 1 and 100), created_at)` +
  унікальний індекс `lower(name)` — з «Припущень» PM (до 100 символів, унікальна без регістру).
- `public.department_members(department_id, user_id, auto_approve boolean not null default false,
  pk (department_id, user_id))` — заявник відділу. Автосхвалення — колонка членства, тож воно діє лише для свого
  відділу (AC-ORG-06) і зникає разом із членством (AC-ORG-15).
- `public.department_approvers(department_id, user_id, pk (department_id, user_id), foreign key (department_id,
  user_id) references department_members on delete cascade)` — складений FK: схвалювачем може бути лише заявник
  відділу (AC-ORG-02, база відхиляє з кодом `23503`), а зняття заявника каскадно знімає схвалювача (AC-ORG-03).
- Альтернатива — одна таблиця членства з прапорцем `is_approver` — ні: правило «схвалювач ⇒ заявник» тоді тримає лише
  CHECK у рядку, а каскад AC-ORG-03 — тригер; складений FK простіший і перевіряється базою.

### D3. Похідна роль — тригер на `department_approvers` (AC-ORG-04, 05, 11; Q3, Q4, Q6)

`private.sync_role(uid)` (`security definer`): якщо `role <> 'admin'`, ставить `approver`, коли людина схвалює хоча б
один відділ, інакше `requester`. Викликає тригер `after insert or delete on department_approvers for each row` — зокрема
й на каскадне видалення з D2. Роль `admin` функція не чіпає (AC-ORG-11). TS-дзеркало — `deriveRole()` у
`src/lib/org/roles.ts` (для тестів і підказок в UI). Альтернатива — обчислювати роль у server action — ні: каскад
AC-ORG-03 відбувається в базі, і роль розійшлася б із даними.

### D4. Дозволи — окрема таблиця (AC-ORG-07, 08, 17)

`public.user_permissions(user_id pk references profiles on delete cascade, card_expense, check_request,
vendor_invoice, self_purchase boolean not null default false)`. Окрема таблиця, а не колонки `profiles`: на `profiles`
уже є політика «оновлюю свій рядок», і колонковий `grant update` дав би користувачу змінити собі дозвіл. Політики:
`select` — свій рядок або `admin`; `insert`/`update`/`delete` — лише `admin`.

### D5. Мінімальна таблиця заявок і серверне відхилення типу без дозволу (AC-ORG-01, 07, 08, 13, 16, 17)

`public.requests(id uuid pk, type text check (type in ('PUR','RMB','CRE','RFC','INV')), purchase_type text null check
(purchase_type in ('procurement','self')), department_id, author_id, on_behalf_of_id null, status text check (status in
('draft','submitted')) default 'draft', created_at)` + CHECK `(type = 'PUR') = (purchase_type is not null)`:
`purchase_type` обов'язковий для `PUR` і порожній для інших типів (CHECK `in (…)` сам `NULL` пропускає, а виправити
чернетку автор не зможе — `update` немає).

Політика `requests_insert` (`to authenticated`, `with check`) відхиляє на сервері все, що UI не показує:

- `author_id = (select auth.uid())`, `status = 'draft'`, автор активний;
- автор — заявник `department_id` (`private.is_member(department_id)`) — AC-ORG-01; це діє й для `admin` (тимчасово, Q1);
- `type in ('PUR','RMB')` або роль `admin` (матриця прав), або відповідний прапорець `user_permissions` для
  `CRE`/`RFC`/`INV` — AC-ORG-07, AC-ORG-17; так виконуємо домовленість із рев'ю CodeRabbit до PR «Специфікація»:
  тип без дозволу база відхиляє, а не лише ховає UI;
- `purchase_type = 'self'` лише з `self_purchase` або для `admin` (тимчасово, Q5) — AC-ORG-08;
- `on_behalf_of_id` — порожньо або активний працівник; для не-`admin` — заявник того самого відділу (матриця прав) —
  AC-ORG-16.

**Поетапно, бо `user_permissions` з'являється лише в задачі 2.** Міграція задачі 1 створює `requests_insert`, що
дозволяє лише `PUR` з `purchase_type = 'procurement'` або `RMB` з порожнім `purchase_type` — для всіх, і для `admin`
теж; `PUR` без `purchase_type`, `CRE`/`RFC`/`INV` і `'self'` база відхиляє, доки міграція задачі 2 не замінить політику повною версією вище. Так між
деплоями задач 1 і 2 немає вікна, коли тип без дозволу можна створити прямим запитом до Data API.

Інші політики (усі з `is_active_user()`, D6): `select` — автор, особа «від імені» або `admin` (усі, включно з
чернетками — матриця прав);
`delete` — лише `admin` і лише `status = 'draft'` (AC-ORG-13: подані заявки не видаляються); `update` — немає (WS7).

### D6. Деактивація й захист єдиного адміністратора (AC-ORG-09, 10, 12, 18; Q2)

- `profiles.is_active boolean not null default true` (у міграції задачі 1, бо AC-ORG-14 рахує лише активних
  схвалювачів); хелпер `private.is_active_user()` (`security definer`). **Кожна** політика нових таблиць і `requests` —
  `select`, `insert`, `update`, `delete`, зокрема гілки `admin` — починається з `(select private.is_active_user()) and
  (…)`: живий JWT деактивованого дає прямий доступ до Data API в обхід `requireActiveUser()`, тож перевіряє база.
- `profiles`: у міграції задачі 1 шаблонну `profiles_select_own_or_admin` замінюємо на `profiles_select_own` (власний
  рядок без перевірки активності — єдиний вузький виняток, щоб `login()` прочитав `is_active`) і
  `profiles_select_admin` (`is_active_user() and current_app_role() = 'admin'`); `profiles_select_colleagues` (D7)
  вимагає активних і читача, і профілю-цілі.
- Вхід (AC-ORG-12): `login()` після `signInWithPassword` читає свій профіль; `is_active = false` → `signOut()` і
  `redirect("/login?error=invalid")` — той самий текст, що й для невірного пароля (PM тексту не задав; не розкриваємо
  стан облікового запису). Те саме робить `requireActiveUser()` у `src/lib/auth/session.ts` для кожної сторінки й
  action. Бан через Admin API — ні: потребує секретного ключа у Vercel.
- Зміна `role`/`is_active` адміністратором: `grant update (full_name, role, is_active)` + політика
  `profiles_update_admin`; тригер `private.guard_profile_update()` (`before update of role, is_active`):
  - для сеансу `authenticated` не-`admin` зміни `role`/`is_active` — виняток (інакше «оновлюю свій рядок» дав би
    підвищити собі роль);
  - якщо після зміни не лишиться жодного активного `admin` — виняток із повідомленням «Має лишитись хоча б один
    активний адміністратор» (AC-ORG-10, AC-ORG-18), з блокуванням рядків інших адміністраторів (`for update`) від гонки
    двох одночасних змін;
  - коли `admin` знімають, нова роль — похідна з D3.
- Сторінки `/admin/**` і їхні actions викликають `requireAdmin()`: не-`admin` бачить «Недостатньо прав» і не отримує
  даних (AC-ORG-09); RLS дублює це на рівні рядків.

### D7. Видимість для форм і списків (AC-ORG-01, 14, 16)

- `departments`/`department_members` — `select` для активного `admin` або активного члена того самого відділу
  (`private.is_member()`, `security definer`, щоб уникнути рекурсії політик 42P17).
- Нова політика `profiles_select_colleagues`: активний працівник бачить профілі лише **активних** колег зі спільного
  відділу (`is_active_user() and is_active and private.shares_department(id)`) — для вибору особи «від імені»; так
  деактивованого колегу не прочитати й прямим запитом до Data API, а не лише не показати фільтром
  `onBehalfCandidates()` (AC-ORG-16).
- Чисті функції в `src/lib/org/`: `selectableDepartments()` (AC-ORG-01), `allowedRequestTypes()` (AC-ORG-07, 17),
  `allowedPurchaseTypes()` (AC-ORG-08), `approverCandidates()` і `onBehalfCandidates()` — лише активні (AC-ORG-16),
  `departmentHasActiveApprover()` (AC-ORG-14), `mapOrgDbError()` — `23503` на `department_approvers` → «Спершу додайте
  працівника до відділу як заявника» (AC-ORG-02), виняток тригера D6 → «Має лишитись хоча б один активний
  адміністратор».

### D8. Сторінки й server actions

| Шлях | Що | AC |
|---|---|---|
| `/admin/departments` | список, створення відділу, позначка «Немає схвалювача» | 09, 14 |
| `/admin/departments/[id]` | заявники (додати / прибрати), автосхвалення, схвалювачі (призначити / зняти) | 01–06, 15, 16 |
| `/admin/users`, `/admin/users/[id]` | роль `admin`, активність, дозволи, чернетки деактивованого | 07, 08, 10, 12, 13, 17, 18 |
| `/requests/new` | чернетка заявки: відділ, тип, тип закупівлі, особа «від імені» | 01, 07, 08, 16, 17 |
| `/profile` | власний профіль лише для читання (відділи, дозволи) — з «Користувачі й ролі» PM, без AC | — |

Actions: `src/app/admin/departments/actions.ts` (`createDepartment`, `addMember`, `removeMember`, `setAutoApprove`,
`addApprover`, `removeApprover`), `src/app/admin/users/actions.ts` (`setAdminRole`, `setActive`, `setPermissions`,
`deleteDraft`), `src/app/requests/new/actions.ts` (`createDraftRequest`). Кожна починає з `getClaims()` через
`requireActiveUser()`/`requireAdmin()`, ніколи `getSession()`. Одне речення SQL на дію — окремі транзакції не
потрібні; там, де дія — перевірка + запис кількох таблиць, правило тримає тригер в одній транзакції з записом.

### D9. Тести

Vitest без бази: `tests/org/*.test.ts`, назви `it("AC-ORG-NN: …")`. Перевіряємо чисті функції D7 і server actions із
`vi.mock("@/lib/supabase/server")` (Vitest уже є — нових залежностей немає): що action надсилає правильний запит і
перетворює помилку бази на текст PM. SQL-правила (FK, тригери, RLS) перевіряє `db-check` (міграції застосовуються) і
ручна перевірка на Preview з демо-користувачами `*@example.test` — опис кроків у PR задачі.

### D10. Тимчасові рішення для відкритих питань PM

Позначено **тимчасово**: до відповіді PM; після неї — нова зміна специфікації і, за потреби, правка міграцією.

| Питання | Тимчасове рішення | Де в дизайні |
|---|---|---|
| Q1 — ValiaBihun/2026-quitcode-dream-team#9 (AC-ORG-11, 01) | **Тимчасово:** адміністратор без відділів заявок не створює | D5 `requests_insert` |
| Q2 — ValiaBihun/2026-quitcode-dream-team#10 (AC-ORG-10) | **Тимчасово:** зняти роль із себе заборонено лише єдиному активному адміністратору | D6 тригер |
| Q3 — ValiaBihun/2026-quitcode-dream-team#11 (AC-ORG-04) | **Тимчасово:** роль лишається `approver`, поки людина схвалює хоча б один відділ | D3 |
| Q4 — ValiaBihun/2026-quitcode-dream-team#12 (AC-ORG-05) | **Тимчасово:** адміністратор, призначений схвалювачем, лишається `admin` | D3 |
| Q5 — ValiaBihun/2026-quitcode-dream-team#13 (AC-ORG-08) | **Тимчасово:** адміністратору дозвіл «Самостійна закупівля» не потрібен | D5 `requests_insert` |
| Q6 — ValiaBihun/2026-quitcode-dream-team#14 (AC-ORG-03) | **Тимчасово:** після зняття заявника, що схвалював лише цей відділ, роль стає `requester` | D3 (каскад D2) |

ADR: модель даних D2–D6 оформлюємо `docs/decisions/0001-org-model.md` у PR задачі 1.

## Risks / Trade-offs

- [RLS і тригери не покриті Vitest — job `app` без бази] → чисті TS-дзеркала правил із тестами AC, `db-check` на
  кожен PR, ручна перевірка на Preview за чеклістом у PR; pgTAP (`supabase test db`) — можливий наступний крок, але це
  зміна `.github/` — лише після погодження.
- [Правило дубльоване в SQL і TS і може розійтися] → TS лише для підказок в UI і тестів; останнє слово — за базою;
  у коментарі біля кожної функції — посилання на політику чи тригер.
- [Деактивований користувач із живим JWT] → `requireActiveUser()` на кожній сторінці/action і `is_active` у політиках
  запису; JWT спливає за годину.
- [Таблиця `requests` випереджає WS7] → мінімальні колонки; WS7 розширює новою міграцією без зміни наявних.
- [Відповіді PM на Q1–Q6 змінять поведінку] → тимчасові рішення зосереджені в D3, D5, D6 — одна міграція на правку.

## Migration Plan

Три міграції — по одній на задачу з `tasks.md`, кожна `npx supabase migration new <назва>` у своєму PR «Реалізація»
(перед кожною — перевірити, чи інша відкрита гілка не змінює схему). Після merge `db-deploy` застосовує її; потім
`npm run users:demo` з оновленим `demo-users.json`. Відкат — лише новою міграцією; застосовані файли не змінюємо.
Сид (`supabase/seed.sql`): три синтетичні відділи «Початкова школа», «Вища школа», «Офіс» з `on conflict do nothing`.
