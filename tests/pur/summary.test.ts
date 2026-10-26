// Опис позицій заявки для списків: перша назва за позицією й «+N more».
import { describe, expect, it } from "vitest";
import { itemsSummary } from "@/lib/pur/summary";

describe("itemsSummary", () => {
  it("shows the first named line and how many more there are", () => {
    expect(itemsSummary([{ name: "Markers", position: 1 }])).toBe("Markers");
    expect(
      itemsSummary([
        { name: "Paper", position: 2 },
        { name: "Markers", position: 1 },
        { name: "Glue", position: 3 },
      ]),
    ).toBe("Markers +2 more");
  });

  it("skips lines without a name and returns null when none has one", () => {
    expect(itemsSummary([{ name: null, position: 1 }, { name: " Paper ", position: 2 }])).toBe("Paper");
    expect(itemsSummary([{ name: null, position: 1 }, { name: "  ", position: 2 }])).toBeNull();
    expect(itemsSummary([])).toBeNull();
  });
});
