// UAT-кроки: кожне «Дано / Коли / Тоді» з AC — окремий test.step, а кожне «Тоді» лишає докази для агента-рецензента:
// кадр екрана, aria-знімок сторінки і список частин «Тоді», які людина БАЧИТЬ (агент має їх процитувати з кадру).
// Невидимі частини (буфер обміну, рядки в базі, «даних немає») вирішують лише автоматичні перевірки.
// Джерело: демо-репо курсу, tests/e2e/support/uat.ts (тег ws8-03-uat). Змінюйте лише signIn (форма входу).
import { test, type Locator, type Page } from "@playwright/test";

export type ThenSpec = {
  /** Частина «Тоді» — дослівно з AC від PM. */
  clause: string;
  /** Що має бути видно на екрані; агент підтверджує кожну частину цитатою з кадру. */
  visible: string[];
  /** Що доводить лише перевірка (не з кадрів). */
  hidden?: string[];
  /** Що замазати на кадрі: живі облікові дані, наприклад посилання для активації. */
  mask?: Locator[];
};

// Номер «Тоді» в межах тесту. Лічильник за testId, а не test.beforeEach у цьому модулі: модуль кешується,
// і хук зареєструвався б лише у файлі, який імпортував його першим.
const thenCounters = new Map<string, number>();

export async function given(title: string, body: () => Promise<void>) {
  await test.step(`Дано: ${title}`, body);
}

export async function when(title: string, body: () => Promise<void>) {
  await test.step(`Коли: ${title}`, body);
}

/**
 * «Тоді»: спершу детерміновані перевірки, потім — ЗАВЖДИ, навіть якщо вони впали, — докази.
 * Назва thenStep, а не then: модуль з експортом then стає thenable, і await import() поводиться дивно.
 */
export async function thenStep(page: Page, spec: ThenSpec, assertions: () => Promise<void>) {
  const { testId } = test.info();
  const n = (thenCounters.get(testId) ?? 0) + 1;
  thenCounters.set(testId, n);

  await test.step(`Тоді: ${spec.clause}`, async () => {
    let passed = false;
    try {
      await assertions();
      passed = true;
    } finally {
      // try/finally без catch: помилка перевірки летить далі (тест червоний), а докази знято в будь-якому разі.
      await captureEvidence(page, n, spec, passed);
    }
  });
}

async function captureEvidence(page: Page, n: number, spec: ThenSpec, assertionsPassed: boolean) {
  const info = test.info();
  // Накладки відео (назва тесту й кроку, підказки дій, курсор) вбудовано в саму сторінку, тож вони потрапляють
  // і в page.screenshot(). Назва кроку МІСТИТЬ очікуваний текст «Тоді» — без hideOverlays агент «бачив» би його.
  await page.screencast.hideOverlays().catch(() => {});
  await page.screencast.hideActions().catch(() => {});
  await info.attach(`then-${n}.png`, {
    body: await page.screenshot({ mask: spec.mask ?? [], maskColor: "#6b7280" }),
    contentType: "image/png",
  });
  await page.screencast.showOverlays().catch(() => {});
  await info.attach(`then-${n}.aria.yml`, {
    body: await page.locator("body").ariaSnapshot(),
    contentType: "text/yaml",
  });
  const meta = { n, url: page.url(), clause: spec.clause, visible: spec.visible, hidden: spec.hidden ?? [], assertionsPassed };
  await info.attach(`then-${n}.json`, { body: JSON.stringify(meta, null, 2), contentType: "application/json" });
}

/** Помилки консолі, необроблені помилки сторінки й відповіді 5xx за час тесту (API Playwright 1.56+). */
export async function attachRuntimeErrors(page: Page) {
  const consoleErrors = (await page.consoleMessages({ filter: "all" }))
    .filter((m) => m.type() === "error")
    .map((m) => m.text());
  const pageErrors = (await page.pageErrors({ filter: "all" })).map((e) => String(e));
  const responses = await Promise.all(
    (await page.requests()).map(async (r) => ({ r, status: (await r.response())?.status() ?? 0 })),
  );
  const failed = responses
    .filter(({ r, status }) => r.failure() !== null || status >= 500)
    .map(({ r, status }) => `${r.method()} ${new URL(r.url()).pathname} → ${r.failure()?.errorText ?? status}`);
  await test.info().attach("runtime-errors.json", {
    body: JSON.stringify({ console: consoleErrors, pageErrors, failed }, null, 2),
    contentType: "application/json",
  });
}

/**
 * Вхід через форму /login. Пароль вводимо через evaluate, а не fill: назва кроку fill містить введене значення,
 * і пароль потрапив би у звіт і трасу.
 * Локатори — форма /login цього застосунку (поля «Email» і «Password», кнопка «Sign in») і перехід на «/» після входу.
 * Ваша форма чи сторінка після входу інші — змініть їх тут.
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  // Доступне ім'я поля — «Password Show password» (підпис охоплює кнопку показу пароля), тож шукаємо за name.
  await page.locator('input[name="password"]').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}
