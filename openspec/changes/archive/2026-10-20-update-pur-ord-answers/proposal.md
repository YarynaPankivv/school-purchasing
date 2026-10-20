# Proposal

## Why

PM відповіла на питання розробника Q7–Q13 і 2026-10-20 оновила вимоги «працівник подає закупівлю, схвалювач приймає
рішення» і «відділ закупівель створює замовлення й обробляє закупівлю»: змінено AC-PUR-26, 47, 48, додано AC-PUR-53, 54
і AC-ORD-35…39. Специфікацію зрізів PUR і ORD треба привести у відповідність до нового тексту PM.

Джерело: `requirements/3-pratsivnyk-podaie-zakupivliu.md` — ValiaBihun/2026-quitcode-dream-team#3 і
`requirements/4-viddil-zakupivel-stvoriuie-zamovlennia.md` — ValiaBihun/2026-quitcode-dream-team#4 (знімок 2026-10-20);
рядки журналу змін PM від 2026-10-20.

## What Changes

- **MODIFIED** AC-PUR-26 — автор явно відкриває подану заявку на редагування; доки не збереже чи не скасує, схвалити не
  можна.
- **MODIFIED** AC-PUR-47, AC-PUR-48 — лише для автора без автосхвалення відділу.
- **ADDED** AC-PUR-53 — автор з автосхваленням, який водночас єдиний схвалювач відділу: одразу «Схвалено», у «Чекають
  рішення» заявки немає.
- **ADDED** AC-PUR-54 — єдиний активний адміністратор, автор (чи особа «від імені») заявки відділу без схвалювача, що
  може вирішити: заявка чекає в «Чекають рішення», дій рішення він не бачить.
- **ADDED** AC-ORD-35 — режим «Детально»: у бухгалтерську систему йде по рядку на кожен рядок замовлення.
- **ADDED** AC-ORD-36 — довідник постачальників, назва унікальна без урахування регістру.
- **ADDED** AC-ORD-37, AC-ORD-38 — межі кількості й ціни в рядку замовлення.
- **ADDED** AC-ORD-39 — після повного видалення останнього замовлення закупівля лишається «В обробці».

## Capabilities

### New Capabilities

- Немає.

### Modified Capabilities

- `purchase-decisions`: AC-PUR-26 (MODIFIED).
- `purchase-submission`: AC-PUR-47, 48 (MODIFIED), AC-PUR-53 (ADDED у вимозі «Автосхвалення»), AC-PUR-54 (ADDED).
- `order-accounting`: AC-ORD-35 (ADDED).
- `order-creation`: AC-ORD-36 (ADDED).
- `order-editing`: AC-ORD-37, 38, 39 (ADDED).

## Users & roles

Без змін: автор заявки (`requester` чи `approver`), схвалювач (`approver`), відділ закупівель (`admin`), особа «від
імені» — як у вимогах ValiaBihun/2026-quitcode-dream-team#3 і #4 та матриці прав `requirements/product.md`.

## Non-goals

Без змін щодо зрізів PUR і ORD (окрема обробка замовлень у PUR, справжня бухгалтерська система в ORD тощо).

## Assumptions

Нові припущення PM:

- Автор починає редагування поданої заявки явно; доки він не збереже чи не скасує зміни, заявку схвалити не можна (#3).
- Статус закупівлі «В обробці» не повертається до «Схвалено» після видалення замовлень (#4).
- Режимів відправки замовлення два: «Підсумок» і «Детально» (#4).
- Постачальників обирають із довідника, який веде адміністратор; назва унікальна без урахування регістру (#4).
- Для рядка замовлення діють ті самі межі, що для рядка закупівлі: кількість ціла не менша за 1, ціна не менша за 0 (#4).

## Open questions

Відкриті питання PM: немає.

Питання розробника Q7–Q13 закрито відповідями PM (текст вимог від 2026-10-20):

- Q7 — https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/25 → AC-PUR-47, 48 змінено, AC-PUR-53.
- Q8 — https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/26 → AC-PUR-26 змінено.
- Q9 — https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/27 → AC-ORD-35.
- Q10 — https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/28 → AC-ORD-36.
- Q11 — https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/29 → AC-ORD-37, 38.
- Q12 — https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/30 → AC-PUR-54.
- Q13 — https://github.com/ValiaBihun/2026-quitcode-dream-team/issues/31 → AC-ORD-39.
