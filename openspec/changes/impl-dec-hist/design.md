# Design

## Context

Поведінка — в `openspec/specs/{decision-outcomes,request-numbers-totals,request-history,ui-language}`, мотивація — в
`proposal.md`. Більшість правил уже діє в базі й на сторінках зрізу PUR (`impl-pur`) під власними ID:
`private.decide_purchase`, `private.submit_purchase`, тригер нумерації, `public.request_history`, політика
`request_history_select` через `private.can_view_request` (`supabase/migrations/20261021140000_pur_drafts.sql`,
`20261103140000_submit_without_auto_approval.sql`); дзеркала для UI — `src/lib/pur/{decisions,statuses,visibility,numbers,totals,time}.ts`;
сторінка заявки — `src/app/(app)/requests/[id]/page.tsx` (картка «History»). Ухвалені рішення —
`docs/decisions/0001…0005`; ADR 0003: права — в базі, а не лише в Server Action.

Обмеження з AGENTS.md: схема — лише міграцією в PR; RLS, `revoke all`, явні `grant`, політика на кожну операцію;
роль — з `profiles.role`; авторизація на сервері — `getClaims()`; функції прав у `src/lib/pur/visibility.ts` для дій автора
перевіряють `request.author_id === actor.id`; нові залежності й міграції — лише після рішення людини.

