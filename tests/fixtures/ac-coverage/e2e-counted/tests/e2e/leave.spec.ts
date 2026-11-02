import { expect, test } from "@playwright/test";

test("AC-DEMO-01: заявка зберігається", async ({ page }) => {
  await page.goto("/requests");
  await expect(page.getByRole("status")).toHaveText("Заявку подано");
});

test.fixme("AC-DEMO-02: порожня заявка", async () => {});
