#!/usr/bin/env node
// Дані для сценарію demo day на STAGING (WS11, повідомлення PM: «підготовка даних для сценарію — наше завдання»).
// Що робить: ставить синтетичних користувачів у відділ Primary School — pm-requester і member1 як працівників, pm-approver
// як працівника й схвалювача цього відділу (саме так PM пройде кроки 2–7 сценарію: подати, схвалити частково, повернути).
// Ідемпотентно (upsert). Заявок не створює: сценарій починається з подання заявки працівником, а лічильник «Awaiting approval»
// не має бути засмічений. Лише синтетичні дані, прод-дані не копіюємо.
// Запуск (значення не друкуються): npm run staging:demo -- <ref-проєкту-staging>
// Запобіжник: другий аргумент має збігатися з ref у NEXT_PUBLIC_SUPABASE_URL, інакше скрипт нічого не робить, а ref проду
// (SUPABASE_PROD_REF, якщо задано) відхиляється завжди: цей скрипт ніколи не пише в прод.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY;
const expected = process.argv[2] ?? "";
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1] ?? "";

if (!ref || !secret || !expected) {
  console.error("Потрібні NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (node --env-file=.env.local …) і ref staging першим аргументом.");
  process.exitCode = 2;
} else if (ref !== expected || (process.env.SUPABASE_PROD_REF && ref === process.env.SUPABASE_PROD_REF)) {
  console.error(`Зупинено: ref у .env.local (${ref}) не збігається з очікуваним ref staging (${expected}) або це прод.`);
  process.exitCode = 2;
} else {
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const fail = (what, error) => {
    console.error(`staging-demo-data: «${what}»: ${error.message}`);
    process.exit(1);
  };
  const { data: departments, error: dErr } = await db.from("departments").select("id, name");
  if (dErr) fail("departments", dErr);
  const primary = departments.find((d) => d.name === "Primary School")?.id;
  if (!primary) fail("departments", new Error("немає відділу Primary School (спершу Run workflow CI з include_seed_staging)"));
  const { data: profiles, error: pErr } = await db.from("profiles").select("id, email");
  if (pErr) fail("profiles", pErr);
  const id = (email) => {
    const found = profiles.find((p) => p.email === email)?.id;
    if (!found) fail("profiles", new Error(`немає профілю ${email} (спершу npm run users:demo)`));
    return found;
  };
  const requesters = ["pm-requester@example.test", "member1@example.test", "pm-approver@example.test"].map(id);
  const approver = id("pm-approver@example.test");

  const m = await db.from("department_members").upsert(requesters.map((user_id) => ({ department_id: primary, user_id })));
  if (m.error) fail("department_members", m.error);
  const a = await db.from("department_approvers").upsert({ department_id: primary, user_id: approver });
  if (a.error) fail("department_approvers", a.error);
  console.log(`OK — staging (${ref}): у Primary School ${requesters.length} працівників, схвалювач — pm-approver@example.test.`);
}
