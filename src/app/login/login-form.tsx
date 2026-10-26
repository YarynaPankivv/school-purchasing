"use client";

// Форма входу. Помилка (AC-LANG-02) приходить з сервера англійською; нативну валідацію браузера вимкнено (noValidate),
// щоб порожнє поле давало наш текст «Enter your email and password.», а не повідомлення мовою браузера.
// Введений email після помилки лишається в полі: його запам'ятовуємо в sessionStorage вкладки (не в URL чи cookie).
import { useEffect, useRef, type ReactNode } from "react";
import { Alert, Field, Input, PasswordInput, SubmitButton } from "@/components/ui";

const KEY = "login-email";

export function LoginForm({
  action,
  message,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message?: string;
  children?: ReactNode;
}) {
  const email = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (message && saved && email.current && !email.current.value) email.current.value = saved;
      if (!message) sessionStorage.removeItem(KEY);
    } catch {
      // sessionStorage недоступний (приватне вікно) — просто не відновлюємо.
    }
  }, [message]);

  const invalid = message ? true : undefined;
  return (
    <form
      action={action}
      noValidate
      onSubmit={(event) => {
        try {
          const value = new FormData(event.currentTarget).get("email");
          sessionStorage.setItem(KEY, typeof value === "string" ? value : "");
        } catch {
          // не критично
        }
      }}
      className="flex flex-col gap-5"
    >
      <Alert id="login-error" message={message} />
      <Field label="Email">
        <Input
          ref={email}
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="name@school.example"
          aria-invalid={invalid}
          aria-describedby={message ? "login-error" : undefined}
        />
      </Field>
      <Field label="Password">
        <PasswordInput name="password" autoComplete="current-password" required aria-invalid={invalid} aria-describedby={message ? "login-error" : undefined} />
      </Field>
      <SubmitButton className="w-full py-3 sm:py-2.5">Sign in</SubmitButton>
      {children}
    </form>
  );
}
