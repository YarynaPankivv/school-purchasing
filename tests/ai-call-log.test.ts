// Запис викликів AI-помічника (SLO-2): стан для кожного виду відповіді, рядок у ai_call_log без тексту користувача,
// збій запису не ламає помічника. Назви без AC ID: це операційна перевірка WS11, а не критерій приймання PM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { llmStateOf, recordAiCall, type AiCallInfo } from "@/lib/ai/call-log";
import type { SuggestResult } from "@/lib/ai/draft";

const USER_TEXT = "Buy 3 packs of paper for olena.test@example.test, secret-note-123";

const line: SuggestResult = { kind: "line", line: { name: "A4 paper", purpose: "For printing", quantity: 3, unitPrice: 20 } };
const base = (result: SuggestResult): AiCallInfo => ({
  requestId: "3f0c2a9e-1b7d-4c55-9a3e-2f6d8e1c0b4a",
  route: "/requests/[id]",
  model: "google/gemma-4-31b-it:free",
  primaryModel: "google/gemma-4-31b-it:free",
  result,
  latencyMs: 1830.4,
  promptVersion: "suggest-v2",
});

// Запис іде функцією record_ai_call (rpc), а не прямим INSERT у таблицю.
function fakeSupabase(rpc: ReturnType<typeof vi.fn>) {
  return { client: { rpc } as never, rpc };
}

describe("ai_call_log (SLO-2)", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("зіставляє кожен вид відповіді зі станом llm.call", () => {
    expect(llmStateOf(line)).toBe("ok");
    expect(llmStateOf({ kind: "partial", line: { name: "Pen", purpose: null, quantity: null, unitPrice: null } })).toBe("needs_info");
    expect(llmStateOf({ kind: "invalid_field", message: "Quantity: a whole number from 1" })).toBe("needs_info");
    expect(llmStateOf({ kind: "not_purchase", message: "x" })).toBe("refused");
    expect(llmStateOf({ kind: "instruction", message: "x" })).toBe("refused");
    expect(llmStateOf({ kind: "unavailable", reason: "limit", message: "x" })).toBe("unavailable");
    expect(llmStateOf({ kind: "forbidden" })).toBeNull();
  });

  it("пише в ai_call_log лише технічні поля: без тексту користувача і повідомлень", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const { client } = fakeSupabase(rpc);
    const state = await recordAiCall(client, base({ kind: "unavailable", reason: "limit", message: `The assistant is unavailable today ${USER_TEXT}` }));
    expect(state).toBe("unavailable");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("record_ai_call");
    const row = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(row).toEqual({
      p_state: "unavailable",
      p_error_kind: "limit",
      p_model: "google/gemma-4-31b-it:free",
      p_fallback_used: false,
      p_latency_ms: 1830,
      p_prompt_version: "suggest-v2",
    });
    const json = JSON.stringify(row);
    for (const marker of ["olena", "secret-note", "unavailable today", "A4 paper"]) expect(json).not.toContain(marker);
  });

  it("позначає fallback, коли відповіла не перша модель, і не пише в базу, коли виклику не було", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const { client } = fakeSupabase(rpc);
    await recordAiCall(client, { ...base(line), model: "nvidia/nemotron-3.5-super-vl:free" });
    expect((rpc.mock.calls[0][1] as { p_fallback_used: boolean }).p_fallback_used).toBe(true);
    rpc.mockClear();
    expect(await recordAiCall(client, base({ kind: "forbidden" }))).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("без виклику моделі (немає ключа) рядок у ai_call_log є — запит входить у SLO-2, — а події llm.call немає", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const { client } = fakeSupabase(rpc);
    const info = vi.spyOn(console, "info");
    const error = vi.spyOn(console, "error");
    const state = await recordAiCall(client, { ...base({ kind: "unavailable", reason: "error", message: "x" }), latencyMs: 0, modelCalled: false });
    expect(state).toBe("unavailable");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_state: "unavailable", p_error_kind: "error", p_latency_ms: 0 });
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("збій запису в базу не кидає виняток: помічник відповідає далі", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error(`rpc failed for ${USER_TEXT}`));
    const { client } = fakeSupabase(rpc);
    await expect(recordAiCall(client, base(line))).resolves.toBe("ok");
  });
});
