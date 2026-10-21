# Tasks

Кожна група — PR «Реалізація» (`task/<коротко>`); галочки й рядки `docs/conformance.md` її AC — у тому самому PR.
Групи 1 і 2 пішли одним PR (`task/pur-core`) з однією міграцією `pur_drafts` (див. `design.md`, «Migration Plan»).
Рішення — `design.md` (D1–D9).

## 1. Чернетка, подання, скасування, копія й видимість (`task/pur-drafts`)

- [x] 1.1 Міграція `pur_drafts`: статуси й колонки `requests` (D1), номер `PUR-N` (D2), `request_lines`,
  `request_history`, тригер порожнього рядка (D3), `can_view_request`, політики й колонкові `grant`, тригер
  `guard_request_update`, `profiles_select_colleagues` (D4), функції `submit_purchase`, `set_purchase_editing`,
  `cancel_purchase`, `copy_purchase` з обгортками `public.*` (D5). Перевірка: зелений `db-check`
- [x] 1.2 `src/lib/pur/*`: статуси й підписи, номер, суми, перевірка рядків і тексту, повнота рядків для подання,
  кандидати «від імені», списки D6, коди помилок; `database.types.ts`. Перевірка: тести 1.4
- [x] 1.3 `/requests`, `/requests/new` → чернетка, `/requests/[id]` (редагування, подання, редагування поданої,
  скасування, копія, історія); посилання й лічильники на головній. Перевірка: `npm run build`
- [ ] 1.4 `tests/pur/drafts-actions.test.ts`, `lines.test.ts`, `submission.test.ts`, `visibility.test.ts`,
  `decision-rules.test.ts`, `pages.test.tsx`: AC-PUR-01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16, 23, 26, 29, 30,
  31, 32, 33, 35, 37, 38, 44, 45, 47, 48, 49, 53, 54. Перевірка: `npm test`
- [ ] 1.5 Рядки AC задачі в `docs/conformance.md` → «реалізовано»; AC-PUR-34 — «відкладено (D8)». Галочка — коли
  `npm run ac:coverage` не показує прогалин по AC задачі, а відкладені AC позначені в матриці

Done when: AC-PUR-01, AC-PUR-02, AC-PUR-03, AC-PUR-04, AC-PUR-05, AC-PUR-06, AC-PUR-07, AC-PUR-08, AC-PUR-09, AC-PUR-10,
AC-PUR-11, AC-PUR-12, AC-PUR-13, AC-PUR-14, AC-PUR-16, AC-PUR-23, AC-PUR-26, AC-PUR-29, AC-PUR-30, AC-PUR-31, AC-PUR-32,
AC-PUR-33, AC-PUR-35, AC-PUR-37, AC-PUR-38, AC-PUR-44, AC-PUR-45, AC-PUR-47, AC-PUR-48, AC-PUR-49, AC-PUR-53, AC-PUR-54

## 2. Рішення схвалювача й відділу закупівель (`task/pur-decisions`)

- [x] 2.1 Функції `decide_purchase`, `reopen_purchase`, `admin_reject_purchase` з обгортками (D5) — у спільній
  міграції `pur_drafts` (окремої `pur_decisions` немає). Перевірка: зелений `db-check`
- [x] 2.2 Панелі рішень на `/requests/[id]` (рядки на відхилення, причина, схвалити / відхилити / повернути), дії
  `admin` (повернути на схвалення, відхилити схвалену), «На рішення» в `/requests`. Перевірка: `npm run build`
- [ ] 2.3 `tests/pur/decisions-actions.test.ts`, `decision-rules.test.ts`, `pages.test.tsx`: AC-PUR-15, 17, 18, 19, 20, 21, 22, 24, 25, 27, 28, 36, 39, 40, 41, 42, 43, 50,
  51, 52. Перевірка: `npm test`
- [ ] 2.4 Рядки AC задачі в `docs/conformance.md` → «реалізовано»; ручний прохід на проді після `db-deploy`;
  archive `impl-pur`. Галочка — лише коли виконано все перелічене, а не лише зміни матриці

Done when: AC-PUR-15, AC-PUR-17, AC-PUR-18, AC-PUR-19, AC-PUR-20, AC-PUR-21, AC-PUR-22, AC-PUR-24, AC-PUR-25,
AC-PUR-27, AC-PUR-28, AC-PUR-36, AC-PUR-39, AC-PUR-40, AC-PUR-41, AC-PUR-42, AC-PUR-43, AC-PUR-50, AC-PUR-51, AC-PUR-52
