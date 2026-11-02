import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8: аліас @/* з tsconfig.json без окремого плагіна.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // Тест без жодної перевірки (порожній it("AC-…", () => {})) падає: ac:coverage рахує тест, тож він має щось перевіряти.
    // Рахуються лише expect(…); assert із vitest чи node:assert — ні (такий тест теж падає).
    expect: { requireAssertions: true },
    // Лише *.test.ts(x): ac:coverage рахує тести з цих файлів і з tests/e2e/**/*.spec.ts (їх запускає Playwright, job e2e).
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // tests/fixtures — дані для тестів скриптів; файли *.test.ts там НЕ запускаються.
    // tests/e2e — територія Playwright: випадковий tests/e2e/*.test.ts упав би тут на імпортах @playwright/test.
    exclude: ["node_modules/**", "tests/fixtures/**", "tests/e2e/**"],
  },
});
