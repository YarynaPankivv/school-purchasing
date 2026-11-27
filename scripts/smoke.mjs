#!/usr/bin/env node
// Smoke розгорнутого застосунку (D0 + WS11): лише GET, без входу й форм (Node 24, без залежностей).
// WS11: змінна VERCEL_AUTOMATION_BYPASS_SECRET (лише з GitHub Secrets) → кожен запит несе заголовок
// x-vercel-protection-bypass, і smoke відкриває preview та staging за захистом Vercel. Значення секрету скрипт
// ніколи не друкує: у журналі лише bypass=true/false. SMOKE_TARGET=deploy (ставить workflow для preview і staging)
// змінює лише підказки в повідомленнях про збій. Джерело: materials/ops-kit/scripts/smoke.mjs курсу WS11.
// Використання: node scripts/smoke.mjs <base-url> [expected-sha]     (або npm run smoke -- <base-url> [sha])
//   1) "/"           → редірект на /login або 200 (не 401/404/5xx і не стіна входу Vercel);
//   2) "/login"      → 200 і поле пароля (застосунок справді віддає сторінку);
//   3) "/api/health" → 200 {db:"ok"}; з expected-sha — sha збігається (до 6 спроб × 20 с: прод-домен перемикається
//                      на новий деплой не миттєво).
// Код виходу: 0 — усе гаразд, 1 — є збій (рядки ::error:: видно в GitHub Actions), 2 — не вказано адресу.
import { isTrustedBypassTarget } from "./lib/bypass-target.mjs";
import { checkSupabaseRef } from "./lib/supabase-ref.mjs";
const [rawBase = process.env.PROD_URL ?? "", expectSha = ""] = process.argv.slice(2);
// client_payload.url від Vercel може прийти хостом без схеми — додаємо https://.
const base = (/^https?:\/\//.test(rawBase) ? rawBase : rawBase ? `https://${rawBase}` : "").replace(/\/+$/, "");

const bypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
const expectRef = (process.env.EXPECT_SUPABASE_REF ?? "").trim();
const forbidRef = (process.env.FORBID_SUPABASE_REF ?? "").trim();
const target = process.env.SMOKE_TARGET === "deploy" ? "deploy" : "prod";
const headers = { "user-agent": "smoke/2.0 (WS11)" };
// x-vercel-set-bypass-cookie не шлемо: він потрібен браузеру й дає редірект із Set-Cookie, а тут redirect:"manual".
if (bypass) headers["x-vercel-protection-bypass"] = bypass;

const get = async (path) => {
  try {
    const r = await fetch(base + path, {
      redirect: "manual",
      headers,
      // Ліміт і на відповідь, і на читання тіла: зависле з'єднання стане збоєм у fail, а не зависанням прогону.
      signal: AbortSignal.timeout(15_000),
    });
    return {
      status: r.status,
      location: r.headers.get("location") ?? "",
      vercelError: r.headers.get("x-vercel-error") ?? "",
      text: await r.text(),
    };
  } catch (e) {
    return { status: 0, location: "", vercelError: "", text: String(e.cause?.code ?? e) };
  }
};
// Підказка залежить від того, що перевіряємо і чи є секрет обходу.
function wallHint() {
  if (bypass) {
    return "Vercel не прийняв секрет обходу — його перегенерували чи видалили? Скопіюйте актуальний з Vercel (Settings → Deployment Protection → Protection Bypass for Automation) у GitHub Secrets VERCEL_AUTOMATION_BYPASS_SECRET і зробіть Redeploy";
  }
  if (target === "deploy") {
    return "деплой за захистом Vercel, а секрету обходу немає — увімкніть Protection Bypass for Automation (Vercel → Settings → Deployment Protection) і додайте значення в GitHub Secrets як VERCEL_AUTOMATION_BYPASS_SECRET";
  }
  return "прод за стіною входу Vercel — Settings → Deployment Protection: Standard Protection (захищає preview і staging, прод відкритий), не All Deployments";
}
const vercelWall = (r) =>
  /vercel\.com\/(sso|login)|_vercel_sso/.test(r.location) || ((r.status === 401 || r.status === 403) && /vercel/i.test(r.text));

async function main() {
  const fail = [];
  const root = await get("/");
  if (vercelWall(root)) fail.push(`"/": ${wallHint()}`);
  else if (root.status === 0) fail.push(`"/": недоступний (${root.text})`);
  else if (root.status >= 300 && root.status < 400 && new URL(root.location || "/", base).pathname !== "/login") {
    fail.push(`"/": редірект на ${root.location || "(без Location)"}, очікували /login`);
  } else if (root.status >= 400) {
    const hint = root.vercelError === "MIDDLEWARE_INVOCATION_FAILED" ? " — у Vercel бракує NEXT_PUBLIC_SUPABASE_*?" : "";
    fail.push(`"/": HTTP ${root.status} ${root.vercelError}${hint}`.trim());
  }

  const login = await get("/login");
  if (login.status !== 200 || !/type=["']?password/i.test(login.text)) {
    fail.push(`"/login": HTTP ${login.status} ${login.vercelError}${login.status === 200 ? " (немає поля пароля)" : ""}`.trim());
  }

  let health = null;
  for (let attempt = 1; attempt <= (expectSha ? 6 : 1) && login.status === 200; attempt++) {
    const r = await get("/api/health");
    try {
      health = { status: r.status, ...JSON.parse(r.text) };
    } catch {
      health = { status: r.status, location: r.location };
    }
    // sha=local — Vercel не віддає VERCEL_GIT_COMMIT_SHA: чекати марно.
    if (!expectSha || health.sha === expectSha || health.sha === "local") break;
    if (attempt < 6) await new Promise((res) => setTimeout(res, 20_000));
  }
  if (!health) {
    // прод не відкрився — причина вже у fail
  } else if (health.status === 404) {
    fail.push(`"/api/health": 404 — додайте src/app/api/health/route.ts`);
  } else if (health.status >= 300 && health.status < 400) {
    fail.push(`"/api/health": ${health.status} → ${health.location} — додайте "/api/health" у PUBLIC_PATHS (src/lib/supabase/proxy.ts)`);
  } else if (health.reason === "paused") {
    fail.push(`"/api/health": Supabase призупинено — Dashboard → Resume project (безкоштовний проєкт засинає після тижня без активності)`);
  } else if (health.reason === "invalid-api-key") {
    fail.push(`"/api/health": ключ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY у Vercel не приймається — звірте змінні Production і зробіть Redeploy`);
  } else if (health.db !== "ok") {
    fail.push(
      `"/api/health": HTTP ${health.status}, db=${health.db ?? "?"}${health.reason ? ` (${health.reason})` : ""} — Supabase недоступний чи NEXT_PUBLIC_SUPABASE_URL у Vercel не той?`,
    );
  }
  // Дія з postmortem: у яку базу дивиться деплой (EXPECT/FORBID_SUPABASE_REF із змінних репо; без них перевірки немає).
  // supabaseRef віддається і при «db: down»: саме так видно хибну адресу, яка давала status-0.
  if (health && typeof health === "object" && health.status !== 404 && !(health.status >= 300 && health.status < 400)) {
    fail.push(...checkSupabaseRef({ actual: health.supabaseRef, expect: expectRef, forbid: forbidRef }));
  }
  if (expectSha && health?.sha === "local") {
    fail.push(`"/api/health": sha=local — у Vercel увімкніть Settings → Environment Variables → «Automatically expose System Environment Variables» і зробіть Redeploy`);
  } else if (expectSha && health?.sha && health.sha !== expectSha) {
    const why = target === "deploy" ? "адреса деплою показує інший коміт — чи та адреса в client_payload.url?" : "деплой main не пройшов чи зроблено Instant Rollback?";
    fail.push(`${base} показує ${String(health.sha).slice(0, 7)}, а очікувався ${expectSha.slice(0, 7)} — ${why}`);
  }

  // Лише статуси й відповідь /api/health (вона публічна й без секретів: sha, appEnv, supabaseRef). Секрет — тільки true/false.
  console.log(JSON.stringify({ base, target, bypass: Boolean(bypass), root: root.status, login: login.status, health }));
  for (const f of fail) console.log(`::error title=smoke ${base}::${f}`);
  if (!fail.length) console.log("OK — застосунок живий, сторінка входу відкривається, база відповідає.");
  return fail.length ? 1 : 0;
}

// process.exitCode, а не process.exit(): на Windows exit() після fetch падає з assertion libuv.
if (!base) {
  console.error("Використання: node scripts/smoke.mjs <base-url> [expected-sha]  (або змінна PROD_URL)");
  process.exitCode = 2;
} else if (bypass && !isTrustedBypassTarget(base, { prodUrl: process.env.PROD_URL ?? "", scope: process.env.VERCEL_SCOPE ?? "" })) {
  // Перший запит по HTTP віддав би секрет відкритим каналом, а редірект на HTTPS його вже не захистить (рев'ю CodeRabbit, PR 99).
  // Без секрету HTTP лишається можливим — для локальних перевірок (npm run smoke -- http://localhost:3000).
  console.error("Секрет обходу Vercel можна передавати лише на https-адресу цього проєкту (<проєкт>.vercel.app чи <проєкт>-…-<VERCEL_SCOPE>.vercel.app; змінні PROD_URL і VERCEL_SCOPE) без логіна, пароля й керівних символів.");
  process.exitCode = 2;
} else {
  process.exitCode = await main();
}
