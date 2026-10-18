// Задача 2 зрізу ORG (openspec/changes/impl-org/tasks.md 2.3): дозволи на типи заявок і тип закупівлі.
// Чисті правила src/lib/org/request-options.ts і server actions із моком Supabase (design.md D9).
// SQL-дзеркало — private.can_create_request() і requests_insert; їх перевіряють db-check і ручний прохід.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NO_PERMISSIONS,
  allowedPurchaseTypes,
  allowedRequestTypes,
  canCreateRequest,
  permissionsFrom,
} from "@/lib/org/request-options";
import { purchaseTypeFor } from "@/lib/org/requests";
import { createSupabaseMock, form, makeProfile, redirectedTo } from "./supabase-mock";

vi.mock("next/navigation", async () => {
  const { RedirectSignal } = await import("./supabase-mock");
  return {
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new RedirectSignal("not-found");
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const requestActions = () => import("@/app/requests/new/actions");
const userActions = () => import("@/app/admin/users/actions");

const WORKER = "user-worker";
const OFFICE = "dep-office";
const worker = makeProfile({ id: WORKER, role: "requester", email: "member2@example.test" });
const withCard = { ...NO_PERMISSIONS, card_expense: true };
const withSelf = { ...NO_PERMISSIONS, self_purchase: true };

function useSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  createClient.mockResolvedValue(mock.client);
  return mock;
}

beforeEach(() => {
  createClient.mockReset();
});

describe("дозволи на типи заявок", () => {
  it("AC-ORG-07: без дозволу на «Витрату карткою» цього типу немає у виборі", async () => {
    expect(allowedRequestTypes("requester", NO_PERMISSIONS)).toEqual(["PUR", "RMB"]);
    expect(allowedRequestTypes("approver", NO_PERMISSIONS)).not.toContain("CRE");
    expect(permissionsFrom(null)).toEqual(NO_PERMISSIONS); // немає рядка — немає дозволів

    // Прямий POST у server action з типом без дозволу до бази не доходить.
    const mock = useSupabase(createSupabaseMock({ profile: worker }));
    const { createDraftRequest } = await requestActions();
    const url = await redirectedTo(() => createDraftRequest(form({ department_id: OFFICE, type: "CRE" })));
    expect(url).toBe("/requests/new?error=invalid_request");
    expect(mock.calls.some((c) => c.table === "requests")).toBe(false);
  });

  it("AC-ORG-17: з дозволом на «Витрату карткою» тип є у виборі й чернетка створюється", async () => {
    expect(allowedRequestTypes("requester", withCard)).toEqual(["PUR", "RMB", "CRE"]);

    const mock = useSupabase(
      createSupabaseMock({ profile: worker, results: { "user_permissions.select": { data: withCard } } }),
    );
    const { createDraftRequest } = await requestActions();
    const url = await redirectedTo(() => createDraftRequest(form({ department_id: OFFICE, type: "CRE" })));
    expect(url).toBe("/requests/new?created=1");
    expect(mock.calls.find((c) => c.table === "requests")?.payload).toEqual({
      author_id: WORKER,
      department_id: OFFICE,
      type: "CRE",
      purchase_type: null,
    });
  });

  it("AC-ORG-17: адміністратор видає дозвіл — рядок user_permissions оновлюється одним upsert", async () => {
    const mock = useSupabase(createSupabaseMock());
    const { setPermissions } = await userActions();
    const url = await redirectedTo(() => setPermissions(form({ user_id: WORKER, card_expense: "on" })));
    expect(url).toBe(`/admin/users/${WORKER}?saved=1`);
    const call = mock.calls.find((c) => c.table === "user_permissions");
    expect(call?.op).toBe("upsert");
    expect(call?.payload).toMatchObject({
      user_id: WORKER,
      card_expense: true,
      check_request: false,
      vendor_invoice: false,
      self_purchase: false,
    });
  });

  it("матриця прав: admin бачить усі п'ять типів без дозволів", () => {
    expect(allowedRequestTypes("admin", NO_PERMISSIONS)).toEqual(["PUR", "RMB", "CRE", "RFC", "INV"]);
  });

  it("видавати дозволи може лише admin", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: worker }));
    const { setPermissions } = await userActions();
    const url = await redirectedTo(() => setPermissions(form({ user_id: WORKER, card_expense: "on" })));
    expect(url).toBe(`/admin/users/${WORKER}?error=forbidden`);
    expect(mock.calls.some((c) => c.table === "user_permissions")).toBe(false);
  });
});

describe("тип закупівлі", () => {
  it("AC-ORG-08: без дозволу «Самостійна закупівля» — лише тип закупівлі «Відділ закупівель»", async () => {
    expect(allowedPurchaseTypes("requester", NO_PERMISSIONS)).toEqual(["procurement"]);
    expect(allowedPurchaseTypes("requester", withSelf)).toEqual(["procurement", "self"]);
    // Тимчасово Q5: адміністратору дозвіл не потрібен.
    expect(allowedPurchaseTypes("admin", NO_PERMISSIONS)).toEqual(["procurement", "self"]);

    const mock = useSupabase(createSupabaseMock({ profile: worker }));
    const { createDraftRequest } = await requestActions();
    const url = await redirectedTo(() =>
      createDraftRequest(form({ department_id: OFFICE, type: "PUR", purchase_type: "self" })),
    );
    expect(url).toBe("/requests/new?error=invalid_request");
    expect(mock.calls.some((c) => c.table === "requests")).toBe(false);
  });

  it("«Закупівля» з «Відділом закупівель» створюється й без дозволів", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: worker }));
    const { createDraftRequest } = await requestActions();
    const url = await redirectedTo(() =>
      createDraftRequest(form({ department_id: OFFICE, type: "PUR", purchase_type: "procurement" })),
    );
    expect(url).toBe("/requests/new?created=1");
    expect(mock.calls.find((c) => c.table === "requests")?.payload).toMatchObject({
      type: "PUR",
      purchase_type: "procurement",
    });
  });

  it("тип закупівлі — лише для «Закупівлі»: для інших типів його ігноруємо, без нього «Закупівлю» не приймаємо", () => {
    expect(purchaseTypeFor("RMB", "self")).toBeNull();
    expect(purchaseTypeFor("PUR", "toString")).toBeNull();
    expect(canCreateRequest("requester", NO_PERMISSIONS, "PUR", null)).toBe(false);
    expect(canCreateRequest("requester", NO_PERMISSIONS, "RMB", null)).toBe(true);
    expect(canCreateRequest("admin", NO_PERMISSIONS, "INV", null)).toBe(true);
  });

  it("збій читання дозволів — помилка, а не «дозволів немає»", async () => {
    useSupabase(
      createSupabaseMock({ profile: worker, results: { "user_permissions.select": { error: { message: "timeout" } } } }),
    );
    const { createDraftRequest } = await requestActions();
    await expect(createDraftRequest(form({ department_id: OFFICE, type: "RMB" }))).rejects.toThrow(
      "Не вдалося прочитати дозволи: timeout",
    );
  });
});
