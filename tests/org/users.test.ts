// Задача 3 зрізу ORG (openspec/changes/impl-org/tasks.md 3.3): доступ лише для admin, захист єдиного адміністратора,
// деактивація, чернетки деактивованого, вибір особи «від імені». Чисті правила src/lib/org/{users,departments}.ts
// і server actions із моком Supabase (design.md D9).
// SQL-дзеркало — тригер private.guard_profile_update(), політики profiles_*/requests_* і private.can_act_on_behalf();
// їх перевіряють db-check і ручний прохід на Preview.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approverCandidates, onBehalfCandidates, type Person } from "@/lib/org/departments";
import { ORG_ERROR_MESSAGES, mapOrgDbError, orgErrorMessage } from "@/lib/org/errors";
import { deriveRole } from "@/lib/org/roles";
import {
  activeAdminCount,
  canDeleteDraft,
  draftsOf,
  isSoleActiveAdmin,
  submittedOf,
  wouldLeaveNoActiveAdmin,
  type StaffMember,
} from "@/lib/org/users";
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

const userActions = () => import("@/app/admin/users/actions");
const loginActions = () => import("@/app/login/actions");
const requestActions = () => import("@/app/requests/new/actions");
const sessionModule = () => import("@/lib/auth/session");

const ADMIN = "3f0c2a5e-9b1d-4c7e-8a2f-1b6d5e4c3a21";
const SECOND_ADMIN = "7a1d9c52-04be-4f3a-9d6e-2c8b1f0e5a47";
const WORKER = "c4e8b7a1-5d23-4a90-b1f6-9e0d3c2a8b15";
const WORKER_2 = "e2b6d4f8-1a37-4c59-8d02-6f9a0b3c7e14";
const DRAFT = "9d3f5b21-8c46-4e17-a0b9-4d7e2c1f6a83";
const OFFICE = "b8a2c6e0-3f14-4d75-9a1c-5e7b0d2f4c69";

const admin = makeProfile({ id: ADMIN, role: "admin" });
const worker = makeProfile({ id: WORKER, role: "requester", email: "member1@example.test", full_name: "Андрій" });

const staff = (...rows: Array<[string, string, boolean]>): StaffMember[] =>
  rows.map(([id, role, is_active]) => ({ id, role, is_active }));

function useSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  createClient.mockResolvedValue(mock.client);
  return mock;
}

beforeEach(() => {
  createClient.mockReset();
});

describe("доступ до адміністрування", () => {
  it("AC-ORG-09: без ролі admin дії адміністрування відхилено з «Недостатньо прав», дані не змінюються", async () => {
    expect(ORG_ERROR_MESSAGES.forbidden).toBe("Insufficient permissions");
    expect(orgErrorMessage("forbidden")).toBe("Insufficient permissions");

    const mock = useSupabase(createSupabaseMock({ profile: worker }));
    const { setAdminRole, setActive, deleteDraft } = await userActions();
    const departments = await import("@/app/admin/departments/actions");

    expect(await redirectedTo(() => setAdminRole(form({ user_id: WORKER, make_admin: "1" })))).toBe(
      `/admin/users/${WORKER}?error=forbidden`,
    );
    expect(await redirectedTo(() => setActive(form({ user_id: WORKER_2, active: "0" })))).toBe(
      `/admin/users/${WORKER_2}?error=forbidden`,
    );
    expect(await redirectedTo(() => deleteDraft(form({ user_id: WORKER_2, request_id: DRAFT })))).toBe(
      `/admin/users/${WORKER_2}?error=forbidden`,
    );
    expect(await redirectedTo(() => departments.createDepartment(form({ name: "Новий" })))).toBe(
      "/admin/departments?error=forbidden",
    );
    // Жодного запису в базу: вибирали лише власний профіль.
    expect(mock.calls.every((c) => c.table === "profiles" && c.op === "select")).toBe(true);
  });

  it("AC-ORG-09: requireAdmin пропускає лише admin; помилка RLS 42501 на profiles теж дає «Недостатньо прав»", async () => {
    const { requireAdmin } = await sessionModule();

    useSupabase(createSupabaseMock({ profile: worker }));
    expect((await requireAdmin()).ok).toBe(false);

    useSupabase(createSupabaseMock({ profile: makeProfile({ id: SECOND_ADMIN, role: "approver" }) }));
    expect((await requireAdmin()).ok).toBe(false);

    useSupabase(createSupabaseMock({ profile: admin }));
    expect((await requireAdmin()).ok).toBe(true);

    expect(mapOrgDbError({ code: "42501" }, "profiles")).toBe("forbidden");
  });
});

