// selectAll читає сторінками по 1000 рядків: PostgREST інакше мовчки обрізав би довгий список заявок.
import { describe, expect, it } from "vitest";
import { PAGE_SIZE, selectAll } from "@/lib/pur/paging";

const rowsOf = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => ({ n: offset + i }));

describe("selectAll", () => {
  it("зводить кілька сторінок в один список без обрізання на 1000 рядках", async () => {
    const total = PAGE_SIZE * 2 + 5;
    const ranges: Array<[number, number]> = [];
    const result = await selectAll<{ n: number }>(async (from, to) => {
      ranges.push([from, to]);
      return { data: rowsOf(Math.max(0, Math.min(total - from, to - from + 1)), from), error: null };
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(total);
    expect(result.data?.[total - 1]).toEqual({ n: total - 1 });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("робить один запит, якщо рядків менше за сторінку", async () => {
    let calls = 0;
    const result = await selectAll<{ n: number }>(async () => {
      calls += 1;
      return { data: rowsOf(3), error: null };
    });
    expect(calls).toBe(1);
    expect(result.data).toHaveLength(3);
  });

  it("рівно повна сторінка вимагає ще одного запиту й закінчується порожньою", async () => {
    let calls = 0;
    const result = await selectAll<{ n: number }>(async (from) => {
      calls += 1;
      return { data: from === 0 ? rowsOf(PAGE_SIZE) : [], error: null };
    });
    expect(calls).toBe(2);
    expect(result.data).toHaveLength(PAGE_SIZE);
  });

  it("помилка на будь-якій сторінці повертається, а не ховається за частковим списком", async () => {
    const result = await selectAll<{ n: number }>(async (from) =>
      from === 0 ? { data: rowsOf(PAGE_SIZE), error: null } : { data: null, error: { message: "boom" } },
    );
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("boom");
  });
});
