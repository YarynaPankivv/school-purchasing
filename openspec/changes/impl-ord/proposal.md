# Proposal

## Why

Реалізуємо зріз WS8 «відділ закупівель створює замовлення й обробляє закупівлю» за власною специфікацією
`openspec/specs/{order-processing-queue,order-creation,order-numbering,order-editing,order-accounting,order-visibility}`
(переклад вимоги ValiaBihun/2026-quitcode-dream-team#4, знімок 2026-10-20, з уточненнями `update-pur-ord-answers`). Без
цього зрізу схвалені закупівлі зі зрізу PUR нікуди не потрапляють: немає постачальників, замовлень з унікальними
номерами й статусу «Оброблено».

**Залежність від PUR.** Зріз ORD працює зі схваленими закупівлями, тож код ORD пишемо лише після злиття обох PR зрізу
PUR (`task/pur-drafts`, `task/pur-decisions`; план — `impl-pur`) і PR `task/org-users` (зріз ORG; на нього спирається
PUR). З PUR беремо `requests` (статуси `approved`, `partially_approved`, `processing`, `processed`, `archived_at`,
`purchase_type`, `author_id`), `request_lines` (статуси `approved`, `rejected`, `ready`, `ordered`) і TS-помічники сум з
`src/lib/pur/*`; з ORG — `profiles`, `private.is_active_user()`, `requireAdmin()` («Недостатньо прав»). Порядок задач і
перелік об'єктів — `design.md` (D1) і `tasks.md`.

## What Changes

Зміна покриває всі 38 AC зрізу з `openspec/specs/` (ID `AC-ORD-16` не існує: PM його прибрала):

- `order-processing-queue`: AC-ORD-01, 27, 28;
- `order-creation`: AC-ORD-02, 03, 04, 05, 08, 29, 30, 36;
- `order-numbering`: AC-ORD-06, 07, 31, 33, 34;
- `order-editing`: AC-ORD-09, 10, 11, 12, 23, 32, 37, 38, 39;
- `order-accounting`: AC-ORD-13, 14, 15, 17, 18, 19, 20, 21, 22, 35;
- `order-visibility`: AC-ORD-24, 25, 26.

Шість задач (кожна — PR «Реалізація» з однією міграцією): довідник постачальників, черга й вибір постачальника рядка →
створення замовлень і нумерація → редагування й видалення замовлень → відправка в бухгалтерську систему (заглушка) →
файли замовлення → видимість для автора, друк, архівування й пошук.

Відкриті питання до PM (Q1–Q8) реалізуємо за тимчасовими рішеннями з `design.md` (D12); після відповідей PM — нова
зміна специфікації й, за потреби, правка міграцією.
