// Стилі кнопок і полів — чисті рядки, тому їх можна використовувати і в серверних, і в клієнтських компонентах.

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "danger-ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover shadow-card",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
  danger: "bg-danger text-white hover:bg-danger-hover shadow-card",
  ghost: "text-muted hover:bg-surface-muted hover:text-ink",
  "danger-ghost": "text-danger-ink hover:bg-danger-soft",
};

export function buttonStyles(variant: ButtonVariant = "primary"): string {
  return `${BASE} ${VARIANTS[variant]}`;
}

export const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted " +
  "disabled:cursor-not-allowed disabled:opacity-60";
