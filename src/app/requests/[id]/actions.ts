"use server";

// Дії над закупівлею (design.md D4, D5, D7; tasks.md 1.3). Кожна починає з requireActiveUser() (getClaims()),
// перевіряє введене TS-правилами src/lib/pur/* ще до запиту й перетворює `pur:<код>` бази на текст через сторінку
// (`?error=<код>`). Перехід статусу — одна функція Postgres через supabase.rpc (транзакція в базі), прості записи полів і
// рядків — окремі запити; останнє слово завжди за RLS і функціями міграції 20261021140000_pur_drafts.sql.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/org/departments";
import { isPurchaseType } from "@/lib/org/requests";
import { mapPurDbError, type PurErrorCode } from "@/lib/pur/errors";
import { parseLineFields, parseNote } from "@/lib/pur/lines";
import { canEditFields, canEditLines } from "@/lib/pur/visibility";
import { isPurchaseStatus } from "@/lib/pur/statuses";
import type { DbError } from "@/lib/org/errors";
import type { Database } from "@/lib/supabase/database.types";

type RequestUpdate = Database["public"]["Tables"]["requests"]["Update"];

type Ctx = Awaited<ReturnType<typeof requireActiveUser>>;

const LIST_PATH = "/requests";
const detailPath = (id: string) => `${LIST_PATH}/${id}`;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// Помилка → сторінка закупівлі: `?error=<код>` (і `&detail=…` для невалідного введення чи списку неповних рядків).
function fail(path: string, code: PurErrorCode, detail?: string | null): never {
  const query = new URLSearchParams({ error: code });
  if (detail) query.set("detail", detail);
  redirect(`${path}?${query.toString()}`);
}

function failDb(path: string, error: NonNullable<DbError>): never {
  const code = mapPurDbError(error);
  // DETAIL Postgres (напр. 23514) може містити значення рядка таблиці: в адресу й на сторінку — лише розбір неповних рядків.
  fail(path, code, code === "lines_incomplete" ? (error.details ?? null) : null);
}

function done(path: string, saved: string): never {
  revalidatePath(LIST_PATH, "layout");
  redirect(`${path}?saved=${saved}`);
}

