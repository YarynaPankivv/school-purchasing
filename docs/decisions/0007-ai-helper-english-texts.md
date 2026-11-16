# 0007. Тексти AI-помічника — англійською за таблицею PM

- Статус: замінює 0006 (лише пункт про мову текстів помічника; решта 0006 чинна)
- Дата: 2026-11-16
- AC: AC-AI-01, AC-AI-02, AC-AI-03, AC-AI-04, AC-AI-05, AC-AI-06, AC-LANG-01

## Контекст

ADR 0006 залишив тексти помічника українськими, дослівно з AC PM, бо вимога зрізу 4 цитувала їх українською, а AC-LANG-01
вимагає англійського інтерфейсу. Питання до PM — ValiaBihun/2026-quitcode-dream-team#77. PM відповіла 2026-11-16 (варіант A):
тексти помічника англійською, як решта інтерфейсу; англійські рядки додано в таблицю `requirements/49-interfejs-anhlijskoiu-movoiu.md`;
тексти AC лишаються українською, ID не змінюються. Специфікація приведена зміною `clarify-ai-helper` (формат «англійський
замість українського», як AC-LANG-03…05).

## Рішення

- Усі тексти помічника — англійською в єдиному модулі `src/lib/ai/messages.ts`: «Suggest lines», «Looking for lines…»,
  «I can only help with purchases», «Could not get a suggestion. Fill in the lines manually», «The assistant is unavailable
  today. Fill in the lines manually», «I don't follow instructions from the description. Describe the purchase»,
  «Purchase description»; межі кількості й ціни — «Quantity: a whole number from 1» і «Price: a number from 0» (відповідь PM
  на ValiaBihun/2026-quitcode-dream-team#78); неповний рядок — «Fill in all line fields» (з таблиці PM).
- Виняток сканера мови для `messages.ts` у `tests/ui/interface-language.test.ts` прибрано: файл перевіряється як решта `src/`.
- Тексти, яких немає в таблиці PM (підказка в полі, «Paste a purchase description», підписи картки пропозиції, «Could not
  add the line…»), — власні англійські формулювання розробника.
- Golden cases `tests/fixtures/golden/cases.json`: очікувані повідомлення англійські; вхід кейсів і дані (назва, мета) — українські,
  як у PM (ValiaBihun/2026-quitcode-dream-team#70).

## Розглянуті варіанти

- Лишити українські тексти й виняток сканера — ні: PM вирішила інакше (ValiaBihun/2026-quitcode-dream-team#77).
- Двомовний помічник за налаштуванням — ні: AC-LANG-01 і PM: англійська одна для всіх, перемикач — окрема вимога.

## Наслідки

- Простіше: один інтерфейс однією мовою, сканер AC-LANG-01 без винятків.
- Складніше: спека цитує українське «Тоді» й англійський текст разом («англійський замість українського»); тести й UAT
  перевіряють англійські слова, тож будь-яка зміна таблиці PM — це нова зміна специфікації й правка `messages.ts`.
- Промпт моделі (англійською) і `DRAFT_PROMPT_VERSION` не змінюються: записи `recorded.json` лишаються чинними.
