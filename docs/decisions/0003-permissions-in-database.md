# 0003. Права форми закупівлі й рішень — у базі, а Server Action лише перевіряє, хто викликає

- Статус: прийнято
- Дата: 2026-10-26
- AC: AC-FRM-02, AC-FRM-04, AC-FRM-08, AC-APR-03, AC-APR-04, AC-APR-05

## Контекст

Зріз 2 WS7 (`openspec/changes/impl-frm-apr`): працівник подає закупівлю лише у свої відділи й дозволених типів, схвалювач
вирішує лише по заявках свого відділу й не по своїй. Server Action — публічний POST-ендпойнт, який можна викликати напряму,
оминувши сторінку, proxy і приховану кнопку; публічний ключ Supabase лежить у JS-бандлі, тож будь-хто з живим JWT може
піти прямо в Data API. supabase-js не має транзакцій. Крім того, межу «хто що бачить» мають бачити й ті, хто пише SQL
(`service_role`, міграції).

## Рішення

1. **Остаточні перевірки — у базі.** RLS (`requests_select`, `requests_insert`, `requests_update_author`,
   `private.can_view_request`), колонкові `grant` і функції переходів `submit_purchase`, `decide_purchase` (`security
   definer` у `private`, обгортки `public.*` — `security invoker`). Помилки — `raise exception 'pur:<код>'`, застосунок лише
   перетворює їх на тексти PM.
2. **Роль — з `profiles.role`**, а не з `user_metadata` чи JWT-клейма, який користувач міг би підробити.
3. **Server Action й сторінка лише відкривають сеанс і відображають.** Кожна експортована дія в `actions.ts` викликає
   `requireActiveUser()` / `requireAdmin()` (`getClaims()` усередині) до будь-якого запису; сторінки `Forbidden` і
   `notFound` не розкривають вміст чужих заявок. Proxy лише оновлює сесію.
4. **Кожен відмовний AC має тест на рівні бази** (`tests/db/frm-apr.test.ts`, PGlite з реальними міграціями), який
   перевіряє відмову й незмінність даних, плюс мутаційну перевірку (описана в PR задачі).
5. **Правило в CI** `check:actions` (`scripts/check-server-actions.mjs`, job в `.github/workflows/architecture.yml`):
   кожна експортована функція в `actions.ts` / `route.ts` викликає перевірку користувача; у `src/` немає `getSession()` і
   `middleware.ts`. Винятки — по іменах: `login` (сеансу ще немає) і `signOut` (завершує власний сеанс); порядок: виклик перевірки має йти до першого запису чи `rpc`.

## Розглянуті варіанти

- **Перевіряти права лише в Server Action (TypeScript).** Простіше тестувати моками, але прямий запит до Data API з
  публічним ключем оминає дію цілком, а забута перевірка в новій дії тихо відкриває дані. Тому ні.
- **Роль у JWT (`app_metadata`) і перевірка клейма в політиках.** Швидше (без читання `profiles`), але зміна ролі
  (скажімо, адміністратор знімає схвалення відділу) діє лише після оновлення токена, а `deactivated` користувач із живим
  JWT ще якийсь час проходить. Тому ні; ціна читання `profiles` через `security definer` хелпер невелика.
- **Перевірки в proxy / layout.** Це UX: proxy не бачить прямих POST у Server Action так, як політика в базі, а layout
  не захищає Route Handler. Тому ні.

## Наслідки

- Будь-яка нова вимога про права — це політика чи функція в міграції плюс тест із AC ID; TS-дзеркала (`canDecide`,
  `selectableDepartments`) лише вирішують, що показати, і змінюються разом з базою.
- Тести бази повільніші за моки (піднімають усі міграції в PGlite), але ловлять забуту політику; PGlite спрощено
  емулює Auth і PostgREST, тож Data API окремо не перевіряється.
- Нова дія без перевірки користувача не пройде `check:actions`; потрібне виключення — запис у `EXEMPT` скрипта з причиною
  й оновлення цього ADR.

## Як перевіряємо

- Тести: `tests/db/frm-apr.test.ts` (AC-FRM-02, 04, 08, AC-APR-03, 05 тощо), `tests/ui/frm-apr-pages.test.tsx` (AC-APR-04).
  Мутації: прибрати `or private.is_member(department_id)` з політик `requests_*` (падає AC-FRM-02), прибрати перевірку
  `own_request` у `decide_purchase` (падає AC-APR-05).
