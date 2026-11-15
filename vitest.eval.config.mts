import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// `npm run eval` — живий прогін golden cases на безкоштовних моделях. Ніколи не частина `npm test` / CI:
// основний vitest.config.mts бере лише *.test.ts(x), а цей — лише evals/**/*.eval.ts.
// .env.local читаємо вбудованим node:util (без імпорту `vite`, якого немає серед залежностей проєкту).
const env = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    env, // .env.local → process.env лише для цього прогону
    fileParallelism: false, // по одному запиту: безкоштовний тариф — 20 запитів/хв
    testTimeout: 120_000,
    hookTimeout: 30_000,
    expect: { requireAssertions: true },
  },
});
