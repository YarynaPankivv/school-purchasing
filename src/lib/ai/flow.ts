// Потік «запитати → чекати → відповідь чи 15 секунд» без React і DOM (design.md D5 зміни impl-ai-helper): так його
// перевіряє unit-тест (fake timers), а компонент лише малює стан. Запізнілу відповідь (після 15 секунд чи нового запиту)
// ігноруємо: AC-AI-04 каже, що після 15-ї секунди форма вже доступна для ручного введення.
import { AI_MESSAGES, AI_WAIT_MS } from "./messages";
import type { SuggestResult } from "./draft";

export type SuggestFlowDeps = {
  ask: (description: string) => Promise<SuggestResult>;
  onPending: (pending: boolean) => void;
  onResult: (result: SuggestResult) => void;
  waitMs?: number;
  setTimer?: (handler: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
};

const failed = (reason: "timeout" | "error"): SuggestResult => ({ kind: "unavailable", reason, message: AI_MESSAGES.timeout });

export function createSuggestFlow(deps: SuggestFlowDeps) {
  const waitMs = deps.waitMs ?? AI_WAIT_MS;
  const setTimer = deps.setTimer ?? ((handler, ms) => setTimeout(handler, ms));
  const clearTimer = deps.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let attempt = 0;
  let pending = false;
  let timer: unknown = null;

  function settle(current: number, result: SuggestResult) {
    if (attempt !== current) return;
    attempt += 1;
    pending = false;
    if (timer !== null) clearTimer(timer);
    timer = null;
    deps.onPending(false);
    deps.onResult(result);
  }

  return {
    isPending: () => pending,
    start(description: string) {
      if (pending) return;
      const current = (attempt += 1);
      pending = true;
      deps.onPending(true);
      timer = setTimer(() => settle(current, failed("timeout")), waitMs);
      deps.ask(description).then(
        (result) => settle(current, result),
        () => settle(current, failed("error")),
      );
    },
    dispose() {
      attempt += 1;
      pending = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}
