# Proposal

## Why

Реалізуємо зріз WS7 «працівник подає закупівлю, схвалювач приймає рішення» за власною специфікацією
`openspec/specs/{purchase-drafts,purchase-submission,purchase-decisions,purchase-visibility}` (переклад вимоги
ValiaBihun/2026-quitcode-dream-team#3, знімок 2026-10-20, з уточненнями `update-pur-ord-answers`). Без подання й рішень
зріз ORD не має схвалених закупівель для обробки.

## What Changes

Зміна покриває AC зрізу з `openspec/specs/`:

- `purchase-drafts`: AC-PUR-01, 02, 04, 06, 07, 08, 10, 13, 30, 32, 34;
- `purchase-submission`: AC-PUR-05, 09, 11, 12, 14, 16, 23, 29, 31, 33, 37, 38, 45, 47, 48, 53, 54;
- `purchase-decisions`: AC-PUR-15, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 36, 39, 40, 41, 42, 43, 44, 50, 51, 52;
- `purchase-visibility`: AC-PUR-03, 35, 49.

AC-PUR-34 (файли) у цій зміні — відкладено: потрібне сховище файлів (Supabase Storage з політиками), на яке в дедлайн
зрізу не вистачає часу (`design.md`, D8).
