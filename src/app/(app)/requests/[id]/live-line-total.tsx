"use client";

// Сума рядка в редагованій заявці оновлюється під час набору (AC-PUR-06): слухаємо поля форми, а не стан сервера.
// Без скрипту лишається значення з бази, яке дала сторінка.
import { useEffect, useRef, useState } from "react";
import { formatCents, lineTotalCentsFromInput } from "@/lib/pur/totals";

export function LiveLineTotal({ lineId, initialCents }: { lineId: string; initialCents: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cents, setCents] = useState(initialCents);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const recalculate = () => {
      const quantity = form.elements.namedItem(`line_${lineId}_quantity`) as HTMLInputElement | null;
      const unitPrice = form.elements.namedItem(`line_${lineId}_unit_price`) as HTMLInputElement | null;
      setCents(lineTotalCentsFromInput(quantity?.value ?? "", unitPrice?.value ?? ""));
    };
    form.addEventListener("input", recalculate);
    return () => form.removeEventListener("input", recalculate);
  }, [lineId]);

  return (
    <span ref={ref} data-testid="line-total">
      {formatCents(cents)}
    </span>
  );
}
