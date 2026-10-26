// Зріз WS7 на рівні сторінок: форма закупівлі (AC-FRM-01, 03, 05, 09, 11) і список для рішення (AC-APR-04, 08, 09, 10).
// Права на дані перевіряють тести бази (tests/db/frm-apr.test.ts); тут — що показує сторінка за тими даними, які їй
// віддала RLS: мок Supabase повертає лише те, що побачила б ця людина.
import { renderToStaticMarkup } from "react-dom/server";
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
    usePathname: () => "/requests",
    useRouter: () => ({ push: () => undefined }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

// Форма заявки — клієнтський компонент зі своїм станом: беремо її пропси, тобто те, що сторінка вирішила показати.
type FormProps = {
  departments: Array<{ value: string; label: string }>;
  types: Array<{ value: string; label: string }>;
  purchaseTypes: Array<{ value: string; label: string }>;
};
const formProps = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/app/(app)/requests/new/request-form", () => ({
  RequestForm: (props: unknown) => {
    formProps.current = props;
    return null;
  },
}));

const ME = "3f0c2a5e-9b1d-4c7e-8a2f-1b6d5e4c3a21";
const AUTHOR = "7a1d9c52-04be-4f3a-9d6e-2c8b1f0e5a47";
const REQ = "9d3f5b21-8c46-4e17-a0b9-4d7e2c1f6a83";
const PRIMARY = "5c9e1b34-7d02-4a68-b3f5-0e8a2d6c9f17";
const OFFICE = "6d0f2c45-8e13-4b79-84a6-1f9b3e7d0a28";
const UPPER = "7e1a3d56-9f24-4c8a-95b7-20ac4f8e1b39";
const LINE = "c4e8b7a1-5d23-4a90-b1f6-9e0d3c2a8b15";

const departments = [
  { id: PRIMARY, name: "Primary School" },
  { id: OFFICE, name: "Office" },
  { id: UPPER, name: "Upper School" },
];

beforeEach(() => {
  createClient.mockReset();
  formProps.current = null;
});

async function renderNewRequest(options: {
  viewer: ReturnType<typeof makeProfile>;
  memberOf: string[];
  selfPurchase?: boolean;
}) {
  const mock = createSupabaseMock({
    profile: options.viewer,
    results: {
      // RLS: заявник бачить лише відділи, де він заявник.
      "departments.select": { data: departments.filter((d) => options.memberOf.includes(d.id)) },
      "department_members.select": {
        data: options.memberOf.map((department_id) => ({ department_id, user_id: options.viewer.id })),
      },
      "user_permissions.select": { data: options.selfPurchase ? { self_purchase: true } : null },
    },
  });
  createClient.mockResolvedValue(mock.client);
  const { NewRequestPageContent } = await import("@/app/(app)/requests/new/page");
  return renderToStaticMarkup(await NewRequestPageContent({ searchParams: Promise.resolve({}) } as never));
}

const requester = makeProfile({ id: ME, role: "requester", email: "member1@example.test", full_name: "Andrii" });

