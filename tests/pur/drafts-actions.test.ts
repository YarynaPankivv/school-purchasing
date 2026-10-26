// Задача 1 зрізу PUR (openspec/changes/impl-pur/tasks.md 1.4): server actions чернетки, подання, скасування й копії.
// Vitest без бази (design.md D9): що надсилає action у `update`/`rpc` і як перетворює `pur:<код>` на помилку сторінки.
// SQL-дзеркало — функції `submit_purchase`/`cancel_purchase`/`copy_purchase`, тригери й RLS міграції
// 20261021140000_pur_drafts.sql; їх перевіряє db-check і прогін сценаріїв AC на Postgres (опис — у PR).
import { revalidatePath } from "next/cache";
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

const purActions = () => import("@/app/(app)/requests/[id]/actions");
const newActions = () => import("@/app/(app)/requests/new/actions");

const USER = "3f0c2a5e-9b1d-4c7e-8a2f-1b6d5e4c3a21";
const OTHER = "7a1d9c52-04be-4f3a-9d6e-2c8b1f0e5a47";
const REQ = "9d3f5b21-8c46-4e17-a0b9-4d7e2c1f6a83";
const COPY = "b8a2c6e0-3f14-4d75-9a1c-5e7b0d2f4c69";
const DEP = "5c9e1b34-7d02-4a68-b3f5-0e8a2d6c9f17";
const LINE_1 = "c4e8b7a1-5d23-4a90-b1f6-9e0d3c2a8b15";
const LINE_2 = "e2b6d4f8-1a37-4c59-8d02-6f9a0b3c7e14";
const COLLEAGUE = "a1b2c3d4-0000-4000-8000-0000000000aa";

const author = makeProfile({ id: USER, role: "requester", email: "member1@example.test" });
const path = `/requests/${REQ}`;

type Entries = Array<[string, string]>;
function form(entries: Entries): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const row = (status: string, extra: Record<string, unknown> = {}) => ({
  id: REQ,
  status,
  author_id: USER,
  editing: false,
  ...extra,
});

function mockSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  createClient.mockResolvedValue(mock.client);
  return mock;
}

// Поля форми заявки + один рядок.
const fields = (extra: Entries = []): Entries => [
  ["id", REQ],
  ["department_id", DEP],
  ["purchase_type", "procurement"],
  ["delivery_date", "2026-11-03"],
  ["note", "  Autumn supplies  "],
  ["line_id", LINE_1],
  [`line_${LINE_1}_name`, "Markers"],
  [`line_${LINE_1}_purpose`, "Classroom"],
  [`line_${LINE_1}_quantity`, "3"],
  [`line_${LINE_1}_unit_price`, "20.00"],
  ...extra,
];

beforeEach(() => {
  createClient.mockReset();
});

