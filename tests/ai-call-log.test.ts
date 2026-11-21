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

function fakeSupabase(insert: ReturnType<typeof vi.fn>) {
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as never, from };
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
    const insert = vi.fn().mockResolvedValue({ error: null });
    const { client, from } = fakeSupabase(insert);
    const state = await recordAiCall(client, base({ kind: "unavailable", reason: "limit", message: `The assistant is unavailable today ${USER_TEXT}` }));
    expect(state).toBe("unavailable");
    expect(from).toHaveBeenCalledWith("ai_call_log");
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toEqual({
      state: "unavailable",
      error_kind: "limit",
      model: "google/gemma-4-31b-it:free",
      fallback_used: false,
      latency_ms: 1830,
      prompt_version: "suggest-v2",
    });
    const json = JSON.stringify(row);
    for (const marker of ["olena", "secret-note", "unavailable today", "A4 paper"]) expect(json).not.toContain(marker);
  });

  it("позначає fallback, коли відповіла не перша модель, і не пише в базу, коли виклику не було", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const { client } = fakeSupabase(insert);
    await recordAiCall(client, { ...base(line), model: "nvidia/nemotron-3.5-super-vl:free" });
    expect((insert.mock.calls[0][0] as { fallback_used: boolean }).fallback_used).toBe(true);
    insert.mockClear();
    expect(await recordAiCall(client, base({ kind: "forbidden" }))).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("збій запису в базу не кидає виняток: помічник відповідає далі", async () => {
    const insert = vi.fn().mockRejectedValue(new Error(`insert failed for ${USER_TEXT}`));
    const { client } = fakeSupabase(insert);
    await expect(recordAiCall(client, base(line))).resolves.toBe("ok");
  });
});
