"use client";

// Власне вікно підтвердження замість нативного window.confirm (його вигляд і мова залежать від браузера): модальний <dialog>
// на токенах застосунку. Esc і клік по затемненню — «Cancel»; фокус одразу на «Cancel», тож випадковий Enter небезпечної дії не виконає.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonVariant } from "./button";
import { Icon } from "./icons";

export function ConfirmDialog({
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  confirmVariant: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const danger = confirmVariant === "destructive" || confirmVariant === "destructive-ghost";

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-message"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
      className="anim-enter m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-card backdrop:bg-foreground/40"
    >
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <span
          aria-hidden="true"
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${danger ? "bg-status-rejected text-status-rejected-foreground" : "bg-accent text-accent-foreground"}`}
        >
          <Icon name={danger ? "alert" : "info"} className="size-[18px]" />
        </span>
        <p id="confirm-dialog-message" className="pt-1.5 text-base font-medium leading-snug text-foreground">
          {message}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
        <Button type="button" variant="outline" onClick={onCancel} autoFocus>
          Cancel
        </Button>
        <Button type="button" variant={confirmVariant === "destructive-ghost" ? "destructive" : confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>,
    document.body,
  );
}
