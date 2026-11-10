# Tasks

Кожна група — PR «Реалізація» (`task/<коротко>`); галочки й рядки `docs/conformance.md` її AC — у тому самому PR.
Рішення — `design.md`. У кожному PR: зелені `spec`, `app`, `conformance`, `db-check`, «fallow audit» і «доменна підлога»;
`@coderabbitai review` окремим коментарем і відповідь на кожну знахідку; після злиття — зелений `db-deploy`.

## 1. Рішення схвалювача й повторне подання: тести бази (`task/dec-db-tests`)

- [x] 1.1 `tests/db/dec-hist.test.ts` (PGlite, `asUser`): `it("AC-DEC-01: …")` — відхилений рядок 2 з трьох і схвалення дають
  `partially_approved`, рядок 2 `rejected`, рядки 1 і 3 `approved`; `it("AC-DEC-04: …")` — повернення з причиною дає
  `returned`; `it("AC-DEC-06: …")` — повернення без причини дає `pur:reason_required`, статус лишається `pending`;
  `it("AC-DEC-07: …")` — виправлена повернена заявка після `submit_purchase` — `pending`, відділ той самий; не-автор повторно
  не подає. Перевірка: `npm test`
- [x] 1.2 Сторінковий тест під ID PM у `tests/pur/pages.test.tsx`: автор бачить статуси рядків частково схваленої заявки
  (`AC-DEC-01`). Перевірка: `npm test`
- [x] 1.3 Мутанти D1, D2, D3 у `scripts/mutants.mjs` (return без причини дозволено; часткове схвалення дає `approved`;
  `submit_purchase` для `returned` не міняє статус) — `npm run mutation:sql` → `KILLED`; таблиця «AC → що зламали → який тест упав»
  в описі PR. Перевірка: `npm run mutation:sql`
- [x] 1.4 Рядки AC-DEC-01, 04, 06, 07 у `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07

## 2. Номер заявки й суми (`task/hist-numbers-totals`)

- [x] 2.1 `tests/db/dec-hist.test.ts`: `it("AC-HIST-01: …")` — на порожній базі перша й друга закупівлі, створені й подані
  послідовно, мають номери 1 і 2 (у «Мої заявки» — `PUR-1`, `PUR-2`). Перевірка: `npm test`
- [x] 2.2 Сума заявки — сума всіх рядків, зокрема відхилених; «Approved total» — лише схвалених; оновити тест
  `AC-PUR-42`. `tests/pur/lines.test.ts` і `tests/pur/pages.test.tsx`: `it("AC-HIST-02: …")` — рядки 60.00 і 31.00, сума 91.00.
  У сторінковому тесті `AC-PUR-42` — частково схвалена заявка: схвалені рядки 60.00 і 7.00, відхилений 10.00; `Request total`
  77.00, `Approved total` 67.00, кожна сума прив'язана до свого підпису. Перевірка: `npm test`
- [x] 2.3 Рядки AC-HIST-01, 02 у `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-HIST-01, AC-HIST-02

## 3. Історія заявки: запис «Подано» і закритість чужому відділу (`task/hist-history`)

- [ ] 3.1 `src/lib/pur/time.ts`: `formatHistoryTime` («05.11.2026, 14:32», 24 год, `America/New_York`, без позначки поясу) і
  `tests/pur/time.test.ts`; картка «History» показує «Submitted · <ім'я або email> · <час>». Оновити тести `AC-PUR-37`, `AC-PUR-39`
  під новий формат. Перевірка: `npm test`
- [ ] 3.2 `it("AC-HIST-06: …")` у `tests/pur/pages.test.tsx` (запис з іменем автора, датою й часом; email, якщо імені немає) і
  у `tests/db/dec-hist.test.ts` (рядок історії `submitted` з `actor_name`). Перевірка: `npm test`
- [ ] 3.3 `it("AC-HIST-10: …")` у `tests/db/dec-hist.test.ts`: заявка має історію рішень (схвалювач її відділу повертає
  заявку з причиною, у `request_history` є запис рішення з його іменем); схвалювач іншого відділу читає нуль рядків
  `request_history` і не відкриває заявку, статус не змінився; автор-схвалювач іншого відділу бачить власну історію; сторінковий тест — `Forbidden`
  без історії. Мутант H1 у `scripts/mutants.mjs` (`request_history_select` без `can_view_request`) → `KILLED`. Перевірка:
  `npm test`, `npm run mutation:sql`
