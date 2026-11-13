// UAT зрізу 3: AC-DEC-01, 04, 06, 07 (рішення схвалювача й повторне подання), AC-HIST-01, 02, 06, 10 (номер, суми, історія),
// AC-LANG-09 (підписи статусів). Тексти «Тоді» — дослівно з requirements/63, 64 і 49; англійські написи інтерфейсу — з
// таблиці PM (requirements/49): «Частково схвалено» = «Partially approved», «Повернено на доопрацювання» = «Returned for
// revision», «Очікує схвалення» = «Awaiting approval», «Недостатньо прав» = «Not enough permissions», «Вкажіть причину» =
// «Provide a reason», «Подано» = «Submitted».
// Кожен AC пише дані, тож працює з синтетичними uat-<run>-<суфікс>@example.test (support/slice3.ts) і прибирається
// teardown-ом (cleanup.teardown.ts). Тег @writes: без SUPABASE_SECRET_KEY ці тести не запускаємо.
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";
import { addToDepartment, createUatUser, decideAs, requestInfo, submitPurchaseAs, type UatLine, type UatUser } from "./support/slice3";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

const PRIMARY = "Primary School";
const OFFICE = "Office";
const PAPER = { name: "Paper A4", quantity: 3, unitPrice: 20 } satisfies UatLine;
const MARKERS = { name: "Markers", quantity: 2, unitPrice: 15.5 } satisfies UatLine;
const FOLDERS = { name: "Folders", quantity: 1, unitPrice: 7 } satisfies UatLine;

/** Вхід під іншим користувачем у тій самій вкладці (відео лишається одним). */
async function loginAs(page: Page, user: UatUser) {
  await page.context().clearCookies();
  await signIn(page, user.email, user.password);
}

/** Автор і схвалювач відділу Primary School з подією, що автор і схвалювач — різні люди. */
async function authorAndApprover(prefix: string) {
  const author = await createUatUser(`${prefix}-author`, "Anna Author");
  const maria = await createUatUser(`${prefix}-maria`, "Maria Approver");
  await addToDepartment(author, PRIMARY);
  await addToDepartment(maria, PRIMARY, { approver: true });
  return { author, maria };
}

const statusOnPage = (page: Page) => page.getByTestId("request-status");
const lineRow = (page: Page, position: number) => page.getByTestId("line-row").nth(position - 1);

