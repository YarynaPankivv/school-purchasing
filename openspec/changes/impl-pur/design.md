# Design

## Context

Мотивація — у `proposal.md`, поведінка — в `openspec/specs/purchase-*`. Зріз ORG уже дав: `profiles` (ролі
`requester`/`approver`/`admin`, `is_active`), `departments`, `department_members` (з `auto_approve`),
`department_approvers`, `user_permissions`, мінімальну `requests` (`type`, `purchase_type`, `department_id`, `author_id`,
`status in ('draft','submitted')`), хелпери `private.is_active_user()`, `private.current_app_role()`,
`private.is_member()`, `private.can_create_request()`; сторінку `/requests/new`, що створює чернетку.

Обмеження з AGENTS.md: схема — лише міграцією в PR; RLS, `revoke all`, явні (колонкові) `grant`, політика на кожну
операцію `to authenticated` з `(select auth.uid())`; хелпери — `private`, `security definer`, `set search_path = ''`;
перевірка + запис кількох таблиць — одна функція Postgres через `supabase.rpc(…)`; без нових залежностей; без змін
`.github/`; Vitest без бази. Ухвалені рішення — `docs/decisions/0001-org-model.md`.

## Goals / Non-Goals

**Goals:** чернетка з рядками й номером `PUR-N`, подання (зокрема автосхвалення й «Чекають рішення»), рішення
схвалювача й відділу закупівель, скасування, копія, видимість — з правилами в базі й TS-дзеркалами для UI і тестів.

**Non-Goals:** файли (AC-PUR-34, D8); замовлення, постачальники й статуси «В обробці»/«Оброблено» встановлює зріз ORD
(`impl-ord`); листи (поза межами продукту); інші типи заявок (WS9–WS11).

## Decisions

### D1. Статуси й колонки заявки (AC-PUR-01, 05, 10, 11, 14, 16–23, 26–31)

Міграцією розширюємо `requests`: статуси `draft`, `pending` («Очікує схвалення»), `approved`, `partially_approved`,
`rejected`, `returned` («Повернено на доопрацювання»), `cancelled`, `processing` («В обробці»), `processed`
(«Оброблено»); наявні `submitted` → `pending`. Нові колонки: `number bigint` (номер `PUR-N`), `note text` (≤ 2000
символів — CHECK), `delivery_date date`, `on_behalf_of_id uuid → profiles` (≠ автор — CHECK), `editing boolean`
(AC-PUR-26), `decision_reason text`, `archived_at timestamptz` (для ORD), `updated_at`. `department_id` стає
необов'язковим для чернетки (CHECK `status = 'draft' or department_id is not null`) — інакше AC-PUR-05 недосяжний.

### D2. Номер `PUR-N` (AC-PUR-01, 02, 30)

Послідовність `private.purchase_number_seq` (з 1) і тригер `before insert` на `requests` для `type = 'PUR'`
(`security definer`). Послідовність не повертає видані значення, тож номер видаленої чернетки не використовується
повторно (AC-PUR-30), а одночасні вставки отримують різні номери (AC-PUR-02). Унікальний індекс `(number) where type =
'PUR'`. Наявні закупівлі отримують номери за `created_at`. Альтернатива `max(number) + 1` — ні: повторює номер видаленої
чернетки й потребує блокування.

### D3. Рядки й історія (AC-PUR-06–09, 37, 39, 41, 42)

- `request_lines(id, request_id → requests on delete cascade, position, name ≤ 500, purpose, quantity integer ≥ 1,
  unit_price numeric(12,2) ≥ 0, status in ('pending','approved','rejected','ready','ordered'))`. Порожні поля дозволені
  (чернетка); повноту перевіряє подання. Статуси `ready`/`ordered` — для ORD. Тригер `after insert` на `requests` для
  `PUR` додає один порожній рядок (AC-PUR-01).
- `request_history(id, request_id, actor_id → profiles, action, reason, created_at)` — дії `submitted`, `approved`,
  `partially_approved`, `rejected`, `returned`, `reopened`, `cancelled`; пишуть лише функції D5.
- Суми — TS (`lineTotal`, `requestTotal`, округлення до центів): у базі лише кількість і ціна.

### D4. Видимість і редагування — RLS (AC-PUR-03, 11, 35, 38, 44, 49; AC-ORG-16)

- `private.can_view_request(id)` (`security definer`): автор, особа «від імені», активний `admin` (усі, включно з
  чернетками) або схвалювач відділу заявки для статусів, відмінних від `draft`. `requests_select`, `request_lines`/
  `request_history` `select` — через неї. Заявник того самого відділу, що не схвалює, чужої заявки не бачить (AC-PUR-49).
- `requests_update`: автор, статус `draft` або `returned`, колонкові `grant update (department_id, purchase_type, note,
  delivery_date, on_behalf_of_id, updated_at)`; тригер `private.guard_request_update()` відхиляє зміну відділу поза
  `draft` (AC-PUR-38) і перевіряє особу «від імені»: активна, не автор, не `admin`; для не-`admin` автора — заявник
  відділу заявки (AC-PUR-13, матриця прав).
- `request_lines` `insert`/`update`/`delete` — автор, коли заявка `draft`, `returned` або `pending` з `editing = true`
  (AC-PUR-26, 44: відхилену не редагують).
- `requests_delete`: автор, лише `draft` (AC-PUR-30; рядки й історія — каскадом).
- `profiles_select_colleagues`: активний працівник бачить активні профілі колег зі спільного відділу — для вибору особи
  «від імені» й імен в історії (D7 `impl-org`, переносимо сюди).

### D5. Переходи статусів — функції Postgres (AC-PUR-14, 16, 17–29, 31, 32, 36, 50–54)

