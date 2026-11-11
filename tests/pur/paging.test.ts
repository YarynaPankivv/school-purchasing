// selectAll читає сторінками по 1000 рядків за курсором id: PostgREST інакше мовчки обрізав би довгий список заявок,
// а зсув між сторінками міг би повторити чи загубити рядок. Це технічна утиліта без власного AC, тож назви без AC ID;
// правила AC, які від неї залежать, перевіряє tests/pur/overview-paging.test.ts.
import { describe, expect, it } from "vitest";
import { PAGE_SIZE, selectAll } from "@/lib/pur/paging";

const idOf = (n: number) => `row-${String(n).padStart(6, "0")}`;
const rowsOf = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => ({ id: idOf(offset + i) }));

// Читач сторінки, що поводиться як PostgREST: впорядковано за id, «id > курсор», не більше PAGE_SIZE.
const readerOver = (all: Array<{ id: string }>, cursors: Array<string | null> = []) => async (after: string | null) => {
  cursors.push(after);
  const rows = all.filter((row) => after === null || row.id > after).slice(0, PAGE_SIZE);
  return { data: rows, error: null };
};

describe("selectAll", () => {
  it("зводить кілька сторінок в один список у тому самому порядку, без обрізання на 1000 рядках", async () => {
    const total = PAGE_SIZE * 2 + 5;
    const cursors: Array<string | null> = [];
    const result = await selectAll(readerOver(rowsOf(total), cursors));
    expect(result.error).toBeNull();
    expect(result.data).toEqual(rowsOf(total));
    // Кожна наступна сторінка починається з id останнього рядка попередньої, а не з зсуву.
    expect(cursors).toEqual([null, idOf(PAGE_SIZE - 1), idOf(PAGE_SIZE * 2 - 1)]);
  });

  it("робить один запит, якщо рядків менше за сторінку", async () => {
    const cursors: Array<string | null> = [];
    const result = await selectAll(readerOver(rowsOf(3), cursors));
    expect(cursors).toEqual([null]);
    expect(result.data).toEqual(rowsOf(3));
  });

  it("рівно повна сторінка вимагає ще одного запиту й закінчується порожньою", async () => {
    const cursors: Array<string | null> = [];
    const result = await selectAll(readerOver(rowsOf(PAGE_SIZE), cursors));
    expect(cursors).toEqual([null, idOf(PAGE_SIZE - 1)]);
    expect(result.data).toEqual(rowsOf(PAGE_SIZE));
  });

  it("вставка рядка між сторінками не повторює і не губить наявні рядки", async () => {
    const original = rowsOf(PAGE_SIZE + 10);
    let calls = 0;
    const result = await selectAll(async (after) => {
      calls += 1;
      // Після першої сторінки на початку списку з'являється новий рядок: зі зсувом перший рядок другої сторінки
      // повторився б, з курсором — ні.
      const live = calls === 1 ? original : [{ id: "row-new" }, ...original];
      const rows = [...live].sort((a, b) => a.id.localeCompare(b.id)).filter((row) => after === null || row.id > after);
      return { data: rows.slice(0, PAGE_SIZE), error: null };
    });
    const ids = (result.data ?? []).map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(original.every((row) => ids.includes(row.id))).toBe(true);
  });

  it("помилка на будь-якій сторінці повертається, а не ховається за частковим списком", async () => {
    const result = await selectAll<{ id: string }>(async (after) =>
      after === null ? { data: rowsOf(PAGE_SIZE), error: null } : { data: null, error: { message: "boom" } },
    );
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("boom");
  });
});
