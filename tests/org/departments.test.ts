// Задача 1 зрізу ORG (openspec/changes/impl-org/tasks.md 1.7): відділи, заявники, схвалювачі, автосхвалення,
// похідна роль. Чисті правила src/lib/org/* і server actions із моком Supabase (design.md D9).
// SQL-правила (FK, каскади, тригер private.sync_role, RLS) перевіряють db-check і ручний прохід на Preview.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NO_APPROVER_LABEL,
  approverCandidates,
  autoApproveDepartments,
  canAssignApprover,
  departmentHasActiveApprover,
  memberRemovalEffects,
  normalizeDepartmentName,
  selectableDepartments,
} from "@/lib/org/departments";
import { ORG_ERROR_MESSAGES, mapOrgDbError, orgErrorMessage } from "@/lib/org/errors";
import { isRequestType } from "@/lib/org/requests";
import { deriveRole } from "@/lib/org/roles";
import { createSupabaseMock, form, makeProfile, redirectedTo } from "./supabase-mock";

vi.mock("next/navigation", async () => {
  const { RedirectSignal } = await import("./supabase-mock");
  return {
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new RedirectSignal("not-found");
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const actions = () => import("@/app/admin/departments/actions");
const requestActions = () => import("@/app/requests/new/actions");

const PRIMARY = { id: "dep-primary", name: "Початкова школа" };
const HIGH = { id: "dep-high", name: "Вища школа" };
const OFFICE = { id: "dep-office", name: "Офіс" };
const WORKER = "user-worker";

function useSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  createClient.mockResolvedValue(mock.client);
  return mock;
}

beforeEach(() => {
  createClient.mockReset();
});

describe("відділи й заявники", () => {
  it("AC-ORG-01: працівник створює заявки лише від імені відділу, куди його додали, і не бачить інших", async () => {
    const departments = [PRIMARY, HIGH, OFFICE];
    expect(selectableDepartments(departments, [], WORKER)).toEqual([]);

    const memberships = [{ department_id: PRIMARY.id, user_id: WORKER }];
    expect(selectableDepartments(departments, memberships, WORKER)).toEqual([PRIMARY]);

    // Тимчасово Q1: адміністратор без відділів теж нічого не обирає.
    expect(selectableDepartments(departments, [], "user-admin")).toEqual([]);

    // Чужий відділ база відхиляє (requests_insert → private.is_member) — дія показує помилку.
    const mock = useSupabase(
      createSupabaseMock({
        profile: makeProfile({ id: WORKER, role: "requester", email: "member1@example.test" }),
        results: { "requests.insert": { error: { code: "42501" } } },
      }),
    );
    const { createDraftRequest } = await requestActions();
    const url = await redirectedTo(() => createDraftRequest(form({ department_id: HIGH.id, type: "PUR" })));
    expect(url).toBe("/requests/new?error=invalid_request");
    expect(mock.calls.find((c) => c.table === "requests")?.payload).toEqual({
      author_id: WORKER,
      department_id: HIGH.id,
      type: "PUR",
      purchase_type: "procurement",
    });
  });

  it("чернетка у своєму відділі створюється", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: makeProfile({ id: WORKER, role: "requester" }) }));
    const { createDraftRequest } = await requestActions();
    const url = await redirectedTo(() => createDraftRequest(form({ department_id: PRIMARY.id, type: "RMB" })));
    expect(url).toBe("/requests/new?created=1");
    expect(mock.calls.find((c) => c.table === "requests")?.payload).toMatchObject({ type: "RMB", purchase_type: null });
  });

  it("назва відділу — від 1 до 100 символів", () => {
    expect(normalizeDepartmentName("  Офіс  ")).toBe("Офіс");
    expect(normalizeDepartmentName("   ")).toBeNull();
    expect(normalizeDepartmentName("а".repeat(101))).toBeNull();
    expect(mapOrgDbError({ code: "23505" }, "departments")).toBe("duplicate_name");
  });

  it("дії адміністрування відхиляють користувача без ролі admin", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: makeProfile({ id: WORKER, role: "requester" }) }));
    const { addMember } = await actions();
    const url = await redirectedTo(() => addMember(form({ department_id: PRIMARY.id, user_id: WORKER })));
    expect(url).toBe(`/admin/departments/${PRIMARY.id}?error=forbidden`);
    expect(mock.calls.some((c) => c.table === "department_members")).toBe(false);
  });
});

