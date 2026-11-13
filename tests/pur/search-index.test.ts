// Індекс підказок пошуку: ліміт заявок виконує база (limit у запиті), а не пам'ять сервера (рев'ю PM до WS9, п. 10).
import { describe, expect, it } from "vitest";
import { createSupabaseMock, makeProfile } from "../org/supabase-mock";
import { loadRecentRequests } from "@/app/(app)/requests/_lib/overview";
import type { CurrentUser } from "@/lib/auth/session";
import { AUTHOR, PRIMARY, makeLine, makePurchase } from "./helpers";

const user: CurrentUser = { id: AUTHOR, email: "a@example.test", fullName: null, role: "requester", isActive: true, hasProfile: true };

describe("loadRecentRequests", () => {
  it("віддає не більше ліміту заявок, а рядки й суми — для них", async () => {
    const purchases = Array.from({ length: 1200 }, (_, i) =>
      makePurchase({ id: `req-${String(i).padStart(5, "0")}`, number: i + 1, department_id: PRIMARY }),
    );
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: {
        "requests.select": { data: purchases },
        "request_lines.select": { data: [makeLine({ request_id: "req-00000", name: "Paper A4", quantity: 2, unit_price: 5 })] },
        "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
      },
    });

    const items = await loadRecentRequests(mock.client as never, user, 300);

    expect(items).toHaveLength(300);
    const first = items.find((item) => item.request.id === "req-00000");
    expect(first?.total).toBe(10);
    expect(first?.items).toContain("Paper A4");
    expect(first?.departmentName).toBe("Primary School");
  });

  it("помилка читання заявок — помилка, а не порожній індекс", async () => {
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: { "requests.select": { error: { message: "boom" } } },
    });
    await expect(loadRecentRequests(mock.client as never, user, 300)).rejects.toThrow("Failed to read requests: boom");
  });
});
