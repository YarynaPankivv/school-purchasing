# Tasks

Кожна група — окремий PR «Реалізація» (`task/<коротко>`) з однією міграцією; галочки й рядки `docs/conformance.md` її
AC — у тому самому PR. Рішення й тимчасові відповіді на Q1–Q8 — `design.md` (D1–D12).

**Порядок і залежності.** Код ORD пишемо лише після злиття в `main` обох PR зрізу PUR (`task/pur-drafts`,
`task/pur-decisions`) і `task/org-users` (зріз ORG; на нього спирається PUR). Перед задачею 1 звіряємо об'єкти з
`design.md` D1: `requests` (`status`, `archived_at`, `purchase_type`, `author_id`), `request_lines` (`status` з `ready`
і `ordered`, `quantity`, `unit_price`, `position`), `private.can_view_request()`, `src/lib/pur/*` (суми, межі рядка).
Задачі йдуть послідовно 1 → 2 → 3 → 4 → 5 → 6: кожна наступна спирається на таблиці й функції попередніх. Усі 38 AC зрізу
розподілено між задачами (AC-ORD-16 не існує).

## 1. Постачальники, черга й вибір постачальника рядка (`task/ord-suppliers-queue`)

- [ ] 1.1 Міграція `ord_suppliers`: `suppliers` з унікальним індексом `lower(btrim(name))` і RLS лише для активного
  `admin` (D2); `request_lines.supplier_id`; функція `set_line_supplier` з обгорткою `public.*` (D2); `revoke all`, явні
  `grant`. Перевірка: `node scripts/check-migration-order.mjs`, зелений `db-check`; прямий `PATCH` `supplier_id`
  автором закупівлі через Data API відхилено (результат — в описі PR)
- [ ] 1.2 `supabase/seed.sql`: постачальники «Альфа», «Бета» (ідемпотентно). Оновити `database.types.ts` (Summary
  `db-check`). Перевірка: `db-check`, `npm run typecheck`
- [ ] 1.3 `src/lib/ord/{statuses,errors,queue,suppliers}.ts`: підписи статусів, `ORD_ERROR_MESSAGES`/`mapOrdDbError`
  (`23505` → «Постачальник з такою назвою вже є», `ord:line_locked`, `ord:not_processable`), `isInProcessingQueue`,
  `isDuplicateSupplierName`. Перевірка: тести 1.6
- [ ] 1.4 `src/app/admin/suppliers/actions.ts` (`createSupplier`) і сторінка `/admin/suppliers`;
  `src/app/admin/processing/[id]/actions.ts` (`setLineSupplier`). Усі — через `requireAdmin()`. Перевірка: тести 1.6
- [ ] 1.5 Сторінки `/admin/processing` (черга «Очікують обробки», D9) і `/admin/processing/[id]` (рядки закупівлі, вибір
  постачальника зі статусом рядка); посилання з навігації адміністратора й зі сторінки закупівлі. Перевірка:
  `npm run build` і ручний прохід на Preview з `admin@example.test` (кроки — в описі PR)
- [ ] 1.6 `tests/ord/suppliers-queue.test.ts`: `it("AC-ORD-01: …")`, 02, 03, 27, 36 — чисті функції й actions з
  `vi.mock("@/lib/supabase/server")`. Перевірка: `npm test`
- [ ] 1.7 Рядки AC задачі в `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-ORD-01, AC-ORD-02, AC-ORD-03, AC-ORD-27, AC-ORD-36

## 2. Створення замовлень і нумерація (`task/ord-create`)

- [ ] 2.1 Міграція `ord_orders`: `orders`, `order_lines` з `CHECK` і частковим унікальним індексом (D3); RLS і `grant`
  (лише `select` для `admin`); `private.next_order_number()`; `create_orders` з `pg_advisory_xact_lock` (D4, D5); первісна
  `private.refresh_request_processing` (D8) — поки лише ставить `processing`. Перевірка: `node
  scripts/check-migration-order.mjs`, зелений `db-check`
- [ ] 2.2 `src/lib/ord/{numbers,lines}.ts`: `nextOrderNumber(existing)`, `lineTotal`/`orderTotal` (з `src/lib/pur`),
  `ORD_ERROR_MESSAGES` для `no_ready_lines`, `number_overflow`. Оновити `database.types.ts`. Перевірка: тести 2.5
- [ ] 2.3 Дія `createOrders` у `src/app/admin/processing/[id]/actions.ts`: один `rpc('create_orders')`, текст PM «Оберіть
  постачальника хоча б для одного рядка». Перевірка: тести 2.5
- [ ] 2.4 `/admin/processing/[id]`: кнопка «Створити замовлення», список замовлень закупівлі (номер, постачальник, статус,
  сума); `/admin/orders/[id]` — лише перегляд рядків (кількість і ціна зі схваленої оцінки, сума рядка). Перевірка:
  `npm run build` і ручний прохід на Preview
- [ ] 2.5 `tests/ord/create.test.ts`: `it("AC-ORD-04: …")`, 05, 06, 07, 08, 09, 29, 30, 34 — зокрема `nextOrderNumber`
  (10001, послідовні, різні) і те, що action не рахує номер сам. Перевірка: `npm test`
- [ ] 2.6 Ручна перевірка AC-ORD-07: два паралельні `rpc('create_orders')` з двох сесій адміністраторів скриптом поза
  репо — номери різні (результат — в описі PR); ADR моделі замовлення (D12, лише за погодженням). Рядки AC задачі в
  `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-ORD-04, AC-ORD-05, AC-ORD-06, AC-ORD-07, AC-ORD-08, AC-ORD-09, AC-ORD-29, AC-ORD-30, AC-ORD-34