describe("схвалювачі", () => {
  it("AC-ORG-02: призначення схвалювачем не-заявника відхилено з повідомленням", async () => {
    expect(canAssignApprover([], HIGH.id, WORKER)).toBe(false);

    const mock = useSupabase(
      createSupabaseMock({ results: { "department_approvers.insert": { error: { code: "23503" } } } }),
    );
    const { addApprover } = await actions();
    const url = await redirectedTo(() => addApprover(form({ department_id: HIGH.id, user_id: WORKER })));

    expect(url).toBe(`/admin/departments/${HIGH.id}?error=not_member`);
    expect(orgErrorMessage("not_member")).toBe("Спершу додайте працівника до відділу як заявника");
    expect(mock.calls.find((c) => c.table === "department_approvers")).toMatchObject({
      op: "insert",
      payload: { department_id: HIGH.id, user_id: WORKER },
    });
  });

  it("AC-ORG-03: зняття заявника знімає його зі схвалювачів цього відділу", async () => {
    const memberships = [{ department_id: PRIMARY.id, user_id: WORKER, auto_approve: false }];
    const approvers = [{ department_id: PRIMARY.id, user_id: WORKER }];
    expect(memberRemovalEffects(PRIMARY.id, WORKER, memberships, approvers)).toContain("approver");

    // Дія видаляє лише членство; схвалювача знімає каскад FK department_approvers_member_fkey.
    const mock = useSupabase(createSupabaseMock());
    const { removeMember } = await actions();
    const url = await redirectedTo(() => removeMember(form({ department_id: PRIMARY.id, user_id: WORKER })));
    expect(url).toBe(`/admin/departments/${PRIMARY.id}`);
    expect(mock.calls.filter((c) => c.op === "delete")).toEqual([
      {
        table: "department_members",
        op: "delete",
        filters: [
          ["department_id", PRIMARY.id],
          ["user_id", WORKER],
        ],
      },
    ]);
  });

  it("AC-ORG-04: схвалювач лише одного відділу після зняття стає requester", async () => {
    expect(deriveRole("approver", 0)).toBe("requester");
    // Тимчасово Q3: схвалювач кількох відділів лишається approver, поки схвалює хоча б один.
    expect(deriveRole("approver", 1)).toBe("approver");

    const mock = useSupabase(createSupabaseMock());
    const { removeApprover } = await actions();
    await redirectedTo(() => removeApprover(form({ department_id: PRIMARY.id, user_id: WORKER })));
    expect(mock.calls.find((c) => c.op === "delete")).toMatchObject({
      table: "department_approvers",
      filters: [
        ["department_id", PRIMARY.id],
        ["user_id", WORKER],
      ],
    });
  });

  it("AC-ORG-05: призначення схвалювачем відділу, де працівник заявник, дає роль approver", async () => {
    expect(deriveRole("requester", 1)).toBe("approver");
    expect(canAssignApprover([{ department_id: PRIMARY.id, user_id: WORKER }], PRIMARY.id, WORKER)).toBe(true);
    // Тимчасово Q4: адміністратор, призначений схвалювачем, лишається admin.
    expect(deriveRole("admin", 1)).toBe("admin");

    const mock = useSupabase(createSupabaseMock());
    const { addApprover } = await actions();
    const url = await redirectedTo(() => addApprover(form({ department_id: PRIMARY.id, user_id: WORKER })));
    expect(url).toBe(`/admin/departments/${PRIMARY.id}`);
    expect(mock.calls.find((c) => c.table === "department_approvers")).toMatchObject({
      op: "insert",
      payload: { department_id: PRIMARY.id, user_id: WORKER },
    });
  });

  it("тимчасово Q6: зняття заявника, що схвалював лише цей відділ, робить його requester", async () => {
    const memberships = [{ department_id: PRIMARY.id, user_id: WORKER, auto_approve: false }];
    const approvers = [{ department_id: PRIMARY.id, user_id: WORKER }];
    expect(memberRemovalEffects(PRIMARY.id, WORKER, memberships, approvers)).toEqual(["approver"]);

    // Дія видаляє лише членство: схвалювача знімає каскад FK, а роль після нього перераховує тригер sync_role.
    const mock = useSupabase(createSupabaseMock());
    const { removeMember } = await actions();
    await redirectedTo(() => removeMember(form({ department_id: PRIMARY.id, user_id: WORKER })));
    expect(mock.calls.filter((c) => c.op !== "select").map((c) => `${c.table}.${c.op}`)).toEqual([
      "department_members.delete",
    ]);

    const remainingApprovals = approvers.filter((a) => a.department_id !== PRIMARY.id).length;
    expect(deriveRole("approver", remainingApprovals)).toBe("requester");
  });

  it("AC-ORG-11: адміністратор, якого прибрали з усіх відділів, лишається admin", () => {
    expect(deriveRole("admin", 0)).toBe("admin");
  });

  it("у виборі схвалювача — лише активні, які ще не схвалюють відділ", () => {
    const people = [
      { id: "a", email: "a@example.test", full_name: null, is_active: true },
      { id: "b", email: "b@example.test", full_name: null, is_active: false },
      { id: "c", email: "c@example.test", full_name: null, is_active: true },
    ];
    const approvers = [{ department_id: PRIMARY.id, user_id: "c" }];
    expect(approverCandidates(PRIMARY.id, approvers, people).map((p) => p.id)).toEqual(["a"]);
  });

  it("AC-ORG-14: відділ без жодного активного схвалювача позначено «Немає схвалювача»", () => {
    const people = [
      { id: "active", is_active: true },
      { id: "inactive", is_active: false },
    ];
    expect(NO_APPROVER_LABEL).toBe("Немає схвалювача");
    expect(departmentHasActiveApprover(PRIMARY.id, [], people)).toBe(false);
    expect(departmentHasActiveApprover(PRIMARY.id, [{ department_id: PRIMARY.id, user_id: "inactive" }], people)).toBe(
      false,
    );
    expect(departmentHasActiveApprover(PRIMARY.id, [{ department_id: PRIMARY.id, user_id: "active" }], people)).toBe(
      true,
    );
    expect(departmentHasActiveApprover(OFFICE.id, [{ department_id: PRIMARY.id, user_id: "active" }], people)).toBe(
      false,
    );
  });
});

