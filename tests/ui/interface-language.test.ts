// Мова інтерфейсу (openspec/specs/ui-language): усі тексти англійською за таблицею PM (requirements/49-…).
// Перевіряємо довідники написів і повідомлень дослівно та скануємо код застосунку на українські слова поза коментарями.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { NO_APPROVER_LABEL } from "@/lib/org/departments";
import { ORG_ERROR_MESSAGES, orgErrorMessage } from "@/lib/org/errors";
import { PURCHASE_TYPE_LABELS, REQUEST_TYPE_LABELS } from "@/lib/org/requests";
import { ROLE_LABELS, isAppRole } from "@/lib/org/roles";
import { PUR_ERROR_MESSAGES, purErrorMessage } from "@/lib/pur/errors";
import { LINE_STATUS_LABELS, PURCHASE_STATUS_LABELS, purchaseStatusLabel } from "@/lib/pur/statuses";

const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;
const ROOT = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && name !== "database.types.ts" ? [path] : [];
  });
}

// Код без коментарів (блокових, JSX-блокових і рядкових `//`): українські коментарі — це не інтерфейс.
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

describe("інтерфейс англійською (ui-language)", () => {
  it("AC-LANG-01: довідники написів збігаються з таблицею PM і не містять українських слів", () => {
    expect(REQUEST_TYPE_LABELS).toEqual({
      PUR: "Purchase",
      RMB: "Reimbursement",
      CRE: "Card expense",
      RFC: "Check request",
      INV: "Vendor invoice",
    });
    expect(PURCHASE_TYPE_LABELS).toEqual({ procurement: "Purchasing department", self: "Self-purchase" });
    expect(ROLE_LABELS).toEqual({ requester: "Requester", approver: "Approver", admin: "Administrator" });
    expect(NO_APPROVER_LABEL).toBe("No approver");
    expect(PURCHASE_STATUS_LABELS.pending).toBe("Awaiting approval");
    expect(PURCHASE_STATUS_LABELS.approved).toBe("Approved");
    expect(PURCHASE_STATUS_LABELS.rejected).toBe("Rejected");

    const all = [
      ...Object.values(REQUEST_TYPE_LABELS),
      ...Object.values(PURCHASE_TYPE_LABELS),
      ...Object.values(ROLE_LABELS),
      ...Object.values(PURCHASE_STATUS_LABELS),
      ...Object.values(LINE_STATUS_LABELS),
      ...Object.values(ORG_ERROR_MESSAGES),
      ...Object.values(PUR_ERROR_MESSAGES),
    ];
    expect(all.filter((text) => CYRILLIC.test(text))).toEqual([]);
  });

  it("AC-LANG-01: у коді застосунку (поза коментарями) немає українських слів", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      withoutComments(readFileSync(file, "utf8"))
        .split("\n")
        .forEach((line, index) => {
          if (CYRILLIC.test(line)) offenders.push(`${relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 80)}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  // Без AC PM: перевірка самого сканера — він має бачити слова в рядках і JSX та ігнорувати коментарі.
  it("сканер знаходить українські слова в рядках і JSX, але не в коментарях", () => {
    const found = (code: string) => CYRILLIC.test(withoutComments(code));
    expect(found('const label = "Привіт"; // коментар')).toBe(true);
    expect(found("<p>Привіт</p> {/* коментар */}")).toBe(true);
    expect(found("const a = 1; // тільки коментар")).toBe(false);
    expect(found("/* блоковий коментар */ const a = 1;")).toBe(false);
  });

  it("AC-LANG-01: повідомлення з таблиці PM — дослівно", () => {
    expect(ORG_ERROR_MESSAGES.not_member).toBe("Add the employee to the department as a requester first");
    expect(ORG_ERROR_MESSAGES.last_admin).toBe("At least one active administrator must remain");
    expect(ORG_ERROR_MESSAGES.duplicate_name).toBe("A department with this name already exists");
    expect(PUR_ERROR_MESSAGES.lines_incomplete).toBe("Fill in all line fields");
  });

  it("AC-LANG-02: сторінка входу й помилки входу англійською", () => {
    const login = readFileSync(join(ROOT, "app", "login", "page.tsx"), "utf8");
    expect(login).toContain('missing: "Enter your email and password."');
    expect(login).toContain('invalid: "Incorrect email or password."');
    expect(CYRILLIC.test(withoutComments(login))).toBe(false);
  });

  it("AC-LANG-03: «Not enough permissions» замість «Недостатньо прав»", () => {
    expect(ORG_ERROR_MESSAGES.forbidden).toBe("Not enough permissions");
    expect(orgErrorMessage("forbidden")).toBe("Not enough permissions");
    expect(PUR_ERROR_MESSAGES.forbidden).toBe("Not enough permissions");
    expect(purErrorMessage("forbidden")).toBe("Not enough permissions");
  });

  it("AC-LANG-04: «Add at least one line» замість «Додайте хоча б один рядок»", () => {
    expect(PUR_ERROR_MESSAGES.lines_required).toBe("Add at least one line");
    expect(purErrorMessage("lines_required")).toBe("Add at least one line");
  });

  it("AC-LANG-05: «Provide a reason» замість «Вкажіть причину»", () => {
    expect(PUR_ERROR_MESSAGES.reason_required).toBe("Provide a reason");
    expect(purErrorMessage("reason_required")).toBe("Provide a reason");
  });

  it("AC-LANG-06: статус підписано англійським текстом", () => {
    expect(purchaseStatusLabel("pending")).toBe("Awaiting approval");
    expect(purchaseStatusLabel("approved")).toBe("Approved");
    expect(purchaseStatusLabel("rejected")).toBe("Rejected");
  });

  it("AC-LANG-08: ідентифікатори ролей без змін, підпис ролі англійською", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(["admin", "approver", "requester"]);
    for (const role of Object.keys(ROLE_LABELS)) expect(isAppRole(role)).toBe(true);
    expect(isAppRole("Requester")).toBe(false);
    expect(ROLE_LABELS.requester).toBe("Requester");
    expect(ROLE_LABELS.approver).toBe("Approver");
    expect(ROLE_LABELS.admin).toBe("Administrator");
  });
});
