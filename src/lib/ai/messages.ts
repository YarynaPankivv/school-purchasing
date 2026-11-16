// Тексти помічника «Suggest lines» — англійською за таблицею PM (requirements/49-interfejs-anhlijskoiu-movoiu.md) за рішенням
// ValiaBihun/2026-quitcode-dream-team#77 (варіант A); специфікація — openspec/specs/ai-line-suggestion (зміна clarify-ai-helper,
// формат «англійський замість українського»). Тексти AC лишаються українською, ID AC не змінюються. Усе, що бачить людина, —
// англійською (AC-LANG-01), тож цей файл сканер tests/ui/interface-language.test.ts перевіряє як решту src/.

export const AI_MESSAGES = {
  // AC-AI-02, golden 8 і 9
  notPurchase: "I can only help with purchases",
  // AC-AI-06, golden 11 і 12
  instruction: "I don't follow instructions from the description. Describe the purchase",
  // AC-AI-04 (немає відповіді за 15 секунд); так само — збій провайдера й відповідь без жодного відомого поля
  timeout: "Could not get a suggestion. Fill in the lines manually",
  // AC-AI-05 (ліміт постачальника моделі: ValiaBihun/2026-quitcode-dream-team#81)
  limit: "The assistant is unavailable today. Fill in the lines manually",
  // golden 5, 6, 7: тексти PM — ті самі, що в ручній формі (ValiaBihun/2026-quitcode-dream-team#78, таблиця #49)
  invalidQuantity: "Quantity: a whole number from 1",
  invalidPrice: "Price: a number from 0",
  // Неповний опис (ValiaBihun/2026-quitcode-dream-team#79): відомі поля заповнено, порожні позначено; текст — з таблиці PM
  missingFields: "Fill in all line fields",
  // Додавання рядка з картки пропозиції не вдалося (сервер відхилив або збій): пропозиція лишається для повтору.
  addFailed: "Could not add the line. Try again or fill in the lines manually",
} as const;

export const AI_UI = {
  label: "Purchase description", // таблиця PM (#49)
  placeholder: "For example: 3 packs of A4 paper for printing, 20 dollars each",
  button: "Suggest lines", // AC-AI-01…06
  loading: "Looking for lines…", // AC-AI-03
  empty: "Paste a purchase description",
  // Картка пропозиції, коли в формі немає порожнього рядка: запис лише після натискання (підтвердження людини).
  proposal: "Suggested line",
  accept: "Add suggested line",
  fields: { name: "Name", purpose: "Purpose", quantity: "Quantity", unitPrice: "Unit price" },
} as const;

// 15 секунд очікування відповіді до повідомлення AC-AI-04 (припущення PM).
export const AI_WAIT_MS = 15_000;
// Сервер обриває запит до провайдера трохи раніше, щоб клієнтський таймер не гнав його з'єднання (design.md D5).
export const AI_SERVER_TIMEOUT_MS = 14_000;
// Захист від надто довгого вводу (рішення розробника; PM межі не задавала).
export const AI_DESCRIPTION_MAX = 1000;