test.describe("рішення схвалювача й повторне подання", () => {
  test(
    "AC-DEC-01: Марія відхиляє рядок 2 і схвалює заявку — статус заявки «Частково схвалено», автор бачить рядок 2 зі статусом «Відхилено», а рядки 1 і 3 — зі статусом «Схвалено»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-01" } },
    async ({ page }) => {
      const { author, maria } = await authorAndApprover("dec01");
      let id = "";

      await given("заявка відділу «Primary School» з трьома рядками зі статусом «Awaiting approval», автор — не Марія, Марія схвалює цей відділ", async () => {
        id = await submitPurchaseAs(author, PRIMARY, [PAPER, MARKERS, FOLDERS]);
        expect((await requestInfo(id)).status).toBe("pending");
      });

      await when("Марія відхиляє рядок 2 і схвалює заявку", async () => {
        await loginAs(page, maria);
        await page.goto(`/requests/${id}`);
        await page.getByRole("checkbox", { name: "2. Markers" }).check();
        await page.getByTestId("approve").click();
        await page.waitForURL(/saved=decided_partially_approved/);
      });

      await thenStep(
        page,
        {
          clause: "статус заявки «Частково схвалено», автор бачить рядок 2 зі статусом «Відхилено», а рядки 1 і 3 — зі статусом «Схвалено»",
          visible: [
            "статус заявки «Partially approved» біля заголовка сторінки",
            "у таблиці рядків: рядок 2 (Markers) зі статусом «Rejected», рядки 1 (Paper A4) і 3 (Folders) зі статусом «Approved»",
          ],
        },
        async () => {
          // Вищий екран: статус і всі три рядки мають потрапити в один кадр «Тоді» (на 800 px рядок 3 лишався за межами).
          await page.setViewportSize({ width: 1280, height: 1400 });
          await loginAs(page, author);
          await page.goto(`/requests/${id}`);
          await expect(statusOnPage(page)).toHaveText("Partially approved");
          await expect(lineRow(page, 1)).toContainText("Approved");
          await expect(lineRow(page, 2)).toContainText("Rejected");
          await expect(lineRow(page, 3)).toContainText("Approved");
          await expect(lineRow(page, 1)).not.toContainText("Rejected");
          await expect(lineRow(page, 2)).not.toContainText("Approved");
        },
      );
    },
  );

  test(
    "AC-DEC-04: Марія повертає заявку на доопрацювання з причиною «Уточніть кількість» — статус заявки «Повернено на доопрацювання»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-04" } },
    async ({ page }) => {
      const { author, maria } = await authorAndApprover("dec04");
      let id = "";

      await given("заявка відділу «Primary School» зі статусом «Awaiting approval», автор — не Марія, Марія схвалює цей відділ", async () => {
        id = await submitPurchaseAs(author, PRIMARY, [PAPER]);
      });

      await when("Марія повертає заявку на доопрацювання з причиною «Уточніть кількість»", async () => {
        await loginAs(page, maria);
        await page.goto(`/requests/${id}`);
        await page.getByLabel("Reason").fill("Уточніть кількість");
        await page.getByTestId("return").click();
        await page.waitForURL(/saved=decided_returned/);
      });

      await thenStep(
        page,
        {
          clause: "статус заявки «Повернено на доопрацювання»",
          visible: ["статус заявки «Returned for revision» біля заголовка сторінки", "причина «Уточніть кількість» на сторінці"],
        },
        async () => {
          await expect(statusOnPage(page)).toHaveText("Returned for revision");
          await expect(page.getByRole("main")).toContainText("Уточніть кількість");
        },
      );
    },
  );

  test(
    "AC-DEC-06: Марія повертає заявку на доопрацювання без причини — вона бачить повідомлення «Вкажіть причину», а статус заявки лишається «Очікує схвалення»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-06" } },
    async ({ page }) => {
      const { author, maria } = await authorAndApprover("dec06");
      let id = "";

      await given("заявка відділу «Primary School» зі статусом «Awaiting approval», Марія схвалює цей відділ", async () => {
        id = await submitPurchaseAs(author, PRIMARY, [PAPER]);
      });

      await when("Марія повертає заявку на доопрацювання без причини", async () => {
        await loginAs(page, maria);
        await page.goto(`/requests/${id}`);
        await page.getByTestId("return").click();
        await page.waitForURL(/error=reason_required/);
      });

      await thenStep(
        page,
        {
          clause: "вона бачить повідомлення «Вкажіть причину», а статус заявки лишається «Очікує схвалення»",
          visible: ["повідомлення «Provide a reason» над карткою заявки", "статус заявки «Awaiting approval»"],
          hidden: ["статус заявки в базі лишається «pending»"],
        },
        async () => {
          await expect(page.getByRole("main")).toContainText("Provide a reason");
          await expect(statusOnPage(page)).toHaveText("Awaiting approval");
          expect((await requestInfo(id)).status).toBe("pending");
        },
      );
    },
  );

  test(
    "AC-DEC-07: автор виправив рядок 1 повернутої заявки й подає її знову — статус заявки «Очікує схвалення», відділ той самий",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DEC-07" } },
    async ({ page }) => {
      const { author, maria } = await authorAndApprover("dec07");
      let id = "";
      let department = "";

      await given("заявка зі статусом «Returned for revision», автор виправив рядок 1", async () => {
        id = await submitPurchaseAs(author, PRIMARY, [PAPER, MARKERS]);
        department = (await requestInfo(id)).department;
        await decideAs(maria, id, "return", { reason: "Уточніть кількість" });
        expect((await requestInfo(id)).status).toBe("returned");
        await loginAs(page, author);
        await page.goto(`/requests/${id}`);
        await page.getByLabel("Line 1 quantity").fill("5");
      });

      await when("автор подає заявку знову", async () => {
        await page.getByTestId("submit").click();
        await page.waitForURL(/saved=submitted/);
      });

      await thenStep(
        page,
        {
          clause: "статус заявки «Очікує схвалення», відділ той самий",
          visible: ["статус заявки «Awaiting approval» біля заголовка сторінки", "відділ заявки «Primary School»"],
          hidden: ["відділ заявки в базі не змінився"],
        },
        async () => {
          await expect(statusOnPage(page)).toHaveText("Awaiting approval");
          await expect(page.getByRole("main")).toContainText(PRIMARY);
          const info = await requestInfo(id);
          expect(info.status).toBe("pending");
          expect(info.department).toBe(department);
        },
      );
    },
  );
});