## 3. Редагування й видалення замовлення (`task/ord-editing`)

- [ ] 3.1 Міграція `ord_editing`: `grant update (send_mode)` на `orders` і `grant update (name, purpose, quantity,
  unit_price, account, account_class)` на `order_lines` для `admin`; тригери `guard_order_write`/`guard_order_line_write`
  (лише `created`, не архівна — D3); функції `add_order_line`, `remove_order_line`, `delete_order` (D6); `refresh_request_processing`
  викликається після прибирання й видалення (D8). Перевірка: `node scripts/check-migration-order.mjs`, зелений `db-check`
- [ ] 3.2 `src/lib/ord/lines.ts`: перевірка кількості (ціла ≥ 1) й ціни (≥ 0) з іменем поля в повідомленні (повторно
  використати правила PUR), `mapOrdDbError` для `23514`. Оновити `database.types.ts`. Перевірка: тести 3.4
- [ ] 3.3 Дії `updateOrderLine`, `addOrderLine`, `removeOrderLine`, `setSendMode`, `deleteOrder` у
  `src/app/admin/orders/[id]/actions.ts` і форми на `/admin/orders/[id]`: редагування кількості й ціни, нових рядків лише
  для замовлення, прибирання, вибір режиму, видалення замовлення (з підтвердженням). Перевірка: `npm run build` і ручний
  прохід на Preview
- [ ] 3.4 `tests/ord/editing.test.ts`: `it("AC-ORD-10: …")`, 11, 12, 23, 31, 32, 33, 37, 38, 39 — чисті функції й actions;
  `nextOrderNumber` після видалення (10452 → 10454; 10453 → знову 10453). Перевірка: `npm test`
- [ ] 3.5 Рядки AC задачі в `docs/conformance.md` → «реалізовано»; ручний прохід (прибрати рядок, видалити замовлення,
  номер знову вільний) — в описі PR. Перевірка: `npm run ac:coverage`

Done when: AC-ORD-10, AC-ORD-11, AC-ORD-12, AC-ORD-23, AC-ORD-31, AC-ORD-32, AC-ORD-33, AC-ORD-37, AC-ORD-38, AC-ORD-39

## 4. Відправка в бухгалтерську систему — заглушка (`task/ord-accounting`)

- [ ] 4.1 Міграція `ord_accounting`: `order_files` (метадані, лише `select` для `admin`); функції `begin_send_order`,
  `finish_send_order`, `unsend_order` (D7); повна `refresh_request_processing` з умовами «Оброблено» (D8). Перевірка: `node
  scripts/check-migration-order.mjs`, зелений `db-check`
- [ ] 4.2 `src/lib/ord/{payload,accounting-stub}.ts`: `buildAccountingPayload` («Підсумок» — один рядок на суму,
  «Детально» — по рядку на кожен), інтерфейс `AccountingClient` і заглушка з опційною імітацією помилки;
  `ACCOUNTING_ERROR_MESSAGES`. Оновити `database.types.ts`. Перевірка: тести 4.5
- [ ] 4.3 Дії `sendOrder` (begin → заглушка → finish, `try/finally`) і `unsendOrder` у
  `src/app/admin/orders/[id]/actions.ts`; перелік рядків без рахунку чи класу в повідомленні (AC-ORD-13)
- [ ] 4.4 `/admin/orders/[id]`: рахунок і клас у рядках, кнопки «Відправити» (з позначкою імітації помилки) і «Видалити з
  бухгалтерської системи», блок статусу, номера документа й посилання, причина помилки; сторінка
  `/admin/orders/[id]/document` (збережений payload). Перевірка: `npm run build` і ручний прохід на Preview
  (відправка, помилка, повторна відправка, видалення з бухгалтерії, закупівля стає «Оброблено»)
