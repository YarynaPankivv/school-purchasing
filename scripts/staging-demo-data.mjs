#!/usr/bin/env node
// Дані для сценарію demo day на STAGING (WS11, повідомлення PM: «підготовка даних для сценарію — наше завдання»).
// Що робить: ставить синтетичних користувачів у відділ Primary School — pm-requester і member1 як працівників, pm-approver
// як працівника й схвалювача цього відділу (саме так PM пройде кроки 2–7 сценарію: подати, схвалити частково, повернути).
// Ідемпотентно (upsert). Заявок не створює: сценарій починається з подання заявки працівником, а лічильник «Awaiting approval»
// не має бути засмічений. Лише синтетичні дані, прод-дані не копіюємо.
// Запуск (значення не друкуються): npm run staging:demo
// Запобіжник: ref у NEXT_PUBLIC_SUPABASE_URL має бути в зашитому списку staging-проєктів і не в списку проду, інакше скрипт
// нічого не робить: цей скрипт ніколи не пише в прод.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY;
// Довірені ref зашито в скрипт, а не передаємо аргументами (друге рев'ю CodeRabbit, PR 104): аргументи, подані у зворотному
// порядку, пропустили б запуск проти проду. Ref — не секрет (він і так у адресі проєкту й у журналах CI). Новий staging-проєкт
// додайте сюди разом із PR; ref проду тут лише для явної заборони.
const STAGING_REFS = ["nrapwkzhqplxvwgittly"];
const PROD_REFS = ["rgpngqhjkawryldpyxzl"];
// Точна адреса проєкту (з кінцевим якорем): префікс-збіг пропустив би https://<ref>.supabase.co.чужий.хост, і клієнт Supabase
// надіслав би чужому хосту секретний ключ (третє рев'ю CodeRabbit, PR 104).
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url)?.[1] ?? "";

if (!ref || !secret) {
  console.error("Потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SECRET_KEY (node --env-file=.env.local …).");
  process.exitCode = 2;
} else if (PROD_REFS.includes(ref) || !STAGING_REFS.includes(ref)) {
  console.error(`Зупинено: проєкт ${ref} не входить до довірених staging-проєктів цього скрипта (або це прод).`);
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
  // Лише три потрібні синтетичні профілі: вибірка без фільтра обмежена 1000 рядками, і потрібного профілю могло б не бути в ній.
  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id, email")
    .in("email", ["pm-requester@example.test", "member1@example.test", "pm-approver@example.test"]);
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
