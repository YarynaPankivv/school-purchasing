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
  const must = ({ data, error }, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
    return data;
  };

  const departments = must(await db.from("departments").select("id, name"), "departments");
  const departmentId = (name) => {
    const found = departments.find((d) => d.name === name);
    if (!found) throw new Error(`немає відділу ${name} (supabase/seed.sql)`);
    return found.id;
  };
  const profiles = must(await db.from("profiles").select("id, email"), "profiles");
  const userId = (email) => {
    const found = profiles.find((p) => p.email === email);
    if (!found) throw new Error(`немає профілю ${email} (npm run users:demo)`);
    return found.id;
  };

  const primary = departmentId("Primary School");
  const upper = departmentId("Upper School");
  const requester = userId("pm-requester@example.test");
  const approver = userId("pm-approver@example.test");

  must(
    await db.from("department_members").upsert([
      { department_id: upper, user_id: requester },
      { department_id: primary, user_id: approver },
    ]),
    "department_members",
  );
  must(await db.from("department_approvers").upsert({ department_id: primary, user_id: approver }), "department_approvers");

  const [request] = must(
    await db
      .from("requests")
      .insert({ type: "PUR", purchase_type: "procurement", department_id: upper, author_id: requester, status: "pending" })
      .select("id"),
    "requests",
  );
  must(
    await db.from("request_lines").insert({
      request_id: request.id,
      name: "Whiteboard markers",
      purpose: "Classroom supplies",
      quantity: 10,
      unit_price: 2.5,
      status: "pending",
    }),
    "request_lines",
  );
  console.log("e2e-seed: pm-approver схвалює Primary School; подана заявка pm-requester — в Upper School");
}
