# Proposal

## Why

Рев'ю PM до WS9 (пункт 7): у сценарії `AC-LANG-09` специфікації «Тоді» переказано. У PM:
«Тоді статус підписано текстом «Partially approved» чи «Returned for revision» відповідно, а не лише кольором»
(`requirements/49-interfejs-anhlijskoiu-movoiu.md`, AC-LANG-09), у нашій специфікації окремим рядком
«статус не передано лише кольором». «Тоді» має бути дослівним, тож сценарій приводимо до тексту PM. ID AC не змінюється.

Джерела (знімок 2026-11-09):

- `requirements/49-interfejs-anhlijskoiu-movoiu.md` — ValiaBihun/2026-quitcode-dream-team#49 (AC-LANG-09).

## What Changes

ID AC PM не змінюються.

- **MODIFIED** — «Статуси «Частково схвалено» й «Повернено на доопрацювання» підписано текстом англійською»
  (AC-LANG-09): «Тоді» в сценарії дослівно за PM, одним реченням; окремий рядок «статус не передано лише кольором»
  прибрано, бо його зміст уже міститься у «а не лише кольором». Вимога (речення з SHALL) не змінюється.

## Capabilities

### New Capabilities

- Немає.

### Modified Capabilities

- `ui-language`: MODIFIED «Статуси «Частково схвалено» й «Повернено на доопрацювання» підписано текстом англійською»
  (AC-LANG-09).

## Users & roles

- Без змін: статуси бачать усі ролі, які бачать заявки.

## Non-goals

- Зміна поведінки застосунку: підписи статусів текстом уже реалізовано (`PURCHASE_STATUS_LABELS`), тести
  `AC-LANG-09` у `tests/pur/pages.test.tsx` і `tests/ui/interface-language.test.ts` не змінюються.
- Зміна «Коли» й «Дано» сценарію.

## Assumptions

Припущення PM:

- У WS9 підпис статусів перевіряється в списку й на сторінці заявки; «в історії» — там, де з'являться записи рішень
  (`requirements/49-interfejs-anhlijskoiu-movoiu.md`, відповідь на ValiaBihun/2026-quitcode-dream-team#75).

Власні припущення (розробник):

- Немає.

## Open questions

- Немає.
