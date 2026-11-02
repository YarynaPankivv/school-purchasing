// eslint.config.mjs шаблону курсу + блоки WS8 (джерело — демо-репо курсу: теги ws8-01-gates і ws8-03-uat).
// Якщо ваш eslint.config.mjs не відрізняється від шаблону (git diff нічого не показує) — замініть файл цілком.
// Якщо ви його змінювали — перенесіть три блоки з позначкою «WS8» і рядки в globalIgnores.
// Потрібні devDependencies: @vitest/eslint-plugin@1.6.27 і eslint-plugin-playwright@2.12.1.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import vitest from "@vitest/eslint-plugin";
import playwright from "eslint-plugin-playwright";

// AC ID, як його читає ac:coverage (scripts/lib/spec-lib.mjs): лише на початку назви тесту.
const AC = String.raw`AC-[A-Z]+-\d+`;
// Власні модулі, які не мокаємо: src/lib/** (крім адаптерів src/lib/supabase/**) і src/app/** — через аліас
// (@/lib/…, @/app/…) або відносним шляхом (../../src/lib/…). У регулярному виразі esquery не може бути «/», тому
// роздільник — «.».
const OWN_MODULE = String.raw`/^(@|.*src).(lib.(?!supabase([^A-Za-z0-9_-]|$))[A-Za-z0-9_-]|app([^A-Za-z0-9_-]|$))/`;
const NO_OWN_MOCK =
  "Не мокайте власні модулі (src/lib/**, src/app/**) — тестуйте справжній код: SQL/RLS на PGlite, " +
  "введення-виведення — через передані залежності. Мок клієнта Supabase (@/lib/supabase/*) дозволено.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // WS8 · Тести Vitest: вимкнений, сфокусований, порожній чи умовний тест — помилка, а не попередження.
  // `npm run lint` має --max-warnings 0 в обов'язковому job app, тож «warn» тут теж валив би CI — пишемо чесно error.
  {
    files: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      // .skip / .todo ховають AC від перевірки (у recommended — warn).
      "vitest/no-disabled-tests": "error",
      // AC ID — лише на початку назви: «… AC-ROOM-04 …» посередині ac:coverage не порахує.
      "vitest/valid-title": [
        "error",
        { mustNotMatch: [String.raw`^(?!${AC}).*\b${AC}`, "AC ID — на самому початку назви тесту, інакше ac:coverage його не порахує."] },
      ],
      // Тест, що розгалужується, сам вирішує, чи щось перевіряти.
      "vitest/no-conditional-in-test": "error",
      "vitest/no-conditional-expect": "error",
      // expect(value, "пояснення") — коректний Vitest.
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      // Помічники на кшталт expectNoInvite() теж перевірки.
      "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*"] }],
      // rejects.toThrow() без тексту проходить на БУДЬ-ЯКІЙ помилці (одруківка в SQL, немає grant), а не на відмові з AC.
      "vitest/require-to-throw-message": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.value=${OWN_MODULE}]`,
          message: NO_OWN_MOCK,
        },
        {
          // vi.mock(import("@/lib/…")) — та сама заборона для форми з import().
          selector: `CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.source.value=${OWN_MODULE}]`,
          message: NO_OWN_MOCK,
        },
      ],
    },
  },
  // WS8 · E2E/UAT (Playwright) — лише tests/e2e/**. Правила recommended закривають те, чого Playwright не має сам:
  // тест без перевірки (expect-expect), пропущений чи сфокусований тест, waitForTimeout і networkidle.
  // lint іде з --max-warnings 0, тож і «warn» тут — червоний app.
  {
    ...playwright.configs["flat/recommended"],
    files: ["tests/e2e/**"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // Перевірки AC живуть у thenStep(…) (tests/e2e/support/uat.ts): він і є expect для цього правила.
      "playwright/expect-expect": ["error", { assertFunctionNames: ["thenStep"] }],
    },
  },
  // WS8 · НЕОБОВ'ЯЗКОВО: правила з інформацією про типи для коду застосунку (забута await у server action, неповний
  // switch за роллю). У демо — 0 знахідок, але на вашому src/ можуть бути знахідки, і тоді обов'язковий app стане
  // червоним. Вмикайте окремим PR, коли готові виправити все, що вони знайдуть.
  // {
  //   files: ["src/**/*.{ts,tsx}"],
  //   languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  //   rules: {
  //     "@typescript-eslint/no-floating-promises": "error",
  //     "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  //     "@typescript-eslint/switch-exhaustiveness-check": "error",
  //   },
  // },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Дані для тестів скриптів (навмисно «зламані» файли).
    "tests/fixtures/**",
    // WS8 · Звіти й тимчасові копії інструментів якості (ESLint не читає .gitignore): покриття, Stryker (звіт і
    // пісочниця), кеш і копії мутантів fallow, звіти, відео й траси Playwright, сесії тестових ролей.
    "coverage/**",
    "reports/**",
    ".stryker-tmp/**",
    ".fallow/**",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    "playwright/.auth/**",
  ]),
]);

export default eslintConfig;