describe("створення й збереження чернетки", () => {
  it("AC-PUR-01: нова закупівля — перехід на сторінку чернетки (номер і порожній рядок дає база)", async () => {
    const mock = mockSupabase(createSupabaseMock({ profile: author, results: { "requests.insert": { data: { id: REQ } } } }));
    const { createDraftRequest } = await newActions();
    const data = new FormData();
    data.set("department_id", DEP);
    data.set("type", "PUR");
    data.set("purchase_type", "procurement");

    expect(await redirectedTo(() => createDraftRequest(data))).toBe(`${path}?saved=created`);
    expect(mock.calls.find((c) => c.table === "requests")?.payload).toMatchObject({ type: "PUR", department_id: DEP });
  });

  it("зберігає поля й рядки чернетки: нотатка обрізається, ціна й кількість — числа", async () => {
    const mock = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: { "requests.select": { data: row("draft") }, "requests.update": { data: [{ id: REQ }] } },
      }),
    );
    const { saveDraft } = await purActions();
    expect(await redirectedTo(() => saveDraft(form(fields())))).toBe(`${path}?saved=draft`);

    const request = mock.calls.find((c) => c.table === "requests" && c.op === "update");
    expect(request?.payload).toMatchObject({
      department_id: DEP,
      purchase_type: "procurement",
      note: "Autumn supplies",
      delivery_date: "2026-11-03",
      on_behalf_of_id: null,
    });
    const line = mock.calls.find((c) => c.table === "request_lines" && c.op === "update");
    expect(line?.payload).toEqual({ name: "Markers", purpose: "Classroom", quantity: 3, unit_price: 20 });
    expect(line?.filters).toEqual([
      ["id", LINE_1],
      ["request_id", REQ],
    ]);
  });

  it("AC-PUR-38: у поданій заявці відділ і поля не надсилаються, зберігаються лише рядки на редагуванні", async () => {
    const mock = mockSupabase(
      createSupabaseMock({ profile: author, results: { "requests.select": { data: row("pending", { editing: true }) } } }),
    );
    const { saveDraft } = await purActions();
    await redirectedTo(() => saveDraft(form(fields())));

    expect(mock.calls.some((c) => c.table === "requests" && c.op === "update")).toBe(false); // відділ не змінити
    expect(mock.calls.some((c) => c.table === "request_lines" && c.op === "update")).toBe(true);

    // Подана заявка без режиму редагування (AC-PUR-44: відхилену теж) не міняє нічого.
    const locked = mockSupabase(createSupabaseMock({ profile: author, results: { "requests.select": { data: row("rejected") } } }));
    await redirectedTo(() => saveDraft(form(fields())));
    expect(locked.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("AC-PUR-12: позначка «від імені колеги» без вибору колеги — заявку не збережено", async () => {
    const mock = mockSupabase(createSupabaseMock({ profile: author, results: { "requests.select": { data: row("draft") } } }));
    const { saveDraft } = await purActions();
    const url = await redirectedTo(() => saveDraft(form(fields([["on_behalf_flag", "on"]]))));
    expect(url).toBe(`${path}?error=on_behalf_required`);
    expect(mock.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("AC-PUR-11: обраний колега йде в on_behalf_of_id; без позначки — скидається", async () => {
    const mock = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: { "requests.select": { data: row("draft") }, "requests.update": { data: [{ id: REQ }] } },
      }),
    );
    const { saveDraft } = await purActions();
    await redirectedTo(() => saveDraft(form(fields([["on_behalf_flag", "on"], ["on_behalf_of_id", COLLEAGUE]]))));
    expect(mock.calls.find((c) => c.table === "requests" && c.op === "update")?.payload).toMatchObject({
      on_behalf_of_id: COLLEAGUE,
    });

    const reset = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: { "requests.select": { data: row("draft") }, "requests.update": { data: [{ id: REQ }] } },
      }),
    );
    await redirectedTo(() => saveDraft(form(fields([["on_behalf_of_id", COLLEAGUE]]))));
    expect(reset.calls.find((c) => c.table === "requests" && c.op === "update")?.payload).toMatchObject({
      on_behalf_of_id: null,
    });
  });

  it("хибне введення (кількість 0, не-UUID відділу) відхиляється до запиту з текстом помилки", async () => {
    const mock = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: { "requests.select": { data: row("draft") }, "requests.update": { data: [{ id: REQ }] } },
      }),
    );
    const { saveDraft } = await purActions();
    const zeroQuantity = fields().map(([k, v]): [string, string] => (k === `line_${LINE_1}_quantity` ? [k, "0"] : [k, v]));
    const url = await redirectedTo(() => saveDraft(form(zeroQuantity)));
    expect(url.startsWith(`${path}?error=invalid_input&detail=`)).toBe(true);
    expect(mock.calls.some((c) => c.table === "request_lines" && c.op === "update")).toBe(false);

    const badDepartment = fields().map(([k, v]): [string, string] => (k === "department_id" ? [k, "not-a-uuid"] : [k, v]));
    expect(await redirectedTo(() => saveDraft(form(badDepartment)))).toBe(`${path}?error=invalid_input`);
  });

  it("додати рядок — insert лише з request_id (позицію присвоює тригер); прибрати — delete за id рядка й заявки", async () => {
    const mock = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: { "requests.select": { data: row("draft") }, "requests.update": { data: [{ id: REQ }] } },
      }),
    );
    const { addLine, removeLine } = await purActions();
    // Без переходу й без банера: сторінка оновлюється на місці (revalidatePath), тож немає ні redirect, ні ?saved=.
    vi.mocked(revalidatePath).mockClear();
    await addLine(form(fields()));
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(mock.calls.find((c) => c.table === "request_lines" && c.op === "insert")?.payload).toEqual({ request_id: REQ });

    vi.mocked(revalidatePath).mockClear();
    await removeLine(LINE_2, form([["id", REQ]]));
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(mock.calls.find((c) => c.table === "request_lines" && c.op === "delete")?.filters).toEqual([
      ["id", LINE_2],
      ["request_id", REQ],
    ]);
  });
});

