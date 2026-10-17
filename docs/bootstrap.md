# Чекліст розробника, день 0

<!--
Заповнюєте ви одразу після заняття, у цьому порядку: власне репо, власні Supabase і Vercel, перший зелений CI, ruleset.
Мета — застосунок працює локально й на вашому прод-URL, міграції в базу застосовує лише CI, а в main усе йде через PR.
Для кожного пункту — доказ: посилання (run CI, PR, preview), назва змінної або знімок екрана в docs/img/
(без справжніх назв клієнта й людей: зображення spec:check не перевіряє).
ЗНАЧЕННЯ СЕКРЕТІВ І ПАРОЛІВ НІКОЛИ НЕ ПИШІТЬ — лише назви змінних і де вони задані.
Заповнений файл (розділи 1–6) — ваш перший PR, тип «Реалізація» (розділ 7): він же перевіряє ruleset. Посилання на сам
цей PR і на preview допишіть наступним PR. Пояснення кроків — README, «Шлях розробника».
Docker не потрібен: локально — лише npm run dev проти вашої бази; міграції на одноразовій базі перевіряє CI (db-check).
-->

Моє репо: <!-- https://github.com/<dev>/<team-slug> --> · Прод-URL: <!-- https://<slug>.vercel.app -->
Репо вимог PM: <!-- https://github.com/<pm>/<team-slug>-spec --> · Організація Supabase: <!-- назва -->

## 1. Інструменти й репо

- [ ] Node 24 (`node -v`), Git, GitHub CLI (`gh auth status`); OpenSpec CLI глобально тієї ж версії, що в `package.json`:
      `npm i -g @fission-ai/openspec@1.14.1` → `openspec --version` = `1.14.1`
- [ ] Репо створено з шаблону (**Use this template → Create a new repository**): власник — ваш особистий акаунт, назва —
      `<team-slug>`, **Public** (ruleset на GitHub Free діє лише в публічних репо; PM у нотатці-порівнянні посилається на
      рядки вашого коду) — <!-- посилання -->
- [ ] `git clone https://github.com/<dev>/<team-slug>.git` → `npm ci` → `cp .env.example .env.local`
      (у PowerShell: `Copy-Item .env.example .env.local`)
- [ ] CodeRabbit (GitHub App) встановлено на це репо (github.com/apps/coderabbitai → Configure → Only select repositories) — <!-- знімок -->
- [ ] (Якщо PM надіслав список справжніх назв клієнта особистим повідомленням) — локальний `product/denylist.local.txt`
      (у `.gitignore`; `npm run spec:check` читає його й значень не друкує)

## 2. Supabase: власна база

- [ ] Організацію й проєкт створено у вашому акаунті (один із двох безкоштовних проєктів; регіон — найближчий) — <!-- регіон -->
- [ ] Authentication: «Allow new users to sign up» **вимкнено**, «Confirm email» **вимкнено**
      (точні назви й місце перемикачів перевірте в інтерфейсі) — <!-- знімки docs/img/auth-signups.png, docs/img/auth-email.png -->
- [ ] (Після розділу 4, коли є прод-URL) Authentication → URL Configuration: Site URL = прод-URL Vercel; Redirect URLs
      `http://localhost:3000/**`, `https://*-<slug>.vercel.app/**` — <!-- знімок -->
- [ ] `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
      (Project Settings → API Keys; точну назву розділу перевірте в інтерфейсі) і `DEMO_USER_PASSWORD` (≥ 8 символів).
      Значення не комітимо й не вставляємо в чат — <!-- лише назви -->

## 3. GitHub: environment `production` і секрети

- [ ] Settings → Environments → `production` (якщо перший прогін CI вже створив його автоматично — відкрийте наявний;
      `Production`, яке створює Vercel для своїх деплоїв, — те саме середовище: регістр у назвах GitHub не розрізняє):
      **Deployment branches** = Selected branches → `main` — <!-- знімок -->
- [ ] Секрет environment `SUPABASE_DB_URL` = рядок **Session pooler** (порт **5432**, не 6543) з Supabase → **Connect**;
      пароль у рядку percent-encoded — <!-- лише назва секрету -->
- [ ] Запасний шлях (лише якщо `--db-url` не працює): секрети environment `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
      `SUPABASE_PROJECT_ID` (README, «Міграції в прод: запасний шлях») — <!-- не потрібно / назви -->
