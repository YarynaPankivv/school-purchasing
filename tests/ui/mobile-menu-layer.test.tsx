// Без AC PM: виправлення вигляду. На телефоні відкрите меню розкривається під шапкою й не має ховатися під sticky-смугою
// пошуку, яка йде в DOM пізніше: шапка (z-20) лежить вище за смугу (z-10).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar, TopBar } from "@/components/ui";

vi.mock("next/navigation", () => ({
  usePathname: () => "/requests",
  useRouter: () => ({ push: () => undefined }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const zOf = (html: string, marker: string) => {
  const tag = html.slice(html.indexOf(marker)).split(">")[0];
  return Number(/\bz-(\d+)\b/.exec(tag)?.[1]);
};

describe("шапка на телефоні", () => {
  it("лежить вище за sticky-смугу пошуку, тож відкрите меню її не перекриває", () => {
    const header = zOf(renderToStaticMarkup(<AppSidebar user={null} />), "<header");
    const bar = zOf(renderToStaticMarkup(<TopBar showNewRequest />), '<div class="sticky');
    expect(header).toBeGreaterThan(bar);
  });
});
