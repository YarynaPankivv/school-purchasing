// Короткий опис того, що купують: перша названа позиція й «+N more» (для рядка списку й підзаголовка заявки).
// Лише наявні назви рядків; без назв — null, а не вигаданий текст.
export function itemsSummary(lines: ReadonlyArray<{ name: string | null; position: number }>): string | null {
  const named = lines
    .filter((line) => line.name !== null && line.name.trim() !== "")
    .sort((a, b) => a.position - b.position);
  const first = named[0]?.name?.trim();
  if (!first) return null;
  return named.length > 1 ? `${first} +${named.length - 1} more` : first;
}
