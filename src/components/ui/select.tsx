"use client";

// Власний випадаючий список замість рідного <select>: меню стилізоване токенами, а не системне.
// API як у <select>: <option> у children, name, value / defaultValue, onChange, required, disabled, aria-*.
// Усередині лишається справжній (прихований) <select>: форма відправляє його значення, required перевіряє браузер,
// onChange отримує звичайну подію зміни. Видима частина — кнопка-combobox і listbox (клавіатура: стрілки, Home/End,
// Enter/Space, Esc, перша літера).
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "./cn";
import { Icon } from "./icons";
import { FIELD } from "./input";

type Option = { value: string; label: string; disabled: boolean };

function parseOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") return [];
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    const label = Children.toArray(props.children).join("");
    return [{ value: props.value === undefined ? label : String(props.value), label, disabled: Boolean(props.disabled) }];
  });
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = parseOptions(children);
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = value !== undefined ? String(value) : inner;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === current));
  const selected = options[selectedIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const root = useRef<HTMLSpanElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;

  // Закриваємо меню кліком поза ним.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Активний пункт завжди в зоні видимості списку.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const pick = (index: number) => {
    const option = options[index];
    const element = native.current;
    if (!option || option.disabled || !element) return;
    // Змінюємо значення справжнього <select> і шлемо йому «change»: форма й onChange бачать звичайну подію.
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, option.value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
  };

  const move = (from: number, step: 1 | -1) => {
    for (let index = from + step; index >= 0 && index < options.length; index += step) {
      if (!options[index]?.disabled) return index;
    }
    return from;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { key } = event;
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActive(selectedIndex);
        setOpen(true);
      } else setActive((index) => move(index, key === "ArrowDown" ? 1 : -1));
    } else if (key === "Home" || key === "End") {
      if (!open) return;
      event.preventDefault();
      setActive(key === "Home" ? move(-1, 1) : move(options.length, -1));
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (open) pick(active);
      else {
        setActive(selectedIndex);
        setOpen(true);
      }
    } else if (key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    } else if (key === "Tab") {
      setOpen(false);
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // Перша літера: наступний пункт, що з неї починається.
      const letter = key.toLowerCase();
      const from = open ? active : selectedIndex;
      const next = [...options.keys()].find((i) => i > from && !options[i]?.disabled && options[i]?.label.toLowerCase().startsWith(letter))
        ?? [...options.keys()].find((i) => !options[i]?.disabled && options[i]?.label.toLowerCase().startsWith(letter));
      if (next === undefined) return;
      event.preventDefault();
      if (open) setActive(next);
      else pick(next);
    }
  };

  return (
    <span ref={root} className="relative block">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => {
          setActive(selectedIndex);
          setOpen((isOpen) => !isOpen);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          FIELD,
          "flex items-center justify-between gap-2 text-left transition-colors hover:border-ring aria-expanded:border-ring",
          className,
        )}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <Icon name="chevron-down" className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <select
        {...rest}
        ref={native}
        value={current}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          setInner(event.target.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          // Список лежить усередині <label> (Field): без preventDefault клік по пункту «активує» мітку, і та повторно
          // тисне кнопку-combobox — меню відкривається знову одразу після вибору.
          onClick={(event) => event.preventDefault()}
          className="anim-pop absolute left-0 right-0 top-full z-30 mt-1 max-h-60 min-w-max overflow-auto rounded-lg border border-border bg-card p-1 shadow-card"
        >
          {options.map((option, index) => (
            <li
              key={`${option.value}-${index}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => !option.disabled && setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground ${
                index === active ? "bg-muted" : ""
              } ${index === selectedIndex ? "font-medium" : ""} ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span className="truncate">{option.label || " "}</span>
              {index === selectedIndex ? <Icon name="check" className="size-4 shrink-0 text-primary" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}
