// AC-FRM-09: гість без входу за прямим посиланням потрапляє на сторінку входу. Це UX (захист — RLS і requireActiveUser),
// але саме proxy переспрямовує, тож перевіряємо його справжній updateSession; підроблено лише клієнт Supabase (getClaims).
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";

const getClaims = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }));

const open = (path: string) => updateSession(new NextRequest(new URL(path, "https://school.example.test")));

describe("proxy: гість без входу", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.example.test";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  });

  it("AC-FRM-09: гість за прямим посиланням на форму закупівлі переспрямований на /login", async () => {
    getClaims.mockResolvedValue({ data: null });

    const response = await open("/requests/new");

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("AC-FRM-09: гість з порожніми claims теж переспрямований на /login, а не побачив форму", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    const response = await open("/requests/new");

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("сторінка входу для гостя відкривається без переспрямування", async () => {
    getClaims.mockResolvedValue({ data: null });

    const response = await open("/login");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("користувач з входом бачить форму закупівлі без переспрямування", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "7a1d9c52-04be-4f3a-9d6e-2c8b1f0e5a47" } } });

    const response = await open("/requests/new");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