describe("подання", () => {
  it("AC-PUR-14: подання зберігає форму й викликає submit_purchase — заявка очікує схвалення", async () => {
    const mock = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: {
          "requests.select": { data: row("draft") },
          "requests.update": { data: [{ id: REQ }] },
          "rpc:submit_purchase.rpc": { data: "pending" },
        },
      }),
    );
    const { submitPurchase } = await purActions();
    expect(await redirectedTo(() => submitPurchase(form(fields())))).toBe(`${path}?saved=submitted`);

    const names = mock.calls.map((c) => `${c.table}.${c.op}`);
    expect(names.indexOf("requests.update")).toBeLessThan(names.indexOf("rpc:submit_purchase.rpc")); // спершу збереження
    expect(mock.calls.find((c) => c.table === "rpc:submit_purchase")?.payload).toEqual({ target_request: REQ });
  });

  it("AC-PUR-16: автосхвалення — функція повертає «approved», сторінка показує «одразу схвалено»", async () => {
    mockSupabase(
      createSupabaseMock({
        profile: author,
        results: {
          "requests.select": { data: row("draft") },
          "requests.update": { data: [{ id: REQ }] },
          "rpc:submit_purchase.rpc": { data: "approved" },
        },
      }),
    );
    const { submitPurchase } = await purActions();
    expect(await redirectedTo(() => submitPurchase(form(fields())))).toBe(`${path}?saved=submitted_approved`);
  });

  it("AC-PUR-05: чернетка без відділу не подається — «pur:department_required» стає помилкою сторінки", async () => {
    mockSupabase(
      createSupabaseMock({
        profile: author,
        results: {
          "requests.select": { data: row("draft") },
          "requests.update": { data: [{ id: REQ }] },
          "rpc:submit_purchase.rpc": { error: { code: "P0001", message: "pur:department_required" } },
        },
      }),
    );
    const { submitPurchase } = await purActions();
    expect(await redirectedTo(() => submitPurchase(form(fields([["department_id", ""]]))))).toBe(
      `${path}?error=department_required`,
    );
  });

  it("AC-PUR-09: незаповнені рядки називає повідомлення — перелік приходить у detail", async () => {
    mockSupabase(
      createSupabaseMock({
        profile: author,
        results: {
          "requests.select": { data: row("draft") },
          "requests.update": { data: [{ id: REQ }] },
          "rpc:submit_purchase.rpc": {
            error: { code: "P0001", message: "pur:lines_incomplete", details: "1:name,quantity;3:purpose" },
          },
        },
      }),
    );
    const { submitPurchase } = await purActions();
    const url = await redirectedTo(() => submitPurchase(form(fields())));
    const query = new URLSearchParams(url.split("?")[1]);
    expect(query.get("error")).toBe("lines_incomplete");
    expect(query.get("detail")).toBe("1:name,quantity;3:purpose");
  });

  it("AC-PUR-45: не автор не подає чужу заявку — RLS не віддає рядок, а база відхиляє виклик (forbidden)", async () => {
    // Заявки немає в RLS-видимому наборі → до функції не доходимо.
    const hidden = mockSupabase(createSupabaseMock({ profile: makeProfile({ id: OTHER, role: "requester" }) }));
    const { submitPurchase } = await purActions();
    expect(await redirectedTo(() => submitPurchase(form(fields())))).toBe(`${path}?error=forbidden`);
    expect(hidden.calls.some((c) => c.table.startsWith("rpc:"))).toBe(false);

    // Заявку видно (напр. особі «від імені»), але функція повертає pur:forbidden.
    mockSupabase(
      createSupabaseMock({
        profile: makeProfile({ id: OTHER, role: "requester" }),
        results: {
          "requests.select": { data: row("returned") },
          "rpc:submit_purchase.rpc": { error: { code: "P0001", message: "pur:forbidden" } },
        },
      }),
    );
    expect(await redirectedTo(() => submitPurchase(form(fields())))).toBe(`${path}?error=forbidden`);
  });

  it("AC-PUR-23: виправлена повернена заявка — зберігаємо поля й рядки й подаємо знову", async () => {
    const mock = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: {
          "requests.select": { data: row("returned") },
          "requests.update": { data: [{ id: REQ }] },
          "rpc:submit_purchase.rpc": { data: "pending" },
        },
      }),
    );
    const { submitPurchase } = await purActions();
    expect(await redirectedTo(() => submitPurchase(form(fields())))).toBe(`${path}?saved=submitted`);
    expect(mock.calls.some((c) => c.table === "requests" && c.op === "update")).toBe(true);
    expect(mock.calls.some((c) => c.table === "request_lines" && c.op === "update")).toBe(true);
  });
});

