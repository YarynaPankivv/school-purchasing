// НЕГАТИВНІ КОНТРОЛІ — навмисно хибні очікування. Не AC-тести: назви починаються з NC-, а не з AC ID,
// тож ac:coverage їх не рахує. У звичайному прогоні їх немає (проєкт chromium має grepInvert @negative-control);
// запуск: npm run uat:nc (UAT_NEGATIVE_CONTROLS=1 → проєкт negative-controls). Лише читання: безпечно на проді.
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент;
//   NC-2 — текст «Тоді» у вимозі уточнено, а тест і застосунок ні → перевірки зелені, агент звіряє кадр із НОВИМ текстом PM
//          і не погоджується → NEEDS-HUMAN (розбіжність іде до людини).
//   NC-3 — AC зрізу 3 (AC-DEC-06, текст «Provide a reason»): у тесті інший очікуваний текст → FAIL. Пише синтетичні дані
//          (uat-<run>-…@example.test), які прибирає teardown, тому тег @writes (потрібен SUPABASE_SECRET_KEY).
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";
import { addToDepartment, createUatUser, submitPurchaseAs } from "./support/slice3";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.describe("NC-1: працівник без заявок", () => {
  test.use({ storageState: "playwright/.auth/empty.json" });

  test(
    "NC-1 (AC-FRM-14, навмисно хибне очікування в тесті: інший текст порожнього стану)",
    {
      tag: ["@negative-control"],
      annotation: [
        { type: "ac", description: "AC-FRM-14" },
        { type: "case", description: "NC-1" },
      ],
    },
    async ({ page }) => {
      await given("працівник pm-empty@example.test без жодної поданої заявки увійшов у застосунок", async () => {
        await page.goto("/");
      });
      await when("відкриває сторінку «Мої заявки»", async () => {
        await page.goto("/requests");
      });
      await thenStep(
        page,
        {
          clause:
            "він бачить повідомлення «Ви ще не подали жодної заявки» (в інтерфейсі англійською: «You have not submitted any requests yet», requirements/49), а списку заявок немає",
          visible: ["розділ «My requests» з повідомленням «You have not submitted any requests yet»"],
        },
        async () => {
          await expect(page.getByRole("main").getByText("You have no requests yet", { exact: true })).toBeVisible({
            timeout: 5_000,
          });
        },
      );
    },
  );
});

test.describe("NC-2: гість", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    "NC-2 (AC-FRM-09, текст «Тоді» у вимозі уточнено, тест і застосунок — ні)",
    {
      tag: ["@negative-control"],
      annotation: [
        { type: "ac", description: "AC-FRM-09" },
        { type: "case", description: "NC-2" },
        {
          type: "ac-text",
          description:
            "AC-FRM-09: Дано гість без входу. Коли він відкриває пряме посилання на форму закупівлі. Тоді він бачить сторінку входу із заголовком «Welcome back», а форму закупівлі не показано.",
        },
      ],
    },
    async ({ page }) => {
      await given("гість без входу", async () => {});
      await when("гість відкриває пряме посилання на форму закупівлі", async () => {
        await page.goto("/requests/new");
      });
      await thenStep(
        page,
        {
          clause: "він бачить сторінку входу, а форму закупівлі не показано",
          visible: ["сторінка входу із заголовком «Sign in»"],
        },
        async () => {
          await expect(page).toHaveURL((url) => url.pathname === "/login");
          await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
        },
      );
    },
  );
});

test.describe("NC-3: схвалювач повертає заявку без причини", () => {
  test(
    "NC-3 (AC-DEC-06, навмисно хибне очікування в тесті: інший текст повідомлення про причину)",
    {
      tag: ["@negative-control", "@writes"],
      annotation: [
        { type: "ac", description: "AC-DEC-06" },
        { type: "case", description: "NC-3" },
      ],
    },
    async ({ page }) => {
      const author = await createUatUser("nc3-author", "Anna Author");
      const maria = await createUatUser("nc3-maria", "Maria Approver");
      await addToDepartment(author, "Primary School");
      await addToDepartment(maria, "Primary School", { approver: true });
      let id = "";

      await given("заявка відділу «Primary School» зі статусом «Awaiting approval», Марія схвалює цей відділ", async () => {
        id = await submitPurchaseAs(author, "Primary School", [{ name: "Paper A4", quantity: 3, unitPrice: 20 }]);
      });
      await when("Марія повертає заявку на доопрацювання без причини", async () => {
        await page.context().clearCookies();
        await signIn(page, maria.email, maria.password);
        await page.goto(`/requests/${id}`);
        await page.getByTestId("return").click();
        await page.waitForURL(/error=reason_required/);
      });
      await thenStep(
        page,
        {
          clause: "вона бачить повідомлення «Вкажіть причину», а статус заявки лишається «Очікує схвалення»",
          visible: ["повідомлення «Provide a reason» над карткою заявки", "статус заявки «Awaiting approval»"],
        },
        async () => {
          await expect(page.getByRole("main").getByText("A reason is required", { exact: true })).toBeVisible({ timeout: 5_000 });
        },
      );
    },
  );
});