describe("єдиний активний адміністратор", () => {
  const sole = staff([ADMIN, "admin", true], [WORKER, "requester", true], [WORKER_2, "admin", false]);
  const two = staff([ADMIN, "admin", true], [SECOND_ADMIN, "admin", true], [WORKER, "requester", true]);

  it("AC-ORG-10: єдиний активний адміністратор не знімає з себе роль — правило, дія й текст PM", async () => {
    expect(activeAdminCount(sole)).toBe(1); // деактивований admin не рахується
    expect(isSoleActiveAdmin(sole, ADMIN)).toBe(true);
    expect(wouldLeaveNoActiveAdmin(sole, ADMIN, { makeAdmin: false })).toBe(true);

    // База відхиляє винятком тригера (SQLSTATE ORG01) — дія показує текст PM дослівно.
    const mock = useSupabase(
      createSupabaseMock({
        profile: admin,
        results: { "profiles.update": { error: { code: "ORG01", message: ORG_ERROR_MESSAGES.last_admin } } },
      }),
    );
    const { setAdminRole } = await userActions();
    const url = await redirectedTo(() => setAdminRole(form({ user_id: ADMIN, make_admin: "0" })));
    expect(url).toBe(`/admin/users/${ADMIN}?error=last_admin`);
    expect(orgErrorMessage("last_admin")).toBe("At least one active administrator must remain");
    expect(mock.calls.find((c) => c.op === "update")?.payload).toEqual({ role: "requester" });
  });

  it("AC-ORG-18: єдиний активний адміністратор не деактивує себе — правило, дія й текст PM", async () => {
    expect(wouldLeaveNoActiveAdmin(sole, ADMIN, { isActive: false })).toBe(true);
    // Деактивація не-адміністратора адміністраторів не зменшує.
    expect(wouldLeaveNoActiveAdmin(sole, WORKER, { isActive: false })).toBe(false);

    const mock = useSupabase(
      createSupabaseMock({
        profile: admin,
        results: { "profiles.update": { error: { code: "ORG01", message: ORG_ERROR_MESSAGES.last_admin } } },
      }),
    );
    const { setActive } = await userActions();
    const url = await redirectedTo(() => setActive(form({ user_id: ADMIN, active: "0" })));
    expect(url).toBe(`/admin/users/${ADMIN}?error=last_admin`);
    expect(mock.calls.find((c) => c.op === "update")?.payload).toEqual({ is_active: false });
  });

  it("AC-ORG-10, AC-ORG-18: повідомлення тригера впізнається й без коду помилки", () => {
    expect(mapOrgDbError({ message: "At least one active administrator must remain" }, "profiles")).toBe("last_admin");
    expect(mapOrgDbError({ code: "ORG01" }, "profiles")).toBe("last_admin");
  });

  it("AC-ORG-21: за двох активних адміністраторів роль із себе знімається, другий лишається адміністратором", async () => {
    expect(isSoleActiveAdmin(two, ADMIN)).toBe(false);
    expect(wouldLeaveNoActiveAdmin(two, ADMIN, { makeAdmin: false })).toBe(false);
    expect(wouldLeaveNoActiveAdmin(two, ADMIN, { isActive: false })).toBe(false);
    // Але обидва одразу — вже ні: після першої зміни другий стає єдиним.
    const afterFirst = staff([ADMIN, "requester", true], [SECOND_ADMIN, "admin", true]);
    expect(wouldLeaveNoActiveAdmin(afterFirst, SECOND_ADMIN, { makeAdmin: false })).toBe(true);

    const mock = useSupabase(createSupabaseMock({ profile: admin, results: { "profiles.update": { data: [{ id: ADMIN }] } } }));
    const { setAdminRole } = await userActions();
    const url = await redirectedTo(() => setAdminRole(form({ user_id: ADMIN, make_admin: "0" })));
    expect(url).toBe(`/admin/users/${ADMIN}?saved=admin_off`);

    // Змінюємо лише власний рядок: другий адміністратор не чіпається.
    const updates = mock.calls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.filters).toEqual([["id", ADMIN]]);
  });

  it("зняття ролі admin дає похідну роль від схвалення відділів (D3, D6)", () => {
    expect(deriveRole("requester", 0)).toBe("requester");
    expect(deriveRole("requester", 2)).toBe("approver");
    expect(deriveRole("admin", 0)).toBe("admin");
  });

  it("призначення адміністратором надсилає role = admin; невідомий працівник — «не знайдено»", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: admin, results: { "profiles.update": { data: [{ id: WORKER }] } } }));
    const { setAdminRole } = await userActions();
    expect(await redirectedTo(() => setAdminRole(form({ user_id: WORKER, make_admin: "1" })))).toBe(
      `/admin/users/${WORKER}?saved=admin_on`,
    );
    expect(mock.calls.find((c) => c.op === "update")?.payload).toEqual({ role: "admin" });

    // RLS мовчки відфільтрувала рядок (0 змінених) — це не успіх.
    useSupabase(createSupabaseMock({ profile: admin, results: { "profiles.update": { data: [] } } }));
    expect(await redirectedTo(() => setAdminRole(form({ user_id: WORKER, make_admin: "1" })))).toBe(
      `/admin/users/${WORKER}?error=not_found`,
    );
    expect(await redirectedTo(() => setAdminRole(form({ user_id: "не-uuid", make_admin: "1" })))).toBe(
      "/admin/users?error=not_found",
    );
  });
});

