## Тип PR

<!-- Залиште один варіант. Межі змін перевіряє CodeRabbit (перевірка «Тип PR і межі змін»). -->
- [ ] **Оновлення вимог** — гілка `sync/<дата>` від команди агента `/requirements-sync`: лише `requirements/` (знімок
  вимог PM) і рядок «Вимоги: …» у шапці `docs/conformance.md`. Рядків матриці тут немає.
- [ ] **Специфікація** — гілка `spec/<id зміни>`: `openspec/**` — переклад вимог PM (`add-<зріз>` чи уточнення з
  ADDED / MODIFIED / REMOVED, archive у цій гілці) або план `impl-<зріз>`; рядки `docs/conformance.md` (нові AC —
  «відкладено (чекає реалізації)», прибрані — видалено), `docs/spec-reading.md`. Виняток — окремий коміт, що прибирає з
  назв тестів ID AC, прибраних зі специфікації (інакше ORPHAN). Без `requirements/`.
- [ ] **Реалізація** — гілка `task/<коротко>` (у день 0 — `setup/bootstrap`): `src/`, `supabase/`, `tests/`, рядки
  `docs/conformance.md`, `docs/decisions/`, `docs/bootstrap.md`, `docs/img/`, `supabase/demo-users.json`, галочки в
  `openspec/changes/impl-<зріз>/tasks.md` і його archive. Без `requirements/` і `openspec/specs/`.
- [ ] **Оновлення шаблону** — гілка `template/<коротко>`: `git cherry-pick` коміту шаблону курсу (README, «Оновлення шаблону»).

## Вимоги

<!-- Рядок «Вимоги: …» із шапки docs/conformance.md (для «Оновлення вимог» — новий, після /requirements-sync). -->
Вимоги:

## AC, які покриває PR

<!-- Перелік AC ID і що з ними сталося:
- «Оновлення вимог» — нові / змінені / прибрані вимоги й AC і нові рядки журналу змін PM зі звіту /requirements-sync;
- «Специфікація» — які AC PM перекладено (ID ті самі), ADDED / MODIFIED / REMOVED, Open questions з посиланнями на
  питання; розділ «## spec-review» нижче;
- «Реалізація» — AC задачі: реалізовано / відкладено (причина).
Питання й рішення PM — посиланням на issue в репо PM: <pm>/<team-slug>-spec#N
(не «Closes #N»: issue живе в іншому репо, і закриває його PM). -->
- AC-…: реалізовано / відкладено (причина)

## Що змінилось

<!-- 2–5 пунктів. Для міграцій — які таблиці й політики. Для «Специфікації» — вставте сюди розділ ## spec-review
(знахідки скіла spec-review, що виправлено, що свідомо лишено). -->

## Чекліст

- [ ] Одна зміна — один намір; гілка від свіжого `main`
- [ ] `requirements/` змінено лише в «Оновленні вимог» і лише командою `/requirements-sync` (не руками)
- [ ] Для «Специфікації»: кожен AC PM — `#### Scenario:` із тим самим ID, нічого не вигадано (неясне — Open questions і
  питання PM); `npx openspec validate <id> --strict` зелений; зміну заархівовано в цій гілці; рядки матриці оновлено;
  `npm run ac:coverage` без «вимогу PM ще не перекладено» для AC зрізу
- [ ] Тести з AC ID на початку назви (`it("AC-…: …")`), без `.skip` для «реалізовано»; `npm test` зелений
- [ ] Рядок `docs/conformance.md` для кожного AC оновлено в цьому ж PR; `npm run ac:coverage` зелений
- [ ] Міграція — лише новим файлом з `npx supabase migration new` у цьому PR; у вашу базу її застосує CI (`db-deploy`) після merge.
  Жодного `supabase db push` з ноутбука, жодного DDL у SQL Editor; `db-check` зелений
- [ ] Кожна нова таблиця: `enable row level security`, `revoke all … from anon, authenticated`, явні `grant`, політика на кожну операцію `to authenticated` з `(select auth.uid())`
- [ ] Жодних секретів і справжніх даних: ключі лише в `.env.local` / Vercel / GitHub Environments, дані — синтетичні (`*@example.test`)
- [ ] CI зелений (`spec`, `app`, `conformance`, `db-check`); на кожен коментар CodeRabbit — виправлення або відповідь, чому ні
- [ ] Preview на Vercel відкривається (для «Реалізації»); для останнього PR зрізу — запис екрана з прод-URL

<!-- Публічні репозиторії з < 10 зірок CodeRabbit не рецензує автоматично.
Рев'ю запускає КОМЕНТАР у PR (не цей опис): після створення PR напишіть окремим коментарем рядок нижче. -->
Нагадування: окремим коментарем у PR — `@coderabbitai review`
