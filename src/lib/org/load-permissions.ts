// Дозволи працівника з бази (RLS user_permissions_select: свої або всі для admin). Немає рядка — немає дозволів.
import type { createClient } from "@/lib/supabase/server";
import { permissionsFrom, type Permissions } from "./request-options";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadPermissions(supabase: Supabase, userId: string): Promise<Permissions> {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("card_expense, check_request, vendor_invoice, self_purchase")
    .eq("user_id", userId)
    .maybeSingle();
  // Збій бази — не «немає дозволів»: інакше працівник мовчки втратить доступні типи.
  if (error) throw new Error(`Failed to read permissions: ${error.message}`);
  return permissionsFrom(data);
}
