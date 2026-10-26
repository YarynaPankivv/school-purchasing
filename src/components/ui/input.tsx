// Поля форми: Input, Textarea (DESIGN.md, розділ 5); власний Select — у select.tsx. Підпис — Label з htmlFor або Field.
import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const FIELD =
  "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground sm:py-2 sm:text-sm " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(FIELD, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, className)} {...props} />;
}

// Перемикач для дозволів і автосхвалення: той самий checkbox, стиль `.toggle` — у globals.css.
export function Switch({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="checkbox" className={cn("toggle", className)} {...props} />;
}

// Звичайний прапорець (checkbox) без власних кольорів: акцент бере з токена primary.
export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="checkbox" className={cn("size-4 accent-primary", className)} {...props} />;
}
