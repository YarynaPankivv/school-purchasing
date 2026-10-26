"use client";

// Кнопка «Add department» і форма, що відкривається під нею: створення відділу — рідка дія, тож постійної картки
// зі формою на сторінці немає. Esc і клік поза формою закривають її; після створення (кількість відділів змінилась)
// форма закривається сама. Сама дія — серверна `createDepartment`; помилку покаже банер сторінки.
import { useEffect, useId, useRef, useState } from "react";
import { Button, Field, Icon, Input, SubmitButton } from "@/components/ui";
import { DEPARTMENT_NAME_MAX } from "@/lib/org/departments";
import { createDepartment } from "../actions";

export function AddDepartment({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(count);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const hintId = `${panelId}-hint`;
  // Закрили з клавіатури — фокус повертається на кнопку, а не зникає разом із полем (інакше Tab починається з початку сторінки).
  const closeToTrigger = () => {
    setOpen(false);
    root.current?.querySelector("button")?.focus();
  };

  // Відділ додано (список виріс) — закриваємо форму, не чекаючи кліку.
  if (seenCount !== count) {
    setSeenCount(count);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeToTrigger();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // self-end: у рядку заголовка кнопка стоїть по низу блоку «заголовок + підзаголовок», на лінії підзаголовка.
    <div ref={root} className="relative self-end">
      <Button
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="h-8 gap-1.5! px-3! py-0!"
      >
        <Icon name="plus" className="size-3.5" />
        Add department
      </Button>
      {open ? (
        <div
          id={panelId}
          className="anim-pop absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-card"
        >
          <form action={createDepartment} className="flex flex-col gap-4">
            <Field
              label="Department name"
              hint={`Up to ${DEPARTMENT_NAME_MAX} characters, no duplicates.`}
              hintId={hintId}
            >
              <Input name="name" required autoFocus maxLength={DEPARTMENT_NAME_MAX} aria-describedby={hintId} />
            </Field>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={closeToTrigger}>
                Cancel
              </Button>
              <SubmitButton>Create department</SubmitButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
