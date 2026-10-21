"use server";

// Працівники очима адміністратора (design.md D4, D6, D8; tasks.md 2.2, 3.2): дозволи, роль admin, активність,
// чернетки деактивованого. Правила «лишається хоча б один активний адміністратор» і «роль після зняття admin»
// тримає тригер private.guard_profile_update(); дія лише перетворює його виняток на текст PM.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/org/departments";
import { mapOrgDbError, type OrgErrorCode } from "@/lib/org/errors";
import { PERMISSION_KEYS, type Permissions } from "@/lib/org/request-options";
import { canDeleteDraft } from "@/lib/org/users";

const LIST_PATH = "/admin/users";
const userPath = (userId: string) => `${LIST_PATH}/${userId}`;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function fail(path: string, code: OrgErrorCode): never {
  redirect(`${path}?error=${code}`);
}

// AC-ORG-09: дію виконує лише admin; решті — «Недостатньо прав».
async function adminOr(path: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) fail(path, "forbidden");
  return ctx.supabase;
}

function done(path: string, saved: string): never {
  revalidatePath(LIST_PATH, "layout");
  redirect(`${path}?saved=${saved}`);
}

// AC-ORG-17 (видати дозвіл) і AC-ORG-07, AC-ORG-08 (забрати): один рядок user_permissions на працівника.
export async function setPermissions(formData: FormData) {
  const userId = field(formData, "user_id");
  const path = userPath(userId);

  const supabase = await adminOr(path);

  const permissions = Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, formData.get(key) === "on"]),
  ) as Permissions;

  const { error } = await supabase
    .from("user_permissions")
    .upsert({ user_id: userId, ...permissions, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) fail(path, mapOrgDbError(error, "user_permissions"));

  done(path, "1");
}

// AC-ORG-10, AC-ORG-18, AC-ORG-21: зміна ролі admin через public.admin_set_role (прямого grant на role немає).
// Знімаємо роль → функція ставить похідну (requester/approver), а тригер не дає лишити систему без активного
// адміністратора (ORG01 → «At least one active administrator must remain»).
export async function setAdminRole(formData: FormData) {
  const userId = field(formData, "user_id");
  const path = isUuid(userId) ? userPath(userId) : LIST_PATH;
  const supabase = await adminOr(path);
  if (!isUuid(userId)) fail(LIST_PATH, "not_found");

  const makeAdmin = field(formData, "make_admin") === "1";
  const { data: found, error } = await supabase.rpc("admin_set_role", { target_user: userId, make_admin: makeAdmin });
  if (error) fail(path, mapOrgDbError(error, "profiles"));
  if (!found) fail(path, "not_found");

  done(path, makeAdmin ? "admin_on" : "admin_off");
}

// AC-ORG-12: деактивований не входить (login() і requireActiveUser()); AC-ORG-18: єдиний активний адміністратор
// не деактивує себе (ORG01). Зміна — через public.admin_set_active (прямого grant на is_active немає). Подані заявки й чернетки лишаються, доки адміністратор не видалить чернетку.
export async function setActive(formData: FormData) {
  const userId = field(formData, "user_id");
  const path = isUuid(userId) ? userPath(userId) : LIST_PATH;
  const supabase = await adminOr(path);
  if (!isUuid(userId)) fail(LIST_PATH, "not_found");

  const isActive = field(formData, "active") === "1";
  const { data: found, error } = await supabase.rpc("admin_set_active", { target_user: userId, make_active: isActive });
  if (error) fail(path, mapOrgDbError(error, "profiles"));
  if (!found) fail(path, "not_found");

  done(path, isActive ? "activated" : "deactivated");
}

// AC-ORG-13: видаляємо чернетку деактивованого працівника; подані заявки не чіпаємо — і фільтр status = 'draft',
// і політика requests_delete_draft_admin віддають на видалення лише чернетки.
export async function deleteDraft(formData: FormData) {
  const userId = field(formData, "user_id");
  const requestId = field(formData, "request_id");
  const path = isUuid(userId) ? userPath(userId) : LIST_PATH;
  const supabase = await adminOr(path);
  if (!isUuid(userId) || !isUuid(requestId)) fail(path, "not_found");

  const [{ data: request, error: requestError }, { data: author, error: authorError }] = await Promise.all([
    supabase.from("requests").select("id, status, author_id").eq("id", requestId).eq("author_id", userId).maybeSingle(),
    supabase.from("profiles").select("is_active").eq("id", userId).maybeSingle(),
  ]);
  if (requestError) fail(path, mapOrgDbError(requestError, "requests"));
  if (authorError) fail(path, mapOrgDbError(authorError, "profiles"));
  if (!request || !author) fail(path, "not_found");
  if (!canDeleteDraft(request, author.is_active)) fail(path, "not_a_draft");

  const { error } = await supabase.from("requests").delete().eq("id", requestId).eq("status", "draft");
  if (error) fail(path, mapOrgDbError(error, "requests"));

  done(path, "draft_deleted");
}
