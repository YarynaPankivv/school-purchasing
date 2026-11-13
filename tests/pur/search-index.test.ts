// Індекс підказок пошуку: ліміт заявок виконує база (limit у запиті), а не пам'ять сервера (рев'ю PM до WS9, п. 10).
import { describe, expect, it } from "vitest";
import { createSupabaseMock, makeProfile } from "../org/supabase-mock";
import { loadRecentRequests } from "@/app/(app)/requests/_lib/overview";
import type { CurrentUser } from "@/lib/auth/session";
import { PAGE_SIZE } from "@/lib/pur/paging";
import { AUTHOR, PRIMARY, makeLine, makePurchase } from "./helpers";

const user: CurrentUser = { id: AUTHOR, email: "a@example.test", fullName: null, role: "requester", isActive: true, hasProfile: true };

describe("loadRecentRequests", () => {
  it("віддає не більше ліміту найновіших заявок за оновленням (далі за id), а рядки й суми — для них", async () => {
    // Порядок за updated_at відрізняється від порядку за id; у «a» і «b» дати однакові — другий ключ id.
    const purchases = [
      makePurchase({ id: "req-c", number: 3, department_id: PRIMARY, updated_at: "2026-10-01T10:00:00Z" }),
      makePurchase({ id: "req-b", number: 2, department_id: PRIMARY, updated_at: "2026-10-03T10:00:00Z" }),
      makePurchase({ id: "req-a", number: 1, department_id: PRIMARY, updated_at: "2026-10-03T10:00:00Z" }),
      makePurchase({ id: "req-d", number: 4, department_id: PRIMARY, updated_at: "2026-10-02T10:00:00Z" }),
    ];
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: {
        "requests.select": { data: purchases },
        "request_lines.select": { data: [makeLine({ request_id: "req-a", name: "Paper A4", quantity: 2, unit_price: 5 })] },
        "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
      },
    });

    const items = await loadRecentRequests(mock.client as never, user, 3);

    // Найновіші за updated_at: a і b (однакова дата → за id), потім d; c (найстаріша) не потрапила.
    expect(items.map((item) => item.request.id)).toEqual(["req-a", "req-b", "req-d"]);
    const requestsCall = mock.calls.find((call) => call.table === "requests");
    expect(requestsCall?.orders).toEqual([
      ["updated_at", false],
      ["id", true],
    ]);
    const first = items[0];
    expect(first.total).toBe(10);
    expect(first.items).toContain("Paper A4");
    expect(first.departmentName).toBe("Primary School");
  });

  it("рядки заявок, яких більше за одну сторінку читання, не губляться (1100 рядків по 1.00 дають суму 1100.00)", async () => {
    const lines = Array.from({ length: PAGE_SIZE + 100 }, (_, i) =>
      makeLine({ id: `line-${String(i).padStart(5, "0")}`, request_id: "req-a", name: `Line ${i}`, quantity: 1, unit_price: 1 }),
    );
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: {
        "requests.select": { data: [makePurchase({ id: "req-a", department_id: PRIMARY })] },
        "request_lines.select": { data: lines },
        "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
      },
    });

    const [item] = await loadRecentRequests(mock.client as never, user, 300);

    expect(item.total).toBe(PAGE_SIZE + 100);
  });

  it("помилка читання заявок — помилка, а не порожній індекс", async () => {
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: { "requests.select": { error: { message: "boom" } } },
    });
    await expect(loadRecentRequests(mock.client as never, user, 300)).rejects.toThrow("Failed to read requests: boom");
  });
});
