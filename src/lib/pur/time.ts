// Дати й час — за America/New_York (Припущення PM; design.md D7).
// У базі timestamptz зберігається в UTC; тут лише показ.
export const APP_TIME_ZONE = "America/New_York";

const dateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

// Запис історії за формулою PM: «05.11.2026, 14:32» — ДД.ММ.РРРР, 24-годинний час, без позначки поясу (AC-HIST-06;
// ValiaBihun/2026-quitcode-dream-team#74). Пояс — America/New_York, як у решти застосунку.
const historyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// День без часу для переліків («Oct 21, 2026»): момент у тому самому часовому поясі, що й повний запис.
const day = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});

// Дата без часу (delivery_date date): це календарна дата, а не момент, тож часовий пояс її не зсуває.
const dateOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// «Oct 21, 2026, 3:45 PM EDT» для запису історії.
export function formatDateTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

// «21.10.2026, 15:45» для запису історії.
export function formatHistoryTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const part = (type: Intl.DateTimeFormatPartTypes) => historyParts.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}.${part("year")}, ${part("hour")}:${part("minute")}`;
}

// «Oct 21, 2026» для моменту в переліку: рядок списку не потребує хвилин; повний момент — formatDateTime на сторінці заявки.
export function formatDay(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : day.format(date);
}

// «Oct 21, 2026» для бажаної дати доставки ('YYYY-MM-DD').
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = DATE_RE.exec(value);
  if (!match) return "—";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  // Дата 2026-02-31 розкотилася б у березень: відкидаємо.
  if (date.getUTCMonth() !== Number(match[2]) - 1) return "—";
  return dateOnly.format(date);
}
