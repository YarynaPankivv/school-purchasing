# QA proof pack: зріз 2 — ролі, права, форма закупівлі й рішення схвалювача

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Покладіть у docs/qa/proof-pack.md вашого репо й заповнюйте по кроках WS8 (A → B → C → D).
Посилання — на файли на коміті (…/blob/<sha>/…#L<N>), на PR (…/pull/N) і на прогони (…/actions/runs/N).
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://school-purchasing.vercel.app
- Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-10-26
- `/api/health` на момент UAT: sha 0286b5e, db ok, 02.11.2026 (оновити при запуску UAT)

## 3 AC

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-FRM-09 | відмова в браузері (не увійшов) | він бачить сторінку входу, а форму закупівлі не показано. |
| AC-FRM-14 | стан інтерфейсу (порожній стан) | він бачить повідомлення «Ви ще не подали жодної заявки» (в інтерфейсі англійською «You have not submitted any requests yet», requirements/49), а списку заявок немає. |
| AC-APR-03 | відмова в браузері (чужі дані за прямим посиланням) | вона бачить повідомлення «Недостатньо прав» (в інтерфейсі «Not enough permissions»), даних заявки їй не показано, а статус заявки лишається «Очікує схвалення». |

## A. Ворота

- PR воріт: https://github.com/YarynaPankivv/school-purchasing/pull/47
- Зелений `quality` на `main`: https://github.com/YarynaPankivv/school-purchasing/actions/runs/41419965667
- Обов'язкові перевірки в `solo-main` з 02.11.2026: «Ворота: fallow audit», «Покриття: доменна підлога» (поруч із `spec`, `app`, `conformance`, `db-check`)

Розбір першого повного прогону `fallow` (той самий — в описі PR воріт):

| Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|
| Невикористаний файл `src/lib/supabase/client.ts` | 1 | навмисна | `ignorePatterns` у `.fallowrc.jsonc`: браузерний клієнт із шаблону, потрібен першому клієнтському компоненту з запитом до бази |
| Невикористаний експорт `AC_ID_GLOBAL` (`scripts/lib/spec-lib.mjs`) | 1 | навмисна | лишено: така сама знахідка на чистому шаблоні, файл — скрипт курсу |
| Невикористаний експорт `isAwaitingDecision` (`src/lib/pur/statuses.ts`) | 1 | справжня | видалено в цьому PR |
| Невикористаний тип `HistoryRow` (`src/lib/pur/types.ts`) | 1 | справжня | видалено: заготовка історії зрізу 3, WS9 додасть знову |
| Невикористаний тип `AppRole` (`tests/db/supabase-pglite.ts`) | 1 | справжня | видалено |
| Дубльований експорт `copyPurchase` (`requests/[id]/actions.ts` ↔ `lib/pur/copy.ts`) | 1 | хибна | лишено: різні функції (Server Action і чиста функція), через barrel їх ніхто не імпортує |
| Дублікати коду | 9 груп | справжні, давні | лишено: `fallow audit --base` ловить лише нові |
| Складність і розмір функцій | 38 | справжні, давні | лишено: рефакторинг сторінок поза межами WS8, ворота ловлять лише нове |
| Умовний `expect` у тестах (`vitest/no-conditional-*`) | 31 | справжні | переписано на безумовні перевірки; кількість тверджень не впала (`weakened-tests` зелений) |
| AC ID не на початку назви (`submission.test.ts`) | 1 | справжня | ID перенесено на початок |
| `vi.mock` власних модулів (`pages.test.tsx`, `frm-apr-pages.test.tsx`) | 2 | навмисні | `eslint-disable-next-line` з причиною: заглушка клієнтської форми й шпигуни Server Actions; переробка завелика для WS8 |

## B. Якість тестів

Посилання на тести й міграції — на коміті `cb77ca3` (гілка PR треку B).

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-FRM-09 | SQL: `revoke` від `anon` на `requests` і функціях подання (`supabase/migrations/20261018182200_org_departments.sql`, `20261021140000_pur_drafts.sql`); TS: `updateSession` у `src/lib/supabase/proxy.ts` (редірект гостя на `/login`) | база (PGlite, `asAnon`) + unit proxy; текст сторінки входу — UAT | відмову гостю тримає SQL, а «бачить сторінку входу» — редірект proxy; TS-копія SQL тут не потрібна | [`tests/db/frm-apr.test.ts#L185`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/db/frm-apr.test.ts#L185) (AC-FRM-09), [`tests/auth/proxy-guest.test.ts`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/auth/proxy-guest.test.ts) (4 тести, нові) |
| AC-FRM-14 | сторінка `src/app/(app)/requests/(list)/page.tsx` (порожній стан «My requests») | unit рендеру сторінки (`renderToStaticMarkup`, мок лише клієнта Supabase) + UAT для дослівного тексту на проді | правило не в SQL: це стан інтерфейсу; точний текст доводить лише UAT | [`tests/pur/pages.test.tsx#L511`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/pur/pages.test.tsx#L511), [`#L530`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/pur/pages.test.tsx#L530), [`#L549`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/pur/pages.test.tsx#L549) (AC-FRM-14: було 1 тест, стало 3) |
| AC-APR-03 | SQL: `requests_select`, `private.can_view_request`, `private.is_department_approver`, `decide_purchase` (`20261021140000_pur_drafts.sql`); сторінка `requests/[id]/page.tsx` (`Forbidden`) | база (PGlite, `asUser` + `asService`-читання статусу) + unit сторінки + UAT | відмова «чужий відділ» — це RLS і функція SQL; TS-дзеркало (`canViewRequest`) окремо; повідомлення «Not enough permissions» доводить UAT | [`tests/db/frm-apr.test.ts#L283`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/db/frm-apr.test.ts#L283) і [`#L340`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/db/frm-apr.test.ts#L340) (AC-APR-03), [`tests/ui/frm-apr-pages.test.tsx#L372`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/ui/frm-apr-pages.test.tsx#L372) |

### Покриття

`npm run test:coverage` на момент PR (v8, `coverage/coverage-summary.json`):

| Файл за AC | Рядки | Гілки | Чим доведено, якщо мало |
|---|---|---|---|
| `src/lib/supabase/proxy.ts` | 60 % | 100 % | гілка гостя покрита новим тестом; непокрите — `setAll` cookies (оновлення сесії, не AC) |
| `src/lib/auth/session.ts` | 94 % | 93 % | — (підлога 90/85/90/90 у `FLOORED`) |
| `src/app/(app)/requests/(list)/page.tsx` | 84 % | 80 % | текст порожнього стану — тести рендеру; на проді — UAT (трек C) |
| `src/app/(app)/requests/[id]/page.tsx` | 96 % | 72 % | відмову й «Not enough permissions» — тест UI + база; на проді — UAT |
| SQL (RLS, `decide_purchase`, grants) | — | — | JS-покриття SQL не бачить; доведено SQL-мутаціями нижче |

### Доказ мутацією

**TS, Stryker 10.1.1** (`npx stryker run --mutate <файл>`):

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `src/lib/supabase/proxy.ts:24–44` — тіло `updateSession` (умова `!claims && !isPublic`, редірект на `/login`) цілком без покриття: 18 мутантів NoCoverage | AC-FRM-09 | не покрито: score 43,75 % (14 убито, 0 вижили, 18 NoCoverage) | [`tests/auth/proxy-guest.test.ts`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/tests/auth/proxy-guest.test.ts): гість (`data: null` і `claims: null`) за прямим посиланням `/requests/new` → 307 на `/login`; `/login` для гостя — без редіректу; користувач з входом — без редіректу | убито: score 71,88 % (23 убито, 3 вижили, 6 NoCoverage); мутанти на гілці гостя вбито |
| `(list)/page.tsx:224` — умова показу «My requests» і текст порожнього стану; рядок `empty="You have not submitted any requests yet"` | AC-FRM-14 | текст мутантів убивав 1 тест; «списку заявок немає» не перевірялось | 2 нові тести: порожня сторінка — немає `<table` і `PUR-`; працівник із заявкою — повідомлення відсутнє | мутанти на тексті й гілці «є/немає заявок» убиті |

Вижили після посилення (розбір, не приховано):

| Мутант | Категорія | Рішення |
|---|---|---|
| `proxy.ts:17,22,23` — `ObjectLiteral` у `NextResponse.next({ request })` і опціях клієнта | не AC (передача request у відповідь) | лишено |
| `proxy.ts:27–35` — `setAll` cookies, NoCoverage | не AC-FRM-09 (оновлення cookie сесії) | лишено |
| `(list)/page.tsx:114–116, 224:24, 224:53` — `nothingToShow`, `mine.length >= 0` | нерозрізнений вхід: потрібен схвалювач/адміністратор із чергою й без власних заявок; AC-FRM-14 говорить лише про працівника без заявок, поведінка для інших ролей поза AC | лишено; питання до PM про «Мої заявки» для схвалювача без власних заявок — кандидат у «Питання до вимог» |

- Stryker: файли за AC — `proxy.ts` 43,75 % → 71,88 %; `visibility.ts` (TS-дзеркало видимості) 92 % (92 з 100), вижилі — права редагування автора, не AC-APR-03.
- SQL-мутації (`npm run mutation:sql -- --markdown`, PGlite, 6 мутантів, ≈26 с):

| Мутант | AC | Що зламано | Вердикт |
|---|---|---|---|
| A1 | AC-APR-03 | `requests_select`: схвалювач бачить подані заявки будь-якого відділу | KILLED (5 тестів, у т.ч. AC-APR-03) |
| A2 | AC-APR-03 | `can_view_request`: рядки й історія чужої заявки видимі схвалювачу будь-якого відділу | KILLED (AC-FRM-08, AC-APR-03) |
| A3 | AC-APR-03 | `decide_purchase`: рішення дозволено, якщо у заявки є відділ | KILLED (AC-APR-03 ×2, AC-APR-04) |
| A4 | AC-APR-03 | `is_department_approver`: не перевіряє, що схвалювач — поточний користувач | KILLED (6 тестів) |
| F1 | AC-FRM-09 | `submit_purchase`: execute дозволено `anon` | SURVIVED — еквівалентний (див. нижче) |
| F2 | AC-FRM-09 | `requests`: select дозволено `anon` | KILLED (AC-FRM-09) |

- Еквівалентні мутанти: **F1** — `public.submit_purchase` є `security invoker` і лише викликає `private.submit_purchase`, у якої `execute` забрано в `anon` ([`20261021140000_pur_drafts.sql#L893`](https://github.com/YarynaPankivv/school-purchasing/blob/cb77ca34ec27bcf01919cafdbda04001b6a7e9f8/supabase/migrations/20261021140000_pur_drafts.sql#L893), `revoke execute on function private.submit_purchase(uuid) from public, anon`); гість однаково отримує `permission denied`. Тест із точнішим текстом помилки це не розрізнить: повідомлення `permission denied for function submit_purchase` однакове для обох шарів. Причина записана в `scripts/mutants.mjs` (`expect: "survive"`, `reason`).
- Чесне зауваження: усі SQL-мутанти AC-APR-03 були вбиті з першого прогону — тести бази вже були з тексту AC; прогалини знайшли TS-мутанти `proxy.ts` (гілку гостя не виконував жоден тест).

## C. UAT на проді

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-FRM-09 | [`tests/e2e/slice2.spec.ts#L14`](https://github.com/YarynaPankivv/school-purchasing/blob/8f4752081f4430cef273c15e714f49da7543dd3a/tests/e2e/slice2.spec.ts#L14) | passed | Haiku: PASS | PASS, R6 | [`AC-FRM-09-then-1.png`](https://github.com/YarynaPankivv/school-purchasing/blob/8f4752081f4430cef273c15e714f49da7543dd3a/docs/qa/uat/2026-11-02/frames/AC-FRM-09-then-1.png) |
| AC-FRM-14 | [`tests/e2e/slice2.spec.ts#L46`](https://github.com/YarynaPankivv/school-purchasing/blob/8f4752081f4430cef273c15e714f49da7543dd3a/tests/e2e/slice2.spec.ts#L46) | passed | Haiku: NEEDS-HUMAN → Sonnet: PASS | PASS, R6 | [`AC-FRM-14-then-1.png`](https://github.com/YarynaPankivv/school-purchasing/blob/8f4752081f4430cef273c15e714f49da7543dd3a/docs/qa/uat/2026-11-02/frames/AC-FRM-14-then-1.png) |
| AC-APR-03 | [`tests/e2e/slice2.spec.ts#L115`](https://github.com/YarynaPankivv/school-purchasing/blob/8f4752081f4430cef273c15e714f49da7543dd3a/tests/e2e/slice2.spec.ts#L115) | passed | Haiku: NEEDS-HUMAN → Sonnet: PASS | PASS, R6 | [`AC-APR-03-then-1.png`](https://github.com/YarynaPankivv/school-purchasing/blob/8f4752081f4430cef273c15e714f49da7543dd3a/docs/qa/uat/2026-11-02/frames/AC-APR-03-then-1.png) |

- Звіт: [`docs/qa/uat/2026-11-02/report.md`](https://github.com/YarynaPankivv/school-purchasing/blob/8f4752081f4430cef273c15e714f49da7543dd3a/docs/qa/uat/2026-11-02/report.md) (прод `/api/health`: коміт `f458c84`, 02.11.2026 12:35 за Києвом, Playwright 29,9 с)
- Відео: у вкладенні опису PR (не в git)
- Рецензент: `claude-haiku-5-5`, на двох AC суперечка → `claude-sonnet-5-5`; разом $0,0615 за цінами API
- Негативний контроль: <!-- NC-1 / NC-2 (npm run uat:nc) — додам після прогону -->
- Дані: лише читання. `@writes` немає; прибирання: видалено 0, лишилось 0 (рядок «Прибирання» зі звіту). Для AC-APR-03 спека не створює даних: бере наявну подану заявку чужого відділу, яку бачить адміністратор, а схвалювач — ні.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-…-NN | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |

## D. Eval рецензента

- PR з вадами (не злитий): <!-- …/pull/N -->
- Ключ і таблиця: <!-- …/pull/N#issuecomment-M -->

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | <!-- категорія і файл:рядок --> | <!-- знайшов / пропустив + цитата --> | <!-- знайшов / пропустив + цитата --> |
| 2 | … | … | … |
| 3 | … | … | … |
| П | приманка: <!-- що --> | <!-- хибна тривога? цитата --> | <!-- хибна тривога? цитата --> |

- Інші знахідки: <!-- слушна / шум, по рядку на кожну -->
- Правило, що закриває пропуск: <!-- рядок в AGENTS.md чи path instruction, …/commit/<sha> -->
- Повторний прогін: <!-- хто, результат, цитата, …/pull/N#issuecomment-M -->
