// Мок клієнта Supabase і next/navigation для тестів server actions (design.md D9).
// Не тест: Vitest запускає лише *.test.ts. Записує кожен запит (таблиця, операція, payload, фільтри),
// а відповідь бере з results за ключем "<таблиця>.<операція>".
import { vi } from "vitest";

export type MockError = { code?: string; message?: string } | null;
export type MockResult = { data?: unknown; error?: MockError };
export type Op = "select" | "insert" | "update" | "delete";
export type Call = { table: string; op: Op; payload?: unknown; filters: Array<[string, unknown]> };

export type MockProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

export function makeProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: "user-admin",
    email: "admin@example.test",
    full_name: "Олена Демо-Адмін",
    role: "admin",
    is_active: true,
    ...overrides,
  };
}

export function createSupabaseMock(options: {
  profile?: MockProfile | null;
  results?: Partial<Record<`${string}.${Op}`, MockResult>>;
} = {}) {
  const profile = options.profile === undefined ? makeProfile() : options.profile;
  const results = options.results ?? {};
  const calls: Call[] = [];
  const signOut = vi.fn(async () => ({ error: null }));

  function from(table: string) {
    const call: Call = { table, op: "select", filters: [] };
    let single = false;
    const builder = {
      select: () => builder,
      insert: (payload: unknown) => ((call.op = "insert"), (call.payload = payload), builder),
      update: (payload: unknown) => ((call.op = "update"), (call.payload = payload), builder),
      delete: () => ((call.op = "delete"), builder),
      eq: (column: string, value: unknown) => (call.filters.push([column, value]), builder),
      order: () => builder,
      maybeSingle: () => ((single = true), builder),
      then<T>(resolve: (value: { data: unknown; error: MockError }) => T, reject?: (reason: unknown) => T) {
        calls.push(call);
        let result: { data: unknown; error: MockError };
        if (table === "profiles" && call.op === "select" && single && !(`profiles.select` in results)) {
          result = { data: profile, error: null };
        } else {
          const configured = results[`${table}.${call.op}`];
          result = { data: configured?.data ?? (single ? null : []), error: configured?.error ?? null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  }

  const client = {
    auth: {
      getClaims: vi.fn(async () => ({ data: profile ? { claims: { sub: profile.id } } : null, error: null })),
      signOut,
    },
    from,
  };

  return { client, calls, signOut };
}

// redirect() / notFound() кидають — як і в Next.js; тест читає адресу з помилки.
export class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`REDIRECT ${url}`);
  }
}

export async function redirectedTo(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("Очікували redirect, але дія завершилась без нього");
}

export function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
