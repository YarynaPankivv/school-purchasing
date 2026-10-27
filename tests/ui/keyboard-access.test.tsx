// Без AC PM: доступність з клавіатури. Esc закриває відкрите меню на телефоні; перше, що отримує фокус, — «Skip to content»,
// посилання на main#main-content (DESIGN.md, розділ 7: Tab проходить сторінку по порядку).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar, PageShell } from "@/components/ui";
import { shouldCloseOnEscape } from "@/components/ui/mobile-menu";

vi.mock("next/navigation", () => ({
  usePathname: () => "/requests",
  useRouter: () => ({ push: () => undefined }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

describe("меню на телефоні: Esc", () => {
  it("закриває відкрите меню", () => {
    expect(shouldCloseOnEscape("Escape", true)).toBe(true);
  });

  it("не чіпає закрите меню й не реагує на інші клавіші", () => {
    expect(shouldCloseOnEscape("Escape", false)).toBe(false);
    expect(shouldCloseOnEscape("Enter", true)).toBe(false);
    expect(shouldCloseOnEscape("Tab", true)).toBe(false);
  });
});

describe("«Skip to content»", () => {
  it("є першим елементом оболонки, до бічної панелі, і веде на #main-content", () => {
    const html = renderToStaticMarkup(<AppSidebar user={null} />);

    expect(html.startsWith('<a href="#main-content"')).toBe(true);
    expect(html).toContain("Skip to content");
    expect(html.indexOf("Skip to content")).toBeLessThan(html.indexOf("<aside"));
  });

  it("має ціль: main з id=\"main-content\", яку можна сфокусувати програмно", () => {
    const html = renderToStaticMarkup(<PageShell title="Requests">content</PageShell>);

    expect(html).toMatch(/<main id="main-content" tabindex="-1"/);
  });
});
