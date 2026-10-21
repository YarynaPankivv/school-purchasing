// Суми рядків і заявки (AC-PUR-06; design.md D3: у базі лише кількість і ціна, суми — TS).
// Рахуємо в центах (цілі числа), щоб 0.1 × 3 не давало 0.30000000000000004; у долари повертаємо наприкінці.
import type { LineRow } from "./types";

type Priced = Pick<LineRow, "quantity" | "unit_price">;

// Незаповнений рядок чернетки (немає кількості чи ціни) дає 0.
export function lineTotalCents(line: Priced): number {
  if (line.quantity === null || line.unit_price === null) return 0;
  return line.quantity * Math.round(line.unit_price * 100);
}

// Сума рядка = кількість × ціна, округлення до центів (Припущення PM).
export function lineTotal(line: Priced): number {
  return lineTotalCents(line) / 100;
}

// Сума заявки = сума всіх її рядків (AC-PUR-06).
export function requestTotalCents(lines: readonly Priced[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}

export function requestTotal(lines: readonly Priced[]): number {
  return requestTotalCents(lines) / 100;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// «$1,234.50»: долари США з двома знаками (Припущення PM).
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

export function formatUsd(amount: number): string {
  return formatCents(Math.round(amount * 100));
}
