"use server";

// Чернетка заявки (design.md D5, D8; tasks.md 1.6). Рядки, суми й подання — зріз WS7.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";
import { mapOrgDbError } from "@/lib/org/errors";
import { BASE_REQUEST_TYPES, isRequestType, purchaseTypeFor } from "@/lib/org/requests";

const PATH = "/requests/new";

export async function createDraftRequest(formData: FormData) {
  const { supabase, user } = await requireActiveUser();

  const departmentId = String(formData.get("department_id") ?? "");
  const type = formData.get("type");
  if (!departmentId || !isRequestType(type) || !BASE_REQUEST_TYPES.includes(type)) {
    redirect(`${PATH}?error=invalid_request`);
  }

  // AC-ORG-01: відділ, де автор не заявник, база відхиляє (requests_insert → private.is_member) — і для admin
  // (тимчасово Q1). UI такого відділу у виборі не показує.
  const { error } = await supabase.from("requests").insert({
    author_id: user.id,
    department_id: departmentId,
    type,
    purchase_type: purchaseTypeFor(type),
  });
  if (error) redirect(`${PATH}?error=${mapOrgDbError(error, "requests")}`);

  revalidatePath(PATH);
  redirect(`${PATH}?created=1`);
}
