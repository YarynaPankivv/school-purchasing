// Запис кожного виклику AI-помічника: рядок `llm.call` у журнал Vercel (години життя) і рядок у public.ai_call_log
// (SLO-2: дні життя). Обидва — лише технічні поля без тексту користувача, промпту й відповіді моделі.
// Без `import "server-only"` і без process.env: файл можна імпортувати з тестів Vitest.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SuggestResult } from "./draft";
import { isFallback, logLlmCall, type LlmState } from "./llm-log";

/** Стан для SLO-2: unavailable — відповіді немає (ліміт, таймаут, збій), решта — модель відповіла. */
export function llmStateOf(result: SuggestResult): LlmState | null {
  switch (result.kind) {
    case "line":
      return "ok";
    case "partial":
    case "invalid_field":
      return "needs_info";
    case "not_purchase":
    case "instruction":
      return "refused";
    case "unavailable":
      return "unavailable";
    case "forbidden":
      return null; // до моделі не дійшли — виклику не було
  }
}

export type AiCallInfo = {
  requestId: string;
  route: string;
  /** id моделі, що відповіла; немає відповіді — перша модель ланцюжка. */
  model: string;
  primaryModel: string;
  result: SuggestResult;
  latencyMs: number;
  promptVersion: string;
};

/** Журнал + рядок у базі. Ніколи не кидає: збій журналу не має ламати помічника. Повертає записаний стан чи null. */
export async function recordAiCall(supabase: SupabaseClient<Database>, call: AiCallInfo): Promise<LlmState | null> {
  const state = llmStateOf(call.result);
  if (state === null) return null;
  const errorKind = call.result.kind === "unavailable" ? call.result.reason : undefined;
  const fallbackUsed = isFallback(call.model, call.primaryModel);
  try {
    logLlmCall({
      requestId: call.requestId,
      route: call.route,
      model: call.model,
      fallbackUsed,
      state,
      latencyMs: call.latencyMs,
      promptVersion: call.promptVersion,
      errorKind,
    });
    await supabase.from("ai_call_log").insert({
      state,
      error_kind: errorKind ?? null,
      model: call.model,
      fallback_used: fallbackUsed,
      latency_ms: Math.max(0, Math.round(call.latencyMs)),
      prompt_version: call.promptVersion,
    });
  } catch {
    // Навмисно нічого не пишемо: помилка запису не повинна нести ні тексту користувача, ні адрес із ключами.
  }
  return state;
}
