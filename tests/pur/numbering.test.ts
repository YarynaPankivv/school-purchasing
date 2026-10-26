// Унікальність номера PUR-N при одночасному створенні (AC-PUR-02; design.md D2).
// Справжню гонку двох транзакцій без бази не відтворити: номер видає послідовність Postgres у тригері before insert,
// тож гарантія — у схемі. Тут перевіряємо обидві половини: застосунок не вигадує номер сам (інакше двоє авторів
// могли б прочитати той самий «останній» і вставити однаковий), а схема видає його з послідовності й має унікальний індекс.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, makeProfile, redirectedTo } from "../org/supabase-mock";

vi.mock("next/navigation", async () => {
  const { RedirectSignal } = await import("../org/supabase-mock");
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

const DEP = "5c9e1b34-7d02-4a68-b3f5-0e8a2d6c9f17";
const FIRST = "9d3f5b21-8c46-4e17-a0b9-4d7e2c1f6a83";
const SECOND = "b8a2c6e0-3f14-4d75-9a1c-5e7b0d2f4c69";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261021140000_pur_drafts.sql"), "utf8");

function draftForm() {
  const data = new FormData();
  data.set("department_id", DEP);
  data.set("type", "PUR");
  data.set("purchase_type", "procurement");
  return data;
}

beforeEach(() => {
  createClient.mockReset();
});

describe("номер закупівлі", () => {
  it("AC-PUR-02: двоє авторів створюють закупівлі одночасно — кожна чернетка вставляється без номера, отже номер видає база", async () => {
    const authors = [
      makeProfile({ id: "user-author-a", role: "requester", email: "a@example.test" }),
      makeProfile({ id: "user-author-b", role: "requester", email: "b@example.test" }),
    ];
    const mocks = [FIRST, SECOND].map((id, i) => createSupabaseMock({ profile: authors[i], results: { "requests.insert": { data: { id } } } }));
    createClient.mockResolvedValueOnce(mocks[0].client).mockResolvedValueOnce(mocks[1].client);

    const { createDraftRequest } = await import("@/app/(app)/requests/new/actions");
    const redirects = await Promise.all([
      redirectedTo(() => createDraftRequest(draftForm())),
      redirectedTo(() => createDraftRequest(draftForm())),
    ]);

    // Кожен автор потрапляє на власну чернетку.
    expect(redirects.sort()).toEqual([`/requests/${FIRST}?saved=created`, `/requests/${SECOND}?saved=created`].sort());
    for (const mock of mocks) {
      const insert = mock.calls.find((c) => c.table === "requests" && c.op === "insert");
      expect(insert?.payload).toBeDefined();
      expect(insert?.payload).not.toHaveProperty("number");
    }
  });

  it("AC-PUR-02: у схемі номер береться з послідовності в тригері й захищений унікальним індексом", () => {
    expect(migration).toContain("create sequence private.purchase_number_seq");
    // Тригер before insert завжди перезаписує надіслане клієнтом значення номером із послідовності.
    expect(migration).toContain("new.number := nextval('private.purchase_number_seq')");
    expect(migration).toMatch(/create trigger requests_assign_number\s+before insert on public\.requests/);
    // Навіть якби два номери збіглися, другу вставку відхилить унікальний індекс.
    expect(migration).toContain("create unique index requests_pur_number_unique on public.requests (number) where type = 'PUR'");
  });
});
