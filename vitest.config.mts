import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8: аліас @/* з tsconfig.json без окремого плагіна.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // Тест без жодної перевірки (порожній it("AC-…", () => {})) падає: ac:coverage рахує тест, тож він має щось перевіряти.
    // Рахуються лише expect(…); assert із vitest чи node:assert — ні (такий тест теж падає).
    expect: { requireAssertions: true },
    // Лише *.test.ts(x): ac:coverage рахує тести тільки з цих файлів (*.spec.ts тут не запускається).
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // tests/fixtures — дані для тестів скриптів; файли *.test.ts там НЕ запускаються.
    exclude: ["node_modules/**", "tests/fixtures/**"],
  },
});
