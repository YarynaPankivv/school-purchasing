import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { failureToSuggestResult, proposeDraft, toSuggestResult } from "@/lib/ai/draft";
import { PRODUCT_MODELS, makeProductModel } from "@/lib/ai/models";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { DraftSchema } from "@/lib/ai/schema";
import { acceptance, passRate, scoreCase, type GoldenCase } from "./scorer";
import casesJson from "../tests/fixtures/golden/cases.json";
import holdoutJson from "../tests/fixtures/golden/holdout.json";

// `npm run eval` — ЖИВИЙ прогін golden cases PM (ValiaBihun/2026-quitcode-dream-team#70) на безкоштовних моделях OpenRouter.
// SET=holdout — власний контрольний набір (tests/fixtures/golden/holdout.json): інші предмети й мета, ніж у промпті й у golden
// cases, плюс варіанти кейсу № 8 PM. Частку успіху рахуємо окремо від golden; записи — recorded-holdout.json, звіт — з суфіксом -holdout
// (фідбек WS10, пропозиція 4: 10 з 10 на наборі, під який підібрано приклади, ще не показує якості на реальному описі).
// Ніколи не в `npm test` і не в CI. Потрібен ваш ключ у .env.local (OPENROUTER_API_KEY). Без ключа кейси пропускаються — не помилка.
// Перший 429 зупиняє прогін: цей і решта кейсів — NOT RUN з причиною у звіті, у частку успіху не входять.
// Таймаут, помилка постачальника, відповідь не за схемою — FAIL з причиною (входять у частку успіху).
//   RUNS=2     — кілька прогонів поспіль для частки успіху; RECORD=1 — успішні відповіді злити в recorded.json (запис лише успішних);
//   ONLY=1,5   — лише ці кейси (налаштування промпту чи дозапис обірваного 429 прогону; звіт — з суфіксом -subset, не офіційний).
// PowerShell: $env:RECORD="1"; npm run eval   (а потім Remove-Item Env:RECORD)

const HOLDOUT = process.env.SET === "holdout";
const allCases = (HOLDOUT ? holdoutJson : casesJson) as GoldenCase[];
const only = (process.env.ONLY ?? "").split(",").map((v) => Number(v.trim())).filter(Boolean);
const cases = only.length > 0 ? allCases.filter((c) => only.includes(c.id)) : allCases;
const key = process.env.OPENROUTER_API_KEY;
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const RECORDED_PATH = HOLDOUT ? "tests/fixtures/golden/recorded-holdout.json" : "tests/fixtures/golden/recorded.json";
const REPORT_DIR = "evals/reports";

// Бюджет: на прогін — по одному виклику моделі на кейс, з одного денного лічильника акаунта (50/день без покупки ≥10 кредитів).
const NEEDED = RUNS * cases.length;
const GAP_MS = 3_000; // ≤ 20 запитів/хв

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
type Row = { run: number; id: number; modelId: string; kind: string; pass: boolean; notRun?: boolean; why?: string };
const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
let stoppedAt: string | undefined;

