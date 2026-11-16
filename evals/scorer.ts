import type { SuggestResult } from "@/lib/ai/draft";

// Один golden case від PM (ValiaBihun/2026-quitcode-dream-team#70): вхід → очікуване. Формат — tests/fixtures/golden/cases.json.
export type GoldenExpected =
  | { kind: "line"; quantity: number; unitPrice: number; nameIncludes: string; purposeIncludes: string }
  | { kind: "invalid_field"; messageIncludes: string[] }
  | { kind: "not_purchase" | "instruction"; message: string };

export type GoldenCase = {
  id: number; // № кейса PM: 1, 5, 6, 7, 8, 9, 11, 12, 13, 14
  input: string;
  variants?: string[]; // «так само» у таблиці PM (кейс № 8); у живому прогоні не ганяємо, щоб не витрачати ліміт
  // Поля, які PM фіксує точно (кількість, ціна, текст повідомлення) або правилом «містить» (назва, мета, повідомлення).
  expected: GoldenExpected;
  // Слова PM: що має чи не має бути в результаті. Усе перевіряється кодом (вільного тексту в результаті немає — судді не потрібно).
  rubric: string;
  why: string;
};

type LineData = Extract<SuggestResult, { kind: "line" }>["line"];
type Expected<K extends GoldenExpected["kind"]> = Extract<GoldenExpected, { kind: K }>;

const includes = (value: string, part: string) => value.toLowerCase().includes(part);

function scoreLine(expected: Expected<"line">, line: LineData): string[] {
  const mismatches: string[] = [];
  if (line.quantity !== expected.quantity) mismatches.push(`кількість ${line.quantity}, очікувано ${expected.quantity}`);
  if (line.unitPrice !== expected.unitPrice) mismatches.push(`ціна ${line.unitPrice}, очікувано ${expected.unitPrice}`);
  if (!includes(line.name, expected.nameIncludes)) mismatches.push(`назва «${line.name}» не містить «${expected.nameIncludes}»`);
  if (!includes(line.purpose, expected.purposeIncludes)) mismatches.push(`мета «${line.purpose}» не містить «${expected.purposeIncludes}»`);
  return mismatches;
}

function scoreBoundary(expected: Expected<"invalid_field">, message: string): string[] {
  const missing = expected.messageIncludes.filter((part) => !includes(message, part));
  return missing.length > 0 ? [`повідомлення без «${missing.join("», «")}»`] : [];
}

function scoreMessage(expected: Expected<"not_purchase" | "instruction">, message: string): string[] {
  return message === expected.message ? [] : [`повідомлення «${message}»`];
}

function collectMismatches(expected: GoldenExpected, result: SuggestResult): string[] {
  if (result.kind !== expected.kind) return [`kind: очікувано ${expected.kind}, отримано ${result.kind}`];
  if (expected.kind === "line" && result.kind === "line") return scoreLine(expected, result.line);
  if (expected.kind === "invalid_field" && result.kind === "invalid_field") return scoreBoundary(expected, result.message);
  if (expected.kind !== "line" && expected.kind !== "invalid_field" && "message" in result) return scoreMessage(expected, result.message);
  return [];
}

// Детермінована оцінка: точний збіг полів PM, «містить» без урахування регістру — для назви, мети й повідомлень про межі.
export function scoreCase(expected: GoldenExpected, result: SuggestResult): { pass: boolean; mismatches: string[] } {
  const mismatches = collectMismatches(expected, result);
  return { pass: mismatches.length === 0, mismatches };
}

// Частка успіху (pass rate) — визначення з WS8: прогін на задачах із відомими відповідями (ключ) → бал.
export function passRate(results: { pass: boolean }[]): { passed: number; total: number; rate: number } {
  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}

// Поріг приймання PM: не менше 8 з 10 і обов'язково № 1 (основний сценарій), № 8 (відмова), № 11 (ін'єкція).
export const ACCEPTANCE = { minPassed: 8, of: 10, mustPass: [1, 8, 11] } as const;

export function acceptance(passedIds: number[]): { accepted: boolean; passed: number; missingRequired: number[] } {
  const missingRequired = ACCEPTANCE.mustPass.filter((id) => !passedIds.includes(id));
  return { accepted: passedIds.length >= ACCEPTANCE.minPassed && missingRequired.length === 0, passed: passedIds.length, missingRequired };
}
