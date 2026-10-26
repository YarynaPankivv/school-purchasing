// Пошук заявок за текстом (сторінка /requests і підказки в рядку пошуку): номер, відділ, автор, статус, позиції.
import { describe, expect, it } from "vitest";
import { matchesRequest, uniqueRequests } from "@/app/(app)/requests/_lib/search";
import type { RequestListItem } from "@/app/(app)/requests/_lib/overview";

const item = (id: string, over: Partial<RequestListItem> & { number?: number; status?: string } = {}): RequestListItem =>
  ({
    request: { id, number: over.number ?? 6, status: over.status ?? "draft", updated_at: "2026-10-21T12:00:00Z" },
    total: 0,
    departmentName: "departmentName" in over ? over.departmentName : "Upper School",
    authorName: over.authorName ?? "Anna Author",
    items: "items" in over ? over.items : "Markers +2 more",
  }) as unknown as RequestListItem;

describe("matchesRequest", () => {
  it("finds a request by number, department, author, status label and item name", () => {
    const one = item("a");
    expect(matchesRequest(one, "pur-6")).toBe(true);
    expect(matchesRequest(one, "upper")).toBe(true);
    expect(matchesRequest(one, "anna")).toBe(true);
    expect(matchesRequest(one, "draft")).toBe(true);
    expect(matchesRequest(one, "markers")).toBe(true);
    expect(matchesRequest(one, "printer")).toBe(false);
  });

  it("does not fail on a request without department or items", () => {
    expect(matchesRequest(item("b", { departmentName: null, items: null }), "markers")).toBe(false);
  });
});

describe("uniqueRequests", () => {
  it("lists a request once even when several lists hold it", () => {
    const a = item("a");
    const b = item("b", { number: 7 });
    expect(uniqueRequests([[a, b], [a], [b, a]]).map((entry) => entry.request.id)).toEqual(["a", "b"]);
  });
});
