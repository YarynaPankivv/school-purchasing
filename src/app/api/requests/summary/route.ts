// Підсумок заявок для сторінки керівника: кількість за статусами; адміністратор додатково бачить розбивку за відділами.
// Дані віддає RLS: хто що бачить, вирішує база.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: rows, error } = await supabase.from("requests").select("status, department_id").eq("type", "PUR");
  if (error) return NextResponse.json({ error: "Failed to read requests" }, { status: 500 });

  const byStatus: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.department_id) byDepartment[row.department_id] = (byDepartment[row.department_id] ?? 0) + 1;
  }

  const isAdmin = claims.user_metadata?.role === "admin";
  return NextResponse.json(isAdmin ? { total: rows.length, byStatus, byDepartment } : { total: rows.length, byStatus });
}
