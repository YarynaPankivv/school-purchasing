// Вхід кожної ролі один раз за прогін → playwright/.auth/<role>.json (у .gitignore: там живі cookie сесії).
// Тести ролей беруть стан через test.use({ storageState: "playwright/.auth/<role>.json" }).
// У цьому проєкті запис вимкнено (playwright.config.ts: setup — video, trace і screenshot "off"): тут вводиться пароль.
//
// Змінні з паролями (лише назви; значення — у .env.local локально або в secrets CI, ніколи в коді):
//   DEMO_USER_PASSWORD           — спільний пароль акаунтів із supabase/demo-users.json (npm run users:demo);
//   UAT_PASSWORD_<РОЛЬ>          — необов'язково: окремий пароль для ролі, напр. UAT_PASSWORD_ADMIN.
//
// Джерело: демо-репо курсу, tests/e2e/auth.setup.ts (тег ws8-03-uat). ROLES — ВАШІ: роль → адреса акаунта на проді
// (D0.5, *@example.test). Нижче — акаунти шаблону курсу.
import { expect, test as setup } from "@playwright/test";
import { signIn } from "./support/uat";

// Акаунти зрізу 2 на проді (docs/qa/proof-pack.md; створює npm run users:demo з supabase/demo-users.json).
// admin — лише щоб знайти чужу заявку для AC-APR-03 і перевірити, що її статус не змінився; empty — працівник без заявок.
const ROLES = {
  admin: "pm-admin@example.test",
  approver: "pm-approver@example.test",
  empty: "pm-empty@example.test",
} as const;

for (const [role, email] of Object.entries(ROLES)) {
  setup(`вхід: ${role}`, async ({ page }) => {
    const password = process.env[`UAT_PASSWORD_${role.toUpperCase()}`] ?? process.env.DEMO_USER_PASSWORD;
    expect(password, `немає пароля для ролі ${role}: DEMO_USER_PASSWORD або UAT_PASSWORD_${role.toUpperCase()}`).toBeTruthy();
    await signIn(page, email, password!);
    // Після входу застосунок відкриває головну, а не /login (імена в бічній панелі — повні імена, не email).
    await expect(page).not.toHaveURL(/\/login/);
    await page.context().storageState({ path: `playwright/.auth/${role}.json` });
  });
}
