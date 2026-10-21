"use server";

// Чернетка заявки (design.md D5, D8; tasks.md 1.6, 2.2). Рядки, суми й подання — зріз WS7.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/org/departments";
import { mapOrgDbError } from "@/lib/org/errors";
import { loadPermissions } from "@/lib/org/load-permissions";
import { canCreateRequest } from "@/lib/org/request-options";
import { isRequestType, purchaseTypeFor } from "@/lib/org/requests";

const PATH = "/requests/new";

export async function createDraftRequest(formData: FormData) {
  const { supabase, user } = await requireActiveUser();

  const departmentId = String(formData.get("department_id") ?? "");
  const type = formData.get("type");
  if (!departmentId || !isRequestType(type)) {
    redirect(`${PATH}?error=invalid_request`);
  }
  const purchaseType = purchaseTypeFor(type, formData.get("purchase_type"));
  // Особа «від імені» — необов'язкова (AC-ORG-16): порожнє поле — від свого імені; не-UUID відхиляємо ще до бази.
  const onBehalfOf = String(formData.get("on_behalf_of_id") ?? "").trim();
  if (onBehalfOf && !isUuid(onBehalfOf)) {
    redirect(`${PATH}?error=invalid_request`);
  }

  // AC-ORG-07, AC-ORG-08, AC-ORG-17: тип без дозволу не надсилаємо. База перевіряє те саме (requests_insert →
  // private.can_create_request), тож прямий запит в обхід цієї дії теж відхилено.
  const permissions = await loadPermissions(supabase, user.id);
  if (!canCreateRequest(user.role, permissions, type, purchaseType)) {
    redirect(`${PATH}?error=invalid_request`);
  }

  // AC-ORG-01: відділ, де не-admin не заявник, база відхиляє (private.is_member); admin — будь-який відділ (AC-ORG-22).
  // AC-ORG-16: деактивованого чи чужого (для не-admin) за відділом працівника в «від імені» відхиляє
  // private.can_act_on_behalf у requests_insert.
  const { data, error } = await supabase
    .from("requests")
    .insert({
      author_id: user.id,
      department_id: departmentId,
      type,
      purchase_type: purchaseType,
      ...(onBehalfOf ? { on_behalf_of_id: onBehalfOf } : {}),
    })
    .select("id")
    .maybeSingle();
  if (error) redirect(`${PATH}?error=${mapOrgDbError(error, "requests")}`);

  revalidatePath(PATH);
  // Зріз PUR (AC-PUR-01, 04): нова закупівля — одразу сторінка чернетки з номером PUR-N і порожнім рядком.
  // Інші типи заявок (WS9–WS11) сторінок ще не мають — лишаємось на формі з підтвердженням.
  if (type === "PUR" && data?.id) redirect(`/requests/${data.id}?saved=created`);
  redirect(`${PATH}?created=1`);
}
