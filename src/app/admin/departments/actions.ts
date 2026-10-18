"use server";

// Налаштування відділів адміністратором (design.md D2, D3, D8; tasks.md 1.5).
// Кожна дія — один SQL-запит; каскади й похідну роль тримає база (FK, тригер private.sync_role).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeDepartmentName } from "@/lib/org/departments";
import { mapOrgDbError, type DbError, type OrgErrorCode, type OrgTable } from "@/lib/org/errors";

const LIST_PATH = "/admin/departments";
const detailPath = (departmentId: string) => `${LIST_PATH}/${departmentId}`;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function fail(path: string, code: OrgErrorCode): never {
  redirect(`${path}?error=${code}`);
}

function finish(path: string, error: DbError, table: OrgTable): never {
  if (error) fail(path, mapOrgDbError(error, table));
  revalidatePath(LIST_PATH, "layout");
  redirect(path);
}

async function adminOr(path: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) fail(path, "forbidden"); // AC-ORG-09
  return ctx.supabase;
}

export async function createDepartment(formData: FormData) {
  const supabase = await adminOr(LIST_PATH);
  const name = normalizeDepartmentName(formData.get("name"));
  if (!name) fail(LIST_PATH, "invalid_name");

  const { error } = await supabase.from("departments").insert({ name });
  finish(LIST_PATH, error, "departments");
}

// AC-ORG-01: працівник стає заявником відділу.
export async function addMember(formData: FormData) {
  const departmentId = field(formData, "department_id");
  const path = detailPath(departmentId);
  const supabase = await adminOr(path);

  const { error } = await supabase
    .from("department_members")
    .insert({ department_id: departmentId, user_id: field(formData, "user_id") });
  finish(path, error, "department_members");
}

// AC-ORG-03, AC-ORG-15: каскад знімає і схвалювача цього відділу, і автосхвалення (рядок членства).
export async function removeMember(formData: FormData) {
  const departmentId = field(formData, "department_id");
  const path = detailPath(departmentId);
  const supabase = await adminOr(path);

  const { error } = await supabase
    .from("department_members")
    .delete()
    .eq("department_id", departmentId)
    .eq("user_id", field(formData, "user_id"));
  finish(path, error, "department_members");
}

// AC-ORG-06: автосхвалення — лише для цього відділу (прапорець членства).
export async function setAutoApprove(formData: FormData) {
  const departmentId = field(formData, "department_id");
  const path = detailPath(departmentId);
  const supabase = await adminOr(path);

  const { error } = await supabase
    .from("department_members")
    .update({ auto_approve: formData.get("auto_approve") === "on" })
    .eq("department_id", departmentId)
    .eq("user_id", field(formData, "user_id"));
  finish(path, error, "department_members");
}

// AC-ORG-02: не-заявника база відхиляє (FK, 23503) → «Спершу додайте працівника до відділу як заявника».
// AC-ORG-05: роль approver ставить тригер private.sync_role (admin лишається admin — AC-ORG-11, тимчасово Q4).
export async function addApprover(formData: FormData) {
  const departmentId = field(formData, "department_id");
  const path = detailPath(departmentId);
  const supabase = await adminOr(path);

  const { error } = await supabase
    .from("department_approvers")
    .insert({ department_id: departmentId, user_id: field(formData, "user_id") });
  finish(path, error, "department_approvers");
}

// AC-ORG-04: схвалювач лише одного відділу після зняття стає requester (тригер; тимчасово Q3 — для кількох).
export async function removeApprover(formData: FormData) {
  const departmentId = field(formData, "department_id");
  const path = detailPath(departmentId);
  const supabase = await adminOr(path);

  const { error } = await supabase
    .from("department_approvers")
    .delete()
    .eq("department_id", departmentId)
    .eq("user_id", field(formData, "user_id"));
  finish(path, error, "department_approvers");
}