- [ ] 4.5 `tests/ord/accounting.test.ts`: `it("AC-ORD-13: …")`, 15, 17, 18, 19, 20, 21, 22, 35 — payload, коди помилок,
  послідовність `begin → submit → finish`, `finish(ok=false)` у разі помилки заглушки й винятку. Перевірка: `npm test`
- [ ] 4.6 Рядки AC задачі в `docs/conformance.md` → «реалізовано» (AC-ORD-14 лишається «відкладено (чекає реалізації)» до
  задачі 5). Перевірка: `npm run ac:coverage`

Done when: AC-ORD-13, AC-ORD-15, AC-ORD-17, AC-ORD-18, AC-ORD-19, AC-ORD-20, AC-ORD-21, AC-ORD-22, AC-ORD-35

## 5. Файли замовлення (`task/ord-files`)

- [ ] 5.1 Міграція `ord_files`: приватний бакет `order-files`, політики на `storage.objects` (лише активний `admin`, префікс
  `<order_id>/`), політики `insert`/`delete` на `order_files` (D7). Перевірка: `node scripts/check-migration-order.mjs`,
  зелений `db-check`; якщо політика на `storage.objects` не проходить — задачу не зливаємо, AC-ORD-14 у матриці
  «відкладено (причина, посилання на рішення)» і запис у `design.md`
- [ ] 5.2 `src/lib/ord/files.ts`: перевірка формату й розміру (Q2), шлях `<order_id>/<uuid>-<ім'я>`; дії `uploadOrderFile`,
  `removeOrderFile` (і видалення зі сховища при `deleteOrder`). Оновити `database.types.ts`. Перевірка: тести 5.4
- [ ] 5.3 `/admin/orders/[id]`: завантаження й перелік файлів для режиму «Підсумок». Перевірка: `npm run build` і ручний
  прохід на Preview (без файлу відправити не можна, з файлом — можна)
- [ ] 5.4 `tests/ord/files.test.ts`: `it("AC-ORD-14: …")` — режим «Підсумок» без файлу відхилено (`ord:file_required`), з
  файлом дозволено. Перевірка: `npm test`
- [ ] 5.5 Рядок AC-ORD-14 у `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-ORD-14

## 6. Видимість для автора, друк, архівування й пошук (`task/ord-visibility`)

- [ ] 6.1 Міграція `ord_visibility`: `request_orders` (обгортка `public.*` + `private` `security definer`, D10) і
  `archive_purchase` (D9). Перевірка: `node scripts/check-migration-order.mjs`, зелений `db-check`; прямий `select` на
  `orders` від автора й від схвалювача через Data API відхилено (результат — в описі PR)
- [ ] 6.2 `/requests/[id]` (PUR): блок «Замовлення» для автора «Самостійної закупівлі» (номер, постачальник, статус,
  сума) і для адміністратора — посилання на `/admin/processing/[id]`; для «Відділ закупівель» — нічого. Перевірка:
  тести 6.5 і `npm run build`
- [ ] 6.3 `/admin/orders/[id]/print` (D10): номер, постачальник, рядки, сума, `@page`/`@media print`; кнопка «Друк» на
  відправленому замовленні. Перевірка: `npm run build` і ручний PDF у A4 та Letter (скріншоти — в описі PR)
- [ ] 6.4 `archivePurchase` у `src/app/admin/processing/[id]/actions.ts`; лічильники «Очікують обробки» й «Оброблено» і
  кнопка «Архівувати» на `/admin/processing`; пошук за номером на `/requests` для адміністратора (з архівними, позначка
  «Архів»). Перевірка: тести 6.5 і `npm run build`
- [ ] 6.5 `tests/ord/visibility.test.ts`: `it("AC-ORD-24: …")`, 25, 26, 28 — відображення списку для автора, відсутність
  для «Відділ закупівель», склад сторінки друку й константи розмірів, архівування (зникає з черги й лічильників,
  лишається в пошуку). Перевірка: `npm test`
- [ ] 6.6 Рядки AC задачі в `docs/conformance.md` → «реалізовано»; archive зміни: `npx openspec archive impl-ord -y`,
  запис екрана з прод-URL. Перевірка: `npm run ac:coverage`, `npx openspec validate --strict`

Done when: AC-ORD-24, AC-ORD-25, AC-ORD-26, AC-ORD-28

## Workflow follow-up

- Після рев'ю цього плану: питання Q1–Q8 (`design.md` D12) — через скіл `spec-clarify` у вебформу «Питання до вимог» репо
  PM, журнал — `docs/spec-reading.md`.
- В останньому PR зрізу (задача 6): `npx openspec archive impl-ord -y`.
- Після відповідей PM: `/requirements-sync` → нова зміна специфікації → правка тимчасових рішень D12.
