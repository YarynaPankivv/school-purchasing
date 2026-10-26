"use client";

// Пошук у верхньому рядку: поле на всю доступну ширину, підказка клавіші «/», кнопка очищення.
// Це звичайна GET-форма (працює без JS): відправка веде на `action?q=…`, фільтрує сервер.
// Із JS поле одразу показує підказки: на фокусі — останні заявки, під час набору — ті, що збігаються з запитом;
// стрілки вибирають, Enter відкриває заявку, Esc спершу закриває список, вдруге — очищає поле.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "./icons";
import { Input } from "./input";

export type SearchSuggestion = {
  id: string;
  number: string;
  department: string | null;
  items: string | null;
  statusLabel: string;
  href: string;
  // Нижній регістр: те, у чому шукаємо (номер, відділ, автор, статус, позиції).
  haystack: string;
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function SearchBox({
  action,
  defaultValue = "",
  label,
  placeholder,
  loadIndex,
}: {
  action: string;
  defaultValue?: string;
  label: string;
  placeholder: string;
  // Серверна дія, що віддає індекс найновіших заявок один раз; фільтр за набраним текстом — миттєво на клієнті.
  // Без неї поле — звичайна форма пошуку.
  loadIndex?: () => Promise<SearchSuggestion[]>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchSuggestion[] | null>(null);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const loadedAt = useRef(0);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Індекс заявок: один запит при відкритті (і не частіше разу на хвилину); далі підказки фільтруються на клієнті миттєво.
  useEffect(() => {
    if (!open || !loadIndex || Date.now() - loadedAt.current < 60_000) return;
    loadedAt.current = Date.now();
    loadIndex()
      .then(setIndex)
      .catch(() => {
        loadedAt.current = 0;
        setIndex((current) => current ?? []);
      });
  }, [open, loadIndex]);

  const query = value.trim().toLowerCase();
  const results = index ? (query ? index.filter((entry) => entry.haystack.includes(query)) : index).slice(0, 6) : null;
  const showList = open && Boolean(loadIndex) && results !== null && (results.length > 0 || query !== "");

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const count = results?.length ?? 0;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!loadIndex || count === 0) return;
      event.preventDefault();
      setOpen(true);
      setActive((index) => (event.key === "ArrowDown" ? (index + 1) % count : (index - 1 + count) % count));
    } else if (event.key === "Enter" && showList && active >= 0 && results?.[active]) {
      event.preventDefault();
      setOpen(false);
      router.push(results[active].href);
    } else if (event.key === "Escape") {
      if (open && showList) {
        event.preventDefault();
        setOpen(false);
      } else {
        setValue("");
        event.currentTarget.blur();
      }
    }
  };

  // Фокус пішов за межі пошуку (інша частина сторінки): список закриваємо; клік по пункту лишає фокус всередині.
  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <form action={action} role="search" onBlur={onBlur} className="group relative min-w-0 flex-1">
      <Icon
        name="search"
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
      />
      <Input
        ref={input}
        type="search"
        name="q"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role={loadIndex ? "combobox" : undefined}
        aria-expanded={loadIndex ? showList : undefined}
        aria-controls={loadIndex && showList ? listId : undefined}
        aria-activedescendant={showList && results && active >= 0 && active < results.length ? optionId(active) : undefined}
        aria-autocomplete={loadIndex ? "list" : undefined}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        aria-keyshortcuts="/"
        enterKeyHint="search"
        className="h-11 pl-10 pr-12 focus-visible:border-ring sm:h-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            setOpen(true);
            input.current?.focus();
          }}
          className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-1.5 sm:size-8"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      ) : (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground group-focus-within:hidden sm:block"
        >
          /
        </kbd>
      )}
      {showList ? (
        <div className="anim-pop absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-card p-1 shadow-card">
          {query === "" ? <p className="px-3 pb-1 pt-2 text-xs text-muted-foreground">Recent</p> : null}
          {results && results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Matching requests">
              {results.map((item, position) => (
                <li key={item.id} id={optionId(position)} role="option" aria-selected={position === active}>
                  <Link
                    href={item.href}
                    tabIndex={-1}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(position)}
                    className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 ${position === active ? "bg-muted" : ""}`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        <span className="tabular-nums">{item.number}</span>
                        {item.department ? <span className="ml-2 font-normal text-muted-foreground">{item.department}</span> : null}
                      </span>
                      {item.items ? <span className="truncate text-xs text-muted-foreground">{item.items}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.statusLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">No requests match “{value.trim()}”.</p>
          )}
          {value.trim() !== "" ? (
            <Link
              href={`${action}?q=${encodeURIComponent(value.trim())}`}
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center justify-between rounded-md border-t border-border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
            >
              All results
              <Icon name="arrow-right" className="size-4" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
