// Тестова база: справжній Postgres у WASM (PGlite) з емульованими ролями Supabase.
// Застосовує ті самі supabase/migrations/*.sql і supabase/seed.sql, що й job db-deploy у CI, без Docker.
// Межа емуляції: Auth, PostgREST і JWT — спрощені (auth.uid() читає request.jwt.claim.sub); налаштування хмарного
// проєкту тут не перевіряються.
// Основа — tests/db/supabase-pglite.ts з koldovsky/2026-quitcode-06-leave-portal-demo (дозволено матеріалами WS7),
// користувачі, відділи й дозволи — власні для school-purchasing.
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/** Емуляція того, що в Supabase вже є до наших міграцій: ролі, схема auth, auth.uid(). */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create role supabase_auth_admin nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant select, insert, delete on auth.users to supabase_auth_admin;
  grant usage on schema public to anon, authenticated, service_role;
  -- Як у справжньому Supabase: нові об'єкти public одразу доступні anon/authenticated/service_role. Без цього тест
  -- «гість нічого не бачить» проходив би й без revoke у міграції: прав і так ніхто не мав би.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type AppRole = "requester" | "approver" | "admin";

export interface AddUserOptions {
  /** Ім'я в профілі; null — профіль без імені (замість нього показують email). */
  fullName?: string | null;
  /** Лише `admin`: ролі requester/approver база виводить сама з department_approvers. */
  admin?: boolean;
  isActive?: boolean;
}

export interface PurchasingDb {
  db: PGlite;
  /** id відділів сиду за назвою: «Primary School», «Upper School», «Office». */
  departments: Record<string, string>;
  /** Створює користувача Auth (тригер додає профіль) і повертає його id. */
  addUser(email: string, options?: AddUserOptions): Promise<string>;
  /** Додатковий відділ (поза сидом); повертає назву для addMember. */
  addDepartment(name: string): Promise<string>;
  /** Заявник відділу; approver — ще й схвалювач (складений FK) з автоматичною роллю approver. */
  addMember(
    department: string,
    userId: string,
    options?: { approver?: boolean; autoApprove?: boolean },
  ): Promise<void>;
  /** Дозвіл на «Самостійну закупівлю» (user_permissions.self_purchase). */
  allowSelfPurchase(userId: string): Promise<void>;
  /** SQL від імені користувача (role authenticated, auth.uid() = id) в окремій транзакції. */
  asUser<T = Record<string, unknown>>(userId: string, sql: string, params?: unknown[]): Promise<T[]>;
  /** SQL без входу (role anon, як запит лише з публічним ключем) в окремій транзакції. */
  asAnon<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** SQL в обхід RLS (як Dashboard / service_role) — для підготовки даних і перевірки результату. */
  asService<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

async function inTransaction<T>(db: PGlite, role: string, userId: string | null, sql: string, params: unknown[]) {
  try {
    await db.exec(`begin; set local role ${role};`);
    if (userId) await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await db.query<T>(sql, params);
    // COMMIT теж може впасти: відкладені constraint trigger-и спрацьовують саме тут.
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback").catch(() => {});
    throw error;
  }
}

export async function createPurchasingDb(): Promise<PurchasingDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const migrations = readdirSync(new URL("supabase/migrations/", root))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) await db.exec(read(`supabase/migrations/${file}`));
  await db.exec(read("supabase/seed.sql"));

  const asService = <T,>(sql: string, params: unknown[] = []) => inTransaction<T>(db, "service_role", null, sql, params);

  const departmentRows = await asService<{ id: string; name: string }>("select id, name from public.departments");
  const departments = Object.fromEntries(departmentRows.map((d) => [d.name, d.id]));

  let counter = 0;
  return {
    db,
    departments,
    async addUser(email, options = {}) {
      counter += 1;
      const id = `a0000000-0000-0000-0000-${String(counter).padStart(12, "0")}`;
      const fullName = options.fullName === undefined ? email.split("@")[0] : options.fullName;
      await inTransaction(db, "supabase_auth_admin", null, "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
        id,
        email,
        fullName === null ? {} : { full_name: fullName },
      ]);
      if (options.admin) await asService("update public.profiles set role = 'admin' where id = $1", [id]);
      if (options.isActive === false) await asService("update public.profiles set is_active = false where id = $1", [id]);
      return id;
    },
    async addDepartment(name) {
      const [row] = await asService<{ id: string }>("insert into public.departments (name) values ($1) returning id", [
        name,
      ]);
      departments[name] = row.id;
      return name;
    },
    async addMember(department, userId, options = {}) {
      const departmentId = departments[department];
      if (!departmentId) throw new Error(`Unknown department: ${department}`);
      await asService(
        "insert into public.department_members (department_id, user_id, auto_approve) values ($1, $2, $3)",
        [departmentId, userId, options.autoApprove ?? false],
      );
      if (options.approver) {
        await asService("insert into public.department_approvers (department_id, user_id) values ($1, $2)", [
          departmentId,
          userId,
        ]);
      }
    },
    async allowSelfPurchase(userId) {
      await asService(
        "insert into public.user_permissions (user_id, self_purchase) values ($1, true) on conflict (user_id) do update set self_purchase = true",
        [userId],
      );
    },
    asUser: <T,>(userId: string, sql: string, params: unknown[] = []) =>
      inTransaction<T>(db, "authenticated", userId, sql, params),
    asAnon: <T,>(sql: string, params: unknown[] = []) => inTransaction<T>(db, "anon", null, sql, params),
    asService,
  };
}
