# Tasks

Кожна група — PR «Реалізація» (`task/<коротко>`); галочки й рядки `docs/conformance.md` її AC — у тому самому PR.
Рішення — `design.md`. У кожному PR: зелені `spec`, `app`, `conformance`, `db-check`, «fallow audit» і «доменна підлога»,
`npm run check:design`; `@coderabbitai review` окремим коментарем і відповідь на кожну знахідку. Міграцій у зрізі немає. Нові
залежності (`ai`, `@openrouter/ai-sdk-provider`, `zod`, `server-only`) — ADR `docs/decisions/0006-ai-helper-openrouter.md`.
Ключ — лише `OPENROUTER_API_KEY` у `.env.local` і Vercel (Production + Preview), у git ніколи.

## 1. Сервіс пропозиції: схема zod, `proposeDraft`, ключ лише на сервері (`task/ai-service`)

- [x] 1.1 `src/lib/ai/schema.ts` (zod: `status ok | needs_info | refused`, `refusal`, поля рядка, `null` для невідомого),
  `prompts/draft.ts` (`DRAFT_PROMPT_VERSION`, межа `<document>`), `draft.ts` (`proposeDraft`, `classifyError`, `toSuggestResult`:
  межі кількості й ціни в коді), `models.ts` (лише `:free`), `openrouter.ts` (`import "server-only"`, єдине місце з ключем),
  `messages.ts` (тексти AC дослівно). Тести `tests/golden.test.ts`: збої (429, 429 у тілі при HTTP 200, 402, таймаут, не за схемою),
  `AC-AI-05`, `AC-AI-04`, `AC-AI-06` (теги `<document>` вирізано), `AC-AI-02`; `tests/ai-key.test.ts` (ключ лише на сервері).
  Перевірка: `npm test`. Done when: AC-AI-01, AC-AI-02, AC-AI-04, AC-AI-05, AC-AI-06
