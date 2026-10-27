// Без AC PM: читання підписів авторів (AC-APR-08, 09) не має ламати сторінки, поки міграцію ще не застосовано.
import { describe, expect, it } from "vitest";
import { loadAuthorLabels } from "@/app/(app)/requests/_lib/author-labels";
import { createSupabaseMock } from "../org/supabase-mock";

describe("loadAuthorLabels", () => {
  it("returns id → label from request_author_labels", async () => {
    const mock = createSupabaseMock({
      results: { "rpc:request_author_labels.rpc": { data: [{ user_id: "u1", label: "Olga Admin" }] } },
    });

    const labels = await loadAuthorLabels(mock.client as never);

    expect(labels.get("u1")).toBe("Olga Admin");
  });

  it("falls back to an empty map while the function is not in the database yet (PGRST202)", async () => {
    const mock = createSupabaseMock({
      results: { "rpc:request_author_labels.rpc": { error: { code: "PGRST202", message: "Could not find the function" } } },
    });

    const labels = await loadAuthorLabels(mock.client as never);

    expect(labels.size).toBe(0);
  });

  it("still fails on any other database error", async () => {
    const mock = createSupabaseMock({
      results: { "rpc:request_author_labels.rpc": { error: { code: "42501", message: "permission denied" } } },
    });

    await expect(loadAuthorLabels(mock.client as never)).rejects.toThrow("Failed to read author names");
  });
});
