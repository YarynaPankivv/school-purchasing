// loadOverview читає заявки й рядки сторінками по 1000 (src/lib/pur/paging.ts): PostgREST інакше мовчки обрізав би
// відповідь. Фікстури більші за одну сторінку: рядки з другої сторінки мають потрапити у списки й суми.
import { describe, expect, it } from "vitest";
import { createSupabaseMock, makeProfile } from "../org/supabase-mock";
import { loadOverview } from "@/app/(app)/requests/_lib/overview";
import type { CurrentUser } from "@/lib/auth/session";
import { PAGE_SIZE } from "@/lib/pur/paging";
import { APPROVER, AUTHOR, PRIMARY, makeLine, makePurchase } from "./helpers";

const COUNT = PAGE_SIZE + 50;
const idOf = (prefix: string, n: number) => `${prefix}-${String(n).padStart(5, "0")}`;

const asUser = (id: string, role: CurrentUser["role"]): CurrentUser => ({
  id,
  email: `${id}@example.test`,
  fullName: null,
  role,
  isActive: true,
  hasProfile: true,
});

describe("loadOverview: понад одну сторінку читання", () => {
  it("AC-FRM-10: власні заявки з другої сторінки читання є в списку «Мої заявки»", async () => {
    const purchases = Array.from({ length: COUNT }, (_, i) =>
      makePurchase({ id: idOf("req", i), number: i + 1, author_id: AUTHOR, status: "pending" }),
    );
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: {
        "requests.select": { data: purchases },
        "request_lines.select": { data: [] },
        "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
        "department_approvers.select": { data: [] },
      },
    });
    const overview = await loadOverview(mock.client as never, asUser(AUTHOR, "requester"));
    expect(overview.mine).toHaveLength(COUNT);
    expect(new Set(overview.mine.map((item) => item.request.id)).size).toBe(COUNT);
  });

  it("AC-APR-01: заявки відділу з другої сторінки читання є в списку «На рішення» схвалювача", async () => {
    const purchases = Array.from({ length: COUNT }, (_, i) =>
      makePurchase({ id: idOf("req", i), number: i + 1, author_id: AUTHOR, status: "pending", department_id: PRIMARY }),
    );
    const mock = createSupabaseMock({
      profile: makeProfile({ id: APPROVER, role: "requester" }),
      results: {
        "requests.select": { data: purchases },
        "request_lines.select": { data: [] },
        "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
        "department_approvers.select": { data: [{ department_id: PRIMARY, user_id: APPROVER }] },
      },
    });
    const overview = await loadOverview(mock.client as never, asUser(APPROVER, "requester"));
    expect(overview.toDecide).toHaveLength(COUNT);
    expect(overview.mine).toHaveLength(0);
  });

  it("AC-HIST-02: сума заявки враховує рядки з другої сторінки читання (1050 рядків по 1.00 дають 1050.00)", async () => {
    const lines = Array.from({ length: COUNT }, (_, i) =>
      makeLine({ id: idOf("line", i), request_id: "req-1", position: i + 1, quantity: 1, unit_price: 1 }),
    );
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: {
        "requests.select": { data: [makePurchase({ id: "req-1", author_id: AUTHOR })] },
        "request_lines.select": { data: lines },
        "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
        "department_approvers.select": { data: [] },
      },
    });
    const overview = await loadOverview(mock.client as never, asUser(AUTHOR, "requester"));
    expect(overview.mine).toHaveLength(1);
    expect(overview.mine[0]?.total).toBe(COUNT);
  });

  it("заявки йдуть «нові зверху» незалежно від порядку читання за id", async () => {
    const older = makePurchase({ id: "req-a", author_id: AUTHOR, created_at: "2026-10-01T10:00:00Z" });
    const newer = makePurchase({ id: "req-b", author_id: AUTHOR, created_at: "2026-11-01T10:00:00Z" });
    const mock = createSupabaseMock({
      profile: makeProfile({ id: AUTHOR, role: "requester" }),
      results: {
        "requests.select": { data: [older, newer] },
        "request_lines.select": { data: [] },
        "departments.select": { data: [] },
        "department_approvers.select": { data: [] },
      },
    });
    const overview = await loadOverview(mock.client as never, asUser(AUTHOR, "requester"));
    expect(overview.mine.map((item) => item.request.id)).toEqual(["req-b", "req-a"]);
  });
});