describe("автосхвалення", () => {
  it("AC-ORG-06: автосхвалення діє лише у відділі «Офіс», у «Початковій школі» лишається вимкненим", async () => {
    const memberships = [
      { department_id: PRIMARY.id, user_id: WORKER, auto_approve: false },
      { department_id: OFFICE.id, user_id: WORKER, auto_approve: true },
    ];
    expect(autoApproveDepartments(memberships, WORKER)).toEqual([OFFICE.id]);

    const mock = useSupabase(createSupabaseMock());
    const { setAutoApprove } = await actions();
    await redirectedTo(() =>
      setAutoApprove(form({ department_id: OFFICE.id, user_id: WORKER, auto_approve: "on" })),
    );
    expect(mock.calls.find((c) => c.op === "update")).toEqual({
      table: "department_members",
      op: "update",
      payload: { auto_approve: true },
      filters: [
        ["department_id", OFFICE.id],
        ["user_id", WORKER],
      ],
    });
  });

  it("AC-ORG-15: зняття заявника відділу знімає його автосхвалення в цьому відділі", () => {
    const memberships = [
      { department_id: PRIMARY.id, user_id: WORKER, auto_approve: true },
      { department_id: OFFICE.id, user_id: WORKER, auto_approve: true },
    ];
    expect(memberRemovalEffects(PRIMARY.id, WORKER, memberships, [])).toEqual(["auto_approve"]);

    // Автосхвалення — властивість рядка членства: без рядка його немає, в інших відділах — лишається.
    const afterRemoval = memberships.filter((m) => m.department_id !== PRIMARY.id);
    expect(autoApproveDepartments(afterRemoval, WORKER)).toEqual([OFFICE.id]);
  });
});

describe("тексти помилок", () => {
  it("текст «Недостатньо прав» — дослівно з вимог PM", () => {
    expect(ORG_ERROR_MESSAGES.forbidden).toBe("Недостатньо прав");
    expect(orgErrorMessage("nonsense")).toBeUndefined();
  });

  it("ключі прототипу з адреси чи форми не стають ні текстом помилки, ні типом заявки", () => {
    for (const key of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
      expect(orgErrorMessage(key)).toBeUndefined();
      expect(isRequestType(key)).toBe(false);
    }
    expect(isRequestType("PUR")).toBe(true);
  });
});

describe("сесія", () => {
  it("збій запиту профілю — помилка, а не вихід із системи", async () => {
    const mock = useSupabase(
      createSupabaseMock({ results: { "profiles.select": { error: { code: "57014", message: "timeout" } } } }),
    );
    const { requireActiveUser } = await import("@/lib/auth/session");
    await expect(requireActiveUser()).rejects.toThrow("Не вдалося прочитати профіль: timeout");
    expect(mock.signOut).not.toHaveBeenCalled();
  });

  it("неактивного працівника виводить із системи з тим самим текстом, що й за невірного пароля", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: makeProfile({ id: WORKER, is_active: false }) }));
    const { requireActiveUser } = await import("@/lib/auth/session");
    await expect(redirectedTo(() => requireActiveUser())).resolves.toBe("/login?error=invalid");
    expect(mock.signOut).toHaveBeenCalledOnce();
  });
});
