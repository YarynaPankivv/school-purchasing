// Помічник «Запропонувати рядки»: розмітка станів (AC-AI-03 та повідомлення AC-AI-02, 04, 05, 06) і потік очікування
// з 15 секундами (AC-AI-04) без DOM: createSuggestFlow — чиста логіка, її перевіряємо з fake timers (design.md D5).
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiHelperView } from "@/app/(app)/requests/[id]/ai-helper-view";
import { createSuggestFlow } from "@/lib/ai/flow";
import type { SuggestResult } from "@/lib/ai/draft";

const DESCRIPTION = "Треба 3 пачки паперу А4 для друку, по 20 доларів";

describe("розмітка помічника", () => {
  it("AC-AI-03: поки відповіді немає — «Шукаю рядки…», кнопка «Запропонувати рядки» неактивна, опис лишається в полі", () => {
    const html = renderToStaticMarkup(<AiHelperView description={DESCRIPTION} pending notice={null} />);
    expect(html).toContain("Шукаю рядки…");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="ai-suggest"[^>]*>Запропонувати рядки<\/button>/);
    expect(html).toContain(`>${DESCRIPTION}</textarea>`);
    // Опис не входить до збереження чернетки: у textarea немає name.
    expect(html).not.toMatch(/<textarea[^>]*name=/);
  });

  it("AC-AI-03: без очікування напису немає, а кнопка активна", () => {
    const html = renderToStaticMarkup(<AiHelperView description="" pending={false} notice={null} />);
    expect(html).not.toContain("Шукаю рядки…");
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toContain("Запропонувати рядки");
  });

  it("AC-AI-02, AC-AI-04, AC-AI-05, AC-AI-06: повідомлення показано дослівно, опис і форма лишаються доступними", () => {
    const messages = [
      "Я допомагаю лише із закупівлями",
      "Не вдалося отримати пропозицію. Заповніть рядки вручну",
      "Помічник сьогодні недоступний. Заповніть рядки вручну",
      "Я не виконую вказівок з опису. Опишіть покупку",
    ];
    for (const message of messages) {
      const html = renderToStaticMarkup(<AiHelperView description={DESCRIPTION} pending={false} notice={{ tone: "info", message }} />);
      expect(html).toContain(message);
      expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
      expect(html).toContain(`>${DESCRIPTION}</textarea>`);
    }
  });
});

describe("пропозиція, коли порожнього рядка немає", () => {
  const proposal = { name: "Папір А4", purpose: "Для друку", quantity: 3, unitPrice: 20 };

  it("AC-AI-01: картка показує один рядок «Папір А4», «Для друку», 3, 20.00 і кнопку «Додати рядок» — запис лише після натискання", () => {
    const html = renderToStaticMarkup(<AiHelperView description={DESCRIPTION} pending={false} notice={null} proposal={proposal} />);
    expect(html).toContain("Пропозиція рядка");
    for (const text of ["Папір А4", "Для друку", ">3<", ">20.00<"]) expect(html).toContain(text);
    expect(html).toMatch(/<button[^>]*data-testid="ai-accept"[^>]*>Додати рядок<\/button>/);
    // Картка не є частиною збереження чернетки: у ній немає полів форми з name.
    expect(html).not.toMatch(/<input[^>]*name=/);
  });

  it("AC-AI-01: без пропозиції картки й кнопки «Додати рядок» немає", () => {
    const html = renderToStaticMarkup(<AiHelperView description="" pending={false} notice={null} />);
    expect(html).not.toContain("ai-proposal");
    expect(html).not.toContain("Додати рядок");
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

  it("AC-AI-04: відповіді немає 15 секунд — на 15-й секунді «Не вдалося отримати пропозицію. Заповніть рядки вручну», форма доступна", async () => {
    const { flow, events, results } = setup(() => new Promise<SuggestResult>(() => {}));
    flow.start(DESCRIPTION);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(results).toEqual([]);
    expect(flow.isPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(results).toEqual([{ kind: "unavailable", reason: "timeout", message: "Не вдалося отримати пропозицію. Заповніть рядки вручну" }]);
    expect(events).toEqual(["pending", "idle"]);
    expect(flow.isPending()).toBe(false);
  });

  it("AC-AI-04: запізніла відповідь після 15 секунд ігнорується, а новий запит можливий", async () => {
    let resolveLate: (r: SuggestResult) => void = () => {};
    const { flow, results } = setup(() => new Promise<SuggestResult>((resolve) => (resolveLate = resolve)));
    flow.start(DESCRIPTION);
    await vi.advanceTimersByTimeAsync(15_000);
    resolveLate({ kind: "line", line: { name: "Папір А4", purpose: "Для друку", quantity: 3, unitPrice: 20 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "unavailable" });
    flow.start(DESCRIPTION);
    expect(flow.isPending()).toBe(true);
    flow.dispose();
  });

  it("AC-AI-01: відповідь до 15 секунд передається як є, а таймер скасовується", async () => {
    const line: SuggestResult = { kind: "line", line: { name: "Папір А4", purpose: "Для друку", quantity: 3, unitPrice: 20 } };
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
    expect(results).toEqual([{ kind: "unavailable", reason: "error", message: "Не вдалося отримати пропозицію. Заповніть рядки вручну" }]);
  });
});
