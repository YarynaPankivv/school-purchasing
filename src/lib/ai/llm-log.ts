// Журнал AI-функції: один рядок JSON `llm.call` на кожен виклик моделі — модель, затримка, токени, стан, fallback,
// версія промпту, id запиту. БЕЗ тексту користувача, промпту й відповіді моделі: таких полів у схемі просто немає,
// а дозволені поля мають вузький формат (див. src/lib/log.ts).
// Куди: src/lib/ai/llm-log.ts у вашому репо (поруч із кодом AI-функції з WS10). Тест: tests/llm-log.test.ts.
// Завдання README: B (журнал AI-функції llm.call без тексту користувача і тест на це). Секретів не потребує.
// Джерело: набір ops-kit WS11; стани — ті самі, що в схемі WS10 (ok / needs_info / refused) + unavailable.
//
// Приклад рядка в Runtime Logs Vercel:
// {"event":"llm.call","ts":"2026-11-09T10:15:00.000Z","requestId":"3f0c…","route":"/requests/new",
//  "model":"google/gemma-4-31b-it:free","fallbackUsed":false,"state":"ok","latencyMs":1830,"inputTokens":612,
//  "outputTokens":144,"promptVersion":"draft-v1"}
// Де викликати в коді WS10 — materials/ops-kit/README.md, розділ «llm.call у коді AI-функції WS10».
import { logEvent, type LogSchema } from "@/lib/log";

/** ok / needs_info / refused — відповідь моделі за схемою; unavailable — відповіді немає (ліміт, таймаут, збій). */
export const LLM_STATES = ["ok", "needs_info", "refused", "unavailable"] as const;
export type LlmState = (typeof LLM_STATES)[number];

export type LlmCall = {
  /** id запиту, щоб зв'язати рядок з іншими подіями цього запиту (напр. crypto.randomUUID()). */
  requestId: string;
  /** маршрут-шаблон, не адреса з параметрами: "/requests/new", "/requests/[id]". */
  route: string;
  /** id моделі, яка відповіла (або перша в ланцюжку, якщо відповіді немає). */
  model: string;
  /** відповіла не перша модель ланцюжка. */
  fallbackUsed: boolean;
  state: LlmState;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** вартість у USD, якщо постачальник її повернув (для :free — 0). */
  costUsd?: number;
  /** версія промпту, напр. DRAFT_PROMPT_VERSION = "draft-v1". */
  promptVersion: string;
  /** КОД причини (rate_limited, timeout, invalid_output, provider_error), ніколи не текст повідомлення про помилку. */
  errorKind?: string;
};

/** Схема llm.call: єдиний список полів, які взагалі можуть потрапити в журнал. */
export const LLM_CALL_SCHEMA = {
  requestId: "token",
  route: "path",
  model: "token",
  fallbackUsed: "boolean",
  state: LLM_STATES,
  latencyMs: "int",
  inputTokens: "int",
  outputTokens: "int",
  costUsd: "number",
  promptVersion: "token",
  errorKind: "token",
} as const satisfies LogSchema;

/** Пише рядок llm.call: unavailable — рівнем error (видно у фільтрі level:error), решта — info. Повертає рядок. */
export function logLlmCall(call: LlmCall): string {
  return logEvent("llm.call", call, LLM_CALL_SCHEMA, call.state === "unavailable" ? "error" : "info");
}

/** Порівнює моделі без суфікса ":free": формат id у відповіді постачальника може відрізнятися від запитаного. */
export function isFallback(answeredModel: string, primaryModel: string): boolean {
  const strip = (id: string) => id.replace(/:free$/, "");
  return strip(answeredModel) !== strip(primaryModel);
}
