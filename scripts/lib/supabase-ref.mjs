// Звірка supabaseRef із /api/health (дія з postmortem 2026-11-21-supabase-url-typo): хибне значення NEXT_PUBLIC_SUPABASE_URL
// для гілки staging давало «db: down» без жодної підказки, у яку базу дивиться деплой. Тепер smoke порівнює ref, який віддає
// health, з очікуваним для цього середовища (змінні репо SUPABASE_STAGING_REF і SUPABASE_PROD_REF) і називає змінну, яку треба
// перевірити, — але без її значення. Ref проєкту Supabase не секрет: він і так у адресі проєкту.
// Чиста функція без мережі й без process.env: її перевіряє tests/scripts/smoke-supabase-ref.test.ts.
//   actual — supabaseRef із відповіді health (undefined, якщо поля немає: деплой старішої збірки);
//   expect — ref, який має показувати це середовище; forbid — ref, який не може показувати ніколи (ref іншої бази).
// Повертає масив повідомлень про збій (порожній — усе гаразд).
const HINT = "перевірте NEXT_PUBLIC_SUPABASE_URL цього деплою у Vercel (Settings → Environment Variables, гілка деплою) і зробіть Redeploy";

export function checkSupabaseRef({ actual, expect = "", forbid = "" }) {
  if (!expect && !forbid) return [];
  // Старіша збірка без поля supabaseRef (PR до злиття PR 99): порівнювати нічого — не збій.
  if (actual === undefined) return [];
  if (!actual) return [`"/api/health": supabaseRef порожній — NEXT_PUBLIC_SUPABASE_URL не схожий на адресу проєкту Supabase; ${HINT}`];
  if (forbid && actual === forbid) {
    return [`"/api/health": supabaseRef ${actual} збігається з refом ЗАБОРОНЕНОЇ бази (SUPABASE_PROD_REF чи SUPABASE_STAGING_REF для цього середовища): деплой ходить не в ту базу; ${HINT}`];
  }
  if (expect && actual !== expect) {
    return [`"/api/health": supabaseRef ${actual} не збігається з очікуваним ${expect} (змінна репо SUPABASE_STAGING_REF для staging і PR-preview, SUPABASE_PROD_REF для проду); ${HINT}`];
  }
  return [];
}
