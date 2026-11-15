"use client";

// Помічник «Запропонувати рядки» (AC-AI-01…06; design.md D1, D4, D5 зміни impl-ai-helper): автор вставляє вільний опис,
// AI пропонує один рядок, а автор сам перевіряє його й вирішує, чи подавати закупівлю. Опис ніколи не очищується.
// Пропозиція лише заповнює поля форми (перший порожній рядок; немає порожнього — картка з кнопкою «Додати рядок», яка викликає addLineWithValues);
// закупівлю не подаємо й автоматично не зберігаємо. Потік очікування й 15 секунд — src/lib/ai/flow.ts.
import { useEffect, useRef, useState } from "react";
import { AI_MESSAGES, AI_UI } from "@/lib/ai/messages";
import { createSuggestFlow } from "@/lib/ai/flow";
import type { SuggestResult } from "@/lib/ai/draft";
import { addLineWithValues, suggestLine } from "./ai-actions";
import { AiHelperView, type Notice, type Proposal } from "./ai-helper-view";

const FIELDS = ["name", "purpose", "quantity", "unit_price"] as const;

// Значення вставляємо так, ніби автор ввів їх сам: подія input потрібна живій сумі рядка (live-line-total).
function setValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// Перший рядок, у якому порожні всі чотири поля (AC-PUR-01: нова чернетка має один порожній рядок).
function firstEmptyLine(form: HTMLFormElement): string | null {
  for (const hidden of form.querySelectorAll<HTMLInputElement>('input[name="line_id"]')) {
    const id = hidden.value;
    const inputs = FIELDS.map((field) => form.elements.namedItem(`line_${id}_${field}`) as HTMLInputElement | null);
    if (inputs.every((input) => input && input.value.trim() === "")) return id;
  }
  return null;
}

type Line = Extract<SuggestResult, { kind: "line" }>["line"];

function fill(form: HTMLFormElement, lineId: string, line: Line) {
  const values = [line.name, line.purpose, String(line.quantity), line.unitPrice.toFixed(2)];
  FIELDS.forEach((field, index) => {
    const input = form.elements.namedItem(`line_${lineId}_${field}`) as HTMLInputElement | null;
    if (input) setValue(input, values[index]);
  });
}

export function AiLineHelper({ requestId }: { requestId: string }) {
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [accepting, setAccepting] = useState(false);
  const acceptingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const flowRef = useRef<ReturnType<typeof createSuggestFlow> | null>(null);

  // Потік створюємо в ефекті (а не під час рендеру): він читає rootRef лише коли приходить відповідь.
  useEffect(() => {
    async function apply(result: SuggestResult) {
      if (result.kind === "line") {
        const form = rootRef.current?.closest("form");
        if (!form) return;
        const lineId = firstEmptyLine(form);
        // Порожній рядок є — заповнюємо поля форми (у БД лише після «Save»); немає — картка з підтвердженням людини.
        if (lineId) fill(form, lineId, result.line);
        else setProposal(result.line);
        setNotice(null);
        return;
      }
      if (result.kind === "forbidden") return setNotice(null);
      const tone = result.kind === "unavailable" || result.kind === "invalid_field" ? "warn" : "info";
      setNotice({ tone, message: result.message });
    }
    const flow = createSuggestFlow({
      ask: (text) => suggestLine(requestId, text),
      onPending: setPending,
      onResult: (result) => void apply(result),
    });
    flowRef.current = flow;
    return () => {
      flow.dispose();
      flowRef.current = null;
    };
  }, [requestId]);

  // Запис нового рядка в БД — лише після натискання «Додати рядок» (підтвердження людини).
  async function accept() {
    // Синхронний захист: другий клік до відповіді сервера не створює другий рядок (інакше кількість і сума подвоїлись би).
    if (!proposal || acceptingRef.current) return;
    acceptingRef.current = true;
    setAccepting(true);
    try {
      const { ok } = await addLineWithValues(requestId, proposal);
      if (ok) {
        setProposal(null);
        setNotice(null);
      } else {
        setNotice({ tone: "warn", message: AI_MESSAGES.addFailed });
      }
    } catch {
      // Пропозиція лишається для повторної спроби; форма працює вручну.
      setNotice({ tone: "warn", message: AI_MESSAGES.addFailed });
    } finally {
      acceptingRef.current = false;
      setAccepting(false);
    }
  }

  function ask() {
    const flow = flowRef.current;
    if (!flow || flow.isPending()) return;
    if (description.trim() === "") return setNotice({ tone: "warn", message: AI_UI.empty });
    setNotice(null);
    setProposal(null);
    flow.start(description);
  }

  return (
    <AiHelperView
      rootRef={rootRef}
      description={description}
      pending={pending}
      notice={notice}
      proposal={proposal}
      accepting={accepting}
      onDescription={setDescription}
      onAsk={ask}
      onAccept={() => void accept()}
    />
  );
}
