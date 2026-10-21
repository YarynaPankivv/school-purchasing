// Мок клієнта Supabase і next/navigation для тестів server actions (design.md D9).
// Не тест: Vitest запускає лише *.test.ts. Записує кожен запит (таблиця, операція, payload, фільтри),
// а відповідь бере з results за ключем "<таблиця>.<операція>". Виклик rpc("name", args) записується як
// таблиця "rpc:name", операція "rpc", payload — аргументи; відповідь — з results["rpc:name.rpc"] (за замовчуванням true).
import { vi } from "vitest";

export type MockError = { code?: string; message?: string } | null;
export type MockResult = { data?: unknown; error?: MockError };
export type Op = "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
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
  // Інші профілі: select(…).eq("id", …).maybeSingle() знаходить їх за id (поруч із профілем сеансу).
  profiles?: MockProfile[];
  // Відповідь signInWithPassword (login()); за замовчуванням — успішний вхід профілю сеансу.
  signInError?: MockError;
  results?: Partial<Record<`${string}.${Op}`, MockResult>>;
} = {}) {
  const profile = options.profile === undefined ? makeProfile() : options.profile;
  const results = options.results ?? {};
  const calls: Call[] = [];
  const signOut = vi.fn(async () => ({ error: null }));
  const signInWithPassword = vi.fn(async () => ({
    data: { user: profile ? { id: profile.id } : null },
    error: options.signInError ?? null,
  }));
  const known = [...(profile ? [profile] : []), ...(options.profiles ?? [])];

  function from(table: string) {
    const call: Call = { table, op: "select", filters: [] };
    let single = false;
    const builder = {
      select: () => builder,
      insert: (payload: unknown) => ((call.op = "insert"), (call.payload = payload), builder),
      update: (payload: unknown) => ((call.op = "update"), (call.payload = payload), builder),
      upsert: (payload: unknown) => ((call.op = "upsert"), (call.payload = payload), builder),
      delete: () => ((call.op = "delete"), builder),
      eq: (column: string, value: unknown) => (call.filters.push([column, value]), builder),
      order: () => builder,
      maybeSingle: () => ((single = true), builder),
      then<T>(resolve: (value: { data: unknown; error: MockError }) => T, reject?: (reason: unknown) => T) {
        calls.push(call);
        let result: { data: unknown; error: MockError };
        const idFilter = call.filters.find(([column]) => column === "id")?.[1];
        const matched = known.find((p) => p.id === idFilter);
        if (table === "profiles" && call.op === "select" && single && matched && !(`profiles.select` in results)) {
          result = { data: matched, error: null };
        } else if (table === "profiles" && call.op === "select" && single && !(`profiles.select` in results) && idFilter === undefined) {
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

  function rpc(name: string, args: unknown) {
    const call: Call = { table: `rpc:${name}`, op: "rpc", payload: args, filters: [] };
    return {
      then<T>(resolve: (value: { data: unknown; error: MockError }) => T, reject?: (reason: unknown) => T) {
        calls.push(call);
        const configured = results[`rpc:${name}.rpc`];
        const result = { data: configured?.data ?? (configured?.error ? null : true), error: configured?.error ?? null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
  }

  const client = {
    auth: {
      getClaims: vi.fn(async () => ({ data: profile ? { claims: { sub: profile.id } } : null, error: null })),
      signOut,
      signInWithPassword,
    },
    from,
    rpc,
  };

  return { client, calls, signOut, signInWithPassword };
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
