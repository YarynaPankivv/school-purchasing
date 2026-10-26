// Smoke-тести сторінок PUR (tasks.md 1.3, 2.2): серверний рендер /requests і /requests/[id] з мок-даними Supabase.
// Перевіряє, що сторінки не падають і показують правильні дії для ролі й статусу (чернетка, подана, на редагуванні,
// відхилена, схвалена): TS-правила src/lib/pur/* → кнопки й форми. Логіку прав і переходів перевіряють SQL і тести правил.
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, makeProfile } from "../org/supabase-mock";

vi.mock("next/navigation", async () => {
  const { RedirectSignal } = await import("../org/supabase-mock");
  return {
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new RedirectSignal("not-found");
    },
    usePathname: () => "/requests",
    // Рядок пошуку у верхній смузі (клієнтський компонент) бере роутер для переходу на підказку.
    useRouter: () => ({ push: () => undefined }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

// Перехоплюємо кнопки сторінки й server actions: перевіряємо не лише HTML, а й те, які аргументи кнопки передають у
// actions через bind() (кнопка з функцією в formAction не передає свого name/value у FormData).
type CapturedButton = {
  children: ReactNode;
  testId?: string;
  formAction?: (formData: FormData) => unknown | Promise<unknown>;
};
const capturedButtons = vi.hoisted(() => [] as CapturedButton[]);
const actionSpies = vi.hoisted(() => ({
  addLine: vi.fn(),
  adminRejectPurchase: vi.fn(),
  cancelPurchase: vi.fn(),
  copyPurchase: vi.fn(),
  decidePurchase: vi.fn(),
  removeLine: vi.fn(),
  reopenPurchase: vi.fn(),
  saveDraft: vi.fn(),
  setEditing: vi.fn(),
  submitPurchase: vi.fn(),
}));
vi.mock("@/components/ui/submit-button", () => ({
  SubmitButton: (props: CapturedButton) => {
    capturedButtons.push(props);
    return <button data-testid={props.testId}>{props.children}</button>;
  },
}));
vi.mock("@/app/(app)/requests/[id]/actions", () => actionSpies);

const VIEWER = "3f0c2a5e-9b1d-4c7e-8a2f-1b6d5e4c3a21";
const AUTHOR = "7a1d9c52-04be-4f3a-9d6e-2c8b1f0e5a47";
const REQ = "9d3f5b21-8c46-4e17-a0b9-4d7e2c1f6a83";
const REQ_2 = "d1a2b3c4-1111-4222-8333-444455556666";
const DEP = "5c9e1b34-7d02-4a68-b3f5-0e8a2d6c9f17";
const LINE_1 = "c4e8b7a1-5d23-4a90-b1f6-9e0d3c2a8b15";
const LINE_2 = "e2b6d4f8-1a37-4c59-8d02-6f9a0b3c7e14";

const author = makeProfile({ id: AUTHOR, role: "requester", email: "author@example.test", full_name: "Anna Author" });

const requestRow = (status: string, extra: Record<string, unknown> = {}) => ({
  id: REQ,
  type: "PUR",
  purchase_type: "procurement",
  number: 12,
  status,
  department_id: DEP,
  author_id: AUTHOR,
  on_behalf_of_id: null,
  note: "Autumn supplies",
  delivery_date: "2026-11-03",
  editing: false,
  decision_reason: null,
  archived_at: null,
  created_at: "2026-10-21T12:00:00Z",
  updated_at: "2026-10-21T12:30:00Z",
  ...extra,
});

const lines = [
  { id: LINE_1, request_id: REQ, position: 1, name: "Markers", purpose: "Classroom", quantity: 3, unit_price: 20, status: "pending", created_at: "" },
  { id: LINE_2, request_id: REQ, position: 2, name: "Paper", purpose: "Printing", quantity: 2, unit_price: 5, status: "pending", created_at: "" },
];

type Setup = {
  viewer: ReturnType<typeof makeProfile>;
  request: ReturnType<typeof requestRow> | null;
  approvers?: Array<{ department_id: string; user_id: string }>;
  members?: Array<{ department_id: string; user_id: string; auto_approve: boolean }>;
};

async function renderDetail({ viewer, request, approvers = [], members = [] }: Setup): Promise<string> {
  const mock = createSupabaseMock({
    profile: viewer,
    profiles: viewer.id === AUTHOR ? [] : [author],
    results: {
      "requests.select": { data: request },
      "request_lines.select": { data: lines },
      "request_history.select": {
        data: [
          {
            id: "h1",
            request_id: REQ,
            actor_id: AUTHOR,
            actor_name: "Anna Author",
            action: "submitted",
            reason: null,
            created_at: "2026-10-21T12:10:00Z",
          },
        ],
      },
      "departments.select": { data: [{ id: DEP, name: "Primary School" }] },
      "department_approvers.select": { data: approvers },
      "department_members.select": { data: members },
    },
  });
  createClient.mockResolvedValue(mock.client);
  const { RequestPageContent: Page } = await import("@/app/(app)/requests/[id]/page");
  const element = await Page({ params: Promise.resolve({ id: REQ }), searchParams: Promise.resolve({}) } as never);
  return renderToStaticMarkup(element);
}

const approverOf = [{ department_id: DEP, user_id: VIEWER }];
const asAuthor = makeProfile({ id: AUTHOR, role: "requester", email: "author@example.test" });
const asApprover = makeProfile({ id: VIEWER, role: "approver", email: "approver@example.test" });
const asAdmin = makeProfile({ id: VIEWER, role: "admin" });
const authorMember = [{ department_id: DEP, user_id: AUTHOR, auto_approve: false }];

beforeEach(() => {
  createClient.mockReset();
  capturedButtons.length = 0;
  Object.values(actionSpies).forEach((action) => action.mockClear());
});

describe("сторінка закупівлі /requests/[id]", () => {
  it("кнопки передають у actions правильні аргументи через bind(): id рядка, режим редагування, рішення", async () => {
    await renderDetail({ viewer: asAuthor, request: requestRow("draft"), members: authorMember });
    const removeButtons = capturedButtons.filter((button) => button.children === "Remove");
    expect(removeButtons).toHaveLength(2);
    await removeButtons[1]!.formAction!(new FormData());
    expect(actionSpies.removeLine).toHaveBeenCalledWith(LINE_2, expect.any(FormData));

    capturedButtons.length = 0;
    await renderDetail({ viewer: asAuthor, request: requestRow("pending", { editing: true }), members: authorMember });
    await capturedButtons.find((button) => button.testId === "save-changes")!.formAction!(new FormData());
    expect(actionSpies.setEditing).toHaveBeenLastCalledWith(false, expect.any(FormData));

    capturedButtons.length = 0;
    await renderDetail({ viewer: asAuthor, request: requestRow("pending"), members: authorMember });
    await capturedButtons.find((button) => button.testId === "edit-request")!.formAction!(new FormData());
    expect(actionSpies.setEditing).toHaveBeenLastCalledWith(true, expect.any(FormData));

    capturedButtons.length = 0;
    await renderDetail({ viewer: asApprover, request: requestRow("pending"), approvers: approverOf });
    for (const testId of ["approve", "return", "reject"]) {
      await capturedButtons.find((button) => button.testId === testId)!.formAction!(new FormData());
    }
    expect(actionSpies.decidePurchase).toHaveBeenNthCalledWith(1, "approve", expect.any(FormData));
    expect(actionSpies.decidePurchase).toHaveBeenNthCalledWith(2, "return", expect.any(FormData));
    expect(actionSpies.decidePurchase).toHaveBeenNthCalledWith(3, "reject", expect.any(FormData));
  });

  it("AC-PUR-01: чернетка автора — форма з номером, рядками й сумою, кнопки «Save» і «Submit»", async () => {
    const html = await renderDetail({ viewer: asAuthor, request: requestRow("draft"), members: authorMember });
    expect(html).toContain("PUR-12");
    expect(html).toContain('data-testid="purchase-form"');
    expect(html).toContain(`name="line_${LINE_1}_name"`);
    expect(html).toContain(`name="line_${LINE_2}_quantity"`);
    expect(html).toContain("$70.00"); // 3 × 20 + 2 × 5
    expect(html).toContain('data-testid="submit"');
    expect(html).toContain('data-testid="save-draft"');
    expect(html).not.toContain('data-testid="decision-form"');
  });

  it("AC-PUR-24: автор поданої заявки не бачить дій рішення, а бачить «Edit request», «Cancel request» і копію", async () => {
    const html = await renderDetail({ viewer: asAuthor, request: requestRow("pending"), members: authorMember, approvers: [] });
    expect(html).not.toContain('data-testid="decision-form"');
    expect(html).not.toContain('data-testid="purchase-form"'); // рядки лише для читання (AC-PUR-26, 38)
    expect(html).toContain('data-testid="edit-request"');
    expect(html).toContain('data-testid="cancel"');
    expect(html).toContain('data-testid="copy"');
    expect(html).toContain("Cancel request");
  });

  it("AC-PUR-26: автор на редагуванні — «Save changes», а схвалювач бачить, що рішення призупинено", async () => {
    const editing = requestRow("pending", { editing: true });
    const authorView = await renderDetail({ viewer: asAuthor, request: editing, members: authorMember });
    expect(authorView).toContain('data-testid="save-changes"');
    expect(authorView).not.toContain('data-testid="submit"');

    const approverView = await renderDetail({ viewer: asApprover, request: editing, approvers: approverOf });
    expect(approverView).toContain("The author is editing this request");
    expect(approverView).not.toContain('data-testid="decision-form"');
  });

  it("AC-PUR-15: схвалювач відділу бачить панель рішення з рядками для відхилення й трьома діями", async () => {
    const html = await renderDetail({ viewer: asApprover, request: requestRow("pending"), approvers: approverOf });
    expect(html).toContain('data-testid="decision-form"');
    expect(html).toContain('data-testid="approve"');
    expect(html).toContain('data-testid="return"');
    expect(html).toContain('data-testid="reject"');
    expect(html).toContain('name="rejected_line_id"');
    expect(html).toContain("History");
    expect(html).toContain("Anna Author");
  });

  it("AC-PUR-54: адміністратор, який сам автор (чи особа «від імені»), не бачить дій рішення", async () => {
    const own = requestRow("pending", { author_id: VIEWER });
    const html = await renderDetail({ viewer: asAdmin, request: own });
    expect(html).not.toContain('data-testid="decision-form"');

    const onBehalf = requestRow("pending", { on_behalf_of_id: VIEWER });
    expect(await renderDetail({ viewer: asAdmin, request: onBehalf })).not.toContain('data-testid="decision-form"');
  });

  it("AC-PUR-27, 28, 50: admin повертає відхилену заявку на схвалення й відхиляє схвалену, але не оброблювану", async () => {
    expect(await renderDetail({ viewer: asAdmin, request: requestRow("rejected", { decision_reason: "Over budget" }) })).toContain(
      'data-testid="reopen"',
    );
    const rejected = await renderDetail({ viewer: asAdmin, request: requestRow("rejected", { decision_reason: "Over budget" }) });
    expect(rejected).toContain("Reason: Over budget"); // AC-PUR-43

    expect(await renderDetail({ viewer: asAdmin, request: requestRow("approved") })).toContain('data-testid="admin-reject"');
    expect(await renderDetail({ viewer: asAdmin, request: requestRow("processing") })).not.toContain('data-testid="admin-reject"');
  });

  it("AC-PUR-44: відхилену заявку автор не редагує — форми немає", async () => {
    const html = await renderDetail({ viewer: asAuthor, request: requestRow("rejected"), members: authorMember });
    expect(html).not.toContain('data-testid="purchase-form"');
  });

  it("AC-PUR-03: чужу чернетку RLS не віддає — сторінка дає «не знайдено»", async () => {
    await expect(renderDetail({ viewer: asApprover, request: null, approvers: approverOf })).rejects.toThrow("not-found");
  });
});

describe("сторінка списку /requests", () => {
  async function renderList(
    viewer: ReturnType<typeof makeProfile>,
    approvers: Array<{ department_id: string; user_id: string }>,
    departments: Array<{ id: string; name: string }> = [{ id: DEP, name: "Primary School" }],
  ) {
    const mock = createSupabaseMock({
      profile: viewer,
      profiles: viewer.id === AUTHOR ? [] : [author],
      results: {
        "requests.select": { data: [requestRow("pending"), requestRow("approved", { id: REQ_2, number: 13, author_id: viewer.id })] },
        "request_lines.select": { data: lines },
        "departments.select": { data: departments },
        "department_approvers.select": { data: approvers },
      },
    });
    createClient.mockResolvedValue(mock.client);
    const { RequestsPageContent: Page } = await import("@/app/(app)/requests/(list)/page");
    return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) } as never));
  }

  it("AC-PUR-15, 40: схвалювач бачить «To decide», а автор схваленої заявки — позначку «Request approved»", async () => {
    const html = await renderList(asApprover, approverOf);
    expect(html).toContain('data-testid="to-decide"');
    expect(html).toContain("PUR-12");
    // Власна схвалена заявка в «My requests» з позначкою для автора.
    expect(html).toContain('data-testid="my-requests"');
    expect(html).toContain("Request approved");
    expect(html).not.toContain('data-testid="all-requests"');
  });

  // Без AC PM: опис сторінки не обіцяє звичайному заявнику чужих заявок і рішень, яких він не бачить.
  it("опис сторінки залежить від ролі: заявник без права рішення не бачить згадки про адміністраторів і рішення", async () => {
    const requester = await renderList(asAuthor, []);
    expect(requester).toContain("Purchase requests you submitted.");
    expect(requester).not.toContain("administrators");
    expect(requester).not.toContain("waiting for your decision");
    const approver = await renderList(asApprover, approverOf);
    expect(approver).toContain("Purchase requests you submitted and requests waiting for your decision.");
  });

  // Без AC PM: це підпис у списку, а не правило. Відділи RLS віддає лише заявникам, тож автор заявки, який уже не заявник
  // свого відділу, не бачить його назви — показуємо «—», а не «No department yet» (у заявки відділ є).
  it("заявка з відділом, назви якого автор не бачить, показує «—», а чернетка без відділу — «No department yet»", async () => {
    const html = await renderList(asApprover, approverOf, []);
    expect(html).toContain("PUR-12");
    expect(html).toContain("—");
    expect(html).not.toContain("No department yet");

    const noDepartment = makeProfile({ id: VIEWER, role: "requester" });
    const mock = createSupabaseMock({
      profile: noDepartment,
      results: {
        "requests.select": { data: [requestRow("draft", { id: REQ_2, number: 14, author_id: VIEWER, department_id: null })] },
        "request_lines.select": { data: [] },
        "departments.select": { data: [] },
        "department_approvers.select": { data: [] },
      },
    });
    createClient.mockResolvedValue(mock.client);
    const { RequestsPageContent: Page } = await import("@/app/(app)/requests/(list)/page");
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) } as never))).toContain("No department yet");
  });

  it("AC-PUR-33: admin бачить «Awaiting decision» (відділ без схвалювача) і «All requests»", async () => {
    const html = await renderList(asAdmin, []);
    expect(html).toContain('data-testid="awaiting-decision"');
    expect(html).toContain("No approver");
    expect(html).toContain('data-testid="all-requests"');
  });

  // Без AC PM: це подання списку (сторінки, нумерація, сортування), а не правило.
  it("довгий список: 20 рядків на сторінку, наскрізна нумерація, сортування за колонкою й фільтр за статусом", async () => {
    const requester = makeProfile({ id: VIEWER, role: "requester" });
    const many = Array.from({ length: 25 }, (_, i) =>
      requestRow(i < 22 ? "draft" : "pending", { id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`, number: i + 1, author_id: VIEWER, department_id: null }),
    );
    const mock = createSupabaseMock({
      profile: requester,
      results: {
        "requests.select": { data: many },
        "request_lines.select": { data: [] },
        "departments.select": { data: [] },
        "department_approvers.select": { data: [] },
      },
    });
    createClient.mockResolvedValue(mock.client);
    const { RequestsPageContent: Page } = await import("@/app/(app)/requests/(list)/page");

    const first = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ sort: "number", dir: "asc" }) } as never));
    expect(first).toContain("Showing 1–20 of 25");
    expect(first).toContain('aria-sort="ascending"');
    expect(first).toContain("PUR-1<");
    expect(first).not.toContain("PUR-21<");

    const second = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ sort: "number", dir: "asc", p_mine: "2" }) } as never));
    expect(second).toContain("Showing 21–25 of 25");
    expect(second).toContain("PUR-25<");
    expect(second).not.toContain("PUR-1<");

    const drafts = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ status: "pending" }) } as never));
    expect(drafts).toContain("3 results");
    expect(drafts).not.toContain("Showing");
  });
});

// Тексти з таблиці PM (requirements/49-…): порожній стан, статуси й відмова в доступі на справжніх сторінках.
describe("тексти інтерфейсу на сторінках (таблиця PM)", () => {
  it("AC-FRM-14: порожня сторінка «Мої заявки» — «You have not submitted any requests yet»", async () => {
    const requester = makeProfile({ id: VIEWER, role: "requester" });
    const mock = createSupabaseMock({
      profile: requester,
      results: {
        "requests.select": { data: [] },
        "request_lines.select": { data: [] },
        "departments.select": { data: [] },
        "department_approvers.select": { data: [] },
      },
    });
    createClient.mockResolvedValue(mock.client);
    const { RequestsPageContent: Page } = await import("@/app/(app)/requests/(list)/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) } as never));
    expect(html).toContain("My requests");
    expect(html).toContain("You have not submitted any requests yet");
    expect(html).not.toContain("You have no requests yet");
  });

  it("AC-LANG-06: статуси «Awaiting approval» і «Approved» підписано текстом у списку й на сторінці заявки", async () => {
    const mock = createSupabaseMock({
      profile: asApprover,
      profiles: [author],
      results: {
        "requests.select": { data: [requestRow("pending"), requestRow("approved", { id: REQ_2, number: 13, author_id: asApprover.id })] },
        "request_lines.select": { data: lines },
        "departments.select": { data: [{ id: DEP, name: "Primary School" }] },
        "department_approvers.select": { data: approverOf },
      },
    });
    createClient.mockResolvedValue(mock.client);
    const { RequestsPageContent } = await import("@/app/(app)/requests/(list)/page");
    const list = renderToStaticMarkup(await RequestsPageContent({ searchParams: Promise.resolve({}) } as never));
    expect(list).toContain("Awaiting approval");
    expect(list).toContain("Approved");

    const rejected = await renderDetail({ viewer: asAuthor, request: requestRow("rejected"), members: authorMember });
    expect(rejected).toContain("Rejected");
    const pending = await renderDetail({ viewer: asAuthor, request: requestRow("pending"), members: authorMember });
    expect(pending).toContain("Awaiting approval");
  });

  it("AC-LANG-03: не-адміністратор на сторінці відділів бачить «Not enough permissions» без даних", async () => {
    const mock = createSupabaseMock({
      profile: makeProfile({ id: VIEWER, role: "requester" }),
      results: { "departments.select": { data: [{ id: DEP, name: "Primary School" }] } },
    });
    createClient.mockResolvedValue(mock.client);
    const { DepartmentsPageContent: Page } = await import("@/app/(app)/admin/departments/(list)/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) } as never));
    expect(html).toContain("Not enough permissions");
    expect(html).toContain("This page is available to administrators only.");
    // Відмова спокійна, не червоне повідомлення про помилку (DESIGN.md).
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Primary School");
  });

  // Без AC PM: збережений тип закупівлі не підміняється в полі, якщо дозвіл на нього зняли після створення.
  it("чернетка зі збереженим типом «Self-purchase» без дозволу показує цей тип у полі, а не підміняє його", async () => {
    const html = await renderDetail({
      viewer: asAuthor,
      request: requestRow("draft", { purchase_type: "self" }),
      members: authorMember,
    });
    expect(html).toContain('value="self"');
    expect(html).toContain("Self-purchase");
    expect(html).toContain('value="procurement"');
  });
});
