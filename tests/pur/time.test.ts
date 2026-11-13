// Час запису історії (AC-HIST-06; design.md D7): «05.11.2026, 14:32», America/New_York, без позначки поясу.
import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDay, formatHistoryTime } from "@/lib/pur/time";

describe("formatHistoryTime", () => {
  it("AC-HIST-06: 19:32 UTC після переходу на зимовий час — 14:32 за New York, у форматі ДД.ММ.РРРР, ГГ:ХХ", () => {
    expect(formatHistoryTime("2026-11-05T19:32:00Z")).toBe("05.11.2026, 14:32");
  });

  it("AC-HIST-06: літній час (EDT) зсуває на 4 години, зимовий (EST) — на 5", () => {
    expect(formatHistoryTime("2026-10-21T19:45:00Z")).toBe("21.10.2026, 15:45");
    expect(formatHistoryTime("2026-12-21T19:45:00Z")).toBe("21.12.2026, 14:45");
  });

  it("AC-HIST-06: 24-годинний час: північ — 00:00, а не 24:00 чи 12:00 AM; позначки поясу немає", () => {
    expect(formatHistoryTime("2026-11-06T05:00:00Z")).toBe("06.11.2026, 00:00");
    expect(formatHistoryTime("2026-11-06T04:59:00Z")).toBe("05.11.2026, 23:59");
    expect(formatHistoryTime("2026-11-05T19:32:00Z")).not.toMatch(/[A-Za-z]/);
  });

  it("порожнє чи неприпустиме значення дає «—»", () => {
    expect(formatHistoryTime(null)).toBe("—");
    expect(formatHistoryTime(undefined)).toBe("—");
    expect(formatHistoryTime("not a date")).toBe("—");
  });
});

describe("інші формати часу: порожні й неприпустимі значення, Date як вхід", () => {
  it("formatDateTime, formatDay, formatDate: null, undefined і неприпустиме значення дають «—»", () => {
    for (const bad of [null, undefined, "not a date"]) {
      expect(formatDateTime(bad)).toBe("—");
      expect(formatDay(bad)).toBe("—");
    }
    for (const bad of [null, undefined, "", "21.10.2026", "2026-02-31"]) expect(formatDate(bad)).toBe("—");
  });

  it("приймають Date так само, як рядок: той самий момент — той самий текст у часовому поясі America/New_York", () => {
    const moment = "2026-11-05T19:32:00Z";
    expect(formatHistoryTime(new Date(moment))).toBe(formatHistoryTime(moment));
    expect(formatDateTime(new Date(moment))).toBe(formatDateTime(moment));
    expect(formatDay(new Date(moment))).toBe("Nov 5, 2026");
    expect(formatDate("2026-10-21")).toBe("Oct 21, 2026");
  });
});
