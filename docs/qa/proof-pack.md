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
- `/api/health` на момент UAT: sha f458c84, db ok, 02.11.2026

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

Посилання на тести й міграції — на merge-коміті `f458c84` (PR [#48](https://github.com/YarynaPankivv/school-purchasing/pull/48), `main`).

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-FRM-09 | SQL: `revoke` від `anon` на `requests` і функціях подання (`supabase/migrations/20261018182200_org_departments.sql`, `20261021140000_pur_drafts.sql`); TS: `updateSession` у `src/lib/supabase/proxy.ts` (редірект гостя на `/login`) | база (PGlite, `asAnon`) + unit proxy; текст сторінки входу — UAT | відмову гостю тримає SQL, а «бачить сторінку входу» — редірект proxy; TS-копія SQL тут не потрібна | [`tests/db/frm-apr.test.ts#L185`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/db/frm-apr.test.ts#L185) (AC-FRM-09), [`tests/auth/proxy-guest.test.ts`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/auth/proxy-guest.test.ts) (4 тести, нові) |
| AC-FRM-14 | сторінка `src/app/(app)/requests/(list)/page.tsx` (порожній стан «My requests») | unit рендеру сторінки (`renderToStaticMarkup`, мок лише клієнта Supabase) + UAT для дослівного тексту на проді | правило не в SQL: це стан інтерфейсу; точний текст доводить лише UAT | [`tests/pur/pages.test.tsx#L511`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/pur/pages.test.tsx#L511), [`#L530`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/pur/pages.test.tsx#L530), [`#L549`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/pur/pages.test.tsx#L549) (AC-FRM-14: було 1 тест, стало 3) |
| AC-APR-03 | SQL: `requests_select`, `private.can_view_request`, `private.is_department_approver`, `decide_purchase` (`20261021140000_pur_drafts.sql`); сторінка `requests/[id]/page.tsx` (`Forbidden`) | база (PGlite, `asUser` + `asService`-читання статусу) + unit сторінки + UAT | відмова «чужий відділ» — це RLS і функція SQL; TS-дзеркало (`canViewRequest`) окремо; повідомлення «Not enough permissions» доводить UAT | [`tests/db/frm-apr.test.ts#L283`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/db/frm-apr.test.ts#L283) і [`#L340`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/db/frm-apr.test.ts#L340) (AC-APR-03), [`tests/ui/frm-apr-pages.test.tsx#L372`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/ui/frm-apr-pages.test.tsx#L372) |

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

**TS, Stryker 10.1.1** (`npx stryker run --mutate src/lib/supabase/proxy.ts` для `proxy.ts`; `stryker.config.json` виключає `src/lib/supabase/**` із `mutate`, тож без явного `--mutate` результат не повториться):

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `src/lib/supabase/proxy.ts#L51-L55` — гілка гостя в `updateSession` (умова `!claims && !isPublic`, редірект на `/login`; уся функція — `:24–58`) цілком без покриття: 18 мутантів NoCoverage | AC-FRM-09 | не покрито: score 43,75 % (14 убито, 0 вижили, 18 NoCoverage) | [`tests/auth/proxy-guest.test.ts`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/tests/auth/proxy-guest.test.ts): гість (`data: null` і `claims: null`) за прямим посиланням `/requests/new` → 307 на `/login`; `/login` для гостя — без редіректу; користувач з входом — без редіректу | убито: score 71,88 % (23 убито, 3 вижили, 6 NoCoverage); мутанти на гілці гостя вбито |
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

- Еквівалентні мутанти: **F1** — `public.submit_purchase` є `security invoker` і лише викликає `private.submit_purchase`, у якої `execute` забрано в `anon` ([`20261021140000_pur_drafts.sql#L893`](https://github.com/YarynaPankivv/school-purchasing/blob/f458c84/supabase/migrations/20261021140000_pur_drafts.sql#L893), `revoke execute on function private.submit_purchase(uuid) from public, anon`); гість однаково отримує `permission denied`. Тест із точнішим текстом помилки це не розрізнить: повідомлення `permission denied for function submit_purchase` однакове для обох шарів. Причина записана в `scripts/mutants.mjs` (`expect: "survive"`, `reason`).
- Чесне зауваження: усі SQL-мутанти AC-APR-03 були вбиті з першого прогону — тести бази вже були з тексту AC; прогалини знайшли TS-мутанти `proxy.ts` (гілку гостя не виконував жоден тест).

## C. UAT на проді

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-FRM-09 | [`tests/e2e/slice2.spec.ts#L14`](https://github.com/YarynaPankivv/school-purchasing/blob/44384cc/tests/e2e/slice2.spec.ts#L14) | passed | Haiku: PASS | PASS, R6 | [`AC-FRM-09-then-1.png`](https://github.com/YarynaPankivv/school-purchasing/blob/44384cc/docs/qa/uat/2026-11-02/frames/AC-FRM-09-then-1.png) |
| AC-FRM-14 | [`tests/e2e/slice2.spec.ts#L46`](https://github.com/YarynaPankivv/school-purchasing/blob/44384cc/tests/e2e/slice2.spec.ts#L46) | passed | Haiku: NEEDS-HUMAN → Sonnet: PASS | PASS, R6 | [`AC-FRM-14-then-1.png`](https://github.com/YarynaPankivv/school-purchasing/blob/44384cc/docs/qa/uat/2026-11-02/frames/AC-FRM-14-then-1.png) |
| AC-APR-03 | [`tests/e2e/slice2.spec.ts#L115`](https://github.com/YarynaPankivv/school-purchasing/blob/44384cc/tests/e2e/slice2.spec.ts#L115) | passed | Haiku: NEEDS-HUMAN → Sonnet: PASS | PASS, R6 | [`AC-APR-03-then-1.png`](https://github.com/YarynaPankivv/school-purchasing/blob/44384cc/docs/qa/uat/2026-11-02/frames/AC-APR-03-then-1.png) |

- Звіт: [`docs/qa/uat/2026-11-02/report.md`](https://github.com/YarynaPankivv/school-purchasing/blob/44384cc/docs/qa/uat/2026-11-02/report.md) (прод `/api/health`: коміт `f458c84`, 02.11.2026 12:35 за Києвом, Playwright 29,9 с)
- Відео: у вкладенні опису PR (не в git)
- Рецензент: `claude-haiku-5-5`, на двох AC суперечка → `claude-sonnet-5-5`; разом $0,0615 за цінами API
- Негативний контроль (`npm run uat:nc`, 02.11.2026): **NC-1** (AC-FRM-14, у тесті навмисно інший текст порожнього стану) → **FAIL**, R1: твердження впало, агент його не перекриває; **NC-2** (AC-FRM-09, текст «Тоді» у вимозі змінено на «Welcome back», тест і застосунок без змін) → **NEEDS-HUMAN**, R3: твердження зелені, Haiku — NEEDS-HUMAN, Sonnet — FAIL; рядки з PR UAT, звіт NC лишається в `test-results/uat-report-nc/` (не в git).
- Дані: лише читання. `@writes` немає; прибирання: видалено 0, лишилось 0 (рядок «Прибирання» зі звіту). Для AC-APR-03 спека не створює даних: бере наявну подану заявку чужого відділу, яку бачить адміністратор, а схвалювач — ні.
- **Фікстура AC-APR-03 на проді** (спека створює дані лише в CI через `scripts/e2e-seed.mjs`, на проді їх готує людина): під `pm-requester@example.test` подати заявку у відділ **Upper School** (його `pm-approver` не схвалює) хоча б з одним заповненим рядком і не вирішувати її. Якщо заявку вирішили чи скасували, «Дано» спеки падає з повідомленням `на проді немає поданої заявки чужого для pm-approver відділу`, і фікстуру треба подати знову. Варіант без людини — окрема спека `@writes`, яка створює й прибирає заявку (поки не робили).

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-FRM-09, AC-FRM-14, AC-APR-03 | ✅ прийнято 03.11.2026, оцінка 3 за кожен | [коментар PM у PR #49](https://github.com/YarynaPankivv/school-purchasing/pull/49#issuecomment-6605570889); [звірка вердикту агента із записом](https://github.com/YarynaPankivv/school-purchasing/pull/49#issuecomment-6615164580) |

## D. Eval рецензента

- PR з вадами (не злитий, після eval закрито): https://github.com/YarynaPankivv/school-purchasing/pull/52 (гілка `task/refactor-request-summary`, нейтральні коміти й опис; усі обов'язкові перевірки на PR зелені)
- Ключ і таблиця «до правила»: https://github.com/YarynaPankivv/school-purchasing/pull/52#issuecomment-6578245575 (ключ відповідей до прогону зберігався поза репо)
- Рецензенти: CodeRabbit (профіль assertive, uk-UA, `.coderabbit.yaml` репо) і `/code-review high` через `claude -p … --setting-sources project` (модель **claude-opus-5-5**: $0,54 і 62 с до правила, $0,56 і 68 с після)

### До правила

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | права в даних: `supabase/migrations/20261102150000_request_notes.sql:21`, політика `request_notes_select` без перевірки видимості заявки | **знайшов, Critical**: «Обмежте читання нотаток доступом до заявки … дозволяє йому читати нотатки до всіх заявок» | **знайшов**: «only checks private.is_active_user(), so any active user can read the notes of every request» |
| 2 | логіка: `src/lib/pur/visibility.ts:52`, `canEditFields` без `request.author_id === actor.id` | **знайшов, лише Minor**: «Поверніть перевірку автора в `canEditFields` … будь-який активний `admin` або `approver` може отримати `true` для чужої заявки» | **знайшов**: «canEditFields lost the `request.author_id === actor.id` check» (№2 у списку, без рівня) |
| 3 | авторизація в дії: `src/app/api/requests/summary/route.ts:22`, роль admin з `claims.user_metadata.role` | **знайшов, Major**: «Читайте роль адміністратора з `profiles.role` … Користувач також може змінити власний `user_metadata.role`» | **знайшов**: «Admin status is read from `claims.user_metadata.role`, which the user can edit themselves» |
| П | приманка: `private.request_note_count` — `security definer`, `set search_path = ''`, `revoke` від `public`/`anon`, перевіряє `can_view_request` (оформлена правильно) | слабка хибна тривога (Major): радить додати `is_active_user()`, небезпеки не заявляє | слабка хибна тривога: «is not called anywhere … dead code», «extra security definer surface» |

### Інші знахідки

| Знахідка | Хто | Оцінка |
|---|---|---|
| вибірка `requests` без пагінації, ліміт PostgREST 1000 рядків (`route.ts:12`) | обидва | слушна |
| `request_notes_insert` без `is_active_user()` (`…sql:27`) | обидва | слушна |
| роут повторює `getClaims` замість `requireActiveUser` (`route.ts:7`) | `/code-review` | слушна |
| FK `author_id` на `auth.users` з `on delete cascade`, а не на `profiles` з `restrict` | `/code-review` | слушна |
| немає AC, тестів і рядка `conformance.md` для ендпойнта й таблиці | обидва | слушна, але шум для eval: PR навмисно без AC |
| 401-гілка роуту недосяжна: `proxy.ts` редіректить гостя на `/login` | `/code-review` (лише після правила) | слушна |

### Правило, що закриває пропуск

Найслабше місце — вада 2: CodeRabbit позначив пропущену перевірку автора лише як Minor. Правило — один рядок у `AGENTS.md` (його читають обидва рецензенти; `CLAUDE.md` імпортує `@AGENTS.md`):

> Функції прав у `src/lib/pur/visibility.ts` (`canEdit*`, `canChange*`, `canSubmit`) для дій автора завжди перевіряють `request.author_id === actor.id`: інтерфейс не показує дію, яку RLS не дозволить. Прибрана чи пропущена перевірка автора — помилка рівня «must fix» (Major), а не зауваження до стилю.

PR із правилом: https://github.com/YarynaPankivv/school-purchasing/pull/53, коміт `b75262a`; потім `git merge main` у гілку з вадами (`6317e47`).

### Повторний прогін

- `/code-review high 52` після правила (claude-opus-5-5): вада 2 стала **№1 у списку** і сама посилається на правило: «canEditFields no longer checks `request.author_id === actor.id` … AGENTS.md calls a removed author check a must-fix (Major)». Вади 1 і 3 знайдено. Приманку більше не позначено, хибна тривога зникла.
- CodeRabbit після правила — чистий прогін на новому PR 54 (гілка з тими самими комітами з вадами, `main` уже з правилом; на PR 52 CodeRabbit пропускав уже закриті треди): https://github.com/YarynaPankivv/school-purchasing/pull/54#issuecomment-6581159803. Усі три вади — **Major**; вада 2 (`canEditFields`) піднялась з Minor до Major і CodeRabbit послався на правило: «За правилами проєкту, функції `canEdit*` завжди перевіряють, що actor є автором заявки» (джерело в коментарі: Coding guidelines). Приманку не позначено. Додатково слушні: пагінація `route.ts:12`, `request_notes_insert` без `is_active_user()`.
- PR 52 і 54 закрито без merge.

## Бонус: UAT у CI

`.github/workflows/e2e.yml` (джерело — `materials/uat/.github/workflows/e2e.yml` курсу, підлаштований під наш застосунок) на
кожен PR, push у `main` і `workflow_dispatch` піднімає **одноразовий локальний Supabase** у раннері (`supabase start`,
міграції й `supabase/seed.sql`), створює синтетичних користувачів `npm run users:demo` з випадковим паролем, додає дані для
AC-APR-03 `npm run e2e:seed` (`scripts/e2e-seed.mjs`: pm-approver схвалює Primary School, подана заявка pm-requester лежить в
Upper School), збирає застосунок і ганяє специфікації `tests/e2e/*.spec.ts`. Хмарних секретів немає; крок «no skipped tests»
валить прогін, якщо хоч один тест пропущено; звіт і записи — артефактом.

- Зелений прогін `workflow_dispatch` на `main`: https://github.com/YarynaPankivv/school-purchasing/actions/runs/41620421190 (коміт `aac9ff0`, 7 пройшли, 0 впали, 0 пропущено, 0 нестабільних; артефакт `e2e-41620421190`).
- Чому сід: на локальному Supabase немає подачі чужого відділу, яку на проді тримає PM, тож без `e2e:seed` AC-APR-03 лише «пропускався». Тепер він виконується, а не пропускається.
- Висновок: UAT уміє падати й у CI. Після merge виявився флейк хелпера `statusSeenByAdmin` (читав скелет «Loading…» замість сторінки заявки); виправлено очікуванням, поки скелет зникне.
