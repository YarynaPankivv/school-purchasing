#!/usr/bin/env node
// Окреме прибирання синтетичних даних UAT: усіх користувачів uat-<run>[-<суфікс>]@example.test і їхніх заявок.
// Для обірваного прогону (teardown Playwright не відпрацював) і як перевірка до та після прогону:
//   npm run uat:cleanup        — видаляє й перевіряє, що залишків немає; повторний запуск пише «нічого прибирати».
// Секретний ключ береться з .env.local (node --env-file), значень не друкуємо — лише адреси синтетичних користувачів.
// Видаляє лише адреси за маскою UAT_EMAIL: інших користувачів (pm-*, demo-*) скрипт не чіпає.
import { createClient } from "@supabase/supabase-js";

const UAT_EMAIL = /^uat-[0-9a-z-]+@example\.test$/;
// requests.author_id і request_history.actor_id → profiles ON DELETE RESTRICT: спершу заявки автора (рядки й історія заявки —
// каскадом), потім записи історії, які користувач лишив як схвалювач. Як OWNED_ROWS у tests/e2e/support/admin.ts.
const OWNED_ROWS = [
  { table: "requests", column: "author_id" },
  { table: "request_history", column: "actor_id" },
];

async function listUatUsers(db) {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email && UAT_EMAIL.test(u.email)) found.push({ id: u.id, email: u.email });
    if (data.users.length < 1000) return found;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error("uat-cleanup: потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SECRET_KEY (.env.local)");
    return 2;
  }
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const targets = await listUatUsers(db);
  if (targets.length === 0) {
    console.log("uat-cleanup: нічого прибирати — синтетичних користувачів uat-*@example.test немає.");
    return 0;
  }
  const ids = targets.map((u) => u.id);
  for (const { table, column } of OWNED_ROWS) {
    const { error } = await db.from(table).delete().in(column, ids);
    if (error) throw new Error(`не вдалося видалити рядки ${table}.${column}: ${error.message}`);
  }
  const deleted = [];
  for (const u of targets) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`не вдалося видалити ${u.email}: ${error.message}`);
    deleted.push(u.email);
  }

  // Перевірка: ні користувачів, ні їхніх рядків.
  const remaining = await listUatUsers(db);
  let leftoverRows = 0;
  for (const { table, column } of OWNED_ROWS) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).in(column, ids);
    if (error) throw new Error(`не вдалося перевірити ${table}.${column}: ${error.message}`);
    leftoverRows += count ?? 0;
  }
  console.log(`uat-cleanup: видалено користувачів: ${deleted.length}`);
  for (const email of deleted) console.log(`  - ${email}`);
  if (remaining.length > 0 || leftoverRows > 0) {
    console.error(`uat-cleanup: залишки — користувачів: ${remaining.length}, рядків: ${leftoverRows}`);
    return 1;
  }
  console.log("uat-cleanup: залишків немає.");
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`uat-cleanup: ${error.message}`);
    process.exitCode = 1;
  },
);