Кожен перехід — `private.<дія>` (`security definer`, `set search_path = ''`, явна перевірка `auth.uid()` і
`is_active_user()`, `select … for update` заявки) і обгортка `public.<дія>` (`security invoker`), яку викликає
`supabase.rpc`. Помилки — `raise exception 'pur:<код>'` з `errcode 'P0001'`, тексти PM — у TS `PUR_ERROR_MESSAGES`.

- `submit_purchase(id)` — автор; `draft`/`returned`; відділ (`pur:department_required`), повні рядки
  (`pur:lines_incomplete`); автосхвалення автора у відділі → `approved`, рядки `approved`, історія «Подано» +
  «Схвалено» з автором (AC-PUR-16, 53); інакше `pending`, історія «Подано» (AC-PUR-14, 23, 37). Не автор —
  `pur:forbidden` (AC-PUR-45).
- `set_purchase_editing(id, bool)` — автор, `pending`; поки `editing`, рішення не приймаються (AC-PUR-26).
- `decide_purchase(id, action, reason, rejected_line_ids)` — `approve` / `reject` / `return`; статус має бути `pending`
  на момент блокування рядка, інакше `pur:already_decided` (AC-PUR-25); `editing` → `pur:author_editing`; автор чи
  особа «від імені» → `pur:own_request` за будь-якої ролі (AC-PUR-24, 54); право — активний схвалювач відділу або
  `admin` (AC-PUR-35); `approve` з усіма відхиленими рядками → `pur:all_lines_rejected` (AC-PUR-19), інакше
  `approved`/`partially_approved` і статуси рядків (AC-PUR-17, 18, 41, 42); `reject`/`return` без причини →
  `pur:reason_required` (AC-PUR-20, 51).
- `reopen_purchase(id)` — лише `admin`, `rejected`/`returned` → `pending` (AC-PUR-27, 36).
- `admin_reject_purchase(id, reason)` — лише `admin`, `approved`/`partially_approved` → `rejected` з причиною
  (AC-PUR-28, 52); `processing`/`processed` → `pur:cannot_reject` (AC-PUR-50).
- `cancel_purchase(id)` — автор; `draft` — видалення (AC-PUR-30); `pending`/`approved`/`partially_approved`/`returned`
  → `cancelled` (AC-PUR-29); інакше `pur:cannot_cancel` (AC-PUR-31).
- `copy_purchase(id)` — автор; нова чернетка з тим самим відділом, нотаткою, особою «від імені» й усіма рядками без
  відхилень, без дати доставки; тип закупівлі — за замовчуванням «Відділ закупівель» (припущення PM: тип за
  замовчуванням; CHECK вимагає тип для `PUR`) (AC-PUR-32).

### D6. Списки для рішення (AC-PUR-15, 33, 47, 48, 53, 54)

TS-функції над даними, які дозволяє RLS: `decisionQueue` — заявки `pending` відділів, де людина схвалює, крім власних
(AC-PUR-15); `awaitingDecision` для `admin` — `pending`, у відділі яких немає активного схвалювача, що не є автором чи
особою «від імені» (AC-PUR-33, 47, 48); автосхвалена заявка туди не потрапляє, бо вона вже `approved` (AC-PUR-53).
`canDecide` ховає дії від автора й особи «від імені» (AC-PUR-24, 54) — те саме перевіряє D5. Позначки в застосунку —
лічильники «На рішення» / «Чекають рішення» на головній і статус «Заявку схвалено» в списку автора (AC-PUR-15, 40).

### D7. Сторінки й server actions

| Шлях | Що | AC |
|---|---|---|
| `/requests` | мої заявки; «На рішення»; для `admin` — «Чекають рішення» й усі заявки | 15, 33, 40, 47, 48 |
| `/requests/new` | створення чернетки → перехід до неї | 01, 04 |
| `/requests/[id]` | чернетка (відділ, тип, дата, нотатка, «від імені», рядки, суми), подання, редагування поданої, скасування, копія, рішення, дії `admin`, історія | решта |

Actions — `src/app/requests/[id]/actions.ts`; кожна починає з `requireActiveUser()` (`getClaims()`), перевіряє введене
TS-правилами (`src/lib/pur/*`) до запиту й перетворює `pur:<код>` на текст PM. Час — `America/New_York`, суми — `$` з
двома знаками.

### D8. Файли (AC-PUR-34) — відкладено

Потрібен бакет Supabase Storage з політиками на `storage.objects` і завантаження з браузера; у дедлайн зрізу не
вміщується. Рядок матриці — «відкладено (не вистачило часу до дедлайну 21.10, design.md D8)».

### D9. Тести

Vitest без бази: `tests/pur/*.test.ts`, назви `it("AC-PUR-NN: …")` — чисті функції `src/lib/pur/*` і server actions із
моком `@/lib/supabase/server` (що надсилається в `insert`/`update`/`rpc`, як перетворюються коди помилок). SQL-функції
й RLS перевіряє `db-check` (міграції застосовуються) і ручний прохід на проді після `db-deploy` (крок у PR).

## Risks / Trade-offs

- [Правила в SQL і TS можуть розійтися] → TS лише для підказок і тестів, останнє слово — функції D5 і RLS D4.
- [RLS і функції не покриті автотестами на базі] → ручний прохід на проді й прямі запити до Data API скриптом поза репо.
- [Великий обсяг за один день] → дві задачі, кожна — робочий вертикальний зріз.

## Migration Plan

Задачі 1 і 2 пішли одним PR «Реалізація» (`task/pur-core`) з однією міграцією `pur_drafts`: функції рішень (D5) лежать
у ній же, окремої `pur_decisions` немає. Після merge `db-deploy` застосовує її. Відкат — лише новою міграцією.
