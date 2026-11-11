// UAT зрізу 2 на проді: AC-FRM-09 (гість), AC-FRM-14 (порожній стан «My requests»), AC-APR-03 (чужа заявка).
// Усі три лише читають дані: прод спільний з PM. Тексти «Тоді» — з requirements/47 і 48; англійські повідомлення
// інтерфейсу — з таблиці PM (requirements/49): «Недостатньо прав» = «Not enough permissions»,
// «Ви ще не подали жодної заявки» = «You have not submitted any requests yet».
// Акаунти — tests/e2e/auth.setup.ts (admin — лише щоб знайти чужу заявку й перевірити її статус).
import { expect, test, type Browser, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.describe("гість без входу", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    "AC-FRM-09: гість за прямим посиланням на форму закупівлі бачить сторінку входу, а форму закупівлі не показано",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-FRM-09" } },
    async ({ page }) => {
      await given("гість без входу", async () => {});

      await when("гість відкриває пряме посилання на форму закупівлі", async () => {
        await page.goto("/requests/new");
      });

      await thenStep(
        page,
        {
          clause: "він бачить сторінку входу, а форму закупівлі не показано",
          visible: ["сторінка входу із заголовком «Sign in» і полями «Email» та «Password»"],
          hidden: ["форми закупівлі (заголовок «New request», поле відділу) на сторінці немає"],
        },
        async () => {
          await expect(page).toHaveURL((url) => url.pathname === "/login");
          await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
          await expect(page.getByLabel("Email")).toBeVisible();
          await expect(page.getByRole("heading", { name: "New request" })).toHaveCount(0);
          await expect(page.getByLabel("Department")).toHaveCount(0);
        },
      );
    },
  );
});

test.describe("працівник без жодної заявки", () => {
  test.use({ storageState: "playwright/.auth/empty.json" });

  test(
    "AC-FRM-14: працівник без жодної заявки відкриває «Мої заявки» і бачить повідомлення про порожній список, а списку заявок немає",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-FRM-14" } },
    async ({ page }) => {
      await given("працівник pm-empty@example.test без жодної заявки (чернеток теж) увійшов у застосунок", async () => {
        await page.goto("/");
        await expect(page).not.toHaveURL(/\/login/);
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
          hidden: ["таблиці заявок і рядків заявок на сторінці немає"],
        },
        async () => {
          const main = page.getByRole("main");
          await expect(main.getByText("You have not submitted any requests yet", { exact: true })).toBeVisible();
          await expect(page.getByTestId("request-row")).toHaveCount(0);
          await expect(page.getByRole("table")).toHaveCount(0);
        },
      );
    },
  );
});

type Foreign = { id: string; label: string; department: string };

/** Подані заявки (статус «Awaiting approval») зі списку «Requests» під сесією `statePath`: id → номер і відділ. */
async function pendingRequests(browser: Browser, baseURL: string, statePath: string): Promise<Map<string, Foreign>> {
  const context = await browser.newContext({ baseURL, storageState: statePath });
  try {
    const page = await context.newPage();
    await page.goto("/requests?status=pending");
    const rows = page.getByTestId("request-row");
    const found = new Map<string, Foreign>();
    for (const row of await rows.all()) {
      const href = (await row.getByRole("link").first().getAttribute("href")) ?? "";
      const id = /^\/requests\/([0-9a-f-]{36})/.exec(href)?.[1];
      if (!id) continue;
      const cells = await row.getByRole("cell").allInnerTexts();
      found.set(id, { id, label: (await row.getByRole("link").first().innerText()).trim(), department: (cells[2] ?? "").trim() });
    }
    return found;
  } finally {
    await context.close();
  }
}

async function statusSeenByAdmin(browser: Browser, baseURL: string, id: string): Promise<string> {
  const context = await browser.newContext({ baseURL, storageState: "playwright/.auth/admin.json" });
  try {
    const page: Page = await context.newPage();
    await page.goto(`/requests/${id}`);
    // Читаємо лише поле статусу (data-testid="request-status"), а не текст усієї сторінки: на сторінці заявки є ще
    // бейджі рядків та історія, і рядок «Awaiting approval» знайшовся б там і в уже вирішеної заявки (хибний PASS).
    // toBeVisible чекає, поки сторінка, яку стрімить Next, замінить скелет «Loading…».
    const status = page.getByTestId("request-status");
    await expect(status).toBeVisible();
    return (await status.innerText()).trim();
  } finally {
    await context.close();
  }
}

test.describe("схвалювач і чужа заявка", () => {
  test.use({ storageState: "playwright/.auth/approver.json" });

  test(
    "AC-APR-03: схвалювач відкриває за прямим посиланням заявку відділу, який не схвалює, і бачить «Недостатньо прав», даних заявки немає, а статус лишається «Очікує схвалення»",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-APR-03" } },
    async ({ page, browser, baseURL }) => {
      let foreign: Foreign | undefined;

      await given(
        "заявка відділу, який схвалювач pm-approver@example.test не схвалює, має статус «Awaiting approval»",
        async () => {
          // Заявка, яку адміністратор бачить у списку подач, а схвалювач — ні: відділ не його.
          const all = await pendingRequests(browser, baseURL!, "playwright/.auth/admin.json");
          const mine = await pendingRequests(browser, baseURL!, "playwright/.auth/approver.json");
          foreign = [...all.values()].find((r) => !mine.has(r.id));
          expect(
            foreign,
            "на проді немає поданої заявки чужого для pm-approver відділу: подайте її під pm-requester у відділ, якого pm-approver не схвалює",
          ).toBeDefined();
          expect(foreign!.department, "у списку не прочитано відділ заявки").not.toBe("");
        },
      );

      await when("схвалювач відкриває цю заявку за прямим посиланням", async () => {
        await page.goto(`/requests/${foreign!.id}`);
      });

      await thenStep(
        page,
        {
          clause:
            "вона бачить повідомлення «Недостатньо прав» (в інтерфейсі англійською: «Not enough permissions», requirements/49), даних заявки їй не показано, а статус заявки лишається «Очікує схвалення»",
          visible: ["сторінка з повідомленням «Not enough permissions»", "номера, відділу й рядків заявки на сторінці немає"],
          hidden: ["статус заявки в системі лишається «Awaiting approval» (перевірено сесією адміністратора)"],
        },
        async () => {
          const main = page.getByRole("main");
          await expect(main.getByRole("heading", { name: "Not enough permissions" })).toBeVisible();
          const text = await page.locator("body").innerText();
          expect(text).not.toContain(foreign!.label);
          expect(text).not.toContain(foreign!.department);
          await expect(page.getByRole("table")).toHaveCount(0);
          expect(await statusSeenByAdmin(browser, baseURL!, foreign!.id)).toBe("Awaiting approval");
        },
      );
    },
  );
});