Прогалини: для зрізу 3 немає тестів на рівні бази (PGlite) під ID PM; існуючі тести рішень мокають `rpc`
(`tests/pur/decisions-actions.test.ts`) і самі по собі не доводять відмову; запис історії має інший вигляд, ніж записав
PM (ValiaBihun/2026-quitcode-dream-team#74); UAT і proof pack на ці AC відсутні.

## Goals / Non-Goals

**Goals:** кожен з 9 AC має тест під ID PM на правильному рівні й UAT-запис на проді; відмовні правила (AC-DEC-06,
AC-HIST-10) доведено тестом бази й мутантом, що його вбиває; запис «Подано» має формат PM.

**Non-Goals:** нові таблиці й міграції (схему зріз не змінює); зміна моменту присвоєння номера (PM відповіла варіантом B:
номер при створенні чернетки, ValiaBihun/2026-quitcode-dream-team#76); поведінки, прибрані PM зі зрізу.

## Decisions

### UI і компоненти (AC-HIST-02, AC-HIST-06, AC-LANG-09, AC-DEC-01)

- Сторінка заявки: суми рядків і заявки — `requestTotal`, `LiveLineTotal`, у доларах з двома знаками (AC-HIST-02). Сума
  заявки — завжди сума **всіх** її рядків, зокрема для «Частково схвалено»: відхилені рядки лише позначено статусом
  (Припущення PM, ValiaBihun/2026-quitcode-dream-team#65). Зараз сторінка рахує `requestTotal(forwardedLines(lines))`, тобто без
  відхилених, — це розходиться з Припущенням PM, тож `Request total` рахуємо за всіма рядками, а суму лише схвалених
  показуємо окремим підписом «Approved total» (зберігає AC-PUR-42 «далі йдуть лише схвалені рядки»); тест
  `AC-PUR-42` у `tests/pur/pages.test.tsx` оновлюємо разом із кодом.
- Історія — картка «History» на сторінці заявки, а не окрема сторінка: «пряме посилання на історію» (AC-HIST-10) — це
  адреса заявки `/requests/[id]`, яка для чужого відділу віддає `Forbidden` без даних. Власне рішення розробника, не змінює
  поведінки PM (`docs/spec-reading.md`, власні припущення).
- Запис історії — один рядок за формулою PM: «Submitted · <ім'я або email> · 05.11.2026, 14:32» (AC-HIST-06,
  ValiaBihun/2026-quitcode-dream-team#74). Для цього в `src/lib/pur/time.ts` — `formatHistoryTime`: `ДД.ММ.РРРР, ГГ:ХХ`,
  24-годинний час, `America/New_York`, без позначки поясу; `formatDateTime` лишається для інших місць. Підпис дії — з
  `HISTORY_LABELS`; ім'я — `actor_name`, інакше підпис із `names`, інакше email.
- Статуси «Partially approved» і «Returned for revision» — текст у `PurchaseStatusBadge` (колір лише підсилює) у списку
  й на сторінці заявки (AC-LANG-09; «в історії» у WS9 не перевіряється, ValiaBihun/2026-quitcode-dream-team#75).
- Рішення схвалювача на сторінці заявки — наявні форми «Approve»/«Return for revision» з причиною; при поверненні
  без причини — повідомлення «Provide a reason» (AC-DEC-06; таблиця PM #49) і незмінений статус.

### Дані й RLS (AC-DEC-01, 04, 06, 07; AC-HIST-01, 06, 10)

Нових таблиць і міграцій немає. Права й переходи тримає база, TS-код лише відображає:

- `decide_purchase(approve)`: відхилений рядок + схвалення дає статус `partially_approved`, рядки отримують статуси
  `rejected`/`approved` (AC-DEC-01); `decide_purchase(return)` з причиною — `returned` (AC-DEC-04), без причини —
  `pur:reason_required` і статус `pending` не змінюється (AC-DEC-06).
- `submit_purchase` для `returned`: автор подає повторно, статус `pending`, відділ той самий (AC-DEC-07); не-автор — відмова.
- Номер: послідовність `private.purchase_number_seq` і тригер `requests_assign_number`; перша заявка на порожній базі —
  `PUR-1`, наступна — `PUR-2` (AC-HIST-01). Номер дає створення чернетки (AC-PUR-01); для двох заявок, створених і поданих
  послідовно, це збігається з поданням. PM відповіла варіантом B (ValiaBihun/2026-quitcode-dream-team#76): номер може
  видаватися при створенні чернетки, прогалини від неподаних чи видалених чернеток допустимі, номер не повторюється; тож
  нумерацію не міняємо, міграції й ADR не потрібні.
- Історія: `request_history_select` через `private.can_view_request` — автор, особа «від імені», admin або схвалювач
  відділу (лише не-чернетки); схвалювач чужого відділу бачить нуль рядків історії й не відкриває заявку (AC-HIST-10).
  Автор-схвалювач іншого відділу бачить власну історію (матриця прав PM; AC-HIST-06).
- Запис «Подано» пише `submit_purchase` разом з `actor_name`; повторне подання дає ще один запис (Припущення PM,
  ValiaBihun/2026-quitcode-dream-team#67), у WS9 перевіряється перший.

### Auth (AC-DEC-06, AC-DEC-07, AC-HIST-10)

- Сторінки й Server Actions зрізу починаються з `requireActiveUser()`/`authorRequest` (`getClaims()`); proxy лише оновлює
  сесію. Рішення приймає rpc з перевіркою ролі всередині (ADR 0003, `check:actions`).
- Дії автора (`canSubmit` для AC-DEC-07) у `visibility.ts` перевіряють `request.author_id === actor.id`; тест
  `tests/pur/visibility.test.ts` має негативний випадок «не автор не подає». Прибрана чи пропущена перевірка — помилка
  рівня «must fix».

### Тести (AC-DEC, AC-HIST, AC-LANG-09)

- Рівні: правила рішень, повторного подання, нумерації й закритості історії — PGlite (`tests/db/dec-hist.test.ts`,
  `asUser`/`asService`): ці правила живуть у SQL, тому мок `rpc` їх не доводить. Суми й формат часу — unit (`tests/pur/lines.test.ts`,
  `tests/pur/time.test.ts`). Що видно на екрані (статуси рядків, номер, запис «Подано», підписи статусів) — сторінкові тести
  (`tests/pur/pages.test.tsx`, `tests/ui/*`) і UAT.
- Назва кожного тесту починається з AC ID PM; очікування в `expect` — значення з «Тоді»; тести пише нова сесія агента або до
  коду (maker ≠ checker).
- Доказ, що тест здатен упасти: мутанти `npm run mutation:sql` — D1 (return без причини дозволено → AC-DEC-06), D2 (часткове
  схвалення дає `approved` → AC-DEC-01), D3 (`submit_purchase` для `returned` лишає статус → AC-DEC-07), H1 (`request_history_select`
  без `can_view_request` → AC-HIST-10) у `scripts/mutants.mjs`; кожен — один раз у файлі, `KILLED`.
- Доменні файли зрізу (`time.ts` тощо) лишаються під підлогою покриття; ворота WS8 («fallow audit», «доменна підлога») зелені.

### UAT на проді (усі 9 AC)

- Специфікація Playwright `tests/e2e/slice3.spec.ts`: назва з AC ID, анотація `ac`, тег `@uat`; `given`/`when`/`thenStep`,
  «Тоді» дослівно з `requirements/63`, `64`, `49`; невидиме («що не змінилося») — теж твердженнями.
- AC, що пишуть дані (DEC-01, 04, 07, HIST-01), — на проді лише з синтетичними `uat-<запуск>@example.test` і прибиранням
  після себе (`tests/e2e/support/admin.ts`, `cleanup.teardown.ts`); решта (DEC-06, HIST-02, 06, 10, LANG-09) — на тих самих
  синтетичних заявках або лише читають. Акаунти ролей — наявні `pm-requester`, `pm-approver`, `pm-admin` (`accounts.zip`).
- Прогін `npm run uat -- --url <прод>`, рецензент «наосліп» і звіт `docs/qa/uat/<дата>/`; негативний контроль `npm run uat:nc` —
  FAIL. AC, який довести не вдалося, — у «Не перевірено» proof pack з причиною.

## Risks / Trade-offs

- PGlite емулює Auth і PostgREST спрощено: тести бази перевіряють політики, grant і функції, а не Data API.
- AC-HIST-01 на проді: у базі вже є заявки зрізу 2, тож «перша — `PUR-1`» перевіряє лише автотест на порожній базі, а на
  проді — два номери поспіль `PUR-n` і `PUR-(n+1)` (ValiaBihun/2026-quitcode-dream-team#73); чернетка, створена й не
  подана між ними, дала б прогалину, тож для UAT дві заявки створюємо й подаємо одна за одною — саме так PM приймає
  AC-HIST-01 (відповідь на #76, варіант B). Прод спільний: якщо чужа чернетка потрапить між двома заявками UAT, перевірка
  хибно впаде. Тому до й після прогону читаємо `number` обох заявок і найбільший `number` у базі секретним ключем
  (`tests/e2e/support/admin.ts`): якщо між ними з'явився сторонній номер — прогін повторюємо; якщо ізолювати не вдалося — AC
  іде в «Не перевірено» proof pack з причиною, а не з вигаданим PASS.
- AC-HIST-10: передумова «з історією рішень» не зводиться до запису «Подано»: перед тестом бази й UAT схвалювач відділу
  заявки приймає рішення (наприклад, повертає заявку з причиною через `decide_purchase`), і тест перевіряє, що в історії є запис
  рішення від імені цього користувача; лише тоді схвалювач іншого відділу відкриває історію. Записи про рішення як окремі AC
  PM виносить за межі WS9 (#75), але їх дає наявний код, а передумова AC-HIST-10 їх прямо називає.
- UAT на проді пише дані в базу, спільну з PM: лише синтетичні користувачі й прибирання; без `SUPABASE_SECRET_KEY` у GitHub
  Secrets (лише локально). Teardown Playwright не виконується, якщо процес зупинили після подання заявки, тож є окреме
  очищення (`scripts/uat-cleanup.mjs`, `npm run uat:cleanup`): воно видаляє користувачів за маскою `uat-*@example.test` разом
  з їхніми заявками й перевіряє, що їх більше немає; запускаємо його до й після кожного прогону.
- Proof pack посилається на конкретну версію: `deployedSha` зі звіту UAT порівнюємо з SHA в `/api/health` на момент
  фіналізації. Якщо після UAT у `main` потрапили зміни, що могли вплинути на AC, UAT для цих AC повторюємо й оновлюємо
  proof pack.

## Migration Plan

Міграцій немає. Порядок: PR «Специфікація» (цей план) → PR «Реалізація» задачі 1 (тести рішень у PGlite) → задача 2 (нумерація й
суми) → задача 3 (історія) → задача 4 (статуси) → задача 5 (UAT на проді) → задача 6 (proof pack, conformance, ретро, archive).
Прод-перевірка PM — після `db-deploy` і злиття задач 1–5. Дедлайн звіту UAT — Вт 10.11; здача — Нд 15.11.
