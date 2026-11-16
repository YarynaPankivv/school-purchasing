# Proposal

## Why

PM відповіла на шість питань розробника до вимоги AI-помічника (зріз 4, WS10) і 2026-11-16 уточнила «Припущення» в
`requirements/71-ai-proponuie-riadky-zakupivli.md` (ValiaBihun/2026-quitcode-dream-team#71) та доповнила таблицю
текстів у `requirements/49-interfejs-anhlijskoiu-movoiu.md` (ValiaBihun/2026-quitcode-dream-team#49). Головне:
тексти помічника показуються **англійською** за таблицею #49; тексти AC лишаються українською, ID не змінюються
(«якщо в чинних критеріях цитується український текст з лівої колонки, діє англійський з правої»). Специфікація
цитувала лише українські тексти, тож сценарії AC-AI-01…06 приводимо до англійських текстів PM у тому ж вигляді, що
AC-LANG-03…05: «англійський текст замість українського».

Джерела (знімок 2026-11-16):

- `requirements/71-ai-proponuie-riadky-zakupivli.md` — ValiaBihun/2026-quitcode-dream-team#71, розділи «Припущення» і
  «Журнал змін» (запис 2026-11-16);
- `requirements/49-interfejs-anhlijskoiu-movoiu.md` — ValiaBihun/2026-quitcode-dream-team#49, таблиця текстів і
  «Журнал змін» (запис 2026-11-16);
- відповіді PM: ValiaBihun/2026-quitcode-dream-team#77, ValiaBihun/2026-quitcode-dream-team#78,
  ValiaBihun/2026-quitcode-dream-team#79, ValiaBihun/2026-quitcode-dream-team#80,
  ValiaBihun/2026-quitcode-dream-team#81, ValiaBihun/2026-quitcode-dream-team#82.

## What Changes

ID AC PM не змінюються; нових і прибраних AC немає (журнал змін PM: «тексти AC не змінено»).

- **MODIFIED** — «Пропозиція рядка за вільним описом» (AC-AI-01): кнопка «Suggest lines» замість «Запропонувати рядки».
- **MODIFIED** — «Відмова на опис не про закупівлі» (AC-AI-02): повідомлення «I can only help with purchases» замість
  «Я допомагаю лише із закупівлями».
- **MODIFIED** — «Стан очікування відповіді AI» (AC-AI-03): «Looking for lines…» замість «Шукаю рядки…», кнопка
  «Suggest lines».
- **MODIFIED** — «Немає відповіді AI за 15 секунд» (AC-AI-04): «Could not get a suggestion. Fill in the lines
  manually» замість «Не вдалося отримати пропозицію. Заповніть рядки вручну».
- **MODIFIED** — «Денний ліміт запитів до AI вичерпано» (AC-AI-05): «The assistant is unavailable today. Fill in the
  lines manually» замість «Помічник сьогодні недоступний. Заповніть рядки вручну».
- **MODIFIED** — «Вказівки в описі не виконуються» (AC-AI-06): «I don't follow instructions from the description.
  Describe the purchase» замість «Я не виконую вказівок з опису. Опишіть покупку».

Для сценаріїв, що цитують дані користувача (опис «Треба 3 пачки паперу А4 …», назва «Папір А4», мета «Для друку»),
текст не змінюється: це введене людиною, а не напис інтерфейсу, а AC-AI-01 перевіряє «Папір А4» за правилом
«містить» (див. Assumptions). Поріг приймання PM без змін.

## Capabilities

### New Capabilities

- Немає.

### Modified Capabilities

- `ai-line-suggestion`: MODIFIED усіх шести вимог (AC-AI-01…06) — англійські тексти замість українських.

## Users & roles

- Без змін: автор заявки (`requester`, `approver`) вставляє опис і бачить пропозицію лише для власної форми;
  схвалювача (`approver`) і відділ закупівель (`admin`) вимога не стосується; гість — лише сторінка входу.

## Non-goals

- Зміна «Коли» і «Дано», крім англійської назви кнопки; зміна даних, які вводить людина.
- Нові AC: PM відповідей у вигляді нових AC не давала, лише уточнила «Припущення».
- Реалізація (англійські тексти в застосунку, заповнення порожнього рядка, неповні рядки) — окрема зміна
  `impl-ai-helper` / PR «Реалізація».

## Assumptions

Припущення PM (знімок 2026-11-16, `requirements/71-…`; не AC, у сценарії не входять):

- Англійські тексти помічника — за таблицею #49 (відповідь ValiaBihun/2026-quitcode-dream-team#77): «Suggest lines»,
  «Looking for lines…», «I can only help with purchases», «Could not get a suggestion. Fill in the lines manually»,
  «The assistant is unavailable today. Fill in the lines manually», «I don't follow instructions from the
  description. Describe the purchase», «Purchase description».
- Кількість чи ціна в описі поза межами (golden cases № 5, 6, 7): рядків не додано, повідомлення — як у формі:
  «Quantity: a whole number from 1» і «Price: a number from 0» (ValiaBihun/2026-quitcode-dream-team#78).
- Немає ціни чи кількості в описі: помічник заповнює відомі поля, відсутнє лишає порожнім і позначеним (нічого не
  вигадує); людина доповнює його й сама подає (ValiaBihun/2026-quitcode-dream-team#79).
- У AC-AI-01 назва й мета перевіряються за правилом golden case № 1 («містить» слово «папір» і «друк»); дослівно
  перевіряються лише кількість 3 і ціна 20.00 (ValiaBihun/2026-quitcode-dream-team#80).
- «Денний ліміт запитів до AI» — ліміт постачальника моделі: «вичерпано», коли постачальник відповів помилкою про
  ліміт; застосунок запити не рахує (ValiaBihun/2026-quitcode-dream-team#81).
- Пропозиція AI заповнює порожній рядок форми, якщо він є, інакше додає новий; «один рядок» в AC-AI-01 — єдиний
  рядок у формі (ValiaBihun/2026-quitcode-dream-team#82).

Власні припущення (розробник):

- Немає.

## Open questions

- Немає. Усі шість питань розробника (Q1–Q6, ValiaBihun/2026-quitcode-dream-team#77…#82) отримали відповіді PM
  2026-11-16 і закриті; нових питань за цією вимогою немає.

## Impact

Лише специфікація. Після archive: `docs/conformance.md` — рядки AC-AI-01…06 мають статус «відкладено (чекає
реалізації)», доки не оновлено код і тести за новими текстами (окремий PR «Реалізація»).
