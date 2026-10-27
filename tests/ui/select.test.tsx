// Власний Select: на сервері рендериться кнопка-combobox з підписом вибраного й прихований справжній <select>,
// який несе name, required, data-testid і всі <option> (форма й браузерна перевірка працюють як зі звичайним <select>).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select } from "@/components/ui";

const departments = [
  { id: "a", name: "Office" },
  { id: "b", name: "Upper School" },
];

describe("Select", () => {
  it("shows the selected option on the button and keeps a real select for the form", () => {
    const html = renderToStaticMarkup(
      <Select name="department_id" required defaultValue="b" data-testid="department-select">
        <option value="">Select a department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('<span class="truncate">Upper School</span>');
    expect(html).toContain('name="department_id"');
    expect(html).toContain('data-testid="department-select"');
    expect(html).toContain("required");
    // Скрінрідер чує «обов'язкове» на самому полі списку (справжній select прихований), а не лише від браузерної перевірки.
    expect(html).toMatch(/role="combobox"[^>]*aria-required="true"/);
    expect(html).toContain('<option value="a">Office</option>');
    // Список не рендериться, поки меню закрите.
    expect(html).not.toContain('role="listbox"');
  });

  it("falls back to the first option and respects disabled", () => {
    const html = renderToStaticMarkup(
      <Select name="user_id" disabled aria-label="Employee">
        <option value="1">Anna Author</option>
        <option value="2">Andrii Second</option>
      </Select>,
    );
    expect(html).toContain('<span class="truncate">Anna Author</span>');
    expect(html).toContain('aria-label="Employee"');
    expect(html).toContain("disabled");
  });

  it("shows the controlled value", () => {
    const html = renderToStaticMarkup(
      <Select value="PUR" onChange={() => undefined}>
        <option value="">None</option>
        <option value="PUR">Purchase</option>
      </Select>,
    );
    expect(html).toContain('<span class="truncate">Purchase</span>');
  });
});
