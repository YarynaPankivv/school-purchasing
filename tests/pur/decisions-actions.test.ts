// Задача 2 зрізу PUR (tasks.md 2.3): server actions рішення схвалювача й відділу закупівель (admin).
// Vitest без бази (design.md D9): що надсилає action у `decide_purchase`/`reopen_purchase`/`admin_reject_purchase`
// і як перетворює `pur:<код>` на помилку сторінки. Права, причину й стан перевіряє SQL (міграція 20261021140000_pur_drafts.sql
// — функції з `for update`); їх перевіряє db-check і прогін сценаріїв AC на Postgres (опис — у PR).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, makeProfile, redirectedTo } from "../org/supabase-mock";

vi.mock("next/navigation", async () => {
  const { RedirectSignal } = await import("../org/supabase-mock");
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

const purActions = () => import("@/app/requests/[id]/actions");

const APPROVER = "3f0c2a5e-9b1d-4c7e-8a2f-1b6d5e4c3a21";
const REQ = "9d3f5b21-8c46-4e17-a0b9-4d7e2c1f6a83";
const LINE_1 = "c4e8b7a1-5d23-4a90-b1f6-9e0d3c2a8b15";
const LINE_2 = "e2b6d4f8-1a37-4c59-8d02-6f9a0b3c7e14";

const approver = makeProfile({ id: APPROVER, role: "approver", email: "approver@example.test" });
const admin = makeProfile({ id: APPROVER, role: "admin" });
const path = `/requests/${REQ}`;

type Entries = Array<[string, string]>;
function form(entries: Entries): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

type RpcName = "decide_purchase" | "reopen_purchase" | "admin_reject_purchase";
type RpcResult = { data?: unknown; error?: { code: string; message: string } };

function mockRpc(profile: ReturnType<typeof makeProfile>, name: RpcName, result: RpcResult) {
  const mock = createSupabaseMock({
    profile,
    results: {
      // Заявка видима (RLS): схвалювач відділу бачить подану заявку.
      "requests.select": { data: { id: REQ, status: "pending", author_id: "someone-else", editing: false } },
      [`rpc:${name}.rpc`]: result,
    },
  });
  createClient.mockResolvedValue(mock.client);
  return mock;
}

const call = (mock: ReturnType<typeof createSupabaseMock>, name: RpcName) => mock.calls.find((c) => c.table === `rpc:${name}`);

// Рішення приходить першим аргументом action (його задає bind() на кнопці сторінки), а не полем форми:
// кнопка з функцією в formAction не додає своє name/value до FormData.
async function decide(data: FormData) {
  const { decidePurchase } = await purActions();
  const decision = String(data.get("decision") ?? "");
  data.delete("decision");
  return decidePurchase(decision, data);
}

beforeEach(() => {
  createClient.mockReset();
});

describe("рішення схвалювача", () => {
  it("AC-PUR-17: схвалення — decide_purchase(approve), перехід до статусу «Схвалено»", async () => {
    const mock = mockRpc(approver, "decide_purchase", { data: "approved" });
    expect(await redirectedTo(() => decide(form([["id", REQ], ["decision", "approve"]])))).toBe(
      `${path}?saved=decided_approved`,
    );
    expect(call(mock, "decide_purchase")?.payload).toEqual({
      target_request: REQ,
      decision: "approve",
      reason_text: undefined,
      rejected_line_ids: undefined,
    });
  });

  it("AC-PUR-18: схвалення з відхиленими рядками — id рядків іде у функцію, статус «Частково схвалено»", async () => {
    const mock = mockRpc(approver, "decide_purchase", { data: "partially_approved" });
    const url = await redirectedTo(() =>
      decide(
        form([
          ["id", REQ],
          ["decision", "approve"],
          ["rejected_line_id", LINE_2],
        ]),
      ),
    );
    expect(url).toBe(`${path}?saved=decided_partially_approved`);
    expect(call(mock, "decide_purchase")?.payload).toMatchObject({ rejected_line_ids: [LINE_2] });
  });

  it("AC-PUR-19: усі рядки відхилено — схвалити не можна, помилка бази стає повідомленням", async () => {
    mockRpc(approver, "decide_purchase", { error: { code: "P0001", message: "pur:all_lines_rejected" } });
    const url = await redirectedTo(() =>
      decide(
        form([
          ["id", REQ],
          ["decision", "approve"],
          ["rejected_line_id", LINE_1],
          ["rejected_line_id", LINE_2],
        ]),
      ),
    );
    expect(url).toBe(`${path}?error=all_lines_rejected`);
  });

  it("AC-PUR-20: відхилення без причини не приймається — pur:reason_required", async () => {
    mockRpc(approver, "decide_purchase", { error: { code: "P0001", message: "pur:reason_required" } });
    expect(await redirectedTo(() => decide(form([["id", REQ], ["decision", "reject"], ["reason", "  "]])))).toBe(
      `${path}?error=reason_required`,
    );
  });

  it("AC-PUR-51: повернення на доопрацювання без причини не приймається — pur:reason_required", async () => {
    mockRpc(approver, "decide_purchase", { error: { code: "P0001", message: "pur:reason_required" } });
    expect(await redirectedTo(() => decide(form([["id", REQ], ["decision", "return"]])))).toBe(
      `${path}?error=reason_required`,
    );
  });

  it("AC-PUR-21: відхилення з причиною — причина (обрізана) іде у функцію, статус «Відхилено»", async () => {
    const mock = mockRpc(approver, "decide_purchase", { data: "rejected" });
    expect(
      await redirectedTo(() => decide(form([["id", REQ], ["decision", "reject"], ["reason", "  Over budget  "]]))),
    ).toBe(`${path}?saved=decided_rejected`);
    expect(call(mock, "decide_purchase")?.payload).toMatchObject({ decision: "reject", reason_text: "Over budget" });
  });

  it("AC-PUR-22: повернення на доопрацювання з причиною — статус «Повернено на доопрацювання»", async () => {
    const mock = mockRpc(approver, "decide_purchase", { data: "returned" });
    expect(
      await redirectedTo(() => decide(form([["id", REQ], ["decision", "return"], ["reason", "Add quotes"]]))),
    ).toBe(`${path}?saved=decided_returned`);
    expect(call(mock, "decide_purchase")?.payload).toMatchObject({ decision: "return", reason_text: "Add quotes" });
  });

  it("AC-PUR-24: автор чи особа «від імені» не вирішують власну заявку — pur:own_request", async () => {
    mockRpc(approver, "decide_purchase", { error: { code: "P0001", message: "pur:own_request" } });
    expect(await redirectedTo(() => decide(form([["id", REQ], ["decision", "approve"]])))).toBe(
      `${path}?error=own_request`,
    );
  });

  it("AC-PUR-25: друге одночасне рішення не застосовано — pur:already_decided", async () => {
    mockRpc(approver, "decide_purchase", { error: { code: "P0001", message: "pur:already_decided" } });
    expect(await redirectedTo(() => decide(form([["id", REQ], ["decision", "approve"]])))).toBe(
      `${path}?error=already_decided`,
    );
  });

  it("AC-PUR-26: схвалення заблоковано, поки автор редагує — pur:author_editing", async () => {
    mockRpc(approver, "decide_purchase", { error: { code: "P0001", message: "pur:author_editing" } });
    expect(await redirectedTo(() => decide(form([["id", REQ], ["decision", "approve"]])))).toBe(
      `${path}?error=author_editing`,
    );
  });

  it("невідома дія й не-UUID рядка відхиляються до запиту", async () => {
    const mock = mockRpc(approver, "decide_purchase", { data: "approved" });
    expect(await redirectedTo(() => decide(form([["id", REQ], ["decision", "delete"]])))).toBe(
      `${path}?error=invalid_input`,
    );
    expect(
      await redirectedTo(() => decide(form([["id", REQ], ["decision", "approve"], ["rejected_line_id", "x"]]))),
    ).toBe(`${path}?error=invalid_input`);
    expect(call(mock, "decide_purchase")).toBeUndefined();
  });
});

describe("дії адміністратора (відділ закупівель)", () => {
  it("AC-PUR-27: відхилену заявку повертає на схвалення лише admin — reopen_purchase", async () => {
    const mock = mockRpc(admin, "reopen_purchase", { data: "pending" });
    const { reopenPurchase } = await purActions();
    expect(await redirectedTo(() => reopenPurchase(form([["id", REQ]])))).toBe(`${path}?saved=reopened`);
    expect(call(mock, "reopen_purchase")?.payload).toEqual({ target_request: REQ });

    // Не admin: функція відповідає pur:forbidden.
    mockRpc(approver, "reopen_purchase", { error: { code: "P0001", message: "pur:forbidden" } });
    expect(await redirectedTo(() => reopenPurchase(form([["id", REQ]])))).toBe(`${path}?error=forbidden`);
  });

  it("AC-PUR-36: повернена на доопрацювання заявка повертається на схвалення — reopen_purchase", async () => {
    mockRpc(admin, "reopen_purchase", { data: "pending" });
    const { reopenPurchase } = await purActions();
    expect(await redirectedTo(() => reopenPurchase(form([["id", REQ]])))).toBe(`${path}?saved=reopened`);
  });

  it("AC-PUR-28: схвалену закупівлю відхиляє admin з причиною — admin_reject_purchase", async () => {
    const mock = mockRpc(admin, "admin_reject_purchase", { data: "rejected" });
    const { adminRejectPurchase } = await purActions();
    expect(await redirectedTo(() => adminRejectPurchase(form([["id", REQ], ["reason", "  Duplicate  "]])))).toBe(
      `${path}?saved=admin_rejected`,
    );
    expect(call(mock, "admin_reject_purchase")?.payload).toEqual({ target_request: REQ, reason_text: "Duplicate" });
  });

  it("AC-PUR-52: відхилення схваленої заявки без причини не приймається — pur:reason_required", async () => {
    mockRpc(admin, "admin_reject_purchase", { error: { code: "P0001", message: "pur:reason_required" } });
    const { adminRejectPurchase } = await purActions();
    expect(await redirectedTo(() => adminRejectPurchase(form([["id", REQ]])))).toBe(`${path}?error=reason_required`);
  });

  it("AC-PUR-50: закупівлю «В обробці» чи «Оброблено» не відхилити — pur:cannot_reject", async () => {
    mockRpc(admin, "admin_reject_purchase", { error: { code: "P0001", message: "pur:cannot_reject" } });
    const { adminRejectPurchase } = await purActions();
    expect(await redirectedTo(() => adminRejectPurchase(form([["id", REQ], ["reason", "Late"]])))).toBe(
      `${path}?error=cannot_reject`,
    );
  });
});