- [x] 1.2 `tests/ui/interface-language.test.ts`: сканер пропускає лише `src/lib/ai/messages.ts` (ValiaBihun/2026-quitcode-dream-team#77).
  Перевірка: `npm test`. Done when: AC-AI-02, AC-AI-06 (тексти AC українською не ламають AC-LANG-01)
- [x] 1.3 `.env.example`: `OPENROUTER_API_KEY` (лише сервер, у Vercel Production + Preview). Скрипти `ai:models`, `ai:quota`, `eval`
  у `package.json`. Перевірка: `npm run check:boundary`. Done when: AC-AI-04 (немає ключа — «недоступний», ключ лише на сервері)

Done when: AC-AI-01, AC-AI-02, AC-AI-04, AC-AI-05, AC-AI-06 (рівень сервісу)

## 2. Server actions і перевірка автора (`task/ai-action`)

- [x] 2.1 `src/app/(app)/requests/[id]/ai-actions.ts` (`suggestLine`, `addLineWithValues`): `requireActiveUser()`, чернетка автора
  (`author_id === actor.id`) ДО виклику моделі, довжина опису, повторна перевірка zod + `parseLineFields` перед записом. Тести
  `tests/pur/ai-actions.test.ts` (підмінений fetch провайдера, справжня обгортка ключа): `AC-AI-06` — чужа заявка чи заявка, яку автор не може редагувати
  (`canEditLines`, напр. `approved`) → відмова без звернення до моделі й без запису, вказівка не створює заявок; `AC-AI-01` — пропозиція без запису в БД;
  `AC-AI-04` — немає ключа; `AC-AI-05` — 429. Перевірка: `npm test`, `npm run check:actions`. Done when: AC-AI-01, AC-AI-04, AC-AI-05, AC-AI-06

Done when: AC-AI-01, AC-AI-04, AC-AI-05, AC-AI-06 (рівень дії)

## 3. Інтерфейс: блок «Запропонувати рядки» у формі чернетки (`task/ai-ui`)

- [x] 3.1 `ai-line-helper.tsx` (клієнтський), `ai-helper-view.tsx`, `src/lib/ai/flow.ts` і підключення в `[id]/page.tsx` лише автору
  редагованої чернетки: textarea, кнопка «Запропонувати рядки», стани очікування й повідомлення (`Alert`, токени,
  `@/components/ui`), заповнення першого порожнього рядка (`line_<id>_*`) або, коли порожнього рядка немає, картка пропозиції з кнопкою «Додати рядок»
  (`addLineWithValues` лише після натискання), подія `input` для `live-line-total`. Тести `tests/ui/ai-line-helper.test.tsx`: `AC-AI-03` — «Шукаю рядки…», кнопка `disabled`, опис у полі;
  `AC-AI-04` — fake timers, 15-та секунда без відповіді; повідомлення AC-AI-02, 04, 05, 06; картка пропозиції не пише в БД без натискання. Перевірка: `npm test`, `npm run check:design`.
  Done when: AC-AI-01, AC-AI-02, AC-AI-03, AC-AI-04, AC-AI-05, AC-AI-06
- [x] 3.2 Рядки AC-AI-01…06 у `docs/conformance.md` → «реалізовано» (з поясненням про Q1, Q2, Q5, Q6, де діє припущення).
  Перевірка: `npm run ac:coverage`. Done when: AC-AI-01…06 («реалізовано» лише з кодом і тестом)

Done when: AC-AI-01, AC-AI-02, AC-AI-03, AC-AI-04, AC-AI-05, AC-AI-06

## 4. Golden cases й офлайн-оцінювання (`task/ai-golden`)

- [x] 4.1 `tests/fixtures/golden/cases.json` (10 кейсів PM: `expected`, `rubric`), `evals/scorer.ts`, `tests/golden.test.ts` (`it.each`,
  назви `AC-AI-01|02|06: golden $id`, реплей справжніх відповідей з `recorded.json` через `MockLanguageModelV4`, перевірка
  версії промпту). Перевірка: `npm test`. Done when: AC-AI-01 (golden 1, 5, 6, 7, 13, 14), AC-AI-02 (golden 8, 9), AC-AI-06 (golden 11, 12); додатково — поріг приймання PM (≥ 8 з 10, обов'язково № 1, 8, 11) у офлайн-реплеї

Done when: AC-AI-01, AC-AI-02, AC-AI-06 (golden cases PM) і поріг приймання PM у офлайн-прогоні

## 5. Живий eval і UAT на проді (`task/ai-eval`)

- [x] 5.1 `evals/golden.live.eval.ts` + `vitest.eval.config.mts` (`npm run eval`): живий прогін із записом (`RECORD=1`), офіційний повний звіт
  `evals/reports/2026-11-15T09-30-54-457Z.md` (10 з 10, модель на кожен кейс, версія промпту), історія прогонів і пояснені FAIL — `evals/reports/README.md`. Перевірка: `npm run eval`. Done when: AC-AI-01, AC-AI-02, AC-AI-06 (golden на живій моделі), поріг PM у звіті
- [x] 5.2 `tests/e2e/slice4.spec.ts` і прогін `npm run uat` на проді (AC-AI-01 «людина підтверджує», AC-AI-02, AC-AI-06); звіт у
  `docs/qa/uat/2026-11-16/` (AC-AI-01 на `1b0d6f2`) і `docs/qa/uat/2026-11-16-58fe065/` (AC-AI-01, 02, 06 на `58fe065`); актуальний повтор усіх трьох на проді `d43406e` — `docs/qa/uat/2026-11-17/` (PASS, 17.11). Перевірка: `npm run uat` на проді. Done when: AC-AI-01 (людина підтверджує: чернетка не подана), AC-AI-02, AC-AI-06
- [ ] 5.3 Повідомлення PM у чаті: «eval готовий: прод <URL>, звіт <посилання>, дата живого прогону <дата>»; proof pack зрізу 4
  (за шаблоном WS9). Archive `impl-ai-helper` — в останньому PR зрізу. Done when: AC-AI-01…06 мають чесний статус у `docs/conformance.md`

Done when: AC-AI-01, AC-AI-02, AC-AI-06 на проді; поріг приймання PM у живому прогоні
