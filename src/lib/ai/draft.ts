import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { AI_MESSAGES, AI_SERVER_TIMEOUT_MS } from "./messages";
import { DRAFT_INSTRUCTIONS, wrapDocument } from "./prompts/draft";
import { DraftSchema, type Draft } from "./schema";
import { parseQuantity, parseUnitPrice } from "@/lib/pur/lines";

// Чиста функція: модель передають параметром (design.md D3 зміни impl-ai-helper). Застосунок передає модель OpenRouter
// (src/lib/ai/openrouter.ts), тести — MockLanguageModelV4 із записаною відповіддю. Тут немає `import "server-only"` і
// немає process.env, тому Vitest може імпортувати цей файл.

export type DraftInput = { text: string };

export type DraftFailure = "invalid_output" | "rate_limited" | "timeout" | "provider_error";

export type DraftResult =
  | { ok: true; draft: Draft; modelId: string }
  | { ok: false; reason: DraftFailure; message: string };

export type DraftOptions = { maxRetries?: number; timeoutMs?: number };

export async function proposeDraft(input: DraftInput, model: LanguageModel, opts: DraftOptions = {}): Promise<DraftResult> {
  try {
    const result = await generateText({
      model,
      instructions: DRAFT_INSTRUCTIONS, // `system` в AI SDK 7 застаріле
      messages: [{ role: "user", content: [{ type: "text", text: wrapDocument(input.text) }] }],
      output: Output.object({ name: "draft", schema: DraftSchema }), // generateObject застарілий
      temperature: 0,
      // На безкоштовному тарифі повтор витрачає той самий денний ліміт: 0–1, не типові 2.
      maxRetries: opts.maxRetries ?? 0,
      timeout: opts.timeoutMs ?? AI_SERVER_TIMEOUT_MS,
    });
    // result.output уже перевірено за DraftSchema (інакше — виняток NoObjectGeneratedError).
    return { ok: true, draft: result.output, modelId: result.response.modelId };
  } catch (error) {
    return classifyError(error);
  }
}

export function classifyError(error: unknown): Extract<DraftResult, { ok: false }> {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) {
    return { ok: false, reason: "invalid_output", message: "model output did not match the schema" };
  }
  if (APICallError.isInstance(cause)) {
    // OpenRouter може відповісти HTTP 200 з тілом `error`; провайдер тоді кидає statusCode 200 + data.
    const code = cause.statusCode === 200 ? (cause.data as { code?: unknown } | undefined)?.code : cause.statusCode;
    // 402 — вичерпано безкоштовний ліміт чи кредити: для працівника це той самий стан «ліміт» (AC-AI-05).
    if (code === 429 || code === "429" || code === 402 || code === "402") {
      return { ok: false, reason: "rate_limited", message: "free-model limit reached, try later" };
    }
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return { ok: false, reason: "timeout", message: "model did not answer in time" };
  }
  return { ok: false, reason: "provider_error", message: cause instanceof Error ? cause.message : String(cause) };
}

// Результат для інтерфейсу: тексти — дослівно з AC PM (src/lib/ai/messages.ts).
export type SuggestResult =
  | { kind: "line"; line: { name: string; purpose: string; quantity: number; unitPrice: number } }
  | { kind: "not_purchase"; message: string }
  | { kind: "instruction"; message: string }
  | { kind: "invalid_field"; message: string }
  | { kind: "unavailable"; reason: "timeout" | "limit" | "error"; message: string }
  | { kind: "forbidden" };

export const unavailable = (reason: "timeout" | "limit" | "error"): SuggestResult => ({
  kind: "unavailable",
  reason,
  message: reason === "limit" ? AI_MESSAGES.limit : AI_MESSAGES.timeout,
});

// Правила, які можна перевірити кодом, — тут, а не лише в промпті: ціле від 1 і ціна від 0 (ті самі, що в ручному введенні).
export function toSuggestResult(draft: Draft): SuggestResult {
  if (draft.status === "refused") {
    return draft.refusal === "instruction"
      ? { kind: "instruction", message: AI_MESSAGES.instruction }
      : { kind: "not_purchase", message: AI_MESSAGES.notPurchase };
  }
  // Межі перевіряємо й для needs_info: модель могла назвати кількість, а мети в описі немає (golden 5, 6, 7).
  if (draft.quantity !== null && !parseQuantity(draft.quantity).ok) return { kind: "invalid_field", message: AI_MESSAGES.invalidQuantity };
  if (draft.unitPrice !== null && !parseUnitPrice(draft.unitPrice).ok) return { kind: "invalid_field", message: AI_MESSAGES.invalidPrice };
  // Чого бракує в описі, AI не вигадує: неповний рядок у форму не потрапляє (питання AI — наступна версія).
  const name = draft.name?.trim();
  const purpose = draft.purpose?.trim();
  // Пробільні назва чи мета — не заповнене поле (спільний парсер зробив би їх null при збереженні).
  if (draft.status !== "ok" || !name || !purpose || draft.quantity === null || draft.unitPrice === null) {
    return unavailable("error");
  }
  return { kind: "line", line: { name, purpose, quantity: draft.quantity, unitPrice: draft.unitPrice } };
}

// Збій виклику → стан із AC PM: ліміт — AC-AI-05; таймаут і решта збоїв — AC-AI-04 (форма лишається доступною для ручного введення).
export function failureToSuggestResult(failure: Extract<DraftResult, { ok: false }>): SuggestResult {
  if (failure.reason === "rate_limited") return unavailable("limit");
  return unavailable(failure.reason === "timeout" ? "timeout" : "error");
}
