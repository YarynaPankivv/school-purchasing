import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Безкоштовні моделі з'являються й зникають: перед роботою — `npm run ai:models`, ланцюжок перевіряє живий прогін
// `npm run eval`. Порядок = пріоритет. Лише ID із `:free`: платна модель у списку fallback оплачується за її ціною.
//   gemma-4-31b / gemma-4-26b — найкраща заявка на багатомовність; НЕ мають structured_outputs: json_schema може бути
//     проігноровано, тому поля повторено в промпті, а zod — ворота (відповідь не за схемою = invalid_output).
//   nemotron-3.5-super-vl     — строга схема (structured_outputs).
export const PRODUCT_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
] as const;

// Фабрика приймає ключ параметром і НЕ читає process.env: так її можна імпортувати в eval-скрипті.
// У коді застосунку модель бере лише src/lib/ai/openrouter.ts (server-only).
export function makeProductModel(apiKey: string | undefined) {
  const openrouter = createOpenRouter({ apiKey, appName: "School Purchasing" });
  return openrouter.chat(PRODUCT_MODELS[0], {
    // OpenRouter пробує наступну модель при помилці, ліміті постачальника або простої.
    // Платформний ліміт безкоштовних моделей (20/хв, 50/день на акаунт) ланцюжок НЕ обходить.
    models: [...PRODUCT_MODELS],
    // Портативний параметр `reasoning` з AI SDK 7 цей провайдер не передає — лише його власний.
    reasoning: { effort: "low", exclude: true },
  });
}