// Заявка, з якою працюємо, у тому вигляді, як її дозволяє бачити RLS (немає права — немає рядка).
async function loadRequest(ctx: Ctx, id: string, path: string) {
  const { data, error } = await ctx.supabase
    .from("requests")
    .select("id, status, author_id, editing")
    .eq("id", id)
    .maybeSingle();
  if (error) failDb(path, error);
  if (!data || !isPurchaseStatus(data.status)) fail(path, "forbidden");
  return { ...data, status: data.status };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Поля заявки з форми → колонки requests (колонковий grant update: department_id, purchase_type, note,
// delivery_date, on_behalf_of_id, updated_at). Порожнє значення — null (чернетка).
function requestFields(formData: FormData): { ok: true; value: RequestUpdate } | { ok: false; code: PurErrorCode; detail?: string } {
  const note = parseNote(formData.get("note"));
  if (!note.ok) return { ok: false, code: "invalid_input", detail: note.error };

  const rawDate = field(formData, "delivery_date");
  if (rawDate && (!DATE_RE.test(rawDate) || Number.isNaN(Date.parse(rawDate)))) {
    return { ok: false, code: "invalid_input", detail: "Delivery date must be a valid date." };
  }

  // AC-PUR-12: позначка «від імені колеги» без вибору колеги — заявку не зберігаємо. Чи колега допустимий
  // (AC-PUR-13), перевіряє база (requests_update_author → can_act_on_behalf).
  const flag = formData.get("on_behalf_flag") === "on";
  const colleague = field(formData, "on_behalf_of_id");
  if (flag && !colleague) return { ok: false, code: "on_behalf_required" };
  if (flag && !isUuid(colleague)) return { ok: false, code: "on_behalf_invalid" };

  const departmentId = field(formData, "department_id");
  if (departmentId && !isUuid(departmentId)) return { ok: false, code: "invalid_input" };
  const purchaseType = field(formData, "purchase_type");

  return {
    ok: true,
    value: {
      department_id: departmentId || null,
      purchase_type: isPurchaseType(purchaseType) ? purchaseType : "procurement",
      note: note.value,
      delivery_date: rawDate || null,
      on_behalf_of_id: flag ? colleague : null,
      updated_at: new Date().toISOString(),
    },
  };
}

// Рядки з форми: `line_id` повторюється, поля — `line_<id>_name|purpose|quantity|unit_price`.
async function saveLines(ctx: Ctx, id: string, path: string, formData: FormData) {
  for (const raw of formData.getAll("line_id")) {
    const lineId = String(raw);
    if (!isUuid(lineId)) fail(path, "invalid_input");
    const parsed = parseLineFields({
      name: formData.get(`line_${lineId}_name`),
      purpose: formData.get(`line_${lineId}_purpose`),
      quantity: formData.get(`line_${lineId}_quantity`),
      unit_price: formData.get(`line_${lineId}_unit_price`),
    });
    if (!parsed.ok) fail(path, "invalid_input", Object.values(parsed.errors).join(" "));
    const { error } = await ctx.supabase.from("request_lines").update(parsed.value).eq("id", lineId).eq("request_id", id);
    if (error) failDb(path, error);
  }
}

// Зберігає те, що автор зараз може змінювати: поля — у чернетці й поверненій заявці, рядки — ще й у поданій на редагуванні.
async function persist(ctx: Ctx, request: Awaited<ReturnType<typeof loadRequest>>, path: string, formData: FormData) {
  const actor = { id: ctx.user.id, role: ctx.user.role, is_active: ctx.user.isActive };
  if (canEditFields(request, actor)) {
    const fields = requestFields(formData);
    if (!fields.ok) fail(path, fields.code, fields.detail);
    const { data, error } = await ctx.supabase.from("requests").update(fields.value).eq("id", request.id).select("id");
    if (error) failDb(path, error);
    if (!data?.length) fail(path, "forbidden");
  }
  if (canEditLines(request, actor)) await saveLines(ctx, request.id, path, formData);
}

async function authorRequest(formData: FormData) {
  const id = field(formData, "id");
  if (!isUuid(id)) redirect(`${LIST_PATH}?error=not_found`);
  const path = detailPath(id);
  const ctx = await requireActiveUser();
  const request = await loadRequest(ctx, id, path);
  return { ctx, request, path, id };
}

// Зберегти чернетку (або поля/рядки поверненої чи поданої на редагуванні заявки).
export async function saveDraft(formData: FormData) {
  const { ctx, request, path } = await authorRequest(formData);
  await persist(ctx, request, path, formData);
  done(path, "draft");
}

export async function addLine(formData: FormData) {
  const { ctx, request, path, id } = await authorRequest(formData);
  await persist(ctx, request, path, formData);
  // Позицію присвоює тригер assign_line_position; порожній рядок дозволений у чернетці (повноту перевіряє подання).
  const { error } = await ctx.supabase.from("request_lines").insert({ request_id: id });
  if (error) failDb(path, error);
  done(path, "line_added");
}

export async function removeLine(formData: FormData) {
  const { ctx, path, id } = await authorRequest(formData);
  const lineId = field(formData, "line_id_to_remove");
  if (!isUuid(lineId)) fail(path, "invalid_input");
  const { error } = await ctx.supabase.from("request_lines").delete().eq("id", lineId).eq("request_id", id);
  if (error) failDb(path, error);
  done(path, "line_removed");
}

// AC-PUR-05, 09, 14, 16, 23, 37, 45: подання — функція Postgres; перед нею зберігаємо те, що в формі.
export async function submitPurchase(formData: FormData) {
  const { ctx, request, path, id } = await authorRequest(formData);
  await persist(ctx, request, path, formData);
  const { data, error } = await ctx.supabase.rpc("submit_purchase", { target_request: id });
  if (error) failDb(path, error);
  done(path, data === "approved" ? "submitted_approved" : "submitted");
}

// AC-PUR-26: автор відкриває подану заявку на редагування (рішення блокуються) і зберігає зміни.
export async function setEditing(formData: FormData) {
  const { ctx, request, path, id } = await authorRequest(formData);
  const makeEditing = field(formData, "editing") === "1";
  if (!makeEditing) await persist(ctx, request, path, formData);
  const { error } = await ctx.supabase.rpc("set_purchase_editing", { target_request: id, make_editing: makeEditing });
  if (error) failDb(path, error);
  done(path, makeEditing ? "editing_on" : "editing_off");
}

// AC-PUR-29, 30, 31: чернетку видаляє, решту — переводить у «Скасовано».
export async function cancelPurchase(formData: FormData) {
  const { ctx, path, id } = await authorRequest(formData);
  const { data, error } = await ctx.supabase.rpc("cancel_purchase", { target_request: id });
  if (error) failDb(path, error);
  if (data === "deleted") {
    revalidatePath(LIST_PATH, "layout");
    redirect(`${LIST_PATH}?saved=deleted`);
  }
  done(path, "cancelled");
}

// AC-PUR-32: копія — нова чернетка; переходимо до неї.
export async function copyPurchase(formData: FormData) {
  const { ctx, path, id } = await authorRequest(formData);
  const { data, error } = await ctx.supabase.rpc("copy_purchase", { target_request: id });
  if (error) failDb(path, error);
  if (!data || !isUuid(data)) fail(path, "unknown");
  done(detailPath(data), "copied");
}

// AC-PUR-17…25, 36, 39…43, 51, 52, 54: рішення схвалювача чи відділу закупівель (admin). Права, причину й стан
// перевіряє функція `decide_purchase`; тут — лише розбір форми.
export async function decidePurchase(formData: FormData) {
  const { ctx, path, id } = await authorRequest(formData);
  const decision = field(formData, "decision");
  if (decision !== "approve" && decision !== "reject" && decision !== "return") fail(path, "invalid_input");
  const rejected = formData.getAll("rejected_line_id").map(String);
  if (!rejected.every(isUuid)) fail(path, "invalid_input");
  const { data, error } = await ctx.supabase.rpc("decide_purchase", {
    target_request: id,
    decision,
    reason_text: field(formData, "reason") || undefined,
    rejected_line_ids: rejected.length ? rejected : undefined,
  });
  if (error) failDb(path, error);
  done(path, `decided_${data ?? decision}`);
}

// AC-PUR-27, 36: admin повертає відхилену чи повернуту заявку на схвалення.
export async function reopenPurchase(formData: FormData) {
  const { ctx, path, id } = await authorRequest(formData);
  const { error } = await ctx.supabase.rpc("reopen_purchase", { target_request: id });
  if (error) failDb(path, error);
  done(path, "reopened");
}

// AC-PUR-28, 50, 52: admin відхиляє вже схвалену заявку з причиною.
export async function adminRejectPurchase(formData: FormData) {
  const { ctx, path, id } = await authorRequest(formData);
  const { error } = await ctx.supabase.rpc("admin_reject_purchase", { target_request: id, reason_text: field(formData, "reason") });
  if (error) failDb(path, error);
  done(path, "admin_rejected");
}