describe("AC-FRM: форма закупівлі", () => {
  it("AC-FRM-01: у виборі відділу лише відділи, де працівник заявник — «Office» і «Primary School», без «Upper School»", async () => {
    await renderNewRequest({ viewer: requester, memberOf: [PRIMARY, OFFICE] });

    const props = formProps.current as FormProps;
    expect(props.departments.map((d) => d.label)).toEqual(["Office", "Primary School"]);
    expect(props.departments.map((d) => d.label)).not.toContain("Upper School");
  });

  it("AC-FRM-03: без дозволу «Самостійна закупівля» у виборі типу закупівлі лише «Purchasing department»", async () => {
    await renderNewRequest({ viewer: requester, memberOf: [PRIMARY] });

    const props = formProps.current as FormProps;
    expect(props.purchaseTypes.map((t) => t.label)).toEqual(["Purchasing department"]);
    expect(props.purchaseTypes.map((t) => t.label)).not.toContain("Self-purchase");
  });

  it("AC-FRM-03: з дозволом «Самостійна закупівля» з'являється в списку", async () => {
    await renderNewRequest({ viewer: requester, memberOf: [PRIMARY], selfPurchase: true });

    const props = formProps.current as FormProps;
    expect(props.purchaseTypes.map((t) => t.label)).toEqual(["Purchasing department", "Self-purchase"]);
  });

  it("AC-FRM-05: працівник без відділів бачить пояснення замість полів форми", async () => {
    const html = await renderNewRequest({ viewer: requester, memberOf: [] });

    expect(html).toContain('data-testid="no-departments"');
    expect(html).toContain("You have not been added to any department. Contact your administrator.");
    expect(formProps.current).toBeNull();
  });

  it("AC-FRM-09: гість за прямим посиланням на форму потрапляє на сторінку входу, форму не показано", async () => {
    createClient.mockResolvedValue(createSupabaseMock({ profile: null }).client);
    const { NewRequestPageContent } = await import("@/app/(app)/requests/new/page");

    const target = await redirectedTo(() => NewRequestPageContent({ searchParams: Promise.resolve({}) } as never));

    expect(target).toBe("/login");
    expect(formProps.current).toBeNull();
  });

  it("AC-FRM-11: після подання на сторінці «My requests» повідомлення «Purchase submitted»", async () => {
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
    const { RequestsPageContent } = await import("@/app/(app)/requests/(list)/page");

    const html = renderToStaticMarkup(await RequestsPageContent({ searchParams: Promise.resolve({ saved: "submitted" }) } as never));

    expect(html).toContain("My requests");
    expect(html).toContain("Purchase submitted");
  });
});

const approver = makeProfile({ id: ME, role: "approver", email: "maria@example.test", full_name: "Maria" });

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQ,
    type: "PUR",
    purchase_type: "procurement",
    number: 12,
    status: "pending",
    department_id: PRIMARY,
    author_id: AUTHOR,
    on_behalf_of_id: null,
    note: null,
    delivery_date: null,
    editing: false,
    decision_reason: null,
    archived_at: null,
    created_at: "2026-10-21T12:00:00Z",
    updated_at: "2026-10-21T12:30:00Z",
    ...overrides,
  };
}

const line = { id: LINE, request_id: REQ, position: 1, name: "Markers", purpose: "Classroom", quantity: 3, unit_price: 20, status: "pending", created_at: "" };

async function renderDecisionList(authorProfile: ReturnType<typeof makeProfile>, view = "decide") {
  const mock = createSupabaseMock({
    profile: approver,
    profiles: [authorProfile],
    results: {
      "requests.select": { data: [pendingRequest()] },
      "request_lines.select": { data: [line] },
      "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
      "department_approvers.select": { data: [{ department_id: PRIMARY, user_id: ME }] },
    },
  });
  createClient.mockResolvedValue(mock.client);
  const { RequestsPageContent } = await import("@/app/(app)/requests/(list)/page");
  return renderToStaticMarkup(await RequestsPageContent({ searchParams: Promise.resolve({ view }) } as never));
}

async function renderDecisionDetail(authorProfile: ReturnType<typeof makeProfile>) {
  const mock = createSupabaseMock({
    profile: approver,
    profiles: [authorProfile],
    results: {
      "requests.select": { data: pendingRequest() },
      "request_lines.select": { data: [line] },
      "request_history.select": { data: [] },
      "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
      "department_approvers.select": { data: [{ department_id: PRIMARY, user_id: ME }] },
      // Чужі членства — у видачі RLS є: автор ще й заявник «Office». На сторінці схвалювача їх бути не має.
      "department_members.select": {
        data: [
          { department_id: PRIMARY, user_id: AUTHOR, auto_approve: false },
          { department_id: OFFICE, user_id: AUTHOR, auto_approve: true },
        ],
      },
    },
  });
  createClient.mockResolvedValue(mock.client);
  const { RequestPageContent } = await import("@/app/(app)/requests/[id]/page");
  return renderToStaticMarkup(await RequestPageContent({ params: Promise.resolve({ id: REQ }), searchParams: Promise.resolve({}) } as never));
}

