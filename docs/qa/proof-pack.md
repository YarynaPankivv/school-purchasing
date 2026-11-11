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
- Негативний контроль (`npm run uat:nc`, 02.11.2026): **NC-1** (AC-FRM-14, у тесті навмисно інший текст порожнього стану) → **FAIL**, R1: твердження впало, агент його не перекриває; **NC-2** (AC-FRM-09, текст «Тоді» у вимозі змінено на «Welcome back», тест і застосунок без змін) → **NEEDS-HUMAN**, R3: твердження зелені, Haiku — NEEDS-HUMAN, Sonnet — FAIL; рядки з PR UAT, звіт NC лишається в `test-results/uat-report-nc/` (не в git).
- Дані: лише читання. `@writes` немає; прибирання: видалено 0, лишилось 0 (рядок «Прибирання» зі звіту). Для AC-APR-03 спека не створює даних: бере наявну подану заявку чужого відділу, яку бачить адміністратор, а схвалювач — ні.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-…-NN | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |

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

---

# WS9: зріз 3 — рішення схвалювача, історія й підписи статусів (9 AC)

- Прод-URL: https://school-purchasing.vercel.app
- Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-11-09
- `/api/health` на момент UAT: коміт `d45d876`, db ok, 10.11.2026
- Спосіб: звичайний (специфікація → задачі з PR і CodeRabbit → merge → `db-deploy` → UAT на проді). Фабрику (бонус) не запускали.
- Специфікація: `openspec/specs/` (зміна `add-dec-hist`, архів `openspec/changes/archive/2026-11-07-add-dec-hist`), план — `openspec/changes/impl-dec-hist/` (design.md, tasks.md).

## Таблиця доказів: 9 AC

База — `tests/db/dec-hist.test.ts` (PGlite, міграції як у проді), unit — `tests/pur/*.test.ts(x)`, UAT — `tests/e2e/slice3.spec.ts`
на коміті `d45d876`. У колонці «PR» — merge-коміти в `main`.