test.describe("номер, суми й історія заявки", () => {
  test(
    "AC-HIST-01: працівник 1 подає першу закупівлю, а потім другу — в списку «Мої заявки» вони мають номери «PUR-n» і «PUR-(n+1)» поспіль (на проді нумерація спільна: за погодженням з PM, issues #73 і #76, UAT перевіряє два номери поспіль, а абсолютні «PUR-1» і «PUR-2» доведено тестом на порожній базі, tests/db/dec-hist.test.ts)",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-01" } },
    async ({ page }) => {
      const worker = await createUatUser("hist01-worker", "Anna Author");
      await addToDepartment(worker, PRIMARY);
      let first = { number: 0 };
      let second = { number: 0 };

      await given("працівник 1 у відділі «Primary School»; база НЕ порожня (нумерація на проді спільна), тож перевіряємо дві закупівлі поспіль, як погоджено з PM", async () => {});

      await when("працівник 1 подає першу закупівлю, а потім другу", async () => {
        const firstId = await submitPurchaseAs(worker, PRIMARY, [PAPER]);
        const secondId = await submitPurchaseAs(worker, PRIMARY, [MARKERS]);
        first = await requestInfo(firstId);
        second = await requestInfo(secondId);
        await loginAs(page, worker);
        await page.goto("/requests");
      });

      await thenStep(
        page,
        {
          clause:
            "в списку «Мої заявки» вони мають номери «PUR-n» і «PUR-(n+1)» поспіль (погоджено з PM, issues #73 і #76: на проді нумерація спільна, тож абсолютні «PUR-1» і «PUR-2» UAT не перевіряє; їх доводить тест бази на порожній базі)",
          visible: [`у розділі «My requests» дві закупівлі з номерами «PUR-${first.number}» і «PUR-${first.number + 1}» поспіль`],
          hidden: ["між номерами двох закупівель немає стороннього номера: нумерація на проді спільна, абсолютні PUR-1 і PUR-2 можливі лише на порожній базі"],
        },
        async () => {
          // Номери поспіль: другий на 1 більший за перший — без повтору й прогалини (прогалини між номерами від чужих заявок на проді — «Не перевірено»).
          expect(second.number).toBe(first.number + 1);
          const table = page.getByTestId("my-requests");
          await expect(table).toContainText(`PUR-${first.number}`);
          await expect(table).toContainText(`PUR-${second.number}`);
        },
      );
    },
  );

  test(
    "AC-HIST-02: автор відкриває закупівлю з двома рядками (кількість 3 за ціною 20.00 і кількість 2 за ціною 15.50) — суми рядків 60.00 і 31.00, а сума заявки 91.00",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-02" } },
    async ({ page }) => {
      const author = await createUatUser("hist02-author", "Anna Author");
      await addToDepartment(author, PRIMARY);
      let id = "";

      await given("закупівля з двома рядками: кількість 3 за ціною 20.00 і кількість 2 за ціною 15.50", async () => {
        id = await submitPurchaseAs(author, PRIMARY, [
          { name: "Paper A4", quantity: 3, unitPrice: 20 },
          { name: "Markers", quantity: 2, unitPrice: 15.5 },
        ]);
      });

      await when("автор відкриває заявку", async () => {
        await loginAs(page, author);
        await page.goto(`/requests/${id}`);
      });

      await thenStep(
        page,
        {
          clause: "суми рядків 60.00 і 31.00, а сума заявки 91.00",
          visible: ["у таблиці рядків: суми рядків $60.00 і $31.00", "сума заявки $91.00 під підписом «Request total»"],
        },
        async () => {
          await expect(lineRow(page, 1)).toContainText("$60.00");
          await expect(lineRow(page, 2)).toContainText("$31.00");
          await expect(page.getByTestId("request-total")).toHaveText("$91.00");
        },
      );
    },
  );

  test(
    "AC-HIST-06: працівник 1 подав закупівлю у відділ «Початкова школа» і відкриває її історію — в історії є запис «Подано» з його іменем і датою та часом за часом America/New_York",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-06" } },
    async ({ page }) => {
      const worker = await createUatUser("hist06-worker", "Anna Author");
      await addToDepartment(worker, PRIMARY);
      let id = "";

      await given("працівник 1 подав закупівлю у відділ «Primary School»", async () => {
        id = await submitPurchaseAs(worker, PRIMARY, [PAPER]);
      });

      await when("він відкриває історію цієї заявки", async () => {
        // Вищий екран: картка «History» лежить нижче «Details» і «Lines», на 800 px її не було в кадрі «Тоді».
        await page.setViewportSize({ width: 1280, height: 1400 });
        await loginAs(page, worker);
        await page.goto(`/requests/${id}`);
      });

      await thenStep(
        page,
        {
          clause: "в історії є запис «Подано» з його іменем і датою та часом за часом America/New_York",
          visible: ["у картці «History» запис «Submitted · Anna Author · ДД.ММ.РРРР, ГГ:ХХ» (час New York, 24 години, без позначки поясу)"],
          hidden: ["час запису — поточний момент за America/New_York (відхилення не більше 5 хвилин)"],
        },
        async () => {
          const history = page.getByTestId("history");
          const text = (await history.innerText()).replace(/\s+/g, " ");
          const match = /Submitted · Anna Author · (\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2})/.exec(text);
          expect(match, `у картці «History» немає запису «Submitted · Anna Author · дата, час»: ${text}`).not.toBeNull();
          // Незалежний еталон: явний пояс America/New_York, 24 години, формат «ДД.ММ.РРРР, ГГ:ХХ».
          const ny = new Intl.DateTimeFormat("en-GB", {
            timeZone: "America/New_York",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          });
          const expected = Array.from({ length: 6 }, (_, k) => ny.format(new Date(Date.now() - k * 60_000)).replaceAll("/", "."));
          expect(expected).toContain(match![1]);
        },
      );
    },
  );

  test(
    "AC-HIST-10: Петро схвалює лише відділ «Офіс» і відкриває за прямим посиланням історію заявки відділу «Початкова школа» з історією рішень — він бачить повідомлення «Недостатньо прав», історії не показано, а статус заявки не змінився",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-10" } },
    async ({ page }) => {
      const { author, maria } = await authorAndApprover("hist10");
      const petro = await createUatUser("hist10-petro", "Petro Approver");
      await addToDepartment(petro, OFFICE, { approver: true });
      let id = "";

      await given("Петро схвалює лише відділ «Office»; заявка відділу «Primary School» з історією рішень (Марія повернула її з причиною)", async () => {
        id = await submitPurchaseAs(author, PRIMARY, [PAPER]);
        await decideAs(maria, id, "return", { reason: "Уточніть кількість" });
        expect((await requestInfo(id)).status).toBe("returned");
      });

      await when("Петро відкриває історію цієї заявки за прямим посиланням", async () => {
        await loginAs(page, petro);
        await page.goto(`/requests/${id}`);
      });

      await thenStep(
        page,
        {
          clause: "він бачить повідомлення «Недостатньо прав», історії не показано, а статус заявки не змінився",
          visible: ["сторінка з повідомленням «Not enough permissions»", "картки «History» і даних заявки на сторінці немає"],
          hidden: ["статус заявки в базі лишається «returned»"],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("heading", { name: "Not enough permissions" })).toBeVisible();
          await expect(page.getByTestId("history")).toHaveCount(0);
          await expect(page.getByText("Уточніть кількість")).toHaveCount(0);
          // «Даних заявки немає»: ні статусу, ні таблиці рядків, ні номера й відділу заявки.
          await expect(statusOnPage(page)).toHaveCount(0);
          await expect(page.getByTestId("lines")).toHaveCount(0);
          const info = await requestInfo(id);
          const text = await page.locator("body").innerText();
          expect(text).not.toContain(`PUR-${info.number}`);
          expect(text).not.toContain(PAPER.name);
          expect(info.status).toBe("returned");
        },
      );
    },
  );
});