describe("деактивація", () => {
  it("AC-ORG-12: деактивований працівник не може увійти — login() виходить із текстом невірного пароля", async () => {
    const inactive = makeProfile({ id: WORKER, role: "requester", is_active: false });
    const mock = useSupabase(createSupabaseMock({ profile: inactive }));
    const { login } = await loginActions();

    const url = await redirectedTo(() => login(form({ email: "member1@example.test", password: "secret-1234" })));
    expect(url).toBe("/login?error=invalid"); // не розкриваємо стан облікового запису
    expect(mock.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(mock.signOut).toHaveBeenCalledTimes(1);
  });

  it("AC-ORG-12: активний працівник входить; невірний пароль не доходить до читання профілю", async () => {
    const ok = useSupabase(createSupabaseMock({ profile: worker }));
    const { login } = await loginActions();
    expect(await redirectedTo(() => login(form({ email: "member1@example.test", password: "secret-1234" })))).toBe("/");
    expect(ok.signOut).not.toHaveBeenCalled();

    const bad = useSupabase(createSupabaseMock({ profile: worker, signInError: { message: "Invalid login" } }));
    expect(await redirectedTo(() => login(form({ email: "member1@example.test", password: "x" })))).toBe(
      "/login?error=invalid",
    );
    expect(bad.calls).toHaveLength(0);
  });

  it("AC-ORG-12: активна сесія деактивованого теж закінчується — requireActiveUser виходить на кожній сторінці", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: makeProfile({ id: WORKER, role: "requester", is_active: false }) }));
    const { requireActiveUser } = await sessionModule();
    expect(await redirectedTo(() => requireActiveUser())).toBe("/login?error=invalid");
    expect(mock.signOut).toHaveBeenCalledTimes(1);
  });

  it("AC-ORG-12: адміністратор деактивує працівника — is_active = false, активує — true", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: admin, results: { "profiles.update": { data: [{ id: WORKER }] } } }));
    const { setActive } = await userActions();

    expect(await redirectedTo(() => setActive(form({ user_id: WORKER, active: "0" })))).toBe(
      `/admin/users/${WORKER}?saved=deactivated`,
    );
    expect(await redirectedTo(() => setActive(form({ user_id: WORKER, active: "1" })))).toBe(
      `/admin/users/${WORKER}?saved=activated`,
    );
    expect(mock.calls.filter((c) => c.op === "update").map((c) => c.payload)).toEqual([
      { is_active: false },
      { is_active: true },
    ]);
  });
});

describe("чернетки деактивованого працівника", () => {
  const rows = [
    { id: DRAFT, status: "draft", author_id: WORKER },
    { id: "s1", status: "submitted", author_id: WORKER },
    { id: "d2", status: "draft", author_id: WORKER_2 },
  ];

  it("AC-ORG-13: видаляється лише чернетка деактивованого, подані заявки лишаються", async () => {
    // Чиста частина: що можна видалити, а що лишається.
    expect(draftsOf(rows, WORKER).map((r) => r.id)).toEqual([DRAFT]);
    expect(submittedOf(rows, WORKER).map((r) => r.id)).toEqual(["s1"]);
    expect(canDeleteDraft(rows[0]!, false)).toBe(true);
    expect(canDeleteDraft(rows[1]!, false)).toBe(false); // подану заявку не видаляємо

    const mock = useSupabase(
      createSupabaseMock({
        profile: admin,
        profiles: [makeProfile({ id: WORKER, role: "requester", is_active: false })],
        results: { "requests.select": { data: rows[0] } },
      }),
    );
    const { deleteDraft } = await userActions();
    const url = await redirectedTo(() => deleteDraft(form({ user_id: WORKER, request_id: DRAFT })));
    expect(url).toBe(`/admin/users/${WORKER}?saved=draft_deleted`);

    // Видалення прив'язане до статусу «чернетка»: подані заявки цього працівника не потрапляють під DELETE.
    const del = mock.calls.find((c) => c.table === "requests" && c.op === "delete");
    expect(del?.filters).toEqual([
      ["id", DRAFT],
      ["status", "draft"],
    ]);
  });

  it("AC-ORG-13: поданої заявки чи чернетки активного працівника дія не видаляє", async () => {
    const submittedRow = { id: DRAFT, status: "submitted", author_id: WORKER };
    const first = useSupabase(
      createSupabaseMock({
        profile: admin,
        profiles: [makeProfile({ id: WORKER, role: "requester", is_active: false })],
        results: { "requests.select": { data: submittedRow } },
      }),
    );
    const { deleteDraft } = await userActions();
    expect(await redirectedTo(() => deleteDraft(form({ user_id: WORKER, request_id: DRAFT })))).toBe(
      `/admin/users/${WORKER}?error=not_a_draft`,
    );
    expect(first.calls.some((c) => c.op === "delete")).toBe(false);

    const second = useSupabase(
      createSupabaseMock({
        profile: admin,
        profiles: [makeProfile({ id: WORKER, role: "requester", is_active: true })],
        results: { "requests.select": { data: rows[0] } },
      }),
    );
    expect(await redirectedTo(() => deleteDraft(form({ user_id: WORKER, request_id: DRAFT })))).toBe(
      `/admin/users/${WORKER}?error=not_a_draft`,
    );
    expect(second.calls.some((c) => c.op === "delete")).toBe(false);
  });
});

