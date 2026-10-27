// Без AC PM: збій читання заявок не ламає головну, але причину пишемо в лог сервера, а не ковтаємо мовчки.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    usePathname: () => "/",
    useRouter: () => ({ push: () => undefined }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

afterEach(() => vi.restoreAllMocks());

describe("головна: збій читання заявок", () => {
  it("shows the unavailable summary and logs the cause", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mock = createSupabaseMock({
      profile: makeProfile({ id: "u1", role: "requester", email: "a@example.test", full_name: "Anna" }),
      results: { "requests.select": { error: { message: "relation does not exist" } } },
    });
    createClient.mockResolvedValue(mock.client);
    const { HomeContent } = await import("@/app/(app)/(home)/page");

    const html = renderToStaticMarkup(await HomeContent());

    expect(html).toContain("Your request summary is unavailable.");
    expect(log).toHaveBeenCalledWith("Home: failed to load the requests overview", expect.any(Error));
  });
});
