// Кнопка й її варіанти (DESIGN.md, розділ 5). Без стану й хуків: годиться і для серверних, і для клієнтських компонентів.
// Колір — лише токени з globals.css. `default` — одна основна дія на екран; `destructive` — лише з підтвердженням.
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "destructive-ghost" | "link";

const BASE =
  "inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium " +
  "transition-[color,background-color,border-color,transform] duration-150 ease-out " +
  "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-card",
  secondary: "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
  outline: "border border-input bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive-hover shadow-card",
  "destructive-ghost": "text-status-rejected-foreground hover:bg-status-rejected",
  link: "px-0 py-0 text-primary underline-offset-4 hover:underline",
};

export function buttonVariants(variant: ButtonVariant = "default", className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function Button({ variant = "default", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonVariants(variant, className)} {...props} />;
}
