// Єдине джерело: рядки, що тримають FK на користувача (ON DELETE RESTRICT) і мають піти до deleteUser.
// Імпортують scripts/uat-cleanup.mjs і tests/e2e/support/admin.ts (tsconfig: allowJs).
// action "delete" — видалити рядки; "null" — лише обнулити колонку (рядок чужої заявки лишається).
// Порядок важливий: спершу обнулення, потім заявки автора (рядки й історія заявки — каскадом), потім записи історії,
// які користувач лишив як схвалювач.
export const OWNED_ROWS = [
  { table: "requests", column: "on_behalf_of_id", action: "null" },
  { table: "requests", column: "author_id", action: "delete" },
  { table: "request_history", column: "actor_id", action: "delete" },
];
