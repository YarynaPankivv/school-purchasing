# Design

## Context

Поведінка — в `openspec/specs/{purchase-form-access,approver-decision-scope,ui-language}`, мотивація — в `proposal.md`.
Права вже виражено в базі зрізами ORG і PUR: `requests_select`/`requests_insert`/`requests_update_author`,
`private.can_create_request`, `private.is_member`, `private.is_department_approver`, функції `submit_purchase` і
`decide_purchase` (`supabase/migrations/20261018200633_org_permissions.sql`, `20261021140000_pur_drafts.sql`). Ухвалені
рішення — `docs/decisions/0001-org-model.md`, `0002-user-administration.md`.

Обмеження з AGENTS.md: схема — лише міграцією в PR; RLS, `revoke all`, явні (колонкові) `grant`, окрема політика на
кожну операцію; роль — з `profiles.role`, ніколи з `user_metadata`; авторизація на сервері — `getClaims()`; нові залежності
— лише після рішення людини (тут `@electric-sql/pglite`, dev).

## Goals / Non-Goals

**Goals:** кожен відмовний AC зрізу має тест, який перевіряє відмову й незмінність даних і падає без відповідної політики
чи перевірки; дві прогалини закрито; рішення й правило записано (ADR 0003, `check:actions`).

**Non-Goals:** нові таблиці й міграції (схему зріз не змінює); часткове схвалення й інше з `impl-pur`.

## Decisions

### UI і компоненти (AC-FRM-01, 03, 05, 09, 10, 11, 14; AC-APR-04, 08, 09, 10; AC-LANG-01…06, 08)

- `/requests/new` бере відділи й типи закупівлі з даних, які віддала RLS, через `selectableDepartments` і
  `allowedPurchaseTypes`; без відділів — `EmptyState` з поясненням замість форми (AC-FRM-05). Поля й кнопки — компоненти
  `@/components/ui`.
- Після `submitPurchase` — редирект на список `/requests?saved=submitted` і банер «Purchase submitted» на «Мої заявки»
  (AC-FRM-11); раніше автор лишався на сторінці заявки. Порожній список — «You have not submitted any requests yet»
  (AC-FRM-14).
- `/requests?view=decide` для `requester` — компонент `Forbidden` («Not enough permissions»), запитів до даних немає
  (AC-APR-04). Схвалювач і admin бачать список «To decide».
- Автор у списку й на сторінці заявки — `personLabel`: ім'я, інакше email; ролей, дозволів і чужих відділів автора на
  сторінках схвалювача немає (AC-APR-08, 09, 10).
- Порожні стани й помилки — `EmptyState`, `Alert`, `StatusPage`; усі тексти англійською за таблицею PM (AC-LANG).

### Дані й RLS (AC-FRM-02, 04, 06, 07, 08, 12, 13, 15; AC-APR-01, 02, 03, 05, 06, 07)

Нових таблиць немає. Права тримає база, а TS-код лише відображає:

- `requests_insert` і `requests_update_author`: відділ — лише з `private.is_member(department_id)` (для `admin` — будь-який);
  тип «Самостійна закупівля» — `private.can_create_request` (`self_purchase` або `admin`); `guard_request_update`
  відхиляє зміну типу без дозволу (AC-FRM-02, 04). Колонковий `grant insert`/`update` не дає змінити `status`,
  `number`, `decision_reason`.
- `requests_select`, `request_lines_select`, `request_history_select` через `private.can_view_request`: автор, особа «від
  імені», admin або схвалювач відділу (лише не-чернетки); заявник того ж відділу чужого не бачить (AC-FRM-08, APR-01, 03).
- `submit_purchase`: лише автор, відділ обов'язковий, повні рядки (`lines_required`, `lines_incomplete`), відділ без
  схвалювача не блокує подання (AC-FRM-06, 07, 12, 13, 15).
- `decide_purchase`: автор і особа «від імені» не вирішують (`own_request`), вирішує лише схвалювач відділу або admin
  (`forbidden`), відхилення без причини — `reason_required` (AC-APR-02, 03, 05, 06, 07).
- `anon` не має grant на `requests` і функції (AC-FRM-09).
- Альтернатива «перевіряти право лише в Server Action» відхилена: action — публічний POST, а публічний ключ у бандлі
  дозволяє піти прямо в Data API; тому остаточні перевірки — в базі (ADR 0003).

### Auth (AC-FRM-09, AC-APR-03, 04, 05)

- Кожна сторінка зрізу починається з `requireActiveUser()` (`getClaims()`, роль з `profiles`); гість — редирект на
  `/login` (AC-FRM-09). Proxy лише оновлює сесію — це UX, а не захист.
- Кожна Server Action зрізу (`src/app/(app)/requests/**/actions.ts`) викликає `authorRequest`/`requireActiveUser` до
  будь-якого запису; рішення приймає rpc `decide_purchase` з перевіркою ролі всередині.
- Admin-клієнт (`SUPABASE_SECRET_KEY`) зрізу не потрібен: усе виконується від імені користувача з RLS.
- Правило в CI `check:actions`: кожен `actions.ts` викликає `requireActiveUser`/`getClaims` і не викликає `getSession`
  (`architecture.yml`, ADR 0003).

### Тести (AC-FRM, AC-APR)

- `tests/db/frm-apr.test.ts` — міграції й сид у PGlite, запити `asUser`/`asAnon`; кожен відмовний тест перевіряє і відмову,
  і те, що статус та дані не змінилися. Інфраструктура `tests/db/supabase-pglite.ts` — з демо-репо koldovsky (дозволено
  матеріалами WS7), адаптована під власні таблиці.
- `tests/ui/frm-apr-pages.test.tsx`, `tests/pur/drafts-actions.test.ts` — що показує сторінка за даними RLS і куди веде
  подання.
- Мутаційна перевірка: таблиця «AC → що прибрали → який тест упав» в описі PR; червоні прогони CI на комітах `mutation: …`.

## Risks / Trade-offs

- PGlite емулює Auth і PostgREST спрощено (`auth.uid()` з `request.jwt.claim.sub`): тести бази не перевіряють Data API, лише
  політики, grant і функції.
- `Forbidden` свідомо не розкриває вміст заявки (Припущення PM): схвалювач чужого відділу бачить лише «Not enough permissions».

## Migration Plan

Міграцій немає. Порядок: PR «Специфікація» (цей план) → PR «Реалізація» (тести, дві правки коду, галочки) → PR «Реалізація»
(ADR 0003 і правило `check:actions`) → прод-перевірка PM.
