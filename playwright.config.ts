// E2E і UAT — одна специфікація Playwright (tests/e2e/*.spec.ts), дві цілі:
//   UAT_BASE_URL задано  → розгорнутий застосунок (ваш прод), npm run uat: запис → кадри «Тоді» → вердикт агента → звіт;
//   UAT_BASE_URL немає   → локальна збірка (webServer: npm run build && npm run start) — так само в CI (.github/workflows/e2e.yml).
// Запис увімкнено для КОЖНОГО тесту, не лише для впалих: для PM зелений прогін — такий самий доказ, як червоний.
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Локально — значення з .env.local (DEMO_USER_PASSWORD, ключі Supabase). Файл не друкуємо й не комітимо.
// У CI .env.local немає: змінні дає workflow.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Один ідентифікатор прогону на всі проєкти й воркери: синтетичні адреси uat-<run>…@example.test.
process.env.UAT_RUN ??= new Date().toISOString().replace(/\D/g, "").slice(2, 14);

const deployed = process.env.UAT_BASE_URL?.replace(/\/+$/, "");
const baseURL = deployed ?? "http://localhost:3000";
// Негативні контролі (навмисно хибні очікування) — лише на окреме прохання: UAT_NEGATIVE_CONTROLS=1.
const withNegativeControls = process.env.UAT_NEGATIVE_CONTROLS === "1";
const noRecording = { video: "off", trace: "off", screenshot: "off" } as const;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "test-results/artifacts",
  forbidOnly: !!process.env.CI,
  // Повтор на розгорнутому застосунку може вдруге створити дані, а доказом має бути перша спроба.
  retries: 0,
  // По одному сценарію: читабельні відео, без гонок за спільні акаунти.
  workers: 1,
  timeout: 60_000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/html", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    locale: "uk-UA",
    timezoneId: "Europe/Kyiv",
    viewport: { width: 1280, height: 800 },
    video: {
      mode: "on",
      size: { width: 1280, height: 800 },
      // У відео видно назву тесту (AC ID) і поточний крок «Тоді: …». Перед кадром-доказом ці накладки ховаємо
      // (tests/e2e/support/uat.ts): інакше на кадрі «видно» текст, якого застосунок не показував.
      show: { actions: { position: "top-right" }, test: { level: "step", position: "top-left" } },
    },
    trace: { mode: "on", snapshots: { dom: true, aria: true, screen: true } },
    screenshot: "on",
  },
  projects: [
    // Вхід ролей один раз → playwright/.auth/<role>.json (у .gitignore). Без запису: тут вводиться пароль.
    { name: "setup", testMatch: /auth\.setup\.ts$/, teardown: "cleanup", use: noRecording },
    // Прибирання після всіх тестів: видаляє синтетичних uat-*@example.test і перевіряє, що нічого не лишилось.
    { name: "cleanup", testMatch: /cleanup\.teardown\.ts$/, use: noRecording },
    { name: "chromium", dependencies: ["setup"], grepInvert: /@negative-control/ },
    ...(withNegativeControls
      ? [{ name: "negative-controls", dependencies: ["setup"], grep: /@negative-control/ }]
      : []),
  ],
  webServer: deployed
    ? undefined
    : {
        // У CI (e2e.yml) застосунок уже зібрано окремим кроком — лише запускаємо.
        command: process.env.CI ? "npm run start" : "npm run build && npm run start",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
});