test.describe("підписи статусів", () => {
  test(
    "AC-LANG-09: заявки зі статусами «Частково схвалено» і «Повернено на доопрацювання» показано у списку й на сторінці заявки — статус підписано текстом «Partially approved» чи «Returned for revision», а не лише кольором",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-LANG-09" } },
    async ({ page }) => {
      const { author, maria } = await authorAndApprover("lang09");
      let partialId = "";
      let returnedId = "";
      let partialNumber = 0;
      let returnedNumber = 0;

      await given("заявки зі статусами «Partially approved» і «Returned for revision»", async () => {
        partialId = await submitPurchaseAs(author, PRIMARY, [PAPER, MARKERS]);
        await decideAs(maria, partialId, "approve", { rejectedLinePositions: [2] });
        returnedId = await submitPurchaseAs(author, PRIMARY, [FOLDERS]);
        await decideAs(maria, returnedId, "return", { reason: "Уточніть кількість" });
        partialNumber = (await requestInfo(partialId)).number;
        returnedNumber = (await requestInfo(returnedId)).number;
      });

      await when("автор відкриває список «Мої заявки» і сторінки цих заявок", async () => {
        await loginAs(page, author);
        await page.goto("/requests");
      });

      await thenStep(
        page,
        {
          clause: "статус підписано текстом «Partially approved» чи «Returned for revision» відповідно, а не лише кольором",
          visible: [
            `у списку «My requests» рядок PUR-${partialNumber} зі статусом «Partially approved», рядок PUR-${returnedNumber} зі статусом «Returned for revision»`,
          ],
          hidden: ["на сторінці кожної заявки статус біля заголовка підписано тим самим текстом"],
        },
        async () => {
          const rows = page.getByTestId("my-requests").getByTestId("request-row");
          await expect(rows.filter({ hasText: `PUR-${partialNumber}` })).toContainText("Partially approved");
          await expect(rows.filter({ hasText: `PUR-${returnedNumber}` })).toContainText("Returned for revision");
          await page.goto(`/requests/${partialId}`);
          await expect(statusOnPage(page)).toHaveText("Partially approved");
          await page.goto(`/requests/${returnedId}`);
          await expect(statusOnPage(page)).toHaveText("Returned for revision");
          // Кадр-доказ — список: повертаємося до нього, бо «Тоді» про те, як заявки показано у списку.
          await page.goto("/requests");
        },
      );
    },
  );
});
