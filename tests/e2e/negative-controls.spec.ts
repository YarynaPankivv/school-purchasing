// НЕГАТИВНІ КОНТРОЛІ — навмисно хибні очікування. Не AC-тести: назви починаються з NC-, а не з AC ID,
// тож ac:coverage їх не рахує. У звичайному прогоні їх немає (проєкт chromium має grepInvert @negative-control);
// запуск: npm run uat:nc (UAT_NEGATIVE_CONTROLS=1 → проєкт negative-controls). Лише читання: безпечно на проді.
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент;
//   NC-2 — текст «Тоді» у вимозі уточнено, а тест і застосунок ні → перевірки зелені, агент звіряє кадр із НОВИМ текстом PM
//          і не погоджується → NEEDS-HUMAN (розбіжність іде до людини).
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

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