| AC | Правило живе в | Тест (рівень) | Доказ, що тест може впасти | UAT на проді | PR | Вердикт |
|---|---|---|---|---|---|---|
| AC-DEC-01 | SQL `decide_purchase` (статус «Частково схвалено» за відхиленим рядком); сторінка заявки | база `dec-hist.test.ts:79`; unit `pages.test.tsx:370` | мутант **D2** KILLED (`scripts/mutants.mjs`) | PASS, R6; [`slice3.spec.ts#L39`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L39); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L13); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-DEC-01-then-1.png) | [#68](https://github.com/YarynaPankivv/school-purchasing/pull/68) `cde1607` | доведено на всіх рівнях |
| AC-DEC-04 | SQL `decide_purchase` (повернення з причиною → «Повернено на доопрацювання») | база `dec-hist.test.ts:106` | окремого мутанта немає (див. «Не перевірено»); сусідню гілку (причина обов'язкова) б'ють D1 і D4 | PASS, R6; [`#L84`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L84); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L14); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-DEC-04-then-1.png) | #68 `cde1607` | доведено; мутацією лише побічно |
| AC-DEC-06 | SQL `private.pur_clean_reason` і `decide_purchase` (причина обов'язкова, пробільні символи обрізаються) | база `dec-hist.test.ts:127`, `:145` | мутанти **D1**, **D4** KILLED; **D5** SURVIVED — еквівалентний: PGlite — PG 18, де `E'\v'` це вертикальна табуляція; у проді PG 17 це літера `v`, але в міграції `chr(11)`, тож результат однаковий | PASS, R6; [`#L117`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L117); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L15); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-DEC-06-then-1.png) | #68 `cde1607` | доведено, 1 еквівалентний мутант розібрано |
| AC-DEC-07 | SQL `submit_purchase` (повторне подання повернутої → «Очікує схвалення») | база `dec-hist.test.ts:153` | мутант **D3** KILLED | PASS, R6; [`#L151`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L151); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L16); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-DEC-07-then-1.png) | #68 `cde1607` | доведено |
| AC-HIST-01 | SQL: послідовність `private.purchase_number_seq` і тригер `assign_request_number` | база `dec-hist.test.ts:179` (порожня база: PUR-1, PUR-2) | мутант **N1** KILLED (доданий у цьому PR) | PASS, R6; [`#L194`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L194); перевіряє лише відносний порядок (див. «Не перевірено»); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L19); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-HIST-01-then-1.png) | [#70](https://github.com/YarynaPankivv/school-purchasing/pull/70) `83ae2c4` | доведено в базі; на проді частково |
| AC-HIST-02 | TS `src/lib/pur/totals.ts` (суми рядків і заявки в центах) | unit `tests/pur/lines.test.ts:66`, `pages.test.tsx:394`, `:423` | Stryker у функціях сум (`lineTotalCents`, `requestTotalCents`, `formatCents`): 17 з 21 мутантів вбито, 4 вижили, усі на `totals.ts:9` (гілка «незаповнений рядок чернетки → 0» — це AC-PUR-06, не AC-HIST-02) | PASS, R6; [`#L232`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L232); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L20); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-HIST-02-then-1.png) | #70 `83ae2c4` | доведено |
| AC-HIST-06 | SQL `submit_purchase` (запис `submitted`); TS `formatHistoryTime` (`ДД.ММ.РРРР, ГГ:ХХ`, America/New_York) | база `dec-hist.test.ts:213`; unit `time.test.ts:6,10,15`, `pages.test.tsx:329,335` | мутант **H2** KILLED (доданий у цьому PR); Stryker, функція `formatHistoryTime`: 23 з 26 вбито, 2 вижили (`time.ts:54` вхід `null`, `:57` запасне значення) і 1 NoCoverage (`:57`) — захисні гілки, у AC їх немає | PASS, R6; [`#L267`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L267); еталон формату в спеці — незалежний `Intl.DateTimeFormat`, а не імпорт функції застосунку; [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L21); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-HIST-06-then-1.png) | [#71](https://github.com/YarynaPankivv/school-purchasing/pull/71) `8852f10` | доведено |
| AC-HIST-10 | SQL `request_history_select` (через `can_view_request`); сторінка заявки (`Forbidden`) | база `dec-hist.test.ts:235`; unit `pages.test.tsx:289` | мутант **H1** KILLED | PASS, R6; [`#L315`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L315); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L22); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-HIST-10-then-1.png) | #71 `8852f10` | доведено |
| AC-LANG-09 | TS `src/lib/pur/statuses.ts` (`PURCHASE_STATUS_LABELS`) | unit `interface-language.test.ts:115`, `pages.test.tsx:670` | Stryker `statuses.ts`: 91 з 95 вбито; 4 вижили — `typeof`-охоронці `isPurchaseStatus` і `isLineStatus` (`:31`, `:35`) та `isTerminal` (`:50`); жоден не торкається текстів підписів | PASS, R6; [`#L354`](https://github.com/YarynaPankivv/school-purchasing/blob/d45d876482087a8b4b2b61ff3aa9454d96f65431/tests/e2e/slice3.spec.ts#L354); [рядок звіту](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md#L23); [кадр](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/frames/AC-LANG-09-then-1.png) | [#69](https://github.com/YarynaPankivv/school-purchasing/pull/69) `e95e2e9` | доведено |

SQL-мутації (`npm run mutation:sql -- --markdown`, PGlite, 14 мутантів, 81 с): **12 з 14 вбито**, 2 прийнято як еквівалентні
(**F1** зі зрізу 2 і **D5**), обидва з поясненням у `scripts/mutants.mjs`. Мутанти зрізу 3: D1–D5, H1, H2, N1.
Специфікації UAT на 9 AC і `npm run uat:cleanup` — [#72](https://github.com/YarynaPankivv/school-purchasing/pull/72) `467d068`.

## UAT на проді

- Звіт: [`docs/qa/uat/2026-11-10/report.md`](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md) (прод `/api/health`: коміт `d45d876`), PR [#75](https://github.com/YarynaPankivv/school-purchasing/pull/75) `004199f`.
- Прогін: 16 з 16 тестів, 12 AC у звіті — **PASS 12, FAIL 0, NEEDS-HUMAN 0** (9 AC зрізу 3 і AC-FRM-09, AC-FRM-14, AC-APR-03 зі зрізу 2); правило R6.
- Рецензент `claude-haiku-5-5`; на AC-APR-03, AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-FRM-14, AC-HIST-10 суперечка → `claude-sonnet-5-5`, у всіх Sonnet — PASS. Разом $0,2409 за цінами API.
- Перший прогін (до #74) давав NEEDS-HUMAN на AC-DEC-01 і AC-HIST-06: кадр «Тоді» був обрізаний висотою екрана 800 px, а не вадою продукту. Виправлення — вищий екран у цих двох кроках ([#74](https://github.com/YarynaPankivv/school-purchasing/pull/74) `d45d876`), повторний прогін — PASS.
- [#73](https://github.com/YarynaPankivv/school-purchasing/pull/73) `62fbdf5`: `afterEach` більше не чекає запитів без відповіді (на проді 9 тестів із `@writes` зависали).
- Негативний контроль (`npm run uat:nc`, 10.11.2026): **NC-1** (AC-FRM-14, у тесті навмисно інший текст) → **FAIL**, R1; **NC-2** (AC-FRM-09, текст «Тоді» уточнено, тест і застосунок ні) → **NEEDS-HUMAN**, R3 (Haiku і Sonnet — FAIL). PASS не отримав жоден. Звіт NC — у `test-results/uat-report-nc/` (не в git).
- Дані: синтетичні `uat-*@example.test`, видалено 16, лишилось 0 (рядок «Прибирання» зі звіту); `npm run uat:cleanup` після прогону — «нічого прибирати».
- Відео й траси: не в git, лишаються локально в `test-results/`.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-DEC-01, 04, 06, 07, AC-HIST-01, 02, 06, 10, AC-LANG-09 | рішення PM ще немає | коментар-підпис або issue «Відхилення від вимог» з'явиться в репо PM |

## Не перевірено

- **AC-HIST-01 на проді:** вимога «перша й друга закупівлі мають PUR-1 і PUR-2» припускає порожню базу, а на проді нумерація спільна для всіх. UAT перевіряє лише, що дві поспіль подані заявки отримали різні номери в зростаючому порядку без стороннього між ними. Точні PUR-1 і PUR-2 доведено лише в базі тесту (`dec-hist.test.ts:179`, мутант N1).
- **AC-DEC-04, мутація:** окремого SQL-мутанта немає; повернення з причиною — звичайний шлях `decide_purchase`. Це слабший доказ, ніж для інших AC.
- **Stryker зрізу 3** запускали лише на файлах цих AC (`time.ts`, `lines.ts`, `totals.ts`, `statuses.ts`), не на всьому `src/lib/pur`; повний `npm run mutation:ts` не гнали. Для `lines.ts` вижилі мутанти не розбирали.
- **Вижилі TS-мутанти** (`totals.ts:9`, `time.ts:54,57`, `statuses.ts:31,35,50`) не про AC зрізу 3; тестів під них не дописували.
- **Приймання PM** — ще немає.
