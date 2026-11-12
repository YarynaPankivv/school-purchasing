// Регресія: власний Select не губить значення після Server Action. React 19 робить form.reset() після кожної дії форми
// («Add line», «Save»), і прихований справжній <select> повертався до порожнього першого пункту, хоча кнопка показувала
// вибраний відділ; наступне «Submit» надсилало порожнє значення й стирало відділ заявки.
// Це не AC-перевірка для PM, тож без тегу @uat (у звіт UAT не потрапляє); пише дані, тож тег @writes і синтетичний
// користувач uat-<run>-selreset@example.test, якого прибирає cleanup.teardown.ts.
import { expect, test } from "@playwright/test";
import { given, signIn, when } from "./support/uat";
import { addToDepartment, createUatUser, requestInfo } from "./support/slice3";

test(
  "AC-PUR-05: відділ, вибраний у чернетці, не губиться після «Add line» й зберігається в поданій заявці",
  // Без анотації `ac`: це регресія, а не UAT-перевірка для PM, тож у звіт UAT (scripts/uat/pack.mjs) вона не потрапляє.
  { tag: ["@writes"] },
  async ({ page }) => {
    const user = await createUatUser("selreset", "Select Reset");
    let id = "";

    await given("працівник із двома відділами відкриває форму нової заявки", async () => {
      await addToDepartment(user, "Office");
      await addToDepartment(user, "Primary School");
      await signIn(page, user.email, user.password);
      await page.goto("/requests/new");
    });

    await when("обирає відділ «Primary School» і створює чернетку", async () => {
      await page.locator('span:has(> select[name="department_id"]) > button').click();
      await page.getByRole("option", { name: "Primary School" }).click();
      await page.getByRole("button", { name: "Create draft" }).click();
      await page.waitForURL(/\/requests\/[0-9a-f-]{36}/);
      id = /\/requests\/([0-9a-f-]{36})/.exec(page.url())![1]!;
    });

    await when("заповнює рядок 1 і додає рядок 2 кнопкою «Add line»", async () => {
      await page.getByLabel("Line 1 name").fill("Paper A4");
      await page.getByLabel("Line 1 purpose").fill("Classroom");
      await page.getByLabel("Line 1 quantity").fill("3");
      await page.getByLabel("Line 1 unit price").fill("20");
      await page.getByTestId("add-line").click();
      await expect(page.getByLabel("Line 2 name")).toBeVisible();
    });

    // Після дії форми значення, яке піде в наступний запит, має лишитися вибраним відділом, а не порожнім пунктом.
    const nativeSelect = page.locator('select[name="department_id"]');
    const selectedText = () => nativeSelect.evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.text ?? "");
    await expect.poll(selectedText, { message: "прихований select відділу після «Add line»" }).toBe("Primary School");

    await when("заповнює рядок 2 і подає заявку", async () => {
      await page.getByLabel("Line 2 name").fill("Markers");
      await page.getByLabel("Line 2 purpose").fill("Classroom");
      await page.getByLabel("Line 2 quantity").fill("2");
      await page.getByLabel("Line 2 unit price").fill("15.5");
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await page.waitForURL(/\/requests\?saved=submitted/);
    });

    const info = await requestInfo(id);
    expect(info.department).toBe("Primary School");
    expect(info.status).toBe("pending");
  },
);
