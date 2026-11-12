# QA proof pack: зріз 3 — рішення схвалювача, історія й підписи статусів

<!--
За шаблоном koldovsky/2026-quitcode-09-software-factory-hw/materials/templates/proof-pack.template.md.
Proof pack WS8 (зріз 2) — у docs/qa/proof-pack-ws8.md. Посилання — на файли на коміті (…/blob/<sha>/…#L<N>), на PR
(…/pull/N) і на прогони (…/actions/runs/N). Жодних паролів і пароля від accounts.zip. Акаунти — лише *@example.test.
-->

- Прод-URL: https://school-purchasing.vercel.app
- Зріз 3: схвалювач вирішує заявку (часткове схвалення з відхиленим рядком, повернення на доопрацювання з причиною), автор подає виправлену заявку знову; заявка має номер PUR-N, суми рядків і заявки та історію з записом «Подано», чужому відділу історія закрита, а статуси «Partially approved» і «Returned for revision» підписано текстом.
- Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-11-09
- Спека: [`decision-outcomes`](https://github.com/YarynaPankivv/school-purchasing/blob/eaaf2fd/openspec/specs/decision-outcomes/spec.md) (AC-DEC), [`request-numbers-totals`](https://github.com/YarynaPankivv/school-purchasing/blob/eaaf2fd/openspec/specs/request-numbers-totals/spec.md) (AC-HIST), [`ui-language`](https://github.com/YarynaPankivv/school-purchasing/blob/eaaf2fd/openspec/specs/ui-language/spec.md) (AC-LANG-09); зміна `add-dec-hist`, план `impl-dec-hist`.
- `/api/health` на момент UAT: коміт `d45d876`, db ok, 10.11.2026
- Спосіб: звичайний (специфікація → задачі з PR і CodeRabbit → merge → `db-deploy` → UAT на проді). Фабрику (бонус) не запускали.

## Доказ на кожен AC зрізу 3

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

## Не перевірено

| AC чи частина | Чому не перевірено | Що зроблено замість | Ризик на проді |
|---|---|---|---|
| AC-HIST-01: точні номери PUR-1 і PUR-2 на проді | вимога припускає порожню базу, а на проді нумерація спільна для всіх | тест бази `dec-hist.test.ts:179` на порожній базі (PUR-1, PUR-2) і мутант N1 KILLED; UAT перевіряє лише, що дві поспіль подані заявки отримали різні номери в зростаючому порядку без стороннього між ними | на проді не видно, що загальна нумерація колись зсунулась |
| AC-DEC-04: доказ, що тест може впасти | окремого SQL-мутанта немає: повернення з причиною — звичайний шлях `decide_purchase` | тест перевіряє статус і причину; сусідню гілку (причина обов'язкова) б'ють D1 і D4 | слабший доказ, ніж для інших AC |
| Stryker зрізу 3 повністю | запускали лише на `time.ts`, `lines.ts`, `totals.ts`, `statuses.ts`; повний `npm run mutation:ts` не гнали, вижилі в `lines.ts` не розбирали | розбір вижилих у функціях цих AC (таблиця вище): жоден не про зріз 3 | вижилі TS-мутанти (`totals.ts:9`, `time.ts:54,57`, `statuses.ts:31,35,50`) без тестів |
| Приймання PM | оцінок PM ще немає | звіт, кадри і пакет передано PM повідомленням «UAT готовий» у чаті команди (12.11.2026) | оцінка може виявити ваду за межами UAT-кроків |

## A. Вимоги й спека

- `/requirements-sync` — PR «Оновлення вимог»: [#63](https://github.com/YarynaPankivv/school-purchasing/pull/63), [#64](https://github.com/YarynaPankivv/school-purchasing/pull/64), після уточнень PM — [#67](https://github.com/YarynaPankivv/school-purchasing/pull/67) (знімок 2026-11-09).
- Спека `add-dec-hist` — PR «Специфікація»: [#65](https://github.com/YarynaPankivv/school-purchasing/pull/65) (9 AC); план `impl-dec-hist` — [#66](https://github.com/YarynaPankivv/school-purchasing/pull/66).
- Зміна після уточнень: PM AC зрізу 3 не змінював; уточнення AC-FRM-14 (зріз 2, чернетка теж є заявкою) внесено окремою зміною `update-frm-14-drafts` — [#79](https://github.com/YarynaPankivv/school-purchasing/pull/79).
- Питання PM: див. `docs/spec-reading.md` — питання ValiaBihun/2026-quitcode-dream-team#65…#75 закриті відповідями PM і враховані у вимогах.

## B. Реалізація

| PR «Реалізація» | Задача з `tasks.md` | AC | Відповіді на знахідки CodeRabbit | `db-deploy` |
|---|---|---|---|---|
| [#68](https://github.com/YarynaPankivv/school-purchasing/pull/68) `cde1607` | 1. тести бази: рішення схвалювача й повторне подання | AC-DEC-01, 04, 06, 07 | на кожну: виправлено або аргумент у треді | [run 42781618637](https://github.com/YarynaPankivv/school-purchasing/actions/runs/42781618637): «Apply migrations» success (міграція `20261110075942_reason_whitespace.sql`) |
| [#69](https://github.com/YarynaPankivv/school-purchasing/pull/69) `e95e2e9` | 4. підписи нових статусів | AC-LANG-09 | так само | [run 42788308381](https://github.com/YarynaPankivv/school-purchasing/actions/runs/42788308381): міграцій немає |
| [#70](https://github.com/YarynaPankivv/school-purchasing/pull/70) `83ae2c4` | 2. номер заявки й суми | AC-HIST-01, AC-HIST-02 | так само | [run 42795992717](https://github.com/YarynaPankivv/school-purchasing/actions/runs/42795992717): міграцій немає |
| [#71](https://github.com/YarynaPankivv/school-purchasing/pull/71) `8852f10` | 3. історія: запис «Подано», закритість чужому відділу | AC-HIST-06, AC-HIST-10 | так само | [run 42803592641](https://github.com/YarynaPankivv/school-purchasing/actions/runs/42803592641): міграцій немає |
| [#72](https://github.com/YarynaPankivv/school-purchasing/pull/72) `467d068`, [#73](https://github.com/YarynaPankivv/school-purchasing/pull/73) `62fbdf5`, [#74](https://github.com/YarynaPankivv/school-purchasing/pull/74) `d45d876` | 5. UAT зрізу 3: специфікації Playwright, `uat:cleanup`, виправлення `afterEach` і висоти кадрів | усі 9 AC | так само | runs [42820283809](https://github.com/YarynaPankivv/school-purchasing/actions/runs/42820283809), [42828850761](https://github.com/YarynaPankivv/school-purchasing/actions/runs/42828850761), [42843005349](https://github.com/YarynaPankivv/school-purchasing/actions/runs/42843005349): міграцій немає |
| [#75](https://github.com/YarynaPankivv/school-purchasing/pull/75) `004199f` | 5.3–5.4. звіт UAT і негативні контролі | усі 9 AC | так само | міграцій немає |
| [#76](https://github.com/YarynaPankivv/school-purchasing/pull/76), [#77](https://github.com/YarynaPankivv/school-purchasing/pull/77), [#78](https://github.com/YarynaPankivv/school-purchasing/pull/78) | 6. proof pack, ретро, мутанти H2 і N1; виправлення `Select` (регресія AC-PUR-05); відгук на WS8 | AC зрізу 3, AC-PUR-05, AC-FRM-14, AC-APR-03 | так само | міграцій немає |

- Ворота на `main` (`quality`, «Ворота: fallow audit», «Покриття: доменна підлога»): [run 43014581528](https://github.com/YarynaPankivv/school-purchasing/actions/runs/43014581528) на `eaaf2fd`, зелений.
- Мутації: SQL — `npm run mutation:sql -- --markdown`, 12 з 14 вбито, 2 еквівалентні (вивід і нові мутанти H2, N1 — PR #76); Stryker на `time.ts`, `totals.ts`, `statuses.ts` — у таблиці доказів вище.

## C. UAT на проді

- Звіт: [`docs/qa/uat/2026-11-10/report.md`](https://github.com/YarynaPankivv/school-purchasing/blob/004199f/docs/qa/uat/2026-11-10/report.md) (прод `/api/health`: коміт `d45d876`), PR [#75](https://github.com/YarynaPankivv/school-purchasing/pull/75) `004199f`.
- Прогін: 16 з 16 тестів, 12 AC у звіті — **PASS 12, FAIL 0, NEEDS-HUMAN 0** (9 AC зрізу 3 і AC-FRM-09, AC-FRM-14, AC-APR-03 зі зрізу 2); правило R6.
- Рецензент `claude-haiku-5-5`; на AC-APR-03, AC-DEC-01, AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-FRM-14, AC-HIST-10 суперечка → `claude-sonnet-5-5`, у всіх Sonnet — PASS. Разом $0,2409 за цінами API.
- Перший прогін (до #74) давав NEEDS-HUMAN на AC-DEC-01 і AC-HIST-06: кадр «Тоді» був обрізаний висотою екрана 800 px, а не вадою продукту. Виправлення — вищий екран у цих двох кроках ([#74](https://github.com/YarynaPankivv/school-purchasing/pull/74) `d45d876`), повторний прогін — PASS.
- [#73](https://github.com/YarynaPankivv/school-purchasing/pull/73) `62fbdf5`: `afterEach` більше не чекає запитів без відповіді (на проді 9 тестів із `@writes` зависали).
- Негативний контроль (`npm run uat:nc`, 10.11.2026): **NC-1** (AC-FRM-14, у тесті навмисно інший текст) → **FAIL**, R1; **NC-2** (AC-FRM-09, текст «Тоді» уточнено, тест і застосунок ні) → **NEEDS-HUMAN**, R3 (Haiku і Sonnet — FAIL). PASS не отримав жоден. Звіт NC — у `test-results/uat-report-nc/` (не в git).
- Дані: синтетичні `uat-*@example.test`, видалено 16, лишилось 0 (рядок «Прибирання» зі звіту); `npm run uat:cleanup` після прогону — «нічого прибирати».
- Відео: вкладення в описі PR з цим proof pack (не в git); траси й HTML-звіт лишаються локально в `test-results/`.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-DEC-01, 04, 06, 07, AC-HIST-01, 02, 06, 10, AC-LANG-09 | рішення PM ще немає | коментар-підпис або issue «Відхилення від вимог» з'явиться в репо PM |


## D. Прод і ретро

- `/api/health` після злиття всіх задач: коміт `eaaf2fd` (збігається з `origin/main`), `db: ok`; `smoke` на `main` зелений.
- Нові ролі й акаунти: нових ролей у зрізі 3 немає. Акаунти зрізів 1–3 — `admin`: `admin@example.test`, `pm-admin@example.test`; `approver`: `approver@example.test`, `pm-approver@example.test`; `requester`: `member1@example.test`, `member2@example.test`, `pm-requester@example.test`, `pm-empty@example.test`. Зашифрований [`accounts.zip`](https://github.com/YarynaPankivv/school-purchasing/blob/eaaf2fd/accounts.zip) у корені `main`; `accounts.txt` в `.gitignore`.
- `docs/conformance.md`: [рядок на кожен AC](https://github.com/YarynaPankivv/school-purchasing/blob/eaaf2fd/docs/conformance.md), 9 AC зрізу 3 — «реалізовано».

### Ретро: що б ми взяли з фабрики у свій звичайний процес

Повний текст: [`docs/qa/retro-ws9.md`](https://github.com/YarynaPankivv/school-purchasing/blob/eaaf2fd/docs/qa/retro-ws9.md) (9 станцій фабрики: «уже є», «візьмемо» з конкретним файлом чи налаштуванням, «не потрібно, бо …»).
