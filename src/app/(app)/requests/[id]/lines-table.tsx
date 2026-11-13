import type { ReactNode } from "react";

// Каркас таблиці рядків закупівлі: одна розмітка для редагування (остання колонка — дії) й перегляду (статус рядка).
// Самі рядки <tr> передає сторінка: їхні клітинки різні (поля вводу чи текст).
export function LinesTable({
  lastHeader,
  children,
}: {
  lastHeader: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label="Request lines"
      tabIndex={0}
    >
      <table
        className="w-full text-left text-sm max-md:block md:min-w-176"
        data-testid="lines"
      >
        <thead className="text-xs text-muted-foreground max-md:hidden">
          <tr>
            <th className="pb-2 pr-2 font-medium">#</th>
            <th className="pb-2 pr-2 font-medium">Name</th>
            <th className="pb-2 pr-2 font-medium">Purpose</th>
            <th className="pb-2 pr-2 font-medium">Qty</th>
            <th className="pb-2 pr-2 font-medium">Unit price</th>
            <th className="pb-2 pr-2 text-right font-medium">Total</th>
            {lastHeader}
          </tr>
        </thead>
        <tbody className="divide-y divide-border max-md:block">
          {children}
        </tbody>
      </table>
    </div>
  );
}
