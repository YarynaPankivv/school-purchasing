// D0: публічна перевірка здоров'я проду — GET /api/health → { ok, sha, env, db, reason }.
// Без секретів і без даних користувачів: коміт збірки (Vercel) і чи відповідає база (один дешевий запит публічним
// ключем). Шлях — у PUBLIC_PATHS (src/lib/supabase/proxy.ts), інакше proxy віддав би 307 на /login.
// Читають: scripts/smoke.mjs, .github/workflows/smoke.yml і перевірка розгортань курсу.
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { classifyDbProbe } from "@/lib/health";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function GET() {
  // VERCEL_GIT_COMMIT_SHA є, коли у Vercel увімкнено «Automatically expose System Environment Variables» (типово так).
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const env = process.env.VERCEL_ENV ?? "local";
  let health: { db: "ok" | "down"; reason: string };
  try {
    // Звичайний supabase-js, не @/lib/supabase/server: перевірка не читає cookie відвідувача.
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    // GET, не HEAD: потрібне тіло помилки, щоб відрізнити «anon без прав» (база відповіла) від «хибний ключ».
    const { error, status } = await supabase.from("profiles").select("id").limit(1);
    health = classifyDbProbe({ status, error });
  } catch {
    health = { db: "down", reason: "exception" };
  }
  return NextResponse.json(
    { ok: health.db === "ok", sha, env, ...health },
    { status: health.db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
