#!/usr/bin/env node
// Окреме прибирання синтетичних даних UAT: усіх користувачів uat-<run>[-<суфікс>]@example.test і їхніх заявок.
// Для обірваного прогону (teardown Playwright не відпрацював) і як перевірка до та після прогону:
//   npm run uat:cleanup        — видаляє й перевіряє, що залишків немає; повторний запуск пише «нічого прибирати».
// Секретний ключ береться з .env.local (node --env-file), значень не друкуємо — лише адреси синтетичних користувачів.
// Видаляє лише адреси за маскою UAT_EMAIL: інших користувачів (pm-*, demo-*) скрипт не чіпає.
import { createClient } from "@supabase/supabase-js";

const UAT_EMAIL = /^uat-[0-9a-z-]+@example\.test$/;
const PAGE_SIZE = 1000;
// requests.author_id і request_history.actor_id → profiles ON DELETE RESTRICT: спершу заявки автора (рядки й історія заявки —
// каскадом), потім записи історії, які користувач лишив як схвалювач. Як OWNED_ROWS у tests/e2e/support/admin.ts.
const OWNED_ROWS = [
  { table: "requests", column: "author_id" },
  { table: "request_history", column: "actor_id" },
];

const isUat = (user) => UAT_EMAIL.test(user.email ?? "");

function connect() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listUatUsers(db) {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    found.push(...data.users.filter(isUat).map(({ id, email }) => ({ id, email })));
    if (data.users.length < PAGE_SIZE) return found;
  }
}

async function deleteOwnedRows(db, ids) {
  for (const { table, column } of OWNED_ROWS) {
    const { error } = await db.from(table).delete().in(column, ids);
    if (error) throw new Error(`не вдалося видалити рядки ${table}.${column}: ${error.message}`);
  }
}

async function deleteUsers(db, users) {
  for (const user of users) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`не вдалося видалити ${user.email}: ${error.message}`);
  }
}

async function countOwnedRows(db, ids) {
  let total = 0;
  for (const { table, column } of OWNED_ROWS) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).in(column, ids);
    if (error) throw new Error(`не вдалося перевірити ${table}.${column}: ${error.message}`);
    total += count ?? 0;
  }
  return total;
}

async function cleanup(db) {
  const targets = await listUatUsers(db);
  if (targets.length === 0) return { deleted: [], leftoverUsers: 0, leftoverRows: 0 };
  const ids = targets.map((user) => user.id);
  await deleteOwnedRows(db, ids);
  await deleteUsers(db, targets);
  // Перевірка: ні користувачів, ні їхніх рядків.
  const remaining = await listUatUsers(db);
  return { deleted: targets.map((user) => user.email), leftoverUsers: remaining.length, leftoverRows: await countOwnedRows(db, ids) };
}

function report({ deleted, leftoverUsers, leftoverRows }) {
  if (deleted.length === 0) {
    console.log("uat-cleanup: нічого прибирати — синтетичних користувачів uat-*@example.test немає.");
    return 0;
  }
  console.log(`uat-cleanup: видалено користувачів: ${deleted.length}`);
  for (const email of deleted) console.log(`  - ${email}`);
  if (leftoverUsers > 0 || leftoverRows > 0) {
    console.error(`uat-cleanup: залишки — користувачів: ${leftoverUsers}, рядків: ${leftoverRows}`);
    return 1;
  }
  console.log("uat-cleanup: залишків немає.");
  return 0;
}

async function main() {
  const db = connect();
  if (!db) {
    console.error("uat-cleanup: потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SECRET_KEY (.env.local)");
    return 2;
  }
  return report(await cleanup(db));
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