- [ ] 3.4 Рядки AC-HIST-06, 10 у `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-HIST-06, AC-HIST-10

## 4. Підписи нових статусів (`task/lang-09-statuses`)

- [x] 4.1 `it("AC-LANG-09: …")` у `tests/pur/pages.test.tsx` і `tests/ui/interface-language.test.ts`: статуси «Partially approved» і
  «Returned for revision» підписано текстом у списку й на сторінці заявки, не лише кольором; «в історії» не перевіряємо
  (ValiaBihun/2026-quitcode-dream-team#75). Перевірка: `npm test`
- [x] 4.2 Рядок AC-LANG-09 у `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-LANG-09

## 5. UAT зрізу 3 на проді (`task/uat-ws9`)

- [ ] 5.1 `tests/e2e/slice3.spec.ts`: специфікація на кожен з 9 AC — назва з ID, анотація `ac`, тег `@uat`,
  `given`/`when`/`thenStep`, «Тоді» дослівно з `requirements/63`, `64`, `49`; AC, що пишуть дані (DEC-01, 04, 07, HIST-01),
  — з `uat-<запуск>@example.test` і прибиранням (`tests/e2e/support/admin.ts`); для AC-HIST-01 — перевірка ізоляції номерів
  (немає стороннього номера між двома заявками, інакше повтор або «Не перевірено»); для AC-HIST-10 — передумова з записом
  рішення. Перевірка: `npm run test:e2e` на локальному стеку
- [ ] 5.2 `scripts/uat-cleanup.mjs` і `npm run uat:cleanup`: окреме очищення за маскою `uat-*@example.test` (користувачі й їхні
  заявки) на випадок перерваного прогону, з перевіркою, що залишків немає; запуск до й після прогону. Перевірка:
  `npm run uat:cleanup` двічі (другий раз — «нічого прибирати»)
- [ ] 5.3 Прогін `npm run uat -- --url <прод>` після `db-deploy`, рецензент «наосліп» і звіт `docs/qa/uat/<дата>/` (`report.md`,
  `manifest.json`, `frames/`); відео — вкладенням в описі PR. Перевірка: `npm run uat:review`
- [ ] 5.4 Негативний контроль: `npm run uat:nc` → FAIL, а не PASS. Перевірка: `npm run uat:nc`

Done when: AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-HIST-01, AC-HIST-02, AC-HIST-06, AC-HIST-10, AC-LANG-09

## 6. Proof pack, ретро, прод і archive (`task/proof-pack-ws9`)

- [ ] 6.1 `docs/qa/proof-pack.md` за шаблоном WS9: рядок на кожен з 9 AC (рівень і назва тесту, доказ, що тест здатен упасти,
  специфікація, рядок звіту UAT і кадр, вердикт, PR і SHA злиття) і розділ «Не перевірено» з причинами; `deployedSha` зі
  звіту UAT порівняно з SHA в `/api/health` на момент фіналізації (якщо `main` змінився й це могло вплинути на AC — UAT повторено).
  Перевірка: рядок на кожен AC
- [ ] 6.2 `docs/qa/retro-ws9.md`: до 10 рядків «що б ви взяли з фабрики у свій звичайний процес» — «уже є», «візьмемо: <конкретний
  крок і де>», «не потрібно, бо …». Перевірка: у кожного «візьмемо» є файл чи налаштування
- [ ] 6.3 Прод: усі PR злито, `db-deploy` зелений, `/api/health` показує SHA `main`; `accounts.zip` актуальний, у чаті команди —
  прод-URL і ролі (пароль — лише в `accounts.zip`). Перевірка: `npm run smoke`, `/api/health`
- [ ] 6.4 Відповіді на issues «Відхилення від вимог» (PR з тестом і `Fixes #N`, новий прогін UAT), якщо PM їх відкриє;
  `docs/conformance.md` — рядок на кожен AC з чесним статусом; archive `npx openspec archive impl-dec-hist -y` в останньому PR.
  Галочка — лише коли виконано все перелічене

Done when: AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-HIST-01, AC-HIST-02, AC-HIST-06, AC-HIST-10, AC-LANG-09
