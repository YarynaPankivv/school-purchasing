# Tasks

Кожна група — PR «Реалізація» (`task/<коротко>`); галочки й рядки `docs/conformance.md` її AC — у тому самому PR.
Рішення — `design.md`.

## 1. Англійський інтерфейс і дизайн-система (`task/design-system`)

- [x] 1.1 Токени, компоненти `src/components/ui`, `DESIGN.md`, `check:design` в `architecture.yml`, скріни «до/після».
  Перевірка: `npm run check:design`
- [x] 1.2 Тексти інтерфейсу англійською за таблицею PM, сторінки 404 і помилок; `tests/ui/interface-language.test.ts`.
  Перевірка: `npm test`

Done when: AC-LANG-01, AC-LANG-02, AC-LANG-03, AC-LANG-04, AC-LANG-05, AC-LANG-06, AC-LANG-08

## 2. Форма закупівлі й список для рішення: права на рівні бази й сторінок (`task/frm-apr-db-tests`)

- [x] 2.1 `tests/db/supabase-pglite.ts` (PGlite, dev-залежність) і `tests/db/frm-apr.test.ts`: `it("AC-FRM-02: …")`, 04, 06,
  07, 08, 09, 12, 13, 15 і `it("AC-APR-01: …")`, 02, 03, 05, 06, 07. Перевірка: `npm test`
- [x] 2.2 `/requests?view=decide` для заявника — `Forbidden`; після подання — редирект на «Мої заявки» з банером.
  `tests/ui/frm-apr-pages.test.tsx`: AC-FRM-01, 03, 05, 09, 11, AC-APR-04, 08, 09, 10. Перевірка: `npm test`
- [x] 2.3 Мутаційна перевірка: таблиця «AC → що прибрали → який тест упав» в описі PR; червоні прогони CI
  `mutation: …` для щонайменше двох відмовних AC. Перевірка: CI
- [x] 2.4 Рядки AC задачі в `docs/conformance.md` → «реалізовано». Перевірка: `npm run ac:coverage`

Done when: AC-FRM-01, AC-FRM-02, AC-FRM-03, AC-FRM-04, AC-FRM-05, AC-FRM-06, AC-FRM-07, AC-FRM-08, AC-FRM-09,
AC-FRM-10, AC-FRM-11, AC-FRM-12, AC-FRM-13, AC-FRM-14, AC-FRM-15, AC-APR-01, AC-APR-02, AC-APR-03, AC-APR-04,
AC-APR-05, AC-APR-06, AC-APR-07, AC-APR-08, AC-APR-09, AC-APR-10

## 3. ADR і архітектурне правило (`task/adr-actions-rule`)

- [x] 3.1 `docs/decisions/0003-permissions-in-database.md`: права — в базі, а не лише в Server Action чи proxy; варіанти,
  «Як перевіряємо». Перевірка: ADR посилається на AC і правило
- [x] 3.2 `scripts/check-server-actions.mjs`, `npm run check:actions`, job в `architecture.yml`; доказ — червоний прогін на
  навмисному порушенні. Перевірка: `npm run check:actions`

Done when: AC-FRM-02, AC-FRM-04, AC-APR-03, AC-APR-05

## 4. Прод і приймання PM (`task/pm-accounts`)

- [ ] 4.1 Акаунти `pm-requester`, `pm-approver`, `pm-admin` (`@example.test`) у `supabase/demo-users.json`; скріни за ролями
  (головна сторінка зрізу й одна відмова) у `docs/img/`. Перевірка: `npm run users:demo`
- [ ] 4.2 Ручний прохід відмов на прод-URL після `db-deploy`; відповіді на issues «Відхилення від вимог»; archive
  `impl-frm-apr`. Галочка — лише коли виконано все перелічене

Done when: AC-FRM-08, AC-APR-03, AC-APR-04
