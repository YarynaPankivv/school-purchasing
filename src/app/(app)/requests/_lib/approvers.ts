// Схвалювачі одного відділу: рішення по заявці залежить лише від них, тож інших відділів не читаємо.
import type { Approver } from "@/lib/org/departments";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadDepartmentApprovers(supabase: Supabase, departmentId: string | null): Promise<Approver[]> {
  if (!departmentId) return [];
  const { data, error } = await supabase.from("department_approvers").select("department_id, user_id").eq("department_id", departmentId);
  if (error) throw new Error(`Failed to read the request: ${error.message}`);
  return data ?? [];
}
