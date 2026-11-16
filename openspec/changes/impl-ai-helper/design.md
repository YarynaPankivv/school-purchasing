# Design

## Context

Форма закупівлі — сторінка чернетки `/requests/[id]` (`src/app/(app)/requests/[id]/page.tsx`): серверна форма з полями рядків
`line_<id>_name|purpose|quantity|unit_price`, кнопки `addLine`, `saveDraft` (server actions у `actions.ts`) і клієнтський
`live-line-total.tsx`. Нова чернетка вже має один порожній рядок (AC-PUR-01). AI-функція будується за набором курсу WS10
(`materials/ai-feature`, AI SDK 7 + OpenRouter + zod); ADR — `docs/decisions/0006-ai-helper-openrouter.md`.

## UI

### D1. Де живе помічник (AC-AI-01…06)

Блок «Запропонувати рядки» — у формі чернетки над таблицею рядків: клієнтський `ai-line-helper.tsx` (стан, заповнення форми),
розмітка `ai-helper-view.tsx` (без логіки й без server actions — її рендерить сторінка й тест станів). Показуємо лише там, де
автор може редагувати рядки (та сама умова, що й для `addLine`: `canEditLines`, `request.author_id === actor.id`). Textarea з
описом без `name`, тож `saveDraft` його не бачить.

### D2. Стани й 15 секунд (AC-AI-03, AC-AI-04)

Потік «запитати → чекати → відповідь чи 15 секунд» — `src/lib/ai/flow.ts` (`createSuggestFlow`, без React і DOM, перевіряється
fake timers). Під час очікування кнопка `disabled`, поруч «Шукаю рядки…», textarea не очищується. Клієнтський таймер 15 с показує
повідомлення AC-AI-04 і повертає форму до доступного стану, навіть якщо Server Action ще не відповіла; запізнілу відповідь
ігноруємо. Сервер обриває запит до провайдера через 14 с (`AI_SERVER_TIMEOUT_MS`), щоб не тримати з'єднання.

### D3. Заповнення форми (AC-AI-01, питання Q6 — ValiaBihun/2026-quitcode-dream-team#82)

Відповідь PM (2026-11-16, варіант A): пропозиція заповнює порожній рядок форми, якщо він є, інакше додає новий. Пропозиція
заповнює перший **порожній** рядок (усі чотири поля порожні), значення вставляються в поля `line_<id>_*` з подією `input`, щоб
`live-line-total` перерахував суму; у БД вони потрапляють лише коли автор сам натисне «Save» чи «Submit». Немає порожнього
рядка — пропозицію показано карткою з кнопкою «Add suggested line»: лише після натискання (підтвердження людини) клієнт
викликає `addLineWithValues`. Рішення розробника (відхилення від слова «додає» у відповіді PM): запис у БД без дії людини
не робимо, бо рубрика курсу не зараховує запис без підтвердження людиною; AC-AI-01 цього випадку не стосується («єдиний
рядок у формі»). Без дії людини нічого не записується; закупівлю не подаємо й автоматично не зберігаємо (AC-AI-01: «ще не подано»).

