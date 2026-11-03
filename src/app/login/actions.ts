"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Вхід email + пароль. Реєстрації в шаблоні немає: користувачів створює
// scripts/create-demo-users.mjs (Admin API), бо вбудований SMTP Supabase
// надсилає лише 2 листи/год і лише членам команди проєкту.
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Не показуємо текст помилки Auth: він може підказати, чи існує email.
    redirect("/login?error=invalid");
  }

  // AC-ORG-12: деактивований працівник не входить і бачить текст PM («Account deactivated. Contact your administrator»).
  // Текст показуємо лише після ВІРНОГО пароля, тож він не розкриває, чи існує email (невірний пароль — завжди «invalid»).
  // Профіль читаємо власний (політика profiles_select_own діє й для неактивного).
  const userId = signIn?.user?.id;
  const { data: profile, error: profileError } = userId
    ? await supabase.from("profiles").select("is_active").eq("id", userId).maybeSingle()
    : { data: null, error: null };
  if (!userId || profileError || !profile) {
    await supabase.auth.signOut();
    redirect("/login?error=invalid");
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=deactivated");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
