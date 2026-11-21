#!/usr/bin/env node
// SLO-2 (операційні вимоги PM, issue ValiaBihun/2026-quitcode-dream-team#83): частка запитів помічника «Suggest lines»
// за 28 днів, після яких користувач побачив відповідь, а не стан «недоступний». Джерело — public.ai_call_log
// (міграція 20261121130508_ai_call_log.sql; лише технічні поля, без тексту користувача). Читає service_role.
// Запуск (значення не друкуються): node --env-file=.env.local scripts/ai-slo.mjs [днів=28]
//   Щоб порахувати прод, а не staging: node --env-file=.env.prod.local scripts/ai-slo.mjs
// Ціль SLO-2: ≥ 95% запитів без стану «недоступний»; бюджет помилок — 5% запитів. Код виходу: 0 — ціль виконано або
// записів ще немає, 1 — бюджет вичерпано, 2 — немає змінних середовища чи запит не вдався.
import { createClient } from "@supabase/supabase-js";

const days = Number(process.argv[2] ?? 28);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || !Number.isFinite(days) || days <= 0) {
  console.error("Потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SECRET_KEY (node --env-file=.env.local …) та кількість днів > 0.");
  process.exitCode = 2;
} else {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const counts = { ok: 0, needs_info: 0, refused: 0, unavailable: 0 };
  const reasons = {};
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("ai_call_log")
      .select("state, error_kind")
      .gte("created_at", since)
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) {
      console.error(`ai_call_log: ${error.code ?? ""} ${error.message}`.trim());
      process.exitCode = 2;
      break;
    }
    for (const row of data) {
      counts[row.state] = (counts[row.state] ?? 0) + 1;
      if (row.state === "unavailable") reasons[row.error_kind ?? "?"] = (reasons[row.error_kind ?? "?"] ?? 0) + 1;
    }
    if (data.length < page) break;
  }
  if (process.exitCode !== 2) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const good = total - counts.unavailable;
    const share = total ? (good / total) * 100 : null;
    console.log(JSON.stringify({ days, total, ...counts, unavailableByReason: reasons, sharePercent: share === null ? null : Number(share.toFixed(2)) }));
    if (share === null) console.log("Записів за період ще немає: SLO-2 порахувати нічим.");
    else if (share < 95) {
      console.log(`SLO-2 порушено: ${share.toFixed(2)}% < 95% (бюджет помилок вичерпано: ${counts.unavailable} із ${total}).`);
      process.exitCode = 1;
    } else console.log(`SLO-2 виконано: ${share.toFixed(2)}% ≥ 95% (недоступний ${counts.unavailable} із ${total}).`);
  }
}
