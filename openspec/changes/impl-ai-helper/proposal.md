# Proposal

## Why

Зріз 4 (WS10): працівник вставляє у формі закупівлі вільний опис покупки, а AI пропонує один рядок (назва, мета,
кількість, ціна). Специфікація зрізу — `openspec/specs/ai-line-suggestion/spec.md` (PR «Специфікація» add-ai-helper);
вимога PM — `requirements/71-ai-proponuie-riadky-zakupivli.md` (ValiaBihun/2026-quitcode-dream-team#71), приклади для
перевірки — golden cases (ValiaBihun/2026-quitcode-dream-team#70). Ця зміна — план реалізації: рішення в `design.md`,
вертикальні задачі в `tasks.md`.

## What Changes

Реалізуємо всі шість AC можливості `ai-line-suggestion`:

- AC-AI-01 — пропозиція одного рядка за описом, закупівлю не подано;
- AC-AI-02 — відмова на опис не про закупівлі;
- AC-AI-03 — стан очікування («Шукаю рядки…», неактивна кнопка, опис у полі);
- AC-AI-04 — немає відповіді 15 секунд;
- AC-AI-05 — денний ліміт запитів до AI вичерпано;
- AC-AI-06 — вказівки в описі не виконуються.

Додатково (вимога PM, не AC): 10 golden cases (№ 1, 5, 6, 7, 8, 9, 11, 12, 13, 14) у `tests/fixtures/golden/cases.json`,
офлайн-прогін у `npm test` і живий прогін `npm run eval`; поріг приймання — не менше 8 з 10, обов'язково № 1, 8, 11.
