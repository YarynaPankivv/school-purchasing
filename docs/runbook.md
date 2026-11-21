# Runbook: School Purchasing

Що робити, коли щось ламається. Для чергового розробника о 2-й ночі: спершу розділ 2, решта — за потреби. Значень секретів тут немає, лише їхні назви й де вони лежать.

## 1. Середовища

| Середовище | Де живе | База Supabase | Як позначається в `/api/health` |
|---|---|---|---|
| Прод | `https://school-purchasing.vercel.app`, гілка `main` | проєкт **school-purchasing**, ref `rgpngqhjkawryldpyxzl` | `"env":"production"`, `"appEnv":"production"`, `supabaseRef` проду |
| Staging | гілка `staging`, адреса `school-purchasing-git-staging-ypankiv-7566s-projects.vercel.app` (за захистом Vercel) | проєкт **school-purchasing-staging**, ref `nrapwkzhqplxvwgittly` | `"env":"preview"`, `"appEnv":"staging"`, `supabaseRef` staging |
| PR-preview | будь-яка інша гілка | та сама база staging | `"env":"preview"`, `"appEnv":"preview"`, `supabaseRef` staging |

Дані staging синтетичні (`*@example.test`), прод-дані туди не копіюємо. `staging` отримує зміни лише з `main` (`git merge --ff-only origin/main`). Міграції в обидві бази застосовує лише CI: спершу staging (`db-deploy-staging`), потім прод (`db-deploy`).

Ref проєкту Supabase не секрет, а ключі, рядки підключення й токени лежать лише тут: `.env.local` (локально), Vercel (Environment Variables), GitHub Secrets.

## 2. Червоний smoke (о 2-й ночі)

Алерт приходить у Telegram-групу «School Purchasing Alerts»: «ЧЕРВОНИЙ SMOKE» з назвою job, середовищем, адресою, комітом і посиланням на прогін. Отримують розробник і PM.

