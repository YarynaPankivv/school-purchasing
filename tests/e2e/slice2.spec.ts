// UAT зрізу 2 на проді: AC-FRM-09 (гість), AC-FRM-14 (порожній стан «My requests»), AC-APR-03 (чужа заявка).
// AC-FRM-09 і AC-FRM-14 лише читають дані (прод спільний з PM); AC-APR-03 створює власну заявку відділу «Office» (@writes). Тексти «Тоді» — з requirements/47 і 48; англійські повідомлення
// інтерфейсу — з таблиці PM (requirements/49): «Недостатньо прав» = «Not enough permissions»,
// «Ви ще не подали жодної заявки» = «You have not submitted any requests yet».
// Акаунти — tests/e2e/auth.setup.ts (admin — лише щоб перевірити статус чужої заявки).
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { addToDepartment, createUatUser, requestInfo, submitPurchaseAs } from "./support/slice3";

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

/** Скільки заявок (з чернетками) має сам працівник за API під своєю сесією: передумова «без жодної заявки» не залежить від сторінки, яку перевіряє тест. */
async function requestCountOf(email: string, password: string | undefined): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  expect(url && key && password, "для перевірки передумови потрібні NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY і пароль акаунта").toBeTruthy();
  const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password: password! });
  expect(signedIn.error, "вхід за API для перевірки передумови").toBeNull();
  const { count, error } = await client
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("author_id", signedIn.data.user!.id);
  expect(error, "читання заявок працівника за API").toBeNull();
  return count ?? 0;
}

test.describe("працівник без жодної заявки", () => {
  test.use({ storageState: "playwright/.auth/empty.json" });

  test(
    "AC-FRM-14: працівник без жодної заявки відкриває «Мої заявки» і бачить повідомлення про порожній список, а списку заявок немає",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-FRM-14" } },
    async ({ page }) => {
      await given("працівник pm-empty@example.test без жодної заявки (чернеток теж) увійшов у застосунок", async () => {
        expect(
          await requestCountOf("pm-empty@example.test", process.env.UAT_PASSWORD_EMPTY ?? process.env.DEMO_USER_PASSWORD),
          "у pm-empty@example.test є заявка (чернетка теж): порожній стан не перевірити",
        ).toBe(0);
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
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-APR-03" } },
    async ({ page, browser, baseURL }) => {
      let foreign: Foreign | undefined;

      await given(
        "заявка відділу, який схвалювач pm-approver@example.test не схвалює, має статус «Awaiting approval»",
        async () => {
          // Власна заявка відділу «Office» (його pm-approver не схвалює: він схвалює «Primary School», scripts/e2e-seed.mjs):
          // перевіряємо саме відділ, а не «будь-яку заявку, видиму адміну й невидиму схвалювачу».
          const author = await createUatUser("apr03-author", "Anna Author");
          await addToDepartment(author, "Office");
          const id = await submitPurchaseAs(author, "Office", [{ name: "Paper A4", quantity: 3, unitPrice: 20 }]);
          const info = await requestInfo(id);
          expect(info.department, "заявка має бути відділу «Office»").toBe("Office");
          expect(info.status).toBe("pending");
          foreign = { id, label: `PUR-${info.number}`, department: info.department };
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
