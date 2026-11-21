import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { failureToSuggestResult, proposeDraft, toSuggestResult } from "@/lib/ai/draft";
import { DRAFT_INSTRUCTIONS, DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { passRate, scoreCase, type GoldenCase } from "../evals/scorer";
import casesJson from "./fixtures/golden/cases.json";
import holdoutJson from "./fixtures/golden/holdout.json";
import recordedJson from "./fixtures/golden/recorded-holdout.json";

// Власний контрольний набір (holdout) — фідбек WS10, пропозиція 4. Предмети й мета в ньому інші, ніж у промпті й у golden cases PM,
// тож частка успіху тут показує, як помічник справляється з описом, під який приклади не підбирали. Офлайн-реплей перевіряє КОД
// навколо моделі на записаних відповідях (як tests/golden.test.ts); якість моделі міряє живий прогін `SET=holdout npm run eval`.
// Назви тестів без AC ID: це наш контрольний набір, а не критерій приймання PM (інакше ac:coverage покаже ORPHAN).

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
const holdout = holdoutJson as GoldenCase[];
const golden = casesJson as GoldenCase[];
const recorded = recordedJson as Record<string, Recording>;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function replay(text: string, modelId: string) {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

async function replayCase(c: GoldenCase) {
  const rec = recorded[String(c.id)];
  const result = await proposeDraft({ text: c.input }, replay(rec.text, rec.modelId));
  const suggestion = result.ok ? toSuggestResult(result.draft) : failureToSuggestResult(result);
  return { result, mismatches: scoreCase(c.expected, suggestion).mismatches };
}

describe("holdout: власний контрольний набір", () => {
  it("не збігається з golden cases PM і не підказаний промптом: ні вхід, ні очікувані слова в інструкції", () => {
    const goldenInputs = new Set(golden.flatMap((c) => [c.input, ...(c.variants ?? [])]));
    // Варіанти кейсу № 8 PM (201, 202) — це навмисно варіанти golden, їх не рахуємо збігом із набором.
    const own = holdout.filter((c) => c.id < 200 || c.id >= 300);
    expect(own.filter((c) => goldenInputs.has(c.input)).map((c) => c.id)).toEqual([]);
    const prompt = DRAFT_INSTRUCTIONS.toLowerCase();
    // Ціле слово, а не підрядок: «art» не має «знаходитись» у «starts».
    const leaked = holdout
      .flatMap((c) => (c.expected.kind === "line" ? [c.expected.nameIncludes, c.expected.purposeIncludes] : []))
      .filter((word) => new RegExp(`\\b${word.toLowerCase()}\\b`).test(prompt));
    expect(leaked).toEqual([]);
  });

  it("кожен кейс має запис, записаний поточною версією промпту", () => {
    const missing = holdout.map((c) => c.id).filter((id) => !recorded[String(id)]);
    expect(missing).toEqual([]);
    const stale = Object.entries(recorded)
      .filter(([, r]) => r.promptVersion !== DRAFT_PROMPT_VERSION)
      .map(([id]) => id);
    // Змінили DRAFT_PROMPT_VERSION — перезапишіть записи живим прогоном (SET=holdout RECORD=1 npm run eval).
    expect(stale).toEqual([]);
  });

  it("офлайн-реплей записів: код навколо моделі дає очікуване, частка успіху рахується окремо від golden", async () => {
    const rows = [];
    for (const c of holdout.filter((x) => recorded[String(x.id)])) {
      const outcome = await replayCase(c);
      expect(outcome.result.ok, `кейс ${c.id}`).toBe(true);
      rows.push({ pass: outcome.mismatches.length === 0 });
    }
    expect(rows.length).toBeGreaterThan(0);
    // Записуємо лише успішні відповіді (RECORD=1), тож усі записані кейси проходять; частка від усіх кейсів — у звіті живого прогону.
    expect(passRate(rows).rate).toBe(1);
  });
});