Неповний опис (відповідь PM на ValiaBihun/2026-quitcode-dream-team#79): `toSuggestResult` повертає `partial` з `null` у
невідомих полях; відомі поля вставляються, порожні позначаються (`aria-invalid` і рамка токена `status-rejected-foreground`,
знімається при вводі), а під полем опису — «Fill in all line fields» (текст із таблиці PM). Немає порожнього рядка — неповну
пропозицію не додаємо: запис потребує всіх полів.

### D4. Мова текстів (питання Q1 — ValiaBihun/2026-quitcode-dream-team#77)

Відповідь PM (2026-11-16, варіант A): тексти помічника англійською за таблицею `requirements/49-…`; тексти AC лишаються
українською, ID не змінюються (зміна специфікації `clarify-ai-helper`, формат «англійський замість українського»). Усі тексти —
в одному модулі `src/lib/ai/messages.ts`; сканер AC-LANG-01 перевіряє його як решту `src/`, винятку більше немає.
Тексти, яких немає в таблиці PM (placeholder, «Paste a purchase description», підписи картки, «Could not add the line…»), —
власні англійські формулювання розробника.

Опис покупки, назва й мета рядка (PM 2026-11-16, зміна специфікації `clarify-ai-english-input`, ADR 0008): вхід — англійський опис, модель повертає англійські назву («A4 paper») і мету («For printing»); промпт і опис полів схеми переписано, `DRAFT_PROMPT_VERSION` = `suggest-v2`.

## Дані й RLS

### D5. Нових таблиць і міграцій немає

Модель нічого не пише в БД, і сам виклик помічника теж. Рядок у БД з'являється лише після дії людини: «Save» / «Submit»
(`saveDraft`, `submitPurchase` — поля форми) або «Add suggested line» на картці пропозиції (`addLineWithValues`: insert у
`request_lines` під сесією користувача — діє наявна RLS `request_lines`, колонкові права й CHECK довжини). Лічильника запитів
до AI в БД немає (D9).

## Auth

### D6. Server Actions `suggestLine` і `addLineWithValues` (AC-AI-01, AC-AI-06)

`src/app/(app)/requests/[id]/ai-actions.ts`: кожна дія починає з `requireActiveUser()` (`getClaims()`, не `getSession()`) і перевіряє,
що заявка — редагована заявка автора (`editableRequest`: `canEditLines` з перевіркою автора) — **до виклику моделі й до запису**:
інакше будь-хто з інтернету витратив би денний ліміт ключа. `addLineWithValues` повторно перевіряє вхід (zod `LineValuesSchema` +
`parseLineFields`) — клієнт може надіслати що завгодно; сама дія викликається лише після натискання «Add suggested line». Роль береться з `profiles.role`, не з `user_metadata`.

## AI

### D7. Схема й стани (AC-AI-02, AC-AI-05, AC-AI-06)

Відповідь моделі — JSON за схемою zod (`src/lib/ai/schema.ts`): `status: ok | needs_info | refused`, `refusal: not_purchase | instruction |
null`, поля рядка, «невідоме» = `null`. Відповідь не за схемою — помилка (`invalid_output`), а не «майже рядок». Мапінг у стани
для форми — `toSuggestResult` (`src/lib/ai/draft.ts`):

| Результат | коли | текст (дослівно з AC) |
|---|---|---|
| `line` | `ok` і всі поля заповнені, кількість ціла ≥ 1, ціна ≥ 0 | — (дані для форми) |
| `partial` | відомо хоча б одне поле, решта `null` (немає мети, ціни чи кількості) | — (відомі поля в форму, порожні позначено; «Fill in all line fields») |
| `not_purchase` | `refused` + `not_purchase`; порожній опис | «I can only help with purchases» (AC-AI-02, golden 8, 9) |
| `instruction` | `refused` + `instruction` | «I don't follow instructions from the description. Describe the purchase» (AC-AI-06, golden 11, 12) |
| `invalid_field` | кількість чи ціна поза межами (golden 5, 6, 7) | «Quantity: a whole number from 1» / «Price: a number from 0» (текст PM, відповідь на ValiaBihun/2026-quitcode-dream-team#78) |
| `unavailable` | немає відповіді за 15 с, збій, відповідь не за схемою, жодного відомого поля, немає ключа | AC-AI-04: «Could not get a suggestion. Fill in the lines manually» |
| `unavailable` (ліміт) | 429 чи 402 від провайдера, зокрема у тілі HTTP 200 | AC-AI-05: «The assistant is unavailable today. Fill in the lines manually» |

Правила, які перевіряє КОД (не лише промпт): ціле число ≥ 1 для кількості, ціна ≥ 0 з ≤ 2 знаками, непорожні назва й мета, довжини
(`parseQuantity`, `parseUnitPrice`, `parseLineFields`). Модель повертає кількість і ціну «як у описі» навіть дробові, нульові чи
від'ємні — відхиляє їх сервер, тому golden 5–7 дають повідомлення про межу, а не мовчазне виправлення.

### D8. Ключ, ланцюжок моделей, промпт (AC-AI-06)

Ключ `OPENROUTER_API_KEY` читає лише `src/lib/ai/openrouter.ts` з `import "server-only"`; фабрика моделі `makeProductModel(key)` у
`models.ts` ключа з `process.env` не бере. Ланцюжок (лише `:free`): `google/gemma-4-31b-it:free` → `google/gemma-4-26b-a4b-it:free` →
`nvidia/nemotron-3.5-super-vl:free`; `maxRetries: 0` (повтор витрачає той самий денний ліміт). Немає ключа → `productModel()` = `null`,
дія повертає «недоступний», форма працює вручну. Промпт — `src/lib/ai/prompts/draft.ts` з `DRAFT_PROMPT_VERSION`: опис іде
**між `<document>…</document>`** (англійська інструкція; `name`/`purpose` — англійською, версія `suggest-v2`), теги з вводу вирізано, довжину обмежено 1000 символів, інструкція каже, що текст між тегами — дані,
а не команди. У моделі немає інструментів і доступу до БД, тож «створи заявку» фізично нічого не створить (AC-AI-06).

### D9. Денний ліміт (AC-AI-05, питання Q5 — ValiaBihun/2026-quitcode-dream-team#81)

До відповіді PM — варіант C: «вичерпано» = провайдер відповів 429/402 (зокрема 429 у тілі при HTTP 200); самі запити застосунок не
рахує (БД і міграцій немає). Ліміт OpenRouter — на акаунт: 20 запитів/хв і 50/день (UTC-доба, нова — о 02:00 за Києвом); його ділять
eval розробника, UAT і приймання PM, тож прогони рознесено по різних добах (`npm run ai:quota`).

### D10. Golden cases й оцінювання

`tests/fixtures/golden/cases.json` — 10 кейсів PM (англійська редакція 2026-11-16) (№ 1, 5, 6, 7, 8, 9, 11, 12, 13, 14): `expected` (кількість і ціна точно, `nameIncludes`,
`purposeIncludes`, текст повідомлення) і `rubric` (слова PM). Суддя-LLM не потрібен: у результаті немає вільного тексту, усе
перевіряє код (`evals/scorer.ts`). Офлайн — `tests/golden.test.ts` у `npm test`: реплей **справжніх** записаних відповідей
(`recorded.json` із `modelId`, датою й `promptVersion`) через `MockLanguageModelV4` → `proposeDraft` → `toSuggestResult` → `scoreCase`,
назви `AC-AI-01|02|06: golden $id`; плюс збої (429, 429 у тілі при HTTP 200, 402, таймаут, не за схемою, немає ключа) і межа `<document>`.
Живий — `npm run eval` (`evals/golden.live.eval.ts`, ключ із `.env.local`, лише вручну, не в CI): по одному запиту на кейс з паузою,
перший 429 зупиняє прогін (решта — NOT RUN), звіт `evals/reports/<дата й час>.md` з моделлю на кожен кейс і часткою успіху за
моделями, `RECORD=1` дописує успішні відповіді. Тест ключа — `tests/ai-key.test.ts`.

### D11. UAT на проді

Playwright `tests/e2e/slice4.spec.ts`: AC-AI-01 (людина підтверджує: чернетка не подана, статус Draft, у БД лишається `draft`),
AC-AI-02 і AC-AI-06 (відмова й ін'єкція; нової заявки немає) — по одному запиту до моделі. AC-AI-03 перевіряється unit-тестом станів
(на проді відповідь надто швидка), AC-AI-04 і AC-AI-05 на проді не відтворюються без збою чи вичерпаного ліміту — доведені
офлайн-тестами й описані в «Не перевірено» proof pack.

## Risks / Trade-offs

- Недетермінована модель: можливі «плаваючі» результати golden → поріг PM 8 з 10, записи справжніх відповідей для офлайн-прогону.
- Безкоштовні моделі: на всі кейси відповіла запасна `nemotron-3.5-super-vl`, а не основна Gemma (див. звіт eval) — ланцюжок перевіряємо `npm run ai:models`.
- Відповіді PM на Q1–Q6 отримано 2026-11-16 (ValiaBihun/2026-quitcode-dream-team#77–#82): D4, D7 (тексти меж) і D9 збіглися чи
  приведені до відповідей; D3 — відхилення в одному місці (картка замість автододавання рядка, див. D3), про це — у PR.
