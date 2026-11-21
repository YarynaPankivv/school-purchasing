"use server";

// Помічник «Запропонувати рядки» (design.md D2, D4 зміни impl-ai-helper): два кроки, між ними — людина.
//   1. suggestLine        — перевірити, хто кличе (getClaims) і чи це його чернетка, спитати модель, ПОВЕРНУТИ рядок у форму.
//                           Нічого не пише в БД: модель не має інструментів із записом.
//   2. addLineWithValues  — лише коли в формі немає порожнього рядка і людина натиснула «Додати рядок» на картці пропозиції:
//                           додати рядок із запропонованими значеннями після повторної перевірки на сервері. Закупівлю не подаємо.
// Авторизація й право редагувати — ДО виклику моделі: інакше будь-хто з інтернету витратить денний ліміт (50 запитів).
import { revalidatePath } from "next/cache";
import { recordAiCall } from "@/lib/ai/call-log";
import { classifyError, failureToSuggestResult, proposeDraft, toSuggestResult, unavailable, type SuggestResult } from "@/lib/ai/draft";
import { AI_DESCRIPTION_MAX, AI_MESSAGES } from "@/lib/ai/messages";
import { PRODUCT_MODELS } from "@/lib/ai/models";
import { productModel } from "@/lib/ai/openrouter";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { LineValuesSchema } from "@/lib/ai/schema";
import { requireActiveUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/org/departments";
import { parseLineFields } from "@/lib/pur/lines";
import { isPurchaseStatus } from "@/lib/pur/statuses";
import { canEditLines } from "@/lib/pur/visibility";

type Ctx = Awaited<ReturnType<typeof requireActiveUser>>;

// Заявка автора, яку він зараз може наповнювати рядками (та сама умова, що й для «Add line»: canEditLines перевіряє
// request.author_id === actor.id). Немає права чи рядка (RLS) — null.
async function editableRequest(ctx: Ctx, requestId: unknown) {
  if (typeof requestId !== "string" || !isUuid(requestId)) return null;
  const { data, error } = await ctx.supabase
    .from("requests")
    .select("id, status, author_id, editing")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data || !isPurchaseStatus(data.status)) return null;
  const actor = { id: ctx.user.id, role: ctx.user.role, is_active: ctx.user.isActive };
  return canEditLines({ ...data, status: data.status }, actor) ? data : null;
}

// AC-AI-01…06: пропозиція рядка за описом.
export async function suggestLine(requestId: unknown, description: unknown): Promise<SuggestResult> {
  const ctx = await requireActiveUser();
  if (!(await editableRequest(ctx, requestId))) return { kind: "forbidden" };
  const text = typeof description === "string" ? description.trim().slice(0, AI_DESCRIPTION_MAX) : "";
  if (!text) return { kind: "not_purchase", message: AI_MESSAGES.notPurchase };

  // Немає ключа → помічник «недоступний» (AC-AI-04), ручна форма працює далі.
  const model = productModel();
  if (!model) {
    // Запит помічника, що завершився «недоступний», входить у SLO-2, навіть якщо до моделі не дійшло (рев'ю CodeRabbit, PR 104):
    // рядок у ai_call_log є, події llm.call немає (виклику моделі не було).
    const result = unavailable("error");
    await recordAiCall(ctx.supabase, {
      requestId: crypto.randomUUID(),
      route: "/requests/[id]",
      model: PRODUCT_MODELS[0],
      primaryModel: PRODUCT_MODELS[0],
      result,
      latencyMs: 0,
      promptVersion: DRAFT_PROMPT_VERSION,
      modelCalled: false,
    });
    return result;
  }
  // WS11: кожен виклик моделі — рядок llm.call (журнал Vercel) і рядок ai_call_log (SLO-2); без тексту користувача.
  const started = performance.now();
  let answeredModel: string = PRODUCT_MODELS[0];
  let result: SuggestResult;
  try {
    const draft = await proposeDraft({ text }, model);
    if (draft.ok) answeredModel = draft.modelId;
    result = draft.ok ? toSuggestResult(draft.draft) : failureToSuggestResult(draft);
  } catch (error) {
    result = failureToSuggestResult(classifyError(error));
  }
  await recordAiCall(ctx.supabase, {
    requestId: crypto.randomUUID(),
    route: "/requests/[id]",
    model: answeredModel,
    primaryModel: PRODUCT_MODELS[0],
    result,
    latencyMs: performance.now() - started,
    promptVersion: DRAFT_PROMPT_VERSION,
  });
  return result;
}

// AC-AI-01 (Q6, варіант A): у формі немає порожнього рядка — додаємо рядок із запропонованими значеннями. Значення
// проходять zod і ті самі правила, що й ручне введення (parseLineFields), а запис іде під сесією користувача (RLS).
export async function addLineWithValues(requestId: unknown, values: unknown): Promise<{ ok: boolean }> {
  const ctx = await requireActiveUser();
  const request = await editableRequest(ctx, requestId);
  const zod = LineValuesSchema.safeParse(values);
  if (!request || !zod.success) return { ok: false };
  const parsed = parseLineFields({ name: zod.data.name, purpose: zod.data.purpose, quantity: zod.data.quantity, unit_price: zod.data.unitPrice });
  if (!parsed.ok) return { ok: false };
  const { error } = await ctx.supabase.from("request_lines").insert({ request_id: request.id, ...parsed.value });
  if (error) return { ok: false };
  revalidatePath("/requests", "layout");
  return { ok: true };
}
