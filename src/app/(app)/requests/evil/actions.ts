"use server";

import { createClient } from "@/lib/supabase/server";

// Навмисне порушення для доказу, що правило check:actions його ловить (буде відкочено).
export async function wipeRequests() {
  const supabase = await createClient();
  await supabase.from("requests").delete().neq("id", "");
}
