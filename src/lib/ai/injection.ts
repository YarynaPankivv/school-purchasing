// Перша лінія захисту від спроби керувати помічником замість опису покупки (фідбек WS10, пропозиція 3): перевірка кодом
// ДО виклику моделі спрацьовує однаково щоразу й не витрачає запит із денного ліміту. Модель лишається другою лінією —
// для формулювань, яких у списку немає. Лише англійські шаблони (інтерфейс і введення англійською, AC-LANG-01).
// Без `import "server-only"` і без process.env: файл можна імпортувати з тестів Vitest.
const PATTERNS: readonly RegExp[] = [
  /\b(ignore|forget|disregard)\b.{0,40}\b(instructions?|rules?|prompts?)\b/i,
  /\b(reveal|show)\b.{0,40}\b(prompt|passwords?|accounts?)\b/i,
  /\byou are now\b/i,
];

export function looksLikeInstruction(text: string): boolean {
  // NFKC і стиснення пробілів: повноширинні літери й подвійні пробіли шаблон не обходять.
  const flat = text.normalize("NFKC").replace(/\s+/g, " ");
  return PATTERNS.some((pattern) => pattern.test(flat));
}
