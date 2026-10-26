// Власний вибір дати: на сервері — кнопка з відформатованою датою й прихованим полем для форми; календар закритий.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateField } from "@/components/ui";

describe("DateField", () => {
  it("shows the chosen date and submits it as YYYY-MM-DD through a hidden input", () => {
    const html = renderToStaticMarkup(<DateField name="delivery_date" defaultValue="2026-11-03" />);
    expect(html).toContain('type="hidden"');
    expect(html).toContain('name="delivery_date"');
    expect(html).toContain('value="2026-11-03"');
    expect(html).toContain("Nov 3, 2026");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it("shows a placeholder for an empty or invalid value and submits an empty string", () => {
    for (const defaultValue of ["", "2026-02-31", "not-a-date"]) {
      const html = renderToStaticMarkup(<DateField name="delivery_date" defaultValue={defaultValue} />);
      expect(html).toContain("Select a date");
      expect(html).toContain('value=""');
    }
  });
});
