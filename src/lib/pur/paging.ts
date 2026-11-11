// PostgREST віддає не більше 1000 рядків на запит (max_rows): довші вибірки мовчки обрізаються, і підсумки списку були б
// хибними. selectAll читає сторінками по PAGE_SIZE, доки сторінка не вийде неповною. Запит має мати стабільний порядок
// (order), інакше рядки між сторінками можуть повторюватись чи губитись.
export const PAGE_SIZE = 1000;

type PageResult<Row> = { data: Row[] | null; error: { message: string } | null };

export async function selectAll<Row>(
  readPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
): Promise<PageResult<Row>> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await readPage(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
