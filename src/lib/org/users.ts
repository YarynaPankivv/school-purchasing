// Правила адміністрування працівників для сторінок і server actions (design.md D6, D7; tasks.md 3.2).
// Останнє слово — за базою: тригер private.guard_profile_update() у міграції 20261021120000_org_users.sql.
// Ці функції — дзеркало для підказок в UI (вимкнена кнопка, пояснення) і тестів; змінюйте їх разом.

export type StaffMember = { id: string; role: string; is_active: boolean };
export type DraftRow = { id: string; status: string; author_id: string };

// Зміна, яку адміністратор хоче внести в працівника: зняти/дати роль admin або (де)активувати.
export type StaffChange = { makeAdmin?: boolean; isActive?: boolean };

export function activeAdminCount(people: readonly StaffMember[]): number {
  return people.filter((p) => p.role === "admin" && p.is_active).length;
}

// AC-ORG-10, AC-ORG-18: чи лишиться хоча б один активний admin після зміни. AC-ORG-21: з двома — лишається.
export function wouldLeaveNoActiveAdmin(people: readonly StaffMember[], targetId: string, change: StaffChange): boolean {
  const target = people.find((p) => p.id === targetId);
  if (!target) return false;
  const role = change.makeAdmin === undefined ? target.role : change.makeAdmin ? "admin" : "requester";
  const isActive = change.isActive ?? target.is_active;
  const targetStaysActiveAdmin = role === "admin" && isActive;
  const others = people.filter((p) => p.id !== targetId && p.role === "admin" && p.is_active).length;
  return others + (targetStaysActiveAdmin ? 1 : 0) === 0;
}

// Єдиний активний адміністратор — його не можна ні розжалувати, ні деактивувати (AC-ORG-10, AC-ORG-18).
export function isSoleActiveAdmin(people: readonly StaffMember[], userId: string): boolean {
  const person = people.find((p) => p.id === userId);
  return !!person && person.role === "admin" && person.is_active && activeAdminCount(people) === 1;
}

// AC-ORG-13: адміністратор видаляє лише чернетки деактивованого автора; подані заявки лишаються.
export function canDeleteDraft(request: DraftRow, authorIsActive: boolean): boolean {
  return request.status === "draft" && !authorIsActive;
}

export function draftsOf(requests: readonly DraftRow[], userId: string): DraftRow[] {
  return requests.filter((r) => r.author_id === userId && r.status === "draft");
}

export function submittedOf(requests: readonly DraftRow[], userId: string): DraftRow[] {
  return requests.filter((r) => r.author_id === userId && r.status !== "draft");
}
