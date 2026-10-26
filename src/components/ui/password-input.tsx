"use client";

// Поле пароля з кнопкою «Show/Hide»: на телефоні легко помилитись у чужій клавіатурі, тож пароль можна побачити.
// Кнопка — окремий елемент поруч із полем, не частина підпису (aria-pressed показує стан).
import { useState, type InputHTMLAttributes } from "react";
import { cn } from "./cn";
import { Input } from "./input";

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <Input type={visible ? "text" : "password"} className={cn("pr-16", className)} {...props} />
      <button
        type="button"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 inline-flex items-center rounded-r-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </span>
  );
}
