// Сторінки стану (404, помилка): заголовок, пояснення, дії й код помилки; без хуків, тож рендеряться на сервері.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusPage } from "@/components/ui";
import NotFound from "@/app/not-found";

describe("StatusPage", () => {
  it("renders title, description and actions in the app layout", () => {
    const html = renderToStaticMarkup(
      <StatusPage icon="alert" tone="danger" title="Something went wrong" description="Try again." actions={<button type="button">Try again</button>} />,
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    expect(html).toContain("bg-status-rejected");
    expect(html).not.toContain("School Purchasing");
  });

  it("shows the server error reference only when there is one", () => {
    const withDigest = renderToStaticMarkup(<StatusPage icon="alert" title="T" description="D" reference="2097415364" actions={null} />);
    const without = renderToStaticMarkup(<StatusPage icon="alert" title="T" description="D" actions={null} />);
    expect(withDigest).toContain("Reference: 2097415364");
    expect(without).not.toContain("Reference");
  });

  it("standalone variant adds the product name and the root 404 uses it", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("School Purchasing");
    expect(html).toContain("404");
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/"');
  });
});