describe("варіанти вибору", () => {
  const people: Person[] = [
    { id: ADMIN, email: "admin@example.test", full_name: "Адмін", is_active: true },
    { id: WORKER, email: "member1@example.test", full_name: "Андрій", is_active: true },
    { id: WORKER_2, email: "member2@example.test", full_name: "Марія", is_active: false },
    { id: SECOND_ADMIN, email: "colleague@example.test", full_name: "Колега", is_active: true },
  ];
  const members = [
    { department_id: OFFICE, user_id: WORKER },
    { department_id: OFFICE, user_id: WORKER_2 },
    { department_id: OFFICE, user_id: ADMIN },
    { department_id: "other", user_id: SECOND_ADMIN },
  ];

  it("AC-ORG-16: деактивованого немає у виборі схвалювача", () => {
    const ids = approverCandidates(OFFICE, [], people).map((p) => p.id);
    expect(ids).not.toContain(WORKER_2);
    expect(ids).toContain(WORKER);
  });

  it("AC-ORG-16: деактивованого немає у виборі особи «від імені»; не-admin обирає лише заявників відділу", () => {
    const forWorker = onBehalfCandidates(OFFICE, members, people, ADMIN, "requester").map((p) => p.id);
    expect(forWorker).toEqual([WORKER]); // не WORKER_2 (деактивований), не автор, не чужий відділ

    // Admin обирає серед усіх активних, але теж без деактивованих і без себе.
    const forAdmin = onBehalfCandidates(OFFICE, members, people, ADMIN, "admin").map((p) => p.id);
    expect(forAdmin).toEqual([WORKER, SECOND_ADMIN]);
    expect(forAdmin).not.toContain(WORKER_2);
  });

  it("AC-ORG-16: особа «від імені» йде в чернетку; відмова бази (деактивований, чужий відділ) — зрозуміла помилка", async () => {
    const mock = useSupabase(createSupabaseMock({ profile: worker }));
    const { createDraftRequest } = await requestActions();
    const url = await redirectedTo(() =>
      createDraftRequest(form({ department_id: OFFICE, type: "RMB", on_behalf_of_id: WORKER_2 })),
    );
    expect(url).toBe("/requests/new?created=1");
    expect(mock.calls.find((c) => c.table === "requests")?.payload).toMatchObject({ on_behalf_of_id: WORKER_2 });

    // Без «від імені» поле в запит не потрапляє.
    const plain = useSupabase(createSupabaseMock({ profile: worker }));
    await redirectedTo(() => createDraftRequest(form({ department_id: OFFICE, type: "RMB" })));
    expect(plain.calls.find((c) => c.table === "requests")?.payload).not.toHaveProperty("on_behalf_of_id");

    // RLS requests_insert (private.can_act_on_behalf) не пропустила рядок.
    useSupabase(createSupabaseMock({ profile: worker, results: { "requests.insert": { error: { code: "42501" } } } }));
    expect(
      await redirectedTo(() => createDraftRequest(form({ department_id: OFFICE, type: "RMB", on_behalf_of_id: WORKER_2 }))),
    ).toBe("/requests/new?error=invalid_request");

    // Не-UUID відхилено до запиту.
    const bad = useSupabase(createSupabaseMock({ profile: worker }));
    expect(
      await redirectedTo(() => createDraftRequest(form({ department_id: OFFICE, type: "RMB", on_behalf_of_id: "x" }))),
    ).toBe("/requests/new?error=invalid_request");
    expect(bad.calls.some((c) => c.table === "requests")).toBe(false);
  });
});