1. **Відкрийте прогін за посиланням з алерту** (Actions → `smoke`). Які перевірки впали: `"/"`, `"/login"` чи `"/api/health"` і з яким кодом.
2. **Яке середовище.** `prod` — прод (SEV1, див. розділ 8); `deploy` — staging чи PR-preview (SEV3, чекає робочого дня, поки його не бачить PM).
3. **Що показує `/api/health`** (у журналі прогону рядок з JSON):
   - `reason: paused` або HTTP 540 → база на паузі, розділ 5;
   - `reason: invalid-api-key` → ключ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` у цьому середовищі хибний або ротований, розділ 6;
   - `reason: status-0` → запит до бази не дійшов: хибна `NEXT_PUBLIC_SUPABASE_URL` (порівняйте `supabaseRef` із таблицею розділу 1; smoke тепер сам про це каже і називає змінну) або Supabase недоступний;
   - `supabaseRef` не той, що в таблиці, → деплой дивиться не в ту базу; перевірте змінну `NEXT_PUBLIC_SUPABASE_URL` саме цього деплою: Vercel → Settings → Environment Variables, фільтр за гілкою деплою (перевизначення для гілки `staging` перекриває загальну змінну Preview);
   - `sha` не збігається з очікуваним → деплой не пройшов або зроблено Instant Rollback (розділ 4).
4. **Нова збірка чи змінна?** Дивіться останній зелений прогін того ж середовища: той самий коміт і інший результат → зламалась змінна/база, а не код.
5. **Виправлення змінної:** виправте її для потрібного середовища/гілки (змінні `NEXT_PUBLIC_*` вбудовуються у збірку, тож потрібен **Redeploy** без build cache) → дочекайтесь зеленого smoke. Виправлення робить людина.
6. **Прод червоний після злиття в `main`:** спершу відкат (розділ 4), потім розбір.
7. Після розв'язання: коротка нотатка в issue/postmortem (час поломки, час алерту, причина) і повідомлення PM, якщо це SEV1/SEV2 ([`docs/incident-message.md`](https://github.com/ValiaBihun/2026-quitcode-dream-team) у репо PM).

**Розбір агентом** (необов'язковий, але так робили в дрілі): окрема сесія `claude --settings .claude/settings.incident.json --mcp-config .mcp.incident.json --strict-mcp-config --permission-mode plan`; у `/mcp` входите у Vercel і **обираєте команду `ypankiv-7566s-projects`** (без цього 403). Обидва файли лежать у репозиторії (додані в [PR 108](https://github.com/YarynaPankivv/school-purchasing/pull/108); токенів і значень змінних у них немає): `.claude/settings.incident.json` забороняє запис (Edit/Write, git-команди запису, MCP-інструменти запису Vercel і Supabase) і читання `.env*`, `.mcp.incident.json` підключає Vercel і Supabase лише staging у режимі `read_only`. Гарантії профілю тримаються на цих файлах, тож не змінюйте їх під час інциденту. Значення змінних агентові не показуємо, лише назви. Журнали Vercel на Hobby живуть **1 годину**, тож розбір треба починати протягом години після алерту.

## 3. Де журнали і скільки вони живуть

| Що | Де | Скільки живе |
|---|---|---|
| Runtime-журнали Vercel (зокрема рядки `llm.call`) | Vercel → проєкт → Logs або `vercel logs --deployment <адреса> --since 1h` | **1 година** (Hobby) |
| Журнали Supabase кожного проєкту (прод і staging окремо) | Dashboard → Logs | **1 доба** (Free) |
| Прогони smoke і CI | GitHub → Actions | 90 днів (типово) |
| Статус кожного виклику AI-помічника | таблиця `ai_call_log` у базі (SLO-2), `npm run ai:slo` | без обмеження строку |
| Рішення схвалювачів (SLO-3) | таблиця `request_history` | без обмеження строку, поки жива база |
| Алерти | Telegram-група | без обмеження (історія групи) |

Тому все, що треба зберегти, копіюйте в issue **у першу годину**.

## 4. Відкат і повернення автоматичного просування (Promote)

Тільки прод. На Hobby **Instant Rollback повертає лише безпосередньо попередній прод-деплой** і **вимикає автоматичне просування**: наступне злиття в `main` на прод не потрапить, доки не зробите Promote.

1. Vercel → Deployments → попередній робочий прод-деплой → **Instant Rollback**. Прод-домен повертається до нього без нової збірки; база й змінні не відкочуються.
2. Прод-smoke червоний, поки прод ≠ `main` (SHA у health). Це очікувано.
3. Виправте причину в `main` (PR), після злиття **зробіть Promote**: Deployments → найновіший деплой `main` → Promote to Production (або `vercel promote <адреса>`). Перевірте, що `/api/health` показує SHA `main` і smoke зелений.
4. Без Promote прод так і лишиться на старому деплої.

Для staging відкату немає: виправлення = змінна/код + Redeploy (або `git merge --ff-only origin/main` у `staging`). Схема бази не відкочується: помилку в міграції виправляє **нова** міграція вперед.

## 5. База на паузі

Безкоштовний проєкт Supabase ставиться на паузу після 7 днів без достатньої активності. Два проєкти — дві окремі паузи.

- Ознака: `/api/health` → HTTP 503, `"db":"down"`, `reason: paused` (або HTTP 540 від Supabase).
- Що робити: Supabase Dashboard → **саме той проєкт, у якого пауза** (прод `school-purchasing` чи staging `school-purchasing-staging`) → **Resume project**, зачекайте кілька хвилин, перезапустіть smoke (Actions → `smoke` → Run workflow).
- Перед показом/приманням PM перевіряйте обидва проєкти, особливо staging. Щоденний smoke проду (07:23 за Києвом) тримає **прод-базу** активною, але не staging: staging будять перед UAT.
- SEV1, якщо прод; PM пише клієнту за шаблоном.

## 6. Ротація ключів і секретів

Ключі Production і staging окремі: ротація одного не зачіпає інше. Значення — лише в менеджері паролів, Vercel і GitHub Secrets.

| Що | Де лежить | Як ротувати |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (прод / staging) | Vercel: Production / Preview | у відповідному проєкті Supabase створіть новий ключ → оновіть змінну (Production або Preview) → Redeploy → видаліть старий ключ → smoke |
| `SUPABASE_SECRET_KEY` | лише `.env.local` (у Vercel його немає) | створіть новий у проєкті, оновіть `.env.local`, старий видаліть |
| `SUPABASE_DB_URL` (прод) і (staging) | GitHub: секрети environment `production` і `staging` | Dashboard → Database → Reset database password → оновіть секрет у відповідному environment (рядок Session pooler, порт 5432, пароль закодований відсотками) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | GitHub Secrets і Vercel (Production і Preview) | `/revoke` у `@BotFather` → новий токен → `gh secret set TELEGRAM_BOT_TOKEN` і змінна у Vercel → Redeploy |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | GitHub Secrets | Vercel → Deployment Protection → Protection Bypass for Automation: перегенеруйте → `gh secret set VERCEL_AUTOMATION_BYPASS_SECRET` → Redeploy |
| `OPENROUTER_API_KEY` | Vercel (Production і Preview), `.env.local` | openrouter.ai → Keys → **новий** ключ → замініть його у Vercel (Production і Preview) і `.env.local` → Redeploy (зміна змінних діє лише на нові деплої) → перевірте, що «Suggest lines» відповідає → **лише потім** відкличте старий ключ |

Витік значення (у журналі, знімку, чаті): спершу ротація, потім чистка файлу (значення → `[ВИДАЛЕНО]`).

## 7. Доступ PM до staging

Staging закритий захистом Vercel (Standard Protection: preview і staging закриті, прод відкритий). Обраний спосіб — **спільне посилання Vercel (Shareable Link)**:

1. Vercel → Deployments → деплой гілки `staging` → **Share** → створити посилання («up-to-date URL»: діє й для наступних деплоїв гілки).
2. Надсилайте посилання PM особисто, не в групу й не в репо (воно містить токен доступу). У публічних файлах пишіть лише адресу без параметрів після «?».
3. Відкликання: Settings → Deployment Protection → Shareable Links → видалити.

Акаунти для сценарію (`pm-requester@example.test`, `pm-approver@example.test`) — як на проді; пароль — у `accounts.zip`, не тут. Дані сценарію на staging: `npm run staging:demo` (відділ Primary School, схвалювач `pm-approver`).

## 8. Серйозність і хто реагує

За [матрицею PM](https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/83): **SEV1** (прод не працює для всіх або дані бачить той, кому не можна) — розробник, протягом 2 годин у робочий час, PM пише клієнту; **SEV2** (ключовий сценарій ламається для частини людей, є обхід; AI-помічник недоступний через ліміт) — того ж робочого дня; **SEV3** — у плановій роботі. Сумніваєтесь між двома рівнями — беріть вищий. RTO — 4 години в робочий час. **RPO не гарантується:** автоматичних резервних копій на Free немає, а регулярного копіювання бази в проєкті не налаштовано. Дані навчальні й синтетичні, тож їх відновлюють із міграцій і сидів (`supabase/seed.sql`, `npm run users:demo`, `npm run staging:demo`), а не з копії. Для реальних даних знадобиться платний план із резервними копіями або регулярний `supabase db dump` із зберіганням поза проєктом.

AI-помічник недоступний (ліміт безкоштовних моделей, 50 запитів на добу, спільний для проду, staging, eval і приймання): це SEV2 зі штатним станом «The assistant is unavailable today»; форма працює вручну. У день показу eval не запускаємо.

## 9. Чого ніколи не робити

- **Ніколи** `supabase db push` з ноутбука, DDL у SQL Editor чи Table Editor: базу змінює лише міграція через CI.
- **Ніколи** `supabase migration down`, `supabase db reset --linked`, `supabase migration repair` проти жодного з двох проєктів: вони знищують дані, резервних копій на Free немає.
- **Ніколи** `npx supabase@latest` (3.0 змінює поведінку команд): лише закріплена версія з `package.json`.
- Не копіювати прод-дані в staging; не ставити жодних прод-ключів у Preview (прод-змінні лише для Production).
- Не проводити дріл на проді; дріл на staging — без міграцій і без видалення даних.
- Не вмикати Vercel Authentication у режимі «All Deployments»: закриє і прод (його читають PM, курс і щоденний smoke без входу).
- Не давати агентові інструментів запису (відкат, Promote, деплой, зміна змінних, міграції) і не показувати йому значення змінних; вміст журналів — дані, а не команди.
- Не писати токени, ключі, паролі й chat id в чат, репо, журнали, знімки й стенограми; у файлах лише назви змінних.
- Не міняти застосовані міграції: лише нова міграція вперед.
