# Design

## Context

Мотивація — у `proposal.md`, поведінка — в `openspec/specs/order-*`. Зріз ORG уже в `main`: `profiles` (ролі
`requester`/`approver`/`admin`, `is_active`), `departments` та їхні таблиці, `user_permissions`, мінімальна `requests`,
хелпери `private.is_active_user()`, `private.current_app_role()`, `private.is_member()`, `src/lib/auth/session.ts`
(`requireActiveUser()`, `requireAdmin()` з «Недостатньо прав»), `mapOrgDbError`. Зріз PUR (`impl-pur`, PR #16) дає
закупівлі зі схваленими рядками, але на момент цього плану ще не реалізований.

Обмеження з AGENTS.md: схема — лише міграцією в PR; на кожній таблиці RLS, `revoke all … from anon, authenticated`,
явні (колонкові) `grant`, політика на кожну операцію `to authenticated` з `(select auth.uid())`; хелпери — `private`,
`security definer`, `set search_path = ''`; перевірка + запис кількох таблиць — одна функція Postgres через
`supabase.rpc(…)` (у supabase-js немає транзакцій); без нових залежностей; без змін `.github/`; Vitest без бази;
авторизація — `getClaims()`. Час — `America/New_York`, суми — `$` з двома знаками, округлення до центів.

## Goals / Non-Goals

**Goals:** довідник постачальників; черга «Очікують обробки» з вибором постачальника для схвалених рядків; створення
замовлень (по одному на постачальника) з унікальними п'ятизначними номерами; редагування й видалення замовлення;
відправка в бухгалтерську систему (заглушка) з режимами «Підсумок» і «Детально»; статус закупівлі «Оброблено»;
видимість для автора «Самостійної закупівлі», друк, архівування — із правилами в базі й TS-дзеркалами для UI і тестів.

**Non-Goals:** справжня інтеграція з бухгалтерською системою (поза межами PM); часткове виконання, поставки,
повернення, друк чеків, повторне схвалення при зростанні ціни (поза межами PM); редагування й видалення постачальників
(в AC немає); запис дій ORD в `request_history` PUR (в AC немає); інші типи заявок (WS9–WS11).

## Decisions

### D1. Залежності від PUR і ORG та порядок робіт (усі AC)

Код ORD пишемо лише після злиття `task/pur-drafts` і `task/pur-decisions` (і `task/org-users`, на який спирається
PUR): перед задачею 1 звіряємо, що в `main` є такі об'єкти (імена — з `impl-pur`, `design.md` D1–D5).

| Об'єкт | Звідки | Як використовує ORD |
|---|---|---|
| `requests` (`type`, `purchase_type`, `author_id`, `status`, `archived_at`) | ORG + PUR D1 | статуси `approved`, `partially_approved`, `processing`, `processed`; `archived_at` ставить `archive_purchase` (D9); автор «Самостійної закупівлі» (D10) |
| `request_lines` (`status in ('pending','approved','rejected','ready','ordered')`, `name`, `purpose`, `quantity`, `unit_price`, `position`) | PUR D3 | статуси `ready`/`ordered` ORD встановлює сам; нова колонка `supplier_id` (D2) |
| `decide_purchase`, `admin_reject_purchase`, `cancel_purchase` | PUR D5 | ORD їх не викликає: після `processing` PUR сам забороняє відхилення й скасування (AC-PUR-31, 50); ORD лише переводить закупівлю в `processing` |
| `private.can_view_request()` | PUR D4 | адміністратор бачить усі закупівлі; автора й схвалювачів ORD не розширює |
| `private.is_active_user()`, `profiles`, `requireAdmin()` | ORG | доступ лише активного `admin` (AC-ORD-27) |
| `src/lib/pur/*` (`lineTotal`, перевірка кількості й ціни, повідомлення AC-PUR-07) | PUR D3, D7 | ті самі межі для рядка замовлення (AC-ORD-37, 38); якщо імена інші — беремо наявні, не дублюємо |

Перед міграціями звіряємо дві речі з міграціями PUR: (1) тригер `guard_request_update()` не блокує зміну `status` і
`archived_at` з функцій ORD (`security definer`); (2) на `request_lines` колонка `supplier_id` не потрапляє в
колонковий `grant update` автора — ORD додає її лише через функцію (D2). Порядок задач: 1 → 2 → 3 → 4 → 5 → 6
(`tasks.md`); кожна наступна спирається на таблиці й функції попередніх.

### D2. Довідник постачальників і вибір постачальника рядка (AC-ORD-36, 02, 03)

- `public.suppliers(id uuid pk default gen_random_uuid(), name text not null check (char_length(btrim(name)) between 1
  and 200), created_at)` + унікальний індекс `suppliers_name_lower_key` на `lower(btrim(name))` — унікальність без
  урахування регістру з «Припущень» PM (AC-ORD-36). Довжина 200 — технічна межа, не правило PM. RLS: `select` і `insert`
  лише активному `admin`; `update`/`delete` немає (в AC немає); `mapOrdDbError`: `23505` на цьому індексі →
  «Постачальник з такою назвою вже є». TS-дзеркало `isDuplicateSupplierName(name, existing)` (регістр без значення) —
  для підказки в формі й тесту.
- `alter table request_lines add column supplier_id uuid references suppliers on delete restrict`. Колонку змінює лише
  функція `set_line_supplier(p_line_id, p_supplier_id)` (`private.…` `security definer` + обгортка `public.…` `security
  invoker`, як у PUR D5): активний `admin`; блокує закупівлю `for update`; закупівля в `approved`,
  `partially_approved` чи `processing` і не в архіві (інакше `ord:not_processable`); рядок `approved` або `ready`
  (відхилений чи `ordered` → `ord:line_locked`, AC-ORD-03); `p_supplier_id` не `null` → `supplier_id` і статус `ready`;
  `null` → `supplier_id = null` і статус `approved` (AC-ORD-02). Заміна постачальника в `ready`-рядка лишає `ready`.

### D3. Модель замовлення (AC-ORD-05, 09, 10, 11, 17, 18, 35)

- `public.orders(id uuid pk, number integer not null unique check (number between 10001 and 99999), request_id uuid not
  null references requests on delete restrict, supplier_id uuid not null references suppliers on delete restrict,
  status text not null default 'created' check (status in ('created','sending','sent')), send_mode text not null
  default 'detailed' check (send_mode in ('summary','detailed')), accounting_doc_number text, accounting_doc_url text,
  accounting_payload jsonb, sent_at timestamptz, last_error text, created_by uuid references profiles, created_at,
  updated_at)`. Підписи статусів: «Створено», «В обробці» (`sending`), «Відправлено». `send_mode` за замовчуванням
  «Детально» — тимчасово (D12, Q5).
- `public.order_lines(id uuid pk, order_id uuid not null references orders on delete cascade, position integer not
  null, request_line_id uuid references request_lines on delete set null, name text not null check
  (char_length(btrim(name)) between 1 and 500), purpose text not null default '' check (char_length(purpose) <= 2000),
  quantity integer not null check (quantity >= 1), unit_price numeric(12,2) not null check (unit_price >= 0), account
  text, account_class text)` + унікальний частковий індекс `(request_line_id) where request_line_id is not null`: рядок
  закупівлі лежить не більш ніж в одному замовленні. `request_line_id is null` — рядок «лише для замовлення»
  (AC-ORD-11). Початкові `name`, `purpose`, `quantity`, `unit_price` копіюються зі схваленої оцінки рядка закупівлі
  (AC-ORD-09); далі редагується лише копія (AC-ORD-10). Суму рядка рахує TS (`lineTotal`, PUR); в SQL
  `quantity * unit_price` точна (numeric).
- `public.order_files(id, order_id → orders on delete cascade, storage_path text not null, file_name text not null,
  size_bytes bigint not null, content_type text not null, created_at)` — метадані файлів (D7, задача 5).
- RLS: `orders`, `order_lines`, `order_files` — `select` лише активному `admin`; прямі `insert`/`delete` не видаємо
  нікому — рядки з'являються й зникають тільки через функції. Єдині прямі записи: `grant update (send_mode) on orders`
  і `grant update (name, purpose, quantity, unit_price, account, account_class) on order_lines` для активного `admin`;
  тригери `private.guard_order_write()` і `private.guard_order_line_write()` відхиляють їх, якщо замовлення не в
  `created` (AC-ORD-17) або закупівля в архіві. Замовлення, що відправляється чи відправлене, змінити не можна.
- Помилки функцій — `raise exception 'ord:<код>' using errcode = 'P0001'` (із `detail` там, де треба перелік рядків),
  тексти PM — у TS `ORD_ERROR_MESSAGES` (`src/lib/ord/errors.ts`), як `PUR_ERROR_MESSAGES`.

### D4. Нумерація замовлень (AC-ORD-06, 07, 31, 33, 34)

Не послідовність, а `max + 1`: `private.next_order_number()` повертає `coalesce(max(number), 10000) + 1` (AC-ORD-34:
перше — 10001; AC-ORD-06: послідовні й різні). Послідовність не годиться: вона не повертає видані номери, а PM вимагає
протилежного — після видалення найбільшого номера він видається знову (AC-ORD-33), а після видалення не найбільшого
наступний — найбільший плюс один, діра не заповнюється (AC-ORD-31). Конкуренція (AC-ORD-07): `create_orders` бере
`pg_advisory_xact_lock(hashtext('orders.number'))` до обчислення номера, тож два паралельні виклики виконуються по черзі;
запасний захист — `unique (number)` (другий програв би з `23505`, а TS-обгортка повторила б виклик один раз). Вихід за
99999 → `ord:number_overflow` (п'ятизначна межа з припущень PM; ризик — нижче). TS-дзеркало
`nextOrderNumber(existing: number[])` — еталон для тестів AC-ORD-31, 33, 34.

### D5. Створення замовлень (AC-ORD-04, 05, 08, 29, 30, 09)

`create_orders(p_request_id)` (`private` `security definer` + обгортка; одна транзакція): активний `admin`; блокує закупівлю
`for update`; статус `approved`, `partially_approved` чи `processing`, не в архіві (`ord:not_processable`); вибирає рядки
`ready`; якщо їх немає — `ord:no_ready_lines`, текст PM «Оберіть постачальника хоча б для одного рядка» (AC-ORD-04);
`pg_advisory_xact_lock` (D4); групує готові рядки за `supplier_id` у порядку першої появи; для кожної групи вставляє
`orders` з наступним номером і `order_lines` зі схваленої оцінки (AC-ORD-05, 09), рядкам закупівлі ставить `ordered`
(AC-ORD-29), закупівлі — `processing` (AC-ORD-30). Повернення — `jsonb` з `id` і `number` створених замовлень. Повторний
виклик для `processing` бере лише рядки `ready` на цей момент і не торкається наявних замовлень (AC-ORD-08): вибірка за
статусом `ready`, а `ordered`-рядки в неї не потрапляють.

### D6. Редагування й видалення замовлення (AC-ORD-10, 11, 12, 23, 31, 32, 33, 37, 38, 39)

Усе — лише для замовлення в `created` (D3): простий запис полів — прямий `update` під guard-тригером, решта — функції.

- Зміна `quantity`/`unit_price`/`account`/`account_class`/`name`/`purpose` — прямий `update` (колонковий `grant`); рядок
  закупівлі не чіпаємо (AC-ORD-10). Межі — AC-ORD-37, 38: TS-перевірка називає поле («Кількість», «Ціна») до запиту;
  `CHECK` на колонках — останнє слово (`23514` → та сама назва поля в `mapOrdDbError`). Ціна 0 при цілій кількості ≥ 1
  приймається, `quantity = 0`, нецілу кількість і від'ємну ціну — ні.
- `add_order_line(p_order_id, name, purpose, quantity, unit_price)` — рядок лише для замовлення, `request_line_id = null`,
  у закупівлі його немає (AC-ORD-11).
- `remove_order_line(p_order_line_id)` — видаляє рядок замовлення; якщо він пов'язаний із рядком закупівлі, той отримує
  `ready` і зберігає `supplier_id` (AC-ORD-12); рядок лише для замовлення просто зникає.
- `delete_order(p_order_id)` — `created` (зокрема після видалення з бухгалтерської системи, D7): повертає рядки
  закупівлі в `ready` (AC-ORD-32), видаляє замовлення з рядками й файлами (AC-ORD-23; номер вільний — D4), після чого
  викликає `private.refresh_request_processing` (D8): закупівля лишається `processing` (AC-ORD-39), навіть коли
  замовлень не лишилось; назад у `approved` не повертається ніколи.
- Видалення файлів зі сховища при `delete_order` — відповідальність server action (D7, задача 5): перелік
  `storage_path` читається до виклику, видалення зі сховища — після успіху функції; осиротілі об'єкти без метаданих
  не шкодять (ризики).

### D7. Відправка в бухгалтерську систему — заглушка (AC-ORD-13, 14, 15, 17, 18, 19, 22, 35)

Бухгалтерська система — заглушка (вимога PM, відгук викладача 2026-10-20): токенів і зовнішніх викликів немає.

- **Клієнт-заглушка** `src/lib/ord/accounting-stub.ts` реалізує інтерфейс `AccountingClient` (`submit(payload)`,
  `deleteDocument(docNumber)`): `submit` повертає номер документа `STUB-<номер замовлення>` і посилання
  `/admin/orders/<id>/document` (сторінка показує збережений payload — те, що «пішло» в систему) або помилку з кодом.
  Щоб помилку можна було показати вручну (AC-ORD-19), форма відправки має позначку «Імітувати помилку бухгалтерської
  системи» (лише для заглушки; без неї заглушка завжди успішна). У тестах клієнт підміняється.
- **Payload** будує чиста функція `buildAccountingPayload(order, lines)` (`src/lib/ord/payload.ts`): «Детально» — по
  рядку на кожен рядок замовлення (AC-ORD-35); «Підсумок» — один рядок на суму замовлення, `amount = Σ quantity ×
  unit_price` (AC-ORD-15: 2 × 50.00 → 100.00). Рахунок і клас єдиного рядка — тимчасово спільні для всіх рядків (D12, Q1).
- **Три кроки** (кожна server action `sendOrder`), бо запит до заглушки не вкладається в транзакцію бази:
  1. `begin_send_order(p_order_id)` (функція): активний `admin`; блокує замовлення й закупівлю; статус `created`, інакше
     `ord:already_sending` / `ord:already_sent` (AC-ORD-17: вдруге відправити не можна); закупівля не в архіві; є хоча б
     один рядок (`ord:no_lines`); в усіх рядків непорожні (після `btrim`) рахунок і клас, інакше `ord:lines_incomplete` з
     `detail` — переліком номерів рядків (AC-ORD-13); для `summary` — хоча б один `order_files` (`ord:file_required`,
     AC-ORD-14); потім `status = 'sending'`, `last_error = null`. Під `sending` guard-тригери D3 не дають змінити
     замовлення (AC-ORD-17).
  2. server action читає замовлення з рядками (адмін бачить `select`), будує payload, викликає `AccountingClient.submit`.
  3. `finish_send_order(p_order_id, p_ok, p_doc_number, p_doc_url, p_error, p_payload)`: лише з `sending`; успіх —
     `sent`, `accounting_*`, `sent_at = now()` (AC-ORD-18); помилка — `created`, `last_error` (AC-ORD-19); потім
     `private.refresh_request_processing` (D8). Невідома помилка заглушки (виняток) завершується як помилка з текстом
     «Бухгалтерська система не відповіла. Спробуйте ще раз» — `try/finally`, щоб замовлення не лишалось у `sending`.
  Тексти причин — простими словами, `ACCOUNTING_ERROR_MESSAGES` (AC-ORD-19); відправити знову можна одразу.
- `unsend_order(p_order_id)` (видалення з бухгалтерської системи, AC-ORD-22): `sent` → `created`, `accounting_*`
  очищено, `number` збережено; закупівля — через D8 назад у `processing`. Server action спершу викликає
  `AccountingClient.deleteDocument`, потім функцію. Видалити замовлення повністю (D6) після цього можна.
- **Файли** (AC-ORD-14, задача 5): бакет Supabase Storage `order-files` (приватний) з політиками на `storage.objects`
  лише для активного `admin` і префіксом `<order_id>/`; завантаження — server action (`supabase.storage.upload`) з
  перевіркою формату й розміру в TS (D12, Q2); метадані — `order_files` (політики `insert`/`delete` для `admin`). Якщо
  `db-check` не приймає політику на `storage.objects`, задачу 5 відкладаємо: AC-ORD-14 — «відкладено (причина,
  посилання на рішення)», а функція `begin_send_order` лишається з перевіркою файлу, тож у «Підсумок» без файлу
  відправити однаково не можна.

### D8. Статус закупівлі «Оброблено» (AC-ORD-20, 21, 22, 30, 39)

`private.refresh_request_processing(p_request_id)` — викликають `create_orders` (замість прямого `processing`),
`finish_send_order`, `unsend_order`, `remove_order_line`, `delete_order`. Лише з `processing`/`processed`: закупівля стає
`processed`, якщо водночас (а) у неї немає рядків у `approved`/`ready` (усі схвалені замовлено, відхилені не рахуємо —
AC-ORD-21), (б) є хоча б одне замовлення, (в) усі замовлення `sent`; інакше — `processing` (AC-ORD-20, 22). Без
замовлень закупівля лишається `processing` (AC-ORD-39: вона ніколи не повертається в `approved`). Це та сама умова, що
в специфікації «Статус закупівлі „Оброблено"»; перерахунок після `remove_order_line`/`delete_order` лише застосовує її
послідовно, нових правил не додає.

### D9. Черга, доступ і архівування (AC-ORD-01, 27, 28)

- `/admin/processing` — `requireAdmin()` (AC-ORD-27: інші бачать «Недостатньо прав»; RLS додатково — `select`
  закупівлі й `suppliers` лише для адміністратора). Запит: `type = 'PUR'`, `status in ('approved','partially_approved',
  'processing')`, `archived_at is null` (AC-ORD-01); `processed`/`rejected`/`cancelled` та архівні не показуються.
  Чисте TS-дзеркало `isInProcessingQueue(request)` — для тесту й лічильників.
- Лічильники «Очікують обробки (N)» і «Оброблено (M)» (закупівлі `processed` не в архіві) — на сторінці черги.
- `archive_purchase(p_request_id)` (функція, лише `admin`): закупівля `processed` і не в архіві (інакше
  `ord:cannot_archive`) → `archived_at = now()`. Архівна зникає з черги й обох лічильників (фільтр
  `archived_at is null`), лишається доступною для читання (RLS `select` не залежить від `archived_at`) і в пошуку:
  `/requests` для адміністратора дістає поле пошуку за номером (`PUR-N` чи `N`), що шукає й серед архівних із
  позначкою «Архів» (D12, Q8). Функції ORD для архівної закупівлі відхиляють зміни (`ord:archived`).

### D10. Видимість для автора й друк (AC-ORD-24, 25, 26)

- Автор бачить замовлення лише через функцію `request_orders(p_request_id)` (`private` `security definer` + обгортка
  `public`): повертає `number`, `supplier_name`, `status`, `total` лише коли викликач — автор закупівлі
  `type = 'PUR'` з `purchase_type = 'self'` (AC-ORD-24); для «Відділ закупівель» (AC-ORD-25) та будь-кого, хто не автор,
  — порожньо. Адміністратор бачить усе напряму. Прямого `select` на `orders`/`order_lines` автор не має: рахунки, класи й
  документи бухгалтерської системи йому не потрібні, змінювати замовлення він не може. Автор — лише `author_id`; особа
  «від імені» й схвалювачі замовлень не бачать (вимога PM «Інші автори й схвалювачі»; D12, Q6).
- На `/requests/[id]` (сторінка PUR) додаємо блок «Замовлення»: таблиця з `request_orders` для автора «Самостійної
  закупівлі», нічого для інших, посилання на `/admin/processing/[id]` для адміністратора. Суми — `$`, 2 знаки.
- Друк `/admin/orders/[id]/print`: лише `sent` (інакше повідомлення), лише `admin`; сторінка з номером, постачальником,
  рядками й сумою. Стилі: `@page { margin: 12mm }`, контейнер без фіксованої ширини (`width: 100%`, `max-width: 180mm` —
  менше за друковану ширину A4 186 мм і Letter 191,9 мм), таблиця з `table-layout: fixed`, без фонового кольору й
  навігації в `@media print`. Vitest не друкує: тест перевіряє склад сторінки й константи розмірів, а вміщення на
  A4/Letter — ручна перевірка (PDF у браузері в обох форматах) у PR задачі 6.

### D11. Сторінки, actions і тести

| Шлях | Що | AC | Задача |
|---|---|---|---|
| `/admin/suppliers` | довідник: список, додати | 36 | 1 |
| `/admin/processing` | черга «Очікують обробки», лічильники | 01, 27 | 1 (лічильники й «Оброблено» — 6) |
| `/admin/processing/[id]` | рядки, вибір постачальника, «Створити замовлення», замовлення закупівлі, архівувати | 02–05, 08, 28–30 | 1, 2, 6 |
| `/admin/orders/[id]` | рядки (редагування, додати, прибрати), режим, файли, відправка, видалення, помилка | 06–12, 13–15, 17–19, 22, 23, 31–35, 37–39 | 2–5 |
| `/admin/orders/[id]/document` | документ заглушки (payload) | 15, 18, 35 | 4 |
| `/admin/orders/[id]/print` | друк відправленого | 26 | 6 |
| `/requests/[id]` (PUR) | блок «Замовлення» | 24, 25 | 6 |
| `/requests` (PUR) | пошук за номером, архівні | 28 | 6 |

Actions: `src/app/admin/suppliers/actions.ts` (`createSupplier`), `src/app/admin/processing/[id]/actions.ts`
(`setLineSupplier`, `createOrders`, `archivePurchase`), `src/app/admin/orders/[id]/actions.ts` (`updateOrderLine`,
`addOrderLine`, `removeOrderLine`, `setSendMode`, `deleteOrder`, `sendOrder`, `unsendOrder`, `uploadOrderFile`,
`removeOrderFile`). Кожна починає з `requireAdmin()` (`getClaims()`, ніколи `getSession()`), перевіряє введене
TS-правилами `src/lib/ord/*` до запиту й перетворює `ord:<код>` на текст PM. Модулі: `statuses.ts` (підписи), `errors.ts`,
`lines.ts` (межі, `lineTotal`), `numbers.ts` (`nextOrderNumber`), `payload.ts`, `accounting-stub.ts`, `queue.ts`.

Тести — Vitest без бази: `tests/ord/<тема>.test.ts`, назви `it("AC-ORD-NN: …")` — чисті функції `src/lib/ord/*` і server
actions з `vi.mock("@/lib/supabase/server")` (що йде в `rpc`/`update`, як `ord:<код>` стає текстом PM). SQL-правила (нумерація,
RLS, переходи) перевіряє `db-check` (міграція застосовується) і ручний прохід на Preview/проді з демо-користувачами
`*@example.test` (кроки — в описі кожного PR); AC-ORD-07 (одночасне створення) — ще й двома паралельними `rpc`-викликами
з двома сесіями адміністраторів скриптом поза репо, результат — у PR задачі 2.

### D12. Тимчасові рішення для відкритих питань PM

Питань PM ще не поставлено: після рев'ю плану — скіл `spec-clarify` (вебформа «Питання до вимог», журнал
`docs/spec-reading.md`). **Тимчасово** — до відповіді PM; після неї — нова зміна специфікації й, за потреби, правка
міграцією.

| Питання | Тимчасове рішення | Де в дизайні |
|---|---|---|
| Q1 — AC-ORD-14, 15: «Підсумок» — один рядок на суму; з якими рахунком і класом, якщо в рядків замовлення вони різні, і що в назві? | **Тимчасово:** усі рядки в режимі «Підсумок» мають однакові рахунок і клас, інакше відправка відхиляється з `ord:summary_mixed_accounts`; назва єдиного рядка — «Замовлення №<номер>» | D7 `payload.ts`, `begin_send_order` |
| Q2 — AC-ORD-14: формат і розмір файлів замовлення | **Тимчасово:** ті самі, що в AC-PUR-34 (PDF, JPG, PNG, HEIC, до 20 МБ) | D7 файли |
| Q3 — AC-ORD-13: «обліковий рахунок» і «клас» — довідник чи вільний текст | **Тимчасово:** вільний текст до 100 символів; порожнім вважається значення з самих пробілів | D3, `begin_send_order` |
| Q4 — AC-ORD-12: замовлення без жодного рядка після прибирання | **Тимчасово:** замовлення лишається, відправити його не можна (`ord:no_lines`), видалити можна | D6, D7 |
| Q5 — AC-ORD-14, 35: режим відправки за замовчуванням | **Тимчасово:** «Детально» | D3 |
| Q6 — AC-ORD-24, 26: хто бачить замовлення й друкує | **Тимчасово:** бачить лише автор (не особа «від імені») «Самостійної закупівлі» — номер, постачальника, статус, суму; друкує лише адміністратор, лише відправлене | D10 |
| Q7 — AC-ORD-17, 19: що робити, якщо відправка застрягла в «В обробці» | **Тимчасово:** `try/finally` завершує її помилкою; окремої дії «скинути» немає | D7 |
| Q8 — AC-ORD-28: що таке «пошук» і коли можна архівувати | **Тимчасово:** пошук за номером закупівлі на `/requests` для адміністратора, включно з архівними; архівувати можна лише `processed` | D9 |

ADR: модель замовлення й нумерацію (D3–D5, D7) оформлюємо `docs/decisions/<наступний вільний номер>-orders-model.md` у PR
задачі 2 — лише за погодженням (AGENTS.md: новий ADR — «спитай спершу»).

## Risks / Trade-offs

- [Код ORD залежить від незлитого PUR] → не починати задачу 1, доки в `main` немає об'єктів з D1; перед кожною міграцією
  `node scripts/check-migration-order.mjs` і перевірка, що відкрита гілка PUR не змінює ті самі таблиці.
- [RLS, функції й нумерація не покриті Vitest — job `app` без бази] → TS-дзеркала з тестами AC, `db-check` на кожен PR,
  ручний прохід на Preview, паралельний виклик для AC-ORD-07; pgTAP — лише після погодження зміни `.github/`.
- [Правило дубльоване в SQL і TS і може розійтися] → TS лише для підказок і тестів, останнє слово — функції й RLS.
- [Відправка в трьох кроках: збій між `begin` і `finish` лишає замовлення в `sending`] → `try/finally` у action; зависання
  після аварійного обриву процесу — відомий ризик (Q7), окремого скидання в AC немає.
- [Адміністратор може викликати `finish_send_order` напряму з вигаданим номером документа] → прийнятно для заглушки;
  справжня інтеграція — поза межами PM.
- [`max + 1` + advisory lock серіалізує створення замовлень] → потрібно лише для одиниць створень на добу; номер за 99999
  дає `ord:number_overflow` — ліміт п'ятизначних номерів із припущень PM.
- [Політика на `storage.objects` може не пройти `db-check`] → задача 5 окрема й не блокує решту; запасний шлях — AC-ORD-14
  «відкладено» з причиною (D7).
- [Друк не перевіряється автотестом] → ручна перевірка PDF у A4 і Letter у PR; довге замовлення може піти на другий
  аркуш — вимога PM про вміщення стосується ширини сторінки й типового замовлення; ліміт рядків на аркуші PM не задала.

## Migration Plan

Шість міграцій — по одній на задачу з `tasks.md`, кожна `npx supabase migration new <назва>` у своєму PR «Реалізація»
(перед кожною — перевірити, чи інша відкрита гілка не змінює схему); імена: `ord_suppliers`, `ord_orders`,
`ord_editing`, `ord_accounting`, `ord_files`, `ord_visibility`. Після merge `db-deploy` застосовує її; тип
`database.types.ts` — з Summary `db-check`. Відкат — лише новою міграцією; застосовані файли не змінюємо. Сид
(`supabase/seed.sql`): два синтетичні постачальники «Альфа» й «Бета» (ідемпотентно, `where not exists` за `lower(name)`).
