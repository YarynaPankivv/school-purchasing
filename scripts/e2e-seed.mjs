#!/usr/bin/env node
// Дані для e2e у CI (e2e.yml) на одноразовому локальному Supabase: на проді їх наявність забезпечує PM і ми, тут — цей скрипт.
// Потрібне AC-APR-03: pm-approver схвалює Primary School, а подана заявка лежить у Upper School (чужий для нього відділ).
// Лише синтетичні дані; SUPABASE_SECRET_KEY — ключ локального стеку, не хмарний (npm run e2e:seed читає .env.local).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Не задано NEXT_PUBLIC_SUPABASE_URL або SUPABASE_SECRET_KEY");
  process.exitCode = 2;
} else if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error("e2e-seed лише для локального стеку: адреса має бути 127.0.0.1 або localhost");
  process.exitCode = 2;
} else {
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  // Заявка, яку цей запуск уже створив: якщо наступний крок упав, її видаляємо, щоб не лишити заявку з порожнім рядком.
  let createdRequestId = null;
  const fail = async (message) => {
    if (createdRequestId) await db.from("requests").delete().eq("id", createdRequestId);
    console.error(`e2e-seed: ${message}`);
    process.exit(1);
  };
  const must = async (query, what) => {
    const { data, error } = await query;
    if (error) await fail(`не вдалося виконати етап «${what}». Деталі Supabase: ${error.message}`);
    return data;
  };

  const departments = await must(db.from("departments").select("id, name"), "departments");
  const departmentId = async (name) => {
    const found = departments.find((d) => d.name === name);
    if (!found) await fail(`немає відділу ${name} (supabase/seed.sql)`);
    return found.id;
  };
  const profiles = await must(db.from("profiles").select("id, email"), "profiles");
  const userId = async (email) => {
    const found = profiles.find((p) => p.email === email);
    if (!found) await fail(`немає профілю ${email} (спершу npm run users:demo)`);
    return found.id;
  };

  const primary = await departmentId("Primary School");
  const upper = await departmentId("Upper School");
  const requester = await userId("pm-requester@example.test");
  const approver = await userId("pm-approver@example.test");

  await must(
    db.from("department_members").upsert([
      { department_id: upper, user_id: requester },
      { department_id: primary, user_id: approver },
    ]),
    "department_members",
  );
  await must(db.from("department_approvers").upsert({ department_id: primary, user_id: approver }), "department_approvers");

  // Ідемпотентність: заявка вже є (повторний запуск на тій самій базі) — нічого не додаємо.
  const existing = await must(
    db.from("requests").select("id").eq("author_id", requester).eq("department_id", upper).eq("status", "pending").limit(1),
    "requests (пошук наявної)",
  );
  if (existing.length > 0) {
    console.log("e2e-seed: подана заявка pm-requester у Upper School уже є, нічого не додаю");
  } else {
    const [request] = await must(
      db
        .from("requests")
        .insert({ type: "PUR", purchase_type: "procurement", department_id: upper, author_id: requester, status: "pending" })
        .select("id"),
      "requests",
    );
    createdRequestId = request.id;
    // Тригер requests_add_empty_line уже додав порожній рядок: заповнюємо його, а не вставляємо другий.
    await must(
      db
        .from("request_lines")
        .update({ name: "Whiteboard markers", purpose: "Classroom supplies", quantity: 10, unit_price: 2.5, status: "pending" })
        .eq("request_id", request.id),
      "request_lines",
    );
    createdRequestId = null;
    console.log("e2e-seed: pm-approver схвалює Primary School; подана заявка pm-requester — в Upper School");
  }
}