- Правило: `npm run check:actions` і job «Server Actions: перевірка користувача» в `architecture.yml`; тест скрипта —
  `tests/scripts/check-server-actions.test.ts`. Доказ, що правило ловить порушення, — червоний прогін у PR на коміті з
  навмисно незахищеною дією.

### Мутаційні перевірки

Тест, який лишається зеленим без політики чи перевірки, AC не покриває. Таблиця: що тимчасово прибрали → який тест упав.
Перші одинадцять рядків — прогони з PR #33 (локально; для AC-APR-05 і AC-FRM-02 — ще й червоні прогони CI на комітах
`mutation: …`), решта — виправлення за рев'ю (кожну мутацію зроблено локально й повернуто).

| AC | Що тимчасово прибрали | Який тест упав |
|---|---|---|
| AC-FRM-02 | `or private.is_member(department_id)` → `or true` у `requests_insert`/`requests_update_author` | AC-FRM-02 |
| AC-FRM-04 | `can_create_request`: «self» дозволено без `self_purchase` | AC-FRM-04 |
| AC-FRM-06 | `submit_purchase`: перевірку «рядків немає» | AC-FRM-06 |
| AC-FRM-08 | `requests_select`: схвалювач → будь-який заявник відділу | AC-FRM-08, AC-APR-01, 03, 04, 07 |
| AC-FRM-09 | `grant select on requests to anon` | AC-FRM-09 |
| AC-FRM-15 | перевірку неповних рядків | AC-FRM-15 |
| AC-APR-03 | `decide_purchase`: право вирішувати → `or true` | AC-APR-03 (обидва), AC-APR-04 |
| AC-APR-05 | перевірку `own_request` | AC-APR-05, AC-FRM-13 |
| AC-APR-06 | відхилення без причини дозволено | AC-APR-06 |
| AC-APR-04 | умову `role === "requester"` у списку | AC-APR-04 |
| AC-FRM-11 | редирект після подання → на сторінку заявки | AC-FRM-11, AC-PUR-14, 16, 23 |
| AC-FRM-09 | `revoke all on table public.requests from anon, authenticated` → без `anon` (тестова база тепер має ті самі права за замовчуванням, що Supabase) | AC-FRM-09 |
| AC-FRM-04 | у `submit_purchase` перевірку `can_create_request` для чернетки → `if false` (міграція `…_submit_recheck_purchase_type`) | AC-FRM-04 (подання після зняття дозволу) |
| AC-APR-01 | у `decisionQueue` умову `!isParticipant(r, actor.id)` | AC-APR-01 (власна заявка схвалювача) |
| AC-APR-08 | підрядок з автором на телефоні в `request-table.tsx` | AC-APR-08 |
| — (`check:actions`) | скрипт без скану за `"use server"` і без перевірки використання `getClaims()` | два нові тести `check-server-actions.test.ts` |
| — (proxy) | `isPublicPath`: точний збіг → `startsWith(path)` | `tests/auth/public-paths.test.ts` |
| — (текст помилки) | `isKnownInvalidDetail` → завжди `true` | `tests/pur/lines.test.ts` |
| AC-FRM-01 | у `new/page.tsx` відбір `selectableDepartments` → усі відділи (мок тепер віддає всі, відбір — код сторінки) | AC-FRM-01, AC-FRM-05 |
| AC-APR-06 | текст `reason_required` у `errors.ts` → інший | AC-APR-06 (повідомлення на сторінці заявки) |
| AC-APR-08 | у `private.profile_labels` `security definer` → `security invoker` (підписи читаються крізь RLS профілів) | AC-APR-08 (обидва тести `tests/db/author-labels.test.ts`) |
| AC-APR-10 | у `private.profile_labels` умову `p.id = any (target_ids)` → `true` (віддає всі профілі) | AC-APR-10 (обидва тести `author-labels.test.ts`) |
| AC-APR-08 | у `overview.ts` підписи з `request_author_labels` не підставляються | AC-APR-08 (сторінка списку для рішення) |
| AC-FRM-06 | текст `lines_required` у `errors.ts` → інший | AC-FRM-06 (сторінка заявки) |
| AC-FRM-15 | текст «Fill in all line fields» у `lines.ts` → інший | AC-FRM-15 (сторінка заявки) |
| — (клавіатура) | `shouldCloseOnEscape` → завжди `false`; «Skip to content» і `main#main-content` прибрано | три тести `tests/ui/keyboard-access.test.tsx` |
