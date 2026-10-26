"use client";

// Кнопка відправки форми з server action: блокується, поки дія виконується (захист від подвійного кліку),
// і за потреби просить підтвердити небезпечну дію (деактивація, видалення). `formAction`, `name` і `value`
// дозволяють кільком кнопкам однієї форми запускати різні дії (збереження, подання, рішення).
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./button";

export function SubmitButton({
  children,
  variant = "default",
  confirm,
  disabled,
  title,
  ariaLabel,
  className = "",
  formAction,
  name,
  value,
  formNoValidate,
  testId,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  confirm?: string;
  disabled?: boolean;
  title?: string;
  // Доступне ім’я, коли однакових кнопок багато (наприклад, «Remove» у кожному рядку).
  ariaLabel?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  formNoValidate?: boolean;
  testId?: string;
}) {
  // pending — стан усієї форми: блокуємо кожну кнопку, але «Please wait…» і aria-busy — лише на натиснутій.
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  if (!pending && clicked) setClicked(false);
  const busy = pending && clicked;
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || pending}
      title={title}
      aria-label={ariaLabel}
      aria-busy={busy}
      formAction={formAction}
      formNoValidate={formNoValidate}
      name={name}
      value={value}
      data-testid={testId}
      className={className}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
          return;
        }
        // Якщо браузер зупинить подання нативною валідацією (порожнє required-поле), подання не почнеться й pending не
        // стане true: «натиснуту» кнопку не позначаємо, інакше вона б показала «Please wait…» при наступному поданні іншої.
        const form = event.currentTarget.form;
        if (form && !formNoValidate && !form.noValidate && !form.checkValidity()) return;
        setClicked(true);
      }}
    >
      {busy ? (
        <>
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          />
          Please wait…
        </>
      ) : (
        children
      )}
    </Button>
  );
}
