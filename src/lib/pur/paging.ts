// PostgREST віддає не більше 1000 рядків на запит (max_rows): довші вибірки мовчки обрізаються, і підсумки списку були б
// хибними. selectAll читає сторінками по PAGE_SIZE за курсором: кожна сторінка — «id більший за останній прочитаний».
// Зсув (range/offset) тут не годиться: вставка чи видалення між сторінками зсунула б межу, і рядок повторився б або
// зник. Запит має бути впорядкований за id (order("id")) і обмежений limit(PAGE_SIZE); впорядкування за іншою ознакою
// читач робить сам після завантаження.
export const PAGE_SIZE = 1000;

type PageResult<Row> = { data: Row[] | null; error: { message: string } | null };

export async function selectAll<Row extends { id: string }>(
  readPage: (afterId: string | null) => PromiseLike<PageResult<Row>>,
): Promise<PageResult<Row>> {
  const rows: Row[] = [];
  let after: string | null = null;
  for (;;) {
    const { data, error } = await readPage(after);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    const last = page[page.length - 1];
    if (!last || page.length < PAGE_SIZE) return { data: rows, error: null };
    after = last.id;
  }
}
