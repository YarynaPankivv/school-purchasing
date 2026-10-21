// Подання «від імені колеги» (AC-PUR-11, 12, 13; design.md D4).
// Кандидатів рахує onBehalfCandidates із src/lib/org/departments.ts (AC-ORG-16) — тут лише обгортка для заявки
// й перевірка вибору. Останнє слово — за тригером guard_request_update (особа активна, не автор, не admin).
import { onBehalfCandidates, type Membership, type Person } from "@/lib/org/departments";
import type { AppRole } from "@/lib/org/roles";
import type { PurchaseRow } from "./types";

// AC-PUR-13: не-admin обирає серед колег із відділу заявки, крім себе й адміністраторів; admin — серед усіх активних.
// Без відділу (чернетка) не-admin нікого не пропонуємо: спершу обирають відділ.
export function purchaseOnBehalfCandidates(
  request: Pick<PurchaseRow, "department_id" | "author_id">,
  memberships: Pick<Membership, "department_id" | "user_id">[],
  people: Person[],
  authorRole: AppRole,
): Person[] {
  if (request.department_id === null && authorRole !== "admin") return [];
  return onBehalfCandidates(request.department_id ?? "", memberships, people, request.author_id, authorRole);
}

export type OnBehalfChoice = { flag: boolean; colleagueId: string | null };

export type OnBehalfResult =
  | { ok: true; onBehalfId: string | null }
  | { ok: false; error: "on_behalf_required" | "on_behalf_invalid" };

// Позначка «подано від імені колеги» без вибору колеги — помилка (AC-PUR-12); обраний не з кандидатів — теж (AC-PUR-13);
// без позначки колегу скидаємо (on_behalf_of_id = null).
export function resolveOnBehalf(choice: OnBehalfChoice, candidates: readonly Pick<Person, "id">[]): OnBehalfResult {
  if (!choice.flag) return { ok: true, onBehalfId: null };
  if (!choice.colleagueId) return { ok: false, error: "on_behalf_required" };
  if (!candidates.some((c) => c.id === choice.colleagueId)) return { ok: false, error: "on_behalf_invalid" };
  return { ok: true, onBehalfId: choice.colleagueId };
}
