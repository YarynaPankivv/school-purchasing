// Номер закупівлі PUR-N (AC-PUR-01; design.md D2). Присвоює його база (послідовність і тригер);
// тут — формат і розбір для UI, пошуку й тестів.

const PREFIX = "PUR-";
// Без провідних нулів: PUR-1, PUR-1042, не PUR-001.
const NUMBER_RE = /^PUR-([1-9][0-9]*)$/i;

export function formatPurchaseNumber(n: number): string {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`Invalid purchase number: ${n}`);
  return `${PREFIX}${n}`;
}

// Для чернетки, якої ще не вставлено, номера немає.
export function purchaseNumberLabel(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : formatPurchaseNumber(n);
}

export function parsePurchaseNumber(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = NUMBER_RE.exec(raw.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) ? n : null;
}

// Наступний номер — на одиницю більший за останній виданий; найперша закупівля — PUR-1 (AC-PUR-01).
export function nextPurchaseNumber(lastIssued: number | null | undefined): number {
  return (lastIssued ?? 0) + 1;
}
