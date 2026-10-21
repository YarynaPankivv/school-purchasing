// Помилки бази → тексти для користувача (design.md D7).
// Інтерфейс — англійською (рішення замовника). Тексти з лапок «…» вимог PM (AC-ORG-02, 09, 10, 18) подано
// англійським перекладом, не дослівно: PM їх задав українською.

export const ORG_ERROR_MESSAGES = {
  not_member: "First add the employee to the department as a requester", // AC-ORG-02 (переклад тексту PM)
  forbidden: "Insufficient permissions", // AC-ORG-09 (переклад тексту PM)
  duplicate_name: "A department with this name already exists.",
  invalid_name: "Department name must be 1 to 100 characters.",
  invalid_request: "This department, request type or on-behalf person is not available to you.",
  last_admin: "At least one active administrator must remain", // AC-ORG-10, AC-ORG-18 (переклад тексту PM)
  role_derived: "A requester or approver role depends on department approvals — change the department approvers instead.",
  not_a_draft: "Only a draft of a deactivated employee can be deleted; submitted requests stay.",
  not_found: "Employee not found.",
  unknown: "Could not save the changes. Please try again.",
} as const;

export type OrgErrorCode = keyof typeof ORG_ERROR_MESSAGES;

export type DbError = { code?: string | null; message?: string | null; details?: string | null } | null;

// Контекст — таблиця, з якою працювала дія: той самий код Postgres означає різне.
export type OrgTable =
  | "departments"
  | "department_members"
  | "department_approvers"
  | "requests"
  | "user_permissions"
  | "profiles";

export function mapOrgDbError(error: DbError, table: OrgTable): OrgErrorCode {
  if (!error) return "unknown";
  // Виняток тригера private.guard_profile_update() (SQLSTATE ORG01): AC-ORG-10, AC-ORG-18. Текст на випадок,
  // якщо клієнт не віддасть код, але перешле повідомлення винятку.
  if (error.code === "ORG01" || error.message === ORG_ERROR_MESSAGES.last_admin) return "last_admin";
  switch (error.code) {
    case "22023":
      return table === "profiles" ? "role_derived" : "unknown";
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
