// Відображення рядків у формі: порядкові номери без «дір» після видалення рядка і ціна з двома знаками
// (зауваження PM до зрізу 4, ValiaBihun/2026-quitcode-dream-team#71; на AC не впливає).
import { describe, expect, it } from "vitest";
import { unitPriceInputValue, withDisplayNumbers } from "@/lib/pur/lines";

describe("ціна в полі форми", () => {
  it("число з одним знаком після крапки показується з двома: 1.5 → «1.50»", () => {
    expect(unitPriceInputValue(1.5)).toBe("1.50");
  });

  it("ціле й вже двозначне не змінюються за змістом: 20 → «20.00», 0 → «0.00», «20.00» → «20.00»", () => {
    expect(unitPriceInputValue(20)).toBe("20.00");
    expect(unitPriceInputValue(0)).toBe("0.00");
    expect(unitPriceInputValue("20.00")).toBe("20.00");
  });

  it("немає ціни — порожнє поле, а не «0.00» чи «NaN»", () => {
    expect(unitPriceInputValue(null)).toBe("");
    expect(unitPriceInputValue(undefined)).toBe("");
    expect(unitPriceInputValue("")).toBe("");
    expect(unitPriceInputValue("abc")).toBe("");
  });
});

describe("номери рядків у повідомленні про незаповнені поля", () => {
  const incomplete = (position: number) => ({ number: position, position, fields: ["name" as const] });

  it("після видалення рядка 1 єдиний рядок (position 2) називається «Line 1», як у формі", () => {
    expect(withDisplayNumbers([incomplete(2)], [{ position: 2 }])).toEqual([{ number: 1, position: 2, fields: ["name"] }]);
  });

  it("«дірка» в position не зсуває порядкові номери: позиції 1, 3, 4 → 1, 2, 3", () => {
    const lines = [{ position: 4 }, { position: 1 }, { position: 3 }];
    const result = withDisplayNumbers([incomplete(3), incomplete(4)], lines);
    expect(result.map((r) => r.number)).toEqual([2, 3]);
  });

  it("позиції, якої вже немає в списку, номер із бази лишається як є", () => {
    expect(withDisplayNumbers([incomplete(7)], [{ position: 1 }])).toEqual([incomplete(7)]);
  });
});