describe("AC-APR: список для рішення", () => {
  it("AC-APR-04: заявник за прямим посиланням на список для рішення бачить «Not enough permissions», заявок немає", async () => {
    const employee = makeProfile({ id: ME, role: "requester", email: "member1@example.test" });
    const mock = createSupabaseMock({
      profile: employee,
      profiles: [makeProfile({ id: AUTHOR, role: "requester", email: "other@example.test", full_name: "Other Author" })],
      results: {
        "requests.select": { data: [pendingRequest()] },
        "request_lines.select": { data: [line] },
        "departments.select": { data: [{ id: PRIMARY, name: "Primary School" }] },
        "department_approvers.select": { data: [] },
      },
    });
    createClient.mockResolvedValue(mock.client);
    const { RequestsPageContent } = await import("@/app/(app)/requests/(list)/page");

    const html = renderToStaticMarkup(await RequestsPageContent({ searchParams: Promise.resolve({ view: "decide" }) } as never));

    expect(html).toContain("Not enough permissions");
    expect(html).not.toContain("PUR-12");
    expect(html).not.toContain('data-testid="to-decide"');
    expect(mock.calls.some((c) => c.table === "requests")).toBe(false);
  });

  it("AC-APR-04: схвалювач той самий URL бачить зі списком заявок свого відділу", async () => {
    const author = makeProfile({ id: AUTHOR, role: "requester", email: "petro@example.test", full_name: "Petro" });

    const html = await renderDecisionList(author);

    expect(html).not.toContain("Not enough permissions");
    expect(html).toContain('data-testid="to-decide"');
  });

  it("AC-APR-08: і в списку для рішення, і на сторінці заявки вказано автора за іменем «Petro»", async () => {
    const author = makeProfile({ id: AUTHOR, role: "requester", email: "petro@example.test", full_name: "Petro" });

    const list = await renderDecisionList(author);
    const detail = await renderDecisionDetail(author);

    expect(list).toContain("Petro");
    expect(detail).toContain("Petro");
    expect(list).not.toContain("petro@example.test");
  });

  it("AC-APR-09: без імені в профілі автора замість імені вказано його email", async () => {
    const author = makeProfile({ id: AUTHOR, role: "requester", email: "petro@example.test", full_name: null });

    const list = await renderDecisionList(author);

    expect(list).toContain("petro@example.test");
  });

  it("AC-APR-10: ролі, відділів поза заявкою й дозволів автора на сторінках схвалювача немає", async () => {
    const author = makeProfile({ id: AUTHOR, role: "requester", email: "petro@example.test", full_name: "Petro" });

    for (const html of [await renderDecisionList(author), await renderDecisionDetail(author)]) {
      expect(html).not.toMatch(/Requester/);
      expect(html).not.toContain("Auto-approval");
      expect(html).not.toContain("Self-purchase");
      expect(html).not.toContain("Office");
    }
  });
});

describe("AC-FRM-08, AC-APR-03: чужа заявка за прямим посиланням", () => {
  async function openForeign(viewer: ReturnType<typeof makeProfile>, members: Array<{ department_id: string; user_id: string; auto_approve: boolean }>, approvers: Array<{ department_id: string; user_id: string }>) {
    // RLS не віддає заявку: requests.select порожній, тож сторінка не має жодних даних.
    const mock = createSupabaseMock({
      profile: viewer,
      results: {
        "requests.select": { data: null },
        "departments.select": { data: [] },
        "department_approvers.select": { data: approvers },
        "department_members.select": { data: members },
      },
    });
    createClient.mockResolvedValue(mock.client);
    const { RequestPageContent } = await import("@/app/(app)/requests/[id]/page");
    return renderToStaticMarkup(await RequestPageContent({ params: Promise.resolve({ id: REQ }), searchParams: Promise.resolve({}) } as never));
  }

  it("AC-FRM-08: заявник того ж відділу, не автор і не схвалювач, бачить «Not enough permissions», даних закупівлі немає", async () => {
    const colleague = makeProfile({ id: ME, role: "requester", email: "member2@example.test" });
    const html = await openForeign(colleague, [{ department_id: PRIMARY, user_id: ME, auto_approve: false }], []);

    expect(html).toContain("Not enough permissions");
    expect(html).not.toContain("PUR-12");
    expect(html).not.toContain('data-testid="lines"');
  });

  it("AC-APR-03: схвалювач «Primary School» за прямим посиланням на заявку «Office» бачить «Not enough permissions», дій рішення немає", async () => {
    const html = await openForeign(approver, [{ department_id: PRIMARY, user_id: ME, auto_approve: false }], [{ department_id: PRIMARY, user_id: ME }]);

    expect(html).toContain("Not enough permissions");
    expect(html).not.toContain('data-testid="approve"');
    expect(html).not.toContain('data-testid="lines"');
  });
});
