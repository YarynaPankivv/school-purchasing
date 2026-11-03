// Люди для вибору «від імені», підписів і «Немає схвалювача». Адміністратор читає профілі напряму (RLS: усі), решта —
// лише через public.colleague_directory(): підпис і ознака admin активних колег зі спільного відділу, без ролі,
// email за наявності імені й is_active (міграція 20261103150000_colleague_directory.sql).
import type { createClient } from "@/lib/supabase/server";
import type { Person } from "./departments";
import type { AppRole } from "./roles";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function readProfiles(supabase: Supabase): Promise<Person[]> {
  const { data, error } = await supabase.from("profiles").select("id, email, full_name, is_active, role");
  if (error) throw new Error(`Failed to read people: ${error.message}`);
  return data ?? [];
}

export async function loadPeople(supabase: Supabase, role: AppRole): Promise<Person[]> {
  if (role === "admin") return readProfiles(supabase);
  const { data, error } = await supabase.rpc("colleague_directory");
  // PGRST202: функції ще немає в кеші схеми PostgREST. Це або міграція ще не застосована (db-deploy трохи пізніше за деплой
  // застосунку) і політика profiles_select_colleagues ще діє, або вже застосована, але кеш не оновився, і тоді читання
  // профілів поверне лише власний рядок; підписи авторів у будь-якому разі дає request_author_labels.
  if (error?.code === "PGRST202") return readProfiles(supabase);
  if (error) throw new Error(`Failed to read people: ${error.message}`);
  // Директорія віддає лише активних; підпис кладемо в full_name (personLabel бере його першим), роль — лише admin чи ні.
  return (data ?? []).map((row) => ({
    id: row.user_id,
    email: null,
    full_name: row.label,
    is_active: true,
    role: row.is_admin ? "admin" : "requester",
  }));
}
