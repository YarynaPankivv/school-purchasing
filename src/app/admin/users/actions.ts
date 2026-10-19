"use server";

// Працівники очима адміністратора (design.md D4, D8; tasks.md 2.2). Роль, активність і чернетки — задача 3.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { mapOrgDbError } from "@/lib/org/errors";
import { PERMISSION_KEYS, type Permissions } from "@/lib/org/request-options";

const LIST_PATH = "/admin/users";

// AC-ORG-17 (видати дозвіл) і AC-ORG-07, AC-ORG-08 (забрати): один рядок user_permissions на працівника.
export async function setPermissions(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  const path = `${LIST_PATH}/${userId}`;

  const ctx = await requireAdmin();
  if (!ctx.ok) redirect(`${path}?error=forbidden`); // AC-ORG-09

  const permissions = Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, formData.get(key) === "on"]),
  ) as Permissions;

  const { error } = await ctx.supabase
    .from("user_permissions")
    .upsert({ user_id: userId, ...permissions, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) redirect(`${path}?error=${mapOrgDbError(error, "user_permissions")}`);

  revalidatePath(LIST_PATH, "layout");
  redirect(`${path}?saved=1`);
}
