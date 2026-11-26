"use client";

// Кнопка відправки форми з server action: блокується, поки дія виконується (захист від подвійного кліку),
// і за потреби просить підтвердити небезпечну дію (деактивація, видалення). `formAction`, `name` і `value`
// дозволяють кільком кнопкам однієї форми запускати різні дії (збереження, подання, рішення).
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./button";
import { ConfirmDialog } from "./confirm-dialog";

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
  const { pending, busy, markClicked } = usePendingState();
  const confirmation = useConfirmation({ confirm, variant, label: children, formNoValidate, onStart: markClicked });
  return (
    <>
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
        onClick={confirmation.onClick}
      >
        {busy ? <PleaseWait /> : children}
      </Button>
      {confirmation.dialog}
    </>
  );
}

// pending — стан усієї форми: блокуємо кожну кнопку, але «Please wait…» і aria-busy — лише на натиснутій (busy).
function usePendingState() {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  if (!pending && clicked) setClicked(false);
  return { pending, busy: pending && clicked, markClicked: () => setClicked(true) };
}

// Якщо браузер зупинить подання нативною валідацією (порожнє required-поле), подання не почнеться й pending не
// стане true: «натиснуту» кнопку не позначаємо, інакше вона б показала «Please wait…» при наступному поданні іншої.
function canStart(form: HTMLFormElement | null, formNoValidate: boolean | undefined): boolean {
  return !form || formNoValidate === true || form.noValidate || form.checkValidity();
}

type ConfirmationOptions = {
  confirm?: string;
  variant: ButtonVariant;
  label: ReactNode;
  formNoValidate?: boolean;
  onStart: () => void;
};

// Підтвердження небезпечної дії власним вікном (ConfirmDialog), а не window.confirm. Без `confirm` кнопка працює як
// звичайна. Після «ОК» форму надсилаємо з цією кнопкою як відправником (requestSubmit), тож formAction/name/value кнопки
// спрацьовують як при звичайному натисканні.
function useConfirmation({ confirm, variant, label, formNoValidate, onStart }: ConfirmationOptions) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    if (confirm) {
      event.preventDefault();
      trigger.current = button;
      setAsking(true);
    } else if (canStart(button.form, formNoValidate)) {
      onStart();
    }
  }

  function proceed() {
    setAsking(false);
    const button = trigger.current;
    const form = button?.form;
    if (!button || !form) return;
    if (!canStart(form, formNoValidate)) return void form.reportValidity();
    onStart();
    form.requestSubmit(button);
  }

  function cancel() {
    setAsking(false);
    trigger.current?.focus();
  }

  const dialog =
    asking && confirm ? (
      <ConfirmDialog
        message={confirm}
        confirmLabel={typeof label === "string" ? label : "Confirm"}
        confirmVariant={confirmVariantOf(variant)}
        onConfirm={proceed}
        onCancel={cancel}
      />
    ) : null;
  return { onClick, dialog };
}

// Небезпечна дія підтверджується червоною кнопкою, решта — основною.
function confirmVariantOf(variant: ButtonVariant): ButtonVariant {
  return variant === "outline" || variant === "ghost" || variant === "secondary" || variant === "link" ? "default" : variant;
}

function PleaseWait() {
  return (
    <>
      <span
        aria-hidden="true"
        className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
      Please wait…
    </>
  );
}