- [ ] (Необов'язково) секрет репо `SPEC_DENYLIST` — ті самі справжні назви через кому, для CI

## 4. Vercel

- [ ] Add New → Project → імпорт вашого репо, Node 24.x — <!-- прод-URL -->
- [ ] Змінні Production і Preview — лише `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
      `SUPABASE_SECRET_KEY` — **ніколи** — <!-- знімок (лише назви) -->
- [ ] Settings → Deployment Protection → **Require Log In** вимкнено → Save (інакше PM і викладач не відкриють ваші preview;
      точну назву перемикача перевірте в інтерфейсі) — <!-- знімок -->
- [ ] Після змінних — редеплой; прод-URL відкривається — <!-- посилання -->

## 5. База й перший зелений CI

- [ ] Actions → CI → **Run workflow** (гілка `main`, `include_seed` ✓) → job `db-deploy` застосував першу міграцію й сид — <!-- посилання на run -->
- [ ] `npm run users:demo` (синтетичні користувачі з `supabase/demo-users.json`) → `npm run dev` → `http://localhost:3000` →
      вхід як `admin@example.test` працює локально й на прод-URL
- [ ] CI на `main` зелений: `spec`, `app`, `conformance`, `db-check`, `db-deploy` — <!-- посилання на run -->

## 6. Ruleset `solo-main` (лише після зеленого CI на `main`)

- [ ] Settings → Rules → Rulesets → **New ruleset → Import a ruleset** → `solo-main.json` з курсового репо
      (`materials/rulesets/solo-main.json`) або вручну: target — гілка за замовчуванням (`main`); Restrict deletions;
      Block force pushes; Require a pull request — **0 approvals** (колег у вашому репо немає); Require status checks
      (джерело GitHub Actions, без «up to date»): `spec`, `app`, `conformance`, `db-check`; Allowed merge methods —
      **Squash** і **Merge**; Bypass list — **порожній** (навіть для власника); Enforcement — Active
      (точні назви полів перевірте в інтерфейсі) — <!-- знімок docs/img/ruleset.png -->

## 7. Перший PR (перевірка ruleset-у)

- [ ] `git switch -c setup/bootstrap` → цей файл із доказами розділів 1–6 → push → `gh pr create --web` (тип «Реалізація»)
      → окремим коментарем `@coderabbitai review` — <!-- посилання на PR (наступним PR) -->
- [ ] Поки перевірки не зелені, кнопка merge заблокована; push у `main` напряму відхиляється — <!-- знімок -->
- [ ] Vercel створив preview для PR — <!-- посилання на preview (наступним PR) -->
- [ ] **Squash and merge** → прод-деплой Vercel пройшов — <!-- посилання -->
- [ ] (З першою задачею, що має міграцію) `db-check` зелений, після merge `db-deploy` застосував її у вашу базу — <!-- посилання на run -->

## 8. Вимоги PM і специфікація

- [ ] Адресу репо вимог PM узято з чату команди; на зустрічі команди (дні 0–2, до кінця 15.10, організує PM; якщо
      команда не зібралася — діра в чат команди до обіду 16.10) — перший раунд питань до брифу
- [ ] PM написав у чаті команди «вимоги оновлено» (у курсі перші вимоги — до кінця 16.10) → у Claude Code чи Cursor
      `/requirements-sync <pm>/<team-slug>-spec` → PR «Оновлення вимог» злито; шапка `docs/conformance.md` показує
      адресу, джерело (issues чи docs) і дату знімка — <!-- посилання на PR -->
- [ ] Читання вимог: скіл `spec-clarify` → питання — issues «Питання до вимог» у репо PM через вебформу → журнал
      `docs/spec-reading.md` — <!-- посилання на issues -->
- [ ] Переклад у специфікацію (гілка `spec/add-<зріз>`): `/opsx:propose add-<зріз>` → `npx openspec validate add-<зріз> --strict`
      → скіл `spec-review` → `npx openspec archive add-<зріз> -y` → `/conformance` → PR «Специфікація» злито;
      `npm run ac:coverage` без «вимогу PM ще не перекладено» — <!-- посилання на PR -->
