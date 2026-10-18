// Помилки бази → тексти для користувача (design.md D7).
// Тексти в лапках «…» з вимог PM дослівно; решта — наші, PM їх не задавав.

export const ORG_ERROR_MESSAGES = {
  not_member: "Спершу додайте працівника до відділу як заявника", // AC-ORG-02 (текст PM)
  forbidden: "Недостатньо прав", // AC-ORG-09 (текст PM)
  duplicate_name: "Відділ із такою назвою вже є.",
  invalid_name: "Назва відділу — від 1 до 100 символів.",
  invalid_request: "Цей відділ або тип заявки вам недоступні.",
  unknown: "Не вдалося зберегти зміни. Спробуйте ще раз.",
} as const;

export type OrgErrorCode = keyof typeof ORG_ERROR_MESSAGES;

export type DbError = { code?: string | null; message?: string | null; details?: string | null } | null;

// Контекст — таблиця, з якою працювала дія: той самий код Postgres означає різне.
export type OrgTable = "departments" | "department_members" | "department_approvers" | "requests" | "user_permissions";

export function mapOrgDbError(error: DbError, table: OrgTable): OrgErrorCode {
  if (!error) return "unknown";
  switch (error.code) {
    case "23503":
      // FK department_approvers → department_members: схвалювач лише із заявників (AC-ORG-02).
      return table === "department_approvers" ? "not_member" : "unknown";
    case "23505":
      return table === "departments" ? "duplicate_name" : "unknown";
    case "23514":
      if (table === "departments") return "invalid_name";
      if (table === "requests") return "invalid_request";
      return "unknown";
    case "42501":
      // RLS: insert з with check, якого не пройшов рядок.
      return table === "requests" ? "invalid_request" : "forbidden";
    default:
      return "unknown";
  }
}

export function orgErrorMessage(code: unknown): string | undefined {
  // Object.hasOwn, а не `in`: ключі прототипу (toString, __proto__) з адреси не мають пройти.
  return typeof code === "string" && Object.hasOwn(ORG_ERROR_MESSAGES, code)
    ? ORG_ERROR_MESSAGES[code as OrgErrorCode]
    : undefined;
}
