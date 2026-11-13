// Без AC PM: підсумок на головній не каже «all caught up», коли заявка автора повернена на доопрацювання (рев'ю PM до WS9, п. 17).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, makeProfile } from "../org/supabase-mock";
import { AUTHOR, makePurchase } from "../pur/helpers";

vi.mock("next/navigation", async () => {
  const { RedirectSignal } = await import("../org/supabase-mock");
  return {
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new RedirectSignal("not-found");
    },
    usePathname: () => "/",
    useRouter: () => ({ push: () => undefined }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

beforeEach(() => createClient.mockReset());

async function renderHome(statuses: Parameters<typeof makePurchase>[0][]) {
  const mock = createSupabaseMock({
    profile: makeProfile({ id: AUTHOR, role: "requester", email: "anna@example.test", full_name: "Anna" }),
    profiles: [],
    results: {
      "requests.select": { data: statuses.map((s, i) => makePurchase({ id: `req-${i}`, number: i + 1, ...s })) },
      "request_lines.select": { data: [] },
      "departments.select": { data: [] },
      "department_approvers.select": { data: [] },
    },
  });
  createClient.mockResolvedValue(mock.client);
  const { HomeContent } = await import("@/app/(app)/(home)/page");
  return renderToStaticMarkup(await HomeContent());
}

describe("головна: підсумок для автора", () => {
  it("повернена на доопрацювання заявка — не «all caught up»", async () => {
    const html = await renderHome([{ status: "returned" }]);
    expect(html).toContain("1 of your request was returned for revision.");
    expect(html).not.toContain("You are all caught up.");
  });

  it("без заявок, що чекають на автора, підсумок лишається «all caught up»", async () => {
    const html = await renderHome([{ status: "approved" }]);
    expect(html).toContain("You are all caught up.");
  });
});
