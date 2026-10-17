# Шаблон проєкту розробника: Next.js + Supabase + OpenSpec

Стартовий репозиторій для вебзастосунку «з нуля». Кожен розробник команди створює з шаблону **власне** репо й робить у
ньому **свою** реалізацію продукту команди: власні Supabase і Vercel, задачі → гілки → PR → CodeRabbit → merge.
Вимоги пише PM людською мовою у своєму репо вимог (шаблон [`koldovsky/2026-quitcode-06-spec-template`](https://github.com/koldovsky/2026-quitcode-06-spec-template)):
в issues або файлами `docs/`. Сюди їхній знімок приносить команда агента `/requirements-sync` (без скриптів і тегів), а
специфікацію в OpenSpec пишете ви — перекладаєте вимоги PM, зберігаючи ID його критеріїв приймання. Наприкінці PM
порівнює, як різні розробники (і їхні агенти) прочитали й реалізували ті самі вимоги. В агенції шаблон так само береться
для нового клієнтського проєкту.

- **Застосунок:** Next.js 16 (App Router, `src/`), вхід email + пароль через Supabase Auth, сторінка
  з email і роллю користувача з таблиці `profiles`; сесію оновлює `src/proxy.ts`.
- **База як код:** ваша власна база Supabase; `supabase/migrations/` (профілі й ролі з RLS і явними GRANT),
  ідемпотентний `seed.sql`, синтетичні користувачі (`npm run users:demo`). Міграції в базу застосовує лише CI.
- **Вимоги й специфікація:** `requirements/` — знімок вимог PM (оновлює лише `/requirements-sync`); OpenSpec
  (`openspec/`, правила перекладу в `openspec/config.yaml`) — ваша специфікація: зміна `add-<зріз>` перекладає вимоги PM,
  `impl-<зріз>` — ваш план реалізації. AC ID PM наскрізно: вимога PM → сценарій специфікації → задача → назва тесту →
  `docs/conformance.md`.
- **Агенти:** `AGENTS.md` (+ `CLAUDE.md` = `@AGENTS.md`), команди `/requirements-sync`, `/conformance` і `/opsx:*`, скіли
  `spec-clarify` і `spec-review` — однаково в Claude Code і Cursor; `.mcp.json` (Supabase MCP лише на читання) і
  `.claude/settings.json` (дозвіл на команди `gh`/`git` для читання й синхронізації вимог; заборона читати `.env*` і
  запускати `supabase db push` та деструктивні команди Supabase CLI) діють лише в Claude Code — Cursor цих файлів не
  читає (див. AGENTS.md, «Секрети»).
- **Ворота:** GitHub Actions `ci.yml` (`spec`, `app`, `conformance`, `db-check` — обов'язкові для PR; `db-deploy` — міграції
  в прод після merge), ruleset `solo-main`, шаблон PR, `.coderabbit.yaml`.

| Шар курсу | Де в шаблоні |
|---|---|
| Правила й команди | `AGENTS.md`, `CLAUDE.md`, `.claude/commands/` (`requirements-sync`, `conformance`, `opsx/`), `.cursor/commands/` |
| Скіли | `.claude/skills/` (`spec-clarify`, `spec-review`, `openspec-*`; Cursor читає цю ж теку) |
| MCP з мінімальними правами | `.mcp.json`, `.claude/settings.json` (лише Claude Code) |
| Вимоги й специфікації | `requirements/`, `openspec/`, `product/` (denylist), `scripts/check-*.mjs`, `docs/conformance.md` |
| Процес і ворота | `.github/` (CI, шаблон PR), `.coderabbit.yaml`, `docs/bootstrap.md` |

## Модель роботи: репо вимог PM і власне репо розробника

```text
 PM:  <pm>/<team-slug>-spec          (шаблон вимог, публічне; PM працює лише у вебінтерфейсі GitHub)
      issue «Продукт» + issues «Вимога» (мітки product, requirement)   — або —   docs/product.md + docs/requirements/*.md
      issues «Питання до вимог» (мітка question) — тут питають і відповідають
          ▲ питання (issue через вебформу)          │ /requirements-sync у Claude Code чи Cursor:
          │                                         ▼ агент робить знімок вимог PM у вашому репо
 Ви:  <dev>/<team-slug>              (цей шаблон, публічне) — у кожного розробника своє
        ├─ main               ← лише через PR (ruleset solo-main: зелений CI, 0 approve)
        ├─ sync/<дата>        ← /requirements-sync: requirements/ + рядок «Вимоги: …» у docs/conformance.md
        ├─ spec/<id зміни>    ← ваша специфікація: переклад вимог PM в openspec/ (add-<зріз>, уточнення), план impl-<зріз>
        ├─ task/<коротко>     ← реалізація: код, міграції, тести, рядки матриці
        └─ template/<коротко> ← виправлення шаблону (cherry-pick)
      Supabase: ваша організація й проєкт   ← міграції застосовує CI (db-deploy)
      Vercel: ваш проєкт, прод з main, preview для кожного PR
```

Чотири правила:

1. **Вимоги пише PM** — людською мовою за шаблоном у своєму репо (issues або `docs/`) і пише в чат команди «вимоги
   оновлено».
2. **У своєму репо ви підтягуєте їх командою `/requirements-sync`.** `requirements/` руками не правите.
3. **Специфікацію пишете ви:** перекладаєте вимоги PM в OpenSpec — кожен AC PM стає сценарієм із тим самим ID, нічого не
   вигадуєте.
4. **Питання до вимог — issues у репо PM** через вебформу «Питання до вимог»
   (`https://github.com/<pm>/<team-slug>-spec/issues/new?template=question.yml`). Відповіді там само — їх бачить уся команда.

| Роль | Де працює | Що робить |
|---|---|---|
| PM | репо вимог `<pm>/<team-slug>-spec` (лише вебінтерфейс) | issue чи файл «Продукт», вимоги за шаблоном з AC, відповіді на питання й «Журнал змін» кожної вимоги; наприкінці — нотатка-порівняння реалізацій |
| Розробник | власне репо `<dev>/<team-slug>` з цього шаблону | налаштування (`docs/bootstrap.md`), `/requirements-sync`, питання (`spec-clarify`), переклад у специфікацію (`spec-review`), план `impl-<зріз>`, задачі PR-ами |

Колег у вашому репо немає: approve не потрібен, рев'ю робить CodeRabbit (коментар `@coderabbitai review`), а ви
відповідаєте на кожен його коментар — виправленням або поясненням, чому ні. Команда лишається: той самий бриф, чат,
зустріч команди й питання в репо PM. Подивитися реалізації колег можна, але це необов'язково.

## Перед початком

- Node 24 (`node -v`), Git, GitHub CLI (`gh`).
- OpenSpec CLI **глобально** й тієї ж версії, що в `package.json`:
  `npm i -g @fission-ai/openspec@1.14.1` → `openspec --version` має показати `1.14.1`
  (стара глобальна версія — оновіть тією ж командою). Команди `/opsx:*` і скіли `openspec-*` викликають
  просто `openspec`, а в PATH оболонки агента немає `node_modules/.bin`. Скрипти `npm run spec:*` і CI
  беруть версію з devDependencies. Телеметрію вимикає `openspec config set telemetry.enabled false`.
- Docker **не** потрібен: локально — лише `npm run dev` проти вашої бази; міграції на одноразовій базі перевіряє CI (`db-check`).

## Шлях розробника

1. **Налаштування (день 0).** Пройдіть чекліст `docs/bootstrap.md` по порядку: **Use this template → Create a new
   repository** (власник — ваш особистий акаунт, назва `<team-slug>`, **Public**: ruleset на GitHub Free діє лише в
   публічних репо) → CodeRabbit на репо → Supabase (власні організація й проєкт, реєстрацію й Confirm email вимкнено) →
   environment `production` із секретом `SUPABASE_DB_URL` → Vercel (дві змінні `NEXT_PUBLIC_…`, Require Log In
   вимкнено) → Supabase URL Configuration → **Actions → CI → Run workflow** на `main` з `include_seed` (перша міграція й
   сид) → `npm run users:demo` → зелений CI на `main` → ruleset `solo-main` (імпорт `materials/rulesets/solo-main.json`
   з курсового репо) → перший PR із заповненим `docs/bootstrap.md` (тип «Реалізація»).
2. **Зустріч команди (дні 0–2, до кінця 15.10; якщо команда не зібралася — діра в чат команди до обіду 16.10).**
   Перший раунд питань до брифу; організує PM. Адреса репо вимог PM — у чаті команди.
3. **Вимоги.** Коли PM написав у чаті «вимоги оновлено» (у курсі перші вимоги — до кінця 16.10) — у Claude Code чи
   Cursor `/requirements-sync <pm>/<team-slug>-spec` (адреса потрібна лише вперше, далі просто `/requirements-sync`;
   можна й словами: «підтягни оновлені вимоги») → звіт про нові вимоги й AC → PR «Оновлення вимог» → merge. Як це
   працює — розділ нижче.
4. **Читання вимог:** скіл `spec-clarify` → питання як issues «Питання до вимог» у репо PM через вебформу (спершу
   пошук: питання вже є — коментар із новим випадком у тому issue) → журнал `docs/spec-reading.md`. `gh issue create` не
   використовуйте: без доступу на запис до репо PM мітка `question` мовчки губиться, а форма її ставить.
5. **Переклад у специфікацію** (PR «Специфікація», гілка `spec/add-<зріз>`): `/opsx:propose add-<зріз>` — переклад
   `requirements/` в OpenSpec: `proposal.md` (Why, What Changes, Capabilities, Users & roles, Non-goals, Assumptions,
   Open questions) і дельти `specs/` без `design.md` і `tasks.md`; кожен AC PM — `#### Scenario:` з тим самим ID, вимоги з
   SHALL, числа й межі як у PM; неясне — в Open questions і питання PM, а не вигадане правило →
   `npx openspec validate add-<зріз> --strict` → скіл `spec-review` → `npx openspec archive add-<зріз> -y` у гілці →
   `/conformance` (рядки нових AC «відкладено (чекає реалізації)») → PR → merge. `npm run ac:coverage` більше не
   попереджає «вимогу PM ще не перекладено в специфікацію».
6. **План реалізації:** власна зміна `npx openspec new change impl-<зріз>` → `skip_specs: true` у `.openspec.yaml` →
   `design.md` (таблиці, RLS, server actions, сторінки — з AC ID) і `tasks.md` (вертикальні задачі з «Done when: AC-…»)
   → PR «Специфікація» (гілка `spec/impl-<зріз>`). Технічні рішення, які вимоги свідомо лишають відкритими, — ADR у
   `docs/decisions/`.
7. **Задача:** `git switch main && git pull` → `git switch -c task/<коротко>` → код + тести `it("AC-…: …")` →
   `/conformance` (рядок матриці → «реалізовано») → `npm run lint && npm run typecheck && npm test` → push → PR
   «Реалізація» → окремим коментарем `@coderabbitai review` → виправлення або відповіді на коментарі → зелений CI →
   **Squash and merge** → прод-деплой Vercel. Галочки в `openspec/changes/impl-<зріз>/tasks.md` ставте в PR задачі
   (`/opsx:apply` робить це сам); в останньому PR зрізу, до merge, — `npx openspec archive impl-<зріз> -y`.
8. **Міграція в задачі:** `npx supabase migration new <назва>` → SQL (RLS, GRANT, політики) → у тому ж PR; `db-check`
   застосує всі міграції на одноразовій базі й звірить порядок з `main`; після merge `db-deploy` застосує її у вашу базу.
   Ніколи `supabase db push` з ноутбука, ніколи DDL у SQL Editor. Типи для нових таблиць — готовий `database.types.ts`
   у Summary прогону `db-check`.
9. **Після уточнень PM (у курсі — після 18.10) — знову `/requirements-sync`.** Звіт покаже нові й змінені AC і нові
   рядки «Журнал змін» PM → нова зміна специфікації з `## ADDED` / `## MODIFIED` / `## REMOVED Requirements` (PR
   «Специфікація») → хоча б один новий чи змінений AC реалізуйте або відкладіть із посиланням на рішення PM:
   `відкладено (рішення PM: <pm>/<team-slug>-spec#7)`.

## Як вимоги потрапляють у репо: `/requirements-sync`

Команда агента (`.claude/commands/requirements-sync.md`; у Cursor — `.cursor/commands/requirements-sync.md`, що
відсилає до того ж файлу). Жодних скриптів синхронізації, тегів чи службових файлів: лише `gh`, `git` і шапка матриці.
Агент:

1. Перевіряє, що робоче дерево чисте, і переходить на свіжий `main`.
2. Бере адресу репо PM із шапки `docs/conformance.md` у `main` — рядок
   `Вимоги: <адреса> · джерело: issues|docs · знімок <дата>`. До першої синхронізації там
   `Вимоги: — (заповнює /requirements-sync)`, і адресу дає аргумент (`<owner>/<repo>` або URL) чи відповідь людини.
3. Визначає джерело: є відкриті issues з міткою `requirement` (`gh issue list … --label requirement`) — **issues**;
   інакше — **docs**: `git fetch --depth 1 <адреса> main` і файли `docs/product.md` + `docs/requirements/*.md` (без
   `_template.md` і `README.md`). Немає ні того, ні іншого — «PM ще не опублікував вимоги». Нічого не змінилось
   (ті самі issues з тим самим часом оновлення або той самий коміт PM) — «вимоги актуальні», і на цьому все.
4. Робить гілку `sync/<дата>` і замінює `requirements/` цілком: для issues — `requirements/<N>-<slug>.md` з кожного
   issue «Вимога» і `requirements/product.md` з issue «Продукт» (`gh issue view`); для docs —
   `git checkout FETCH_HEAD -- docs/…` і перенесення в `requirements/`. Перший рядок кожного файлу —
   `> Джерело: …` (issue і час оновлення або файл і коміт PM), далі текст PM дослівно.
5. Показує, що змінилось (рядки джерела не враховує): які вимоги й AC додано, змінено, прибрано; нові рядки «Журнал
   змін» PM; що змінилось у продукті; де змінені й прибрані AC уже є у вашій специфікації, коді й тестах.
6. Оновлює лише шапку `docs/conformance.md` (рядків таблиці не додає: їх додає ваш PR «Специфікація»); запускає
   `npm run spec:check` (denylist у тексті PM) і `npm run ac:coverage` — попередження «вимогу PM ще не перекладено в
   специфікацію» тут очікувані.
7. Комітить «Оновлення вимог з `<owner>/<repo>` (issues|docs, `<дата>`)» і **лише після вашого «так»** пушить гілку й
   відкриває PR «Оновлення вимог» (`gh pr create --web`).
8. Підказує, що далі: переклад у специфікацію (PR «Специфікація»), питання — `spec-clarify`.

Чому знімок, а не одразу специфікація: `git diff` теки `requirements/` показує, що саме змінив PM, а ваша специфікація
змінюється окремим PR, де видно ваш переклад. `requirements/README.md` шаблону зникає з першою синхронізацією.

Побічний ефект `--depth 1` (лише джерело docs): git позначає ваш локальний клон як неглибокий
(`git rev-parse --is-shallow-repository` → `true`), бо коміт PM узято без історії. Ваших гілок і `main` це не стосується:
push, fetch, `git log` і `scripts/check-migration-order.mjs` працюють як звичайно.

## Міграції в прод

**Основний шлях.** Секрет environment `production` `SUPABASE_DB_URL` = рядок **Session pooler** з Supabase → **Connect**
(`postgresql://postgres.<ref>:<пароль>@<pooler-host>:5432/postgres`; порт **5432**, не 6543 — у transaction mode DDL не
застосовуємо; прямий хост на Free лише IPv6, а раннери GitHub — IPv4). Спецсимволи пароля — percent-encoded
(`@` → `%40`, `#` → `%23`, `/` → `%2F`). Job `db-deploy` на push у `main` виконує
`supabase db push --db-url "$SUPABASE_DB_URL"` (спершу `--dry-run` для журналу; без `--include-all`); сид — лише
вручну: **Actions → CI → Run workflow** на `main` з `include_seed` (`--include-seed`). Без секрету job пропускає
крок з повідомленням. Перевіряємо прогоном у день 0.

**Запасний шлях** (якщо `--db-url` не працює): офіційний `supabase link` + `supabase db push`. Створіть scoped token
(Supabase → Account → Access Tokens; доступ лише до вашого проєкту, дозвіл **Project Settings → API Keys → API Key
Secrets: Read**; точні назви перевірте в інтерфейсі) і задайте в environment `production` секрети `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` (ref проєкту), а `SUPABASE_DB_URL` видаліть — `db-deploy` сам перейде на цей шлях:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_ID"   # токен і пароль — з env SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD
supabase db push --dry-run && supabase db push
```

Scoped tokens вийшли в GA 06.10.2026, і є відкритий звіт про 403 на `supabase link` зі scoped token
(supabase/supabase#50244) — тому цей шлях запасний; працює він у вашому проєкті чи ні, звіряємо прогоном.
Класичний токен доступу відкриває всі ваші організації Supabase — у секрети репо його не кладемо.

**Збої й відновлення:**

- `db-check` FAIL `OLDER` — міграцію з іншої вашої гілки злито раніше: перейменуйте файл новою міткою (команду `git mv`
  друкує `scripts/check-migration-order.mjs`) і запуште.
- `db-deploy` FAIL «Found local migration files to be inserted before the last migration on remote database» — два PR-и
  з міграціями пройшли перевірки паралельно (статуси не вимагають «up to date») і злились у зворотному порядку. Окремий PR:
  `git mv` старшого (ще не застосованого — див. журнал `db-deploy`) файлу на нову мітку без зміни SQL → `db-check`
  покаже попередження `RENAMED`, не FAIL → звірте журнал `db-deploy` → merge → `db-deploy` застосує. Ніколи `--include-all`.
- `db-deploy` скасовано (cancelled) на якомусь коміті `main` — кілька merge поспіль: у групі `supabase-prod` GitHub тримає
  один прогін в очікуванні, і новіший замінює старіший. Нічого не втрачено: наступний прогін застосовує всі міграції з `main`.
- `db-deploy` FAIL «Remote migration versions not found in local migrations directory» — міграцію застосовано не
  через `main` (`db push` з ноутбука чи з гілки). Якщо зміна потрібна — PR із цим файлом у `main`; якщо ні —
  `supabase migration repair --status reverted <версія> --db-url "<рядок pooler>"` зі свого ноутбука (сам, не агентом:
  `.claude/settings.json` це забороняє) і відкат змін схеми новою міграцією (точний порядок звіряйте з документацією Supabase CLI).
- Проєкт Free призупинено після тижня без активності — Dashboard → **Restore project** (точну назву кнопки перевірте в інтерфейсі).

## Оновлення шаблону

Виправлення шаблону викладач оголошує в чаті курсу з SHA звичайного (не merge) коміту: `git cherry-pick` merge-коміту
без `-m 1` не працює. Не `git merge` шаблону: «Use this template» починає нову історію, і merge дає конфлікт у кожному
файлі, що відрізняється. Натомість (один раз)
`git remote add template https://github.com/koldovsky/2026-quitcode-06-project-template.git` → `git fetch template` →
`git switch -c template/<коротко> origin/main` → `git cherry-pick <sha>` →
`npm ci && npm run lint && npm run typecheck && npm test && npm run spec:check` →
`git push -u origin template/<коротко>` → PR «Оновлення шаблону» → зелений CI → merge.
Кожен розробник переносить виправлення у своє репо сам.

## Перевірки

| Команда | Що перевіряє |
|---|---|
| `npm run lint` / `typecheck` / `test` / `build` | ESLint без попереджень, типи (`next typegen` + `tsc`), Vitest, збірка з `ƒ Proxy (Middleware)` |
| `npm run spec:validate` | `openspec validate --all --strict` — структура специфікацій |
| `npm run spec:check` | AC ID на початку кожного `#### Scenario:` (схожий на ID, але з кириличною літерою чи трьома цифрами — з підказкою); унікальність у `openspec/specs` і після archive кожної активної зміни; denylist (`product/denylist.txt`, локальний `product/denylist.local.txt`, секрет `SPEC_DENYLIST`; за початком слова, тож ловить відмінки; фраза — і через перенесення рядка) у `requirements/`, `openspec/`, `docs/`, `src/`, `supabase/`, `tests/`, `README.md`, `AGENTS.md`; немає «бродячого» `product/denylist.local*` під іншим іменем; у кожній зміні специфікації (без `skip_specs`) — `proposal.md` з усіма сімома розділами в порядку правил `openspec/config.yaml` |
| `npm run ac:coverage` | кожен AC специфікації має рядок у `docs/conformance.md`; статус дослівно «реалізовано» або «відкладено (причина)»; «реалізовано» має непропущений тест у `*.test.ts(x)` у `src/` чи `tests/` (їх запускає `npm test`), назва якого починається з ID; шляхи з колонок «Код»/«Тест» існують; тести не посилаються на неіснуючі AC. Попередження (не падає): AC з вимог PM у `requirements/` (рядок починається з ID), якого ще немає в `openspec/specs/`, — «вимогу PM ще не перекладено в специфікацію». E2e-тести (`tests/e2e/*.spec.ts`) не рахуються, доки їх не запускає крок CI |
| `node scripts/check-migration-order.mjs` | міграції, яких немає в `origin/main` (перевизначення — `MIGRATION_BASE` або `--base <ref>`), новіші за найновішу там (`OLDER`); назви `<14 цифр>_<назва>.sql` (`NAME`); без однакових міток (`DUPLICATE`); застосовані файли не змінено (`CHANGED`) і не видалено (`DELETED`); той самий SQL старшого за найновіший файлу під новішою міткою — попередження `RENAMED` (відновлення, див. «Збої й відновлення») |
| CI `db-check` | `supabase db start` — усі міграції й сид на одноразовій базі в раннері (що саме застосовує `db start`, звіряємо на першому прогоні); у PR — `check-migration-order.mjs`; готовий `database.types.ts` у Summary прогону |

## Як цей шаблон зібрано з нуля

Повторюваний рецепт (Git Bash / macOS / Linux; Node 24, npm 11). Для нового клієнта зазвичай достатньо
«Use this template»; рецепт — щоб оновити шаблон на нові версії або зібрати його заново.

```bash
# 1. Скелет Next.js (версію зафіксовано; --turbopack не потрібен, --import-alias — за замовчуванням)
npx --yes create-next-app@16.4.0 my-project --ts --app --eslint --tailwind --src-dir --use-npm \
  --no-agent-feedback --no-cache-components
cd my-project
git branch -M main

# 2. Залежності (спершу @types/node 24 — інакше Vitest 5 дає ERESOLVE)
npm i -E @supabase/supabase-js@2.117.3 @supabase/ssr@0.12.7
npm i -D @types/node@^24
npm i -D -E supabase@2.120.0 @fission-ai/openspec@1.14.1 vitest@5.0.3
npm pkg set engines.node=24.x scripts.lint="eslint --max-warnings 0" \
  scripts.typecheck="next typegen && tsc --noEmit" scripts.test="vitest run" \
  scripts.spec:validate="openspec validate --all --strict" scripts.spec:check="node scripts/check-spec.mjs" \
  scripts.ac:coverage="node scripts/check-ac-coverage.mjs" \
  scripts.db:types="supabase gen types typescript --linked > src/lib/supabase/database.types.ts" \
  scripts.users:demo="node --env-file=.env.local scripts/create-demo-users.mjs"
printf '\n!.env.example\n/product/denylist.local*\n' >> .gitignore
# !.env.example — .env.example комітимо (правило після `.env*` скасовує його для цього файлу);
# /product/denylist.local* — справжні назви клієнтів для spec:check лише локально (зірочка ловить і denylist.local.txt.txt, якщо Провідник приховав розширення)
printf '* text=auto eol=lf\n*.ico binary\n*.png binary\n' > .gitattributes

# 3. Supabase: конфіг і міграція
npx supabase init
# supabase/config.toml: [api] auto_expose_new_tables = false; [auth] site_url = "http://localhost:3000",
#   additional_redirect_urls = ["http://localhost:3000/**"], enable_signup = false (користувачі — лише
#   npm run users:demo через Admin API); [auth.email] enable_confirmations = false
# supabase/migrations/20261012000000_profiles_and_roles.sql, supabase/seed.sql, supabase/demo-users.json

# 4. OpenSpec: глобальний CLI тієї ж версії (його викликають /opsx:* і скіли), профіль custom з verify
#    (глобальний конфіг цієї машини), потім init
npm i -g @fission-ai/openspec@1.14.1 && openspec --version   # 1.14.1
export OPENSPEC_TELEMETRY=0
npx openspec config set profile custom
npx openspec config set workflows '["propose","explore","apply","verify","update","sync","archive"]'
npx openspec init --tools claude,cursor --language Ukrainian --profile custom
npx openspec update
# openspec/config.yaml: context + rules перекладу вимог PM (кожен пункт у лапках); порожні openspec/specs і openspec/changes з .gitkeep

# 5. Перенести з цього шаблону файли, написані вручну:
#   src/proxy.ts, src/lib/supabase/*, src/app/{layout.tsx,page.tsx,login/*}, scripts/**, tests/**, vitest.config.mts,
#   .claude/{settings.json,commands/requirements-sync.md,commands/conformance.md,skills/spec-clarify,skills/spec-review},
#   .cursor/commands/{requirements-sync.md,conformance.md}, .cursorignore, .mcp.json,
#   .github/**, .coderabbit.yaml, AGENTS.md (наші розділи після блоку Next.js), CLAUDE.md,
#   requirements/README.md, product/README.md, docs/**, .env.example
rm -r public   # демо-SVG скелета шаблон не використовує
# tsconfig.json: "exclude" + "tests/fixtures"; eslint.config.mjs: globalIgnores + "tests/fixtures/**"

# 6. Перевірити
npm run lint && npm run typecheck && npm test && npm run build
npm run spec:validate && npm run spec:check && npm run ac:coverage
```

У Windows PowerShell 5.1 лапки всередині JSON треба екранувати:
`npx openspec config set workflows '[\"propose\",\"explore\",\"apply\",\"verify\",\"update\",\"sync\",\"archive\"]'`
(або інтерактивно: `npx openspec config profile`). Змінна середовища: `$env:OPENSPEC_TELEMETRY = "0"`.

Чому саме так — коротко:

- `--no-cache-components`: з Cache Components за замовчуванням (16.4) офіційний патерн Supabase для захищеної
  сторінки не збирається; `proxy.ts` з `--src-dir` має лежати в `src/`, інакше його мовчки ігнорують.
- `setAll(cookies, headers)` у `src/lib/supabase/proxy.ts` копіює заголовки кешування у відповідь (`@supabase/ssr` ≥ 0.10).
- `auto_expose_new_tables = false`: як у хмарі — нові проєкти без автогрантів приблизно з 30.05.2026, усі — з 30.10.2026.
- Профіль OpenSpec зберігається на машині, а не в репозиторії, тому згенеровані `.claude/` і `.cursor/` закомічені.
- Вимоги — командою агента, а не скриптом: `/requirements-sync` — це кілька команд `gh` і `git` та оновлення шапки
  матриці, які агент і так робить добре; людина бачить звіт і вирішує, чи пушити.
- Скіли лише в `.claude/skills/`: Cursor читає цю теку сам, тож двійників у `.cursor/skills/` для `spec-clarify` і
  `spec-review` немає (там лише згенеровані OpenSpec `openspec-*`).
- `## Purpose` у дельті нової можливості: `openspec archive` інакше пише в `openspec/specs/<можливість>/spec.md`
  заглушку Purpose, і `openspec validate --strict` на ній падає.

## Журнал виправлень шаблону

Виправлення після дня 0. Викладач оголошує кожне в чаті курсу з SHA; кожен розробник переносить його у своє репо
PR-ом «Оновлення шаблону» (розділ «Оновлення шаблону» вище).

| Дата | SHA | Що виправлено |
|---|---|---|
| — | — | поки немає |

## Ліцензія

MIT — див. [LICENSE](LICENSE): шаблон можна вільно брати для власних і клієнтських проєктів. Протокол уточнень у
`.claude/skills/spec-clarify` (і його таксономію, яку використовує `.claude/skills/spec-review`) адаптовано з
[GitHub Spec Kit](https://github.com/github/spec-kit) (MIT, Copyright GitHub, Inc.).
