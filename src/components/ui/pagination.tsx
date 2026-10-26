// Нумерація сторінок списку: «Showing 21–40 of 87» і «Previous 1 … 4 [5] 6 … 20 Next». Посилання, без JS;
// адресу сторінки будує сторінка-власник списку (`hrefFor`), бо лише вона знає решту параметрів.
import Link from "next/link";
import { Icon } from "./icons";

const ITEM = "inline-flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors";

// Сторінки для нумерації: 1 … 4 [5] 6 … 20 (з крапками, де є пропуск).
export function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  pages.forEach((n, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && n - previous > 1) result.push("gap");
    result.push(n);
  });
  return result;
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  label: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount === 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-5 py-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        Showing {from}–{to} of {total}
      </p>
      <nav aria-label={label}>
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={hrefFor(page - 1)} aria-label="Previous page" className={`${ITEM} text-foreground hover:bg-muted`}>
                <Icon name="chevron-left" className="size-4" />
              </Link>
            ) : (
              <span aria-hidden="true" className={`${ITEM} text-muted-foreground opacity-50`}>
                <Icon name="chevron-left" className="size-4" />
              </span>
            )}
          </li>
          {pageWindow(page, pageCount).map((item, index) =>
            item === "gap" ? (
              <li key={`gap-${index}`} aria-hidden="true" className={`${ITEM} text-muted-foreground`}>
                …
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={hrefFor(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  className={`${ITEM} ${item === page ? "border border-primary font-medium text-primary" : "text-foreground hover:bg-muted"}`}
                >
                  {item}
                </Link>
              </li>
            ),
          )}
          <li>
            {page < pageCount ? (
              <Link href={hrefFor(page + 1)} aria-label="Next page" className={`${ITEM} text-foreground hover:bg-muted`}>
                <Icon name="chevron-right" className="size-4" />
              </Link>
            ) : (
              <span aria-hidden="true" className={`${ITEM} text-muted-foreground opacity-50`}>
                <Icon name="chevron-right" className="size-4" />
              </span>
            )}
          </li>
        </ul>
      </nav>
    </div>
  );
}
