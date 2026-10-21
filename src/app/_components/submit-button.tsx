"use client";

// Кнопка відправки форми з server action: блокується, поки дія виконується (захист від подвійного кліку),
// і за потреби просить підтвердити небезпечну дію (деактивація, видалення). `formAction`, `name` і `value`
// дозволяють кільком кнопкам однієї форми запускати різні дії (збереження, подання, рішення).
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles, type ButtonVariant } from "./button-styles";

export function SubmitButton({
  children,
  variant = "primary",
  confirm,
  disabled,
  title,
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
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  formNoValidate?: boolean;
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      title={title}
      aria-busy={pending}
      formAction={formAction}
      formNoValidate={formNoValidate}
      name={name}
      value={value}
      data-testid={testId}
      className={`${buttonStyles(variant)} ${className}`}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
