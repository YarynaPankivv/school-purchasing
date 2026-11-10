// Синтетичні дані UAT зрізу 3 (рішення схвалювача, номери, суми, історія): користувачі uat-<run>-<суфікс>@example.test,
// їхні відділи й закупівлі. Дані створюємо секретним ключем (support/admin.ts), а подання й рішення виконуємо від імені
// самих користувачів через ті самі rpc, що й кнопки застосунку (submit_purchase, decide_purchase) — база та сама, RLS діє.
// Прибирання — deleteUatUsers() у support/admin.ts (requests і request_history синтетичних користувачів видаляються першими).
// Лише синтетичні дані (*@example.test). Значень ключів і паролів не друкуємо.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, randomPassword, uatEmail } from "./admin";

export type UatUser = { id: string; email: string; password: string; fullName: string };
export type UatLine = { name: string; quantity: number; unitPrice: number };

export async function createUatUser(suffix: string, fullName: string): Promise<UatUser> {
  const email = uatEmail(suffix);
  const password = randomPassword();
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return { id: data.user.id, email, password, fullName };
}

async function departmentId(name: string): Promise<string> {
  const { data, error } = await adminClient().from("departments").select("id").eq("name", name).single();
  if (error) throw error;
  return data.id;
}

/** Заявник відділу; з `approver` — ще й схвалювач цього відділу. */
export async function addToDepartment(user: UatUser, department: string, options: { approver?: boolean } = {}) {
  const supabase = adminClient();
  const id = await departmentId(department);
  const member = await supabase.from("department_members").insert({ department_id: id, user_id: user.id });
  if (member.error) throw member.error;
  if (options.approver) {
    const approver = await supabase.from("department_approvers").insert({ department_id: id, user_id: user.id });
    if (approver.error) throw approver.error;
  }
}

/** Клієнт від імені користувача (RLS діє): вхід паролем, без збереження сесії. */
async function clientOf(user: UatUser): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Потрібні NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local)");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

/** Чернетка → заповнені рядки → submit_purchase від імені автора. Повертає id закупівлі (статус «Awaiting approval»). */
export async function submitPurchaseAs(author: UatUser, department: string, lines: readonly UatLine[]): Promise<string> {
  const client = await clientOf(author);
  const draft = await client
    .from("requests")
    .insert({ type: "PUR", purchase_type: "procurement", department_id: await departmentId(department), author_id: author.id, status: "draft" })
    .select("id")
    .single();
  if (draft.error) throw draft.error;
  const id = draft.data.id as string;
  // Перший рядок створює база разом із чернеткою; решту додаємо.
  const [first, ...rest] = lines;
  const update = await client
    .from("request_lines")
    .update({ name: first.name, purpose: "For printing", quantity: first.quantity, unit_price: first.unitPrice })
    .eq("request_id", id)
    .eq("position", 1);
  if (update.error) throw update.error;
  for (const line of rest) {
    const insert = await client
      .from("request_lines")
      .insert({ request_id: id, name: line.name, purpose: "For printing", quantity: line.quantity, unit_price: line.unitPrice });
    if (insert.error) throw insert.error;
  }
  const submit = await client.rpc("submit_purchase", { target_request: id });
  if (submit.error) throw submit.error;
  return id;
}

/** Рішення схвалювача від його імені: approve (з відхиленими рядками), return або reject. */
export async function decideAs(
  approver: UatUser,
  requestId: string,
  decision: "approve" | "return" | "reject",
  options: { reason?: string; rejectedLinePositions?: number[] } = {},
) {
  const client = await clientOf(approver);
  const rejectedIds: string[] = [];
  for (const position of options.rejectedLinePositions ?? []) {
    const { data, error } = await client.from("request_lines").select("id").eq("request_id", requestId).eq("position", position).single();
    if (error) throw error;
    rejectedIds.push(data.id);
  }
  const { error } = await client.rpc("decide_purchase", {
    target_request: requestId,
    decision,
    reason_text: options.reason ?? null,
    rejected_line_ids: rejectedIds.length ? rejectedIds : null,
  });
  if (error) throw error;
}

/** Номер і статус закупівлі за секретним ключем (для передумов і невидимих частин «Тоді»). */
export async function requestInfo(requestId: string): Promise<{ number: number; status: string; department: string }> {
  const { data, error } = await adminClient()
    .from("requests")
    .select("number, status, departments(name)")
    .eq("id", requestId)
    .single();
  if (error) throw error;
  const department = (data.departments as unknown as { name: string } | null)?.name ?? "";
  return { number: Number(data.number), status: data.status as string, department };
}
