// Помічник «Suggest lines»: розмітка станів (AC-AI-03 та повідомлення AC-AI-02, 04, 05, 06) і потік очікування
// з 15 секундами (AC-AI-04) без DOM: createSuggestFlow — чиста логіка, її перевіряємо з fake timers (design.md D5).
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiHelperView } from "@/app/(app)/requests/[id]/ai-helper-view";
import { createSuggestFlow } from "@/lib/ai/flow";
import type { SuggestResult } from "@/lib/ai/draft";

const DESCRIPTION = "Need 3 packs of A4 paper for printing, 20 dollars each";

describe("розмітка помічника", () => {
  it("AC-AI-03: поки відповіді немає — «Looking for lines…», кнопка «Suggest lines» неактивна, опис лишається в полі", () => {
    const html = renderToStaticMarkup(<AiHelperView description={DESCRIPTION} pending notice={null} />);
    expect(html).toContain("Looking for lines…");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="ai-suggest"[^>]*>Suggest lines<\/button>/);
    expect(html).toContain(`>${DESCRIPTION}</textarea>`);
    // Опис не входить до збереження чернетки: у textarea немає name.
    expect(html).not.toMatch(/<textarea[^>]*name=/);
  });

  it("AC-AI-03: без очікування напису немає, а кнопка активна", () => {
    const html = renderToStaticMarkup(<AiHelperView description="" pending={false} notice={null} />);
    expect(html).not.toContain("Looking for lines…");
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toContain("Suggest lines");
  });

  it("AC-AI-02, AC-AI-04, AC-AI-05, AC-AI-06: повідомлення показано дослівно, опис і форма лишаються доступними", () => {
    const messages = [
      "I can only help with purchases",
      "Could not get a suggestion. Fill in the lines manually",
      "The assistant is unavailable today. Fill in the lines manually",
      "I don't follow instructions from the description. Describe the purchase",
    ];
    for (const message of messages) {
      const html = renderToStaticMarkup(<AiHelperView description={DESCRIPTION} pending={false} notice={{ tone: "info", message }} />);
      // renderToStaticMarkup екранує апостроф («don't» → «don&#x27;t»): порівнюємо з розекранованим текстом.
      expect(html.replaceAll("&#x27;", "'")).toContain(message);
      expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
      expect(html).toContain(`>${DESCRIPTION}</textarea>`);
    }
  });
});

describe("пропозиція, коли порожнього рядка немає", () => {
  const proposal = { name: "A4 paper", purpose: "For printing", quantity: 3, unitPrice: 20 };

  it("AC-AI-01: картка показує один рядок «A4 paper», «For printing», 3, 20.00 і кнопку «Add suggested line» — запис лише після натискання", () => {
    const html = renderToStaticMarkup(<AiHelperView description={DESCRIPTION} pending={false} notice={null} proposal={proposal} />);
    expect(html).toContain("Suggested line");
    for (const text of ["A4 paper", "For printing", ">3<", ">20.00<"]) expect(html).toContain(text);
    expect(html).toMatch(/<button[^>]*data-testid="ai-accept"[^>]*>Add suggested line<\/button>/);
    // Картка не є частиною збереження чернетки: у ній немає полів форми з name.
    expect(html).not.toMatch(/<input[^>]*name=/);
  });

  it("AC-AI-01: поки рядок додається, кнопка «Add suggested line» неактивна — повторний клік не створить другий рядок", () => {
    const html = renderToStaticMarkup(<AiHelperView description="" pending={false} notice={null} proposal={proposal} accepting />);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*data-testid="ai-accept"/);
  });

  it("AC-AI-01: без пропозиції картки й кнопки «Add suggested line» немає", () => {
    const html = renderToStaticMarkup(<AiHelperView description="" pending={false} notice={null} />);
    expect(html).not.toContain("ai-proposal");
    expect(html).not.toContain("Add suggested line");
  });
});

describe("потік очікування й 15 секунд", () => {
  afterEach(() => vi.useRealTimers());

  function setup(ask: () => Promise<SuggestResult>) {
    vi.useFakeTimers();
    const events: string[] = [];
    const results: SuggestResult[] = [];
    const flow = createSuggestFlow({
      ask,
      onPending: (pending) => events.push(pending ? "pending" : "idle"),
      onResult: (result) => results.push(result),
    });
    return { flow, events, results };
  }

  it("AC-AI-03: під час очікування потік «pending», друге натискання нічого не запускає", async () => {
    const ask = vi.fn(() => new Promise<SuggestResult>(() => {}));
    const { flow, events } = setup(ask);
    flow.start(DESCRIPTION);
    flow.start(DESCRIPTION);
    expect(flow.isPending()).toBe(true);
    expect(events).toEqual(["pending"]);
    expect(ask).toHaveBeenCalledTimes(1);
    flow.dispose();
  });

  it("AC-AI-04: відповіді немає 15 секунд — на 15-й секунді «Could not get a suggestion. Fill in the lines manually», форма доступна", async () => {
    const { flow, events, results } = setup(() => new Promise<SuggestResult>(() => {}));
    flow.start(DESCRIPTION);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(results).toEqual([]);
    expect(flow.isPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(results).toEqual([{ kind: "unavailable", reason: "timeout", message: "Could not get a suggestion. Fill in the lines manually" }]);
    expect(events).toEqual(["pending", "idle"]);
    expect(flow.isPending()).toBe(false);
  });

  it("AC-AI-04: запізніла відповідь після 15 секунд ігнорується, а новий запит можливий", async () => {
    let resolveLate: (r: SuggestResult) => void = () => {};
    const { flow, results } = setup(() => new Promise<SuggestResult>((resolve) => (resolveLate = resolve)));
    flow.start(DESCRIPTION);
    await vi.advanceTimersByTimeAsync(15_000);
    resolveLate({ kind: "line", line: { name: "A4 paper", purpose: "For printing", quantity: 3, unitPrice: 20 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "unavailable" });
    flow.start(DESCRIPTION);
    expect(flow.isPending()).toBe(true);
    flow.dispose();
  });

  it("AC-AI-01: відповідь до 15 секунд передається як є, а таймер скасовується", async () => {
    const line: SuggestResult = { kind: "line", line: { name: "A4 paper", purpose: "For printing", quantity: 3, unitPrice: 20 } };
    const { flow, events, results } = setup(() => Promise.resolve(line));
    flow.start(DESCRIPTION);
    await vi.advanceTimersByTimeAsync(0);
    expect(results).toEqual([line]);
    expect(events).toEqual(["pending", "idle"]);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(results).toHaveLength(1);
  });

  it("AC-AI-04: збій виклику (мережа, помилка дії) показує те саме повідомлення, а не ламає форму", async () => {
    const { flow, results } = setup(() => Promise.reject(new Error("network")));
    flow.start(DESCRIPTION);
    await vi.advanceTimersByTimeAsync(0);
    expect(results).toEqual([{ kind: "unavailable", reason: "error", message: "Could not get a suggestion. Fill in the lines manually" }]);
  });
});