describe.skipIf(!key)("golden cases, живий прогін (безкоштовні моделі OpenRouter)", () => {
  beforeAll(async () => {
    // Скільки безкоштовних запитів лишилось сьогодні (UTC-доба; у листопаді скидається о 02:00 за Києвом).
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    const body = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
    const remaining = body.data?.free_model_daily_requests?.remaining;
    if (typeof remaining === "number" && remaining < NEEDED) {
      throw new Error(`Сьогодні лишилось ${remaining} безкоштовних запитів, потрібно ${NEEDED}. Запустіть завтра або зменште RUNS.`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`прогін ${run}: golden ${c.id}`, async (ctx) => {
        if (stoppedAt) {
          rows.push({ run, id: c.id, modelId: "—", kind: "—", pass: false, notRun: true, why: `NOT RUN: зупинено після 429 (${stoppedAt})` });
          return ctx.skip();
        }
        await sleep(GAP_MS);
        // maxRetries 0: денний 429 повтором не виправити, повтор лише з'їдає ліміт.
        const result = await proposeDraft({ text: c.input }, makeProductModel(key), { maxRetries: 0, timeoutMs: 90_000 });
        if (!result.ok) {
          // Рядок у звіт — ДО перевірки: інакше кейс зникає зі звіту, і частку успіху рахують з меншого знаменника.
          if (result.reason === "rate_limited") {
            stoppedAt = `${c.id}, прогін ${run}`;
            rows.push({ run, id: c.id, modelId: "—", kind: "—", pass: false, notRun: true, why: `NOT RUN: 429 — ${result.message}` });
            return ctx.skip();
          }
          // Таймаут, помилка постачальника, відповідь не за схемою — це FAIL з причиною, він входить у частку успіху.
          rows.push({ run, id: c.id, modelId: "—", kind: failureToSuggestResult(result).kind, pass: false, why: `${result.reason}: ${result.message}` });
        }
        expect(result.ok, result.ok ? "" : `${result.reason}: ${result.message}`).toBe(true);
        if (!result.ok) return;
        const suggestion = toSuggestResult(result.draft);
        const score = scoreCase(c.expected, suggestion);
        rows.push({ run, id: c.id, modelId: result.modelId, kind: suggestion.kind, pass: score.pass, why: score.mismatches.join("; ") });
        // Записуємо ЛИШЕ успішні відповіді: офлайн-реплей у CI має лишатися зеленим.
        if (RECORD && score.pass) {
          fresh[String(c.id)] = {
            modelId: result.modelId,
            recordedAt: new Date().toISOString(),
            promptVersion: DRAFT_PROMPT_VERSION,
            text: JSON.stringify(DraftSchema.parse(result.draft)),
          };
        }
        expect(score.mismatches).toEqual([]);
      });
    }
  }

  afterAll(() => {
    console.table(rows); // яка модель з ланцюжка відповіла на кожен кейс: бал — за модель, а не «за AI»
    writeReport();
    if (RECORD && Object.keys(fresh).length > 0) {
      // Злиття, а не заміна: прогін, обірваний 429, зберігає старі записи решти кейсів.
      const old = JSON.parse(readFileSync(RECORDED_PATH, "utf8")) as Record<string, Recording>;
      writeFileSync(RECORDED_PATH, JSON.stringify({ ...old, ...fresh }, null, 2) + "\n");
    }
  });
});

// Рядок про поріг приймання PM: лише для повного прогону golden cases; holdout і підмножина його не мають.
function acceptanceLine(verdict: ReturnType<typeof acceptance>): string {
  if (HOLDOUT) return "- Поріг приймання PM тут не застосовується: holdout — власний контрольний набір, частка успіху окремо від golden cases PM";
  if (only.length > 0) return "- Поріг приймання: не рахуємо на підмножині кейсів";
  return `- Поріг приймання PM (не менше ${8} з 10, обов'язково № 1, 8, 11; перший прогін): **${verdict.accepted ? "прийнято" : "не прийнято"}**${verdict.missingRequired.length ? ` — не пройшли обов'язкові: ${verdict.missingRequired.join(", ")}` : ""}`;
}

// Суфікс імені звіту: -holdout для власного набору, -subset для налаштування на підмножині кейсів.
const reportSuffix = () => `${HOLDOUT ? "-holdout" : ""}${only.length > 0 ? "-subset" : ""}`;

// Звіт для домашки: частка успіху загалом і за моделлю + кожен кейс. Файл комітять (він без секретів).
function writeReport() {
  if (rows.length === 0) return;
  const ran = rows.filter((r) => !r.notRun);
  const notRun = rows.filter((r) => r.notRun);
  const total = passRate(ran);
  const byModel = new Map<string, Row[]>();
  for (const r of ran) byModel.set(r.modelId, [...(byModel.get(r.modelId) ?? []), r]);
  const verdict = acceptance(ran.filter((r) => r.pass && r.run === 1).map((r) => r.id));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [
    `# Живий прогін ${HOLDOUT ? "holdout (власний набір)" : "golden cases"} — ${new Date().toISOString()}`,
    "",
    `- Промпт: \`${DRAFT_PROMPT_VERSION}\`; ланцюжок моделей: ${PRODUCT_MODELS.map((m) => `\`${m}\``).join(" → ")}; суддя не потрібен (у результаті немає вільного тексту)`,
    `- Прогонів: ${RUNS}; кейсів у прогоні: ${cases.length}${only.length > 0 ? ` (ONLY=${only.join(",")} — налаштування, не офіційний прогін)` : ""}`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь`,
    acceptanceLine(verdict),
    `- Не запущено (NOT RUN): ${notRun.length}${stoppedAt ? ` — ліміт 429, зупинено на: ${stoppedAt}` : ""}`,
    "",
    "| Модель, що відповіла | Пройшло | Усього |",
    "|---|---|---|",
    ...[...byModel].map(([m, rs]) => `| \`${m}\` | ${passRate(rs).passed} | ${rs.length} |`),
    "",
    "| Прогін | Кейс | Модель | Результат помічника | Кейс | Причина FAIL / помилка |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.run} | ${r.id} | \`${r.modelId}\` | ${r.kind} | ${r.notRun ? "NOT RUN" : r.pass ? "✅" : "❌"} | ${(r.why ?? "").replaceAll("|", "/")} |`),
    "",
  ];
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${stamp}${reportSuffix()}.md`, lines.join("\n"));
  console.log(`Звіт: ${REPORT_DIR}/${stamp}.md`);
}