describe("скасування, копія й редагування поданої", () => {
  const run = async (rpcResult: { data?: unknown; error?: { code: string; message: string } }, fn: "cancelPurchase" | "copyPurchase" | "setEditing", extra: Entries = [], request = row("pending")) => {
    const mock = mockSupabase(
      createSupabaseMock({
        profile: author,
        results: {
          "requests.select": { data: request },
          "requests.update": { data: [{ id: REQ }] },
          [`rpc:${fn === "cancelPurchase" ? "cancel_purchase" : fn === "copyPurchase" ? "copy_purchase" : "set_purchase_editing"}.rpc`]: rpcResult,
        },
      }),
    );
    const actions = await purActions();
    // makeEditing приходить першим аргументом (bind() на кнопці), решта дій беруть лише поля форми.
    const editing = extra.find(([key]) => key === "editing")?.[1] === "1";
    const fields = form([["id", REQ], ...extra.filter(([key]) => key !== "editing")]);
    const url = await redirectedTo(() => (fn === "setEditing" ? actions.setEditing(editing, fields) : actions[fn](fields)));
    return { url, mock };
  };

  it("AC-PUR-30: скасована чернетка видаляється — перехід до списку", async () => {
    const { url, mock } = await run({ data: "deleted" }, "cancelPurchase");
    expect(url).toBe("/requests?saved=deleted");
    expect(mock.calls.find((c) => c.table === "rpc:cancel_purchase")?.payload).toEqual({ target_request: REQ });
  });

  it("AC-PUR-29: подану заявку скасовано (статус «Скасовано»), лишаємось на сторінці", async () => {
    expect((await run({ data: "cancelled" }, "cancelPurchase")).url).toBe(`${path}?saved=cancelled`);
  });

  it("AC-PUR-31: відхилену чи оброблювану заявку не скасувати — pur:cannot_cancel", async () => {
    expect((await run({ error: { code: "P0001", message: "pur:cannot_cancel" } }, "cancelPurchase")).url).toBe(
      `${path}?error=cannot_cancel`,
    );
  });

  it("AC-PUR-32: копія — нова чернетка, перехід до неї", async () => {
    const { url } = await run({ data: COPY }, "copyPurchase");
    expect(url).toBe(`/requests/${COPY}?saved=copied`);
    expect((await run({ data: "not-a-uuid" }, "copyPurchase")).url).toBe(`${path}?error=unknown`);
  });

  it("AC-PUR-26: автор відкриває подану заявку на редагування — функція set_purchase_editing(true)", async () => {
    const { url, mock } = await run({ data: true }, "setEditing", [["editing", "1"]]);
    expect(url).toBe(`${path}?saved=editing_on`);
    expect(mock.calls.find((c) => c.table === "rpc:set_purchase_editing")?.payload).toEqual({
      target_request: REQ,
      make_editing: true,
    });
  });

  it("setEditing приймає лише boolean: інше значення відхилено до збереження й до rpc", async () => {
    const mock = mockSupabase(
      createSupabaseMock({ profile: author, results: { "requests.select": { data: row("pending", { editing: true }) } } }),
    );
    const { setEditing } = await purActions();
    const url = await redirectedTo(() => setEditing({ not: "a boolean" }, form([["id", REQ]])));
    expect(url).toBe(`${path}?error=invalid_input`);
    expect(mock.calls.some((c) => c.op === "update" || c.op === "rpc")).toBe(false);
  });

  it("AC-PUR-26: збереження змін перед вимкненням редагування — спершу рядки, потім set_purchase_editing(false)", async () => {
    const { url, mock } = await run(
      { data: true },
      "setEditing",
      [
        ["editing", "0"],
        ["line_id", LINE_1],
        [`line_${LINE_1}_name`, "Markers"],
        [`line_${LINE_1}_purpose`, "Classroom"],
        [`line_${LINE_1}_quantity`, "4"],
        [`line_${LINE_1}_unit_price`, "20"],
      ],
      row("pending", { editing: true }), // автор уже на редагуванні — рядки зберігаються
    );
    expect(url).toBe(`${path}?saved=editing_off`);
    const names = mock.calls.map((c) => `${c.table}.${c.op}`);
    expect(names.indexOf("request_lines.update")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("request_lines.update")).toBeLessThan(names.indexOf("rpc:set_purchase_editing.rpc"));
  });
});
