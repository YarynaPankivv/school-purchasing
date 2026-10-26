// Підпис поля. У кожного поля форми — свій Label (htmlFor або обгортка), placeholder не замінює підпис.
import type { LabelHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}
