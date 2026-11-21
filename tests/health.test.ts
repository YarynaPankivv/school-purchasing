// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
import { describe, expect, it } from "vitest";
import { classifyDbProbe, supabaseRefFromUrl } from "@/lib/health";

describe("classifyDbProbe (/api/health)", () => {
  it("рахує базу живою, коли запит пройшов або Postgres відмовив у правах (42501)", () => {
    expect(classifyDbProbe({ status: 200, error: null })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 401, error: { code: "42501", message: "permission denied for table profiles" } })).toEqual({
      db: "ok",
      reason: "",
    });
    expect(classifyDbProbe({ status: 400, error: { code: "PGRST100", message: "bad filter" } }).db).toBe("ok");
  });

  it("повідомляє «paused», коли Supabase відповідає 540 (безкоштовний проєкт призупинено)", () => {
    expect(classifyDbProbe({ status: 540, error: { message: "project paused" } })).toEqual({ db: "down", reason: "paused" });
  });

  it("повідомляє про хибний публічний ключ", () => {
    expect(classifyDbProbe({ status: 401, error: { message: "Invalid API key" } })).toEqual({
      db: "down",
      reason: "invalid-api-key",
    });
  });

  it("повідомляє код, коли PostgREST не дістає до бази або мережі немає", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "PGRST002", message: "schema cache" } })).toEqual({
      db: "down",
      reason: "status-503-PGRST002",
    });
    // SQLSTATE класу 08 зі статусом 503: PostgREST не дістає до бази — не «ok», хоч код схожий на код Postgres.
    expect(classifyDbProbe({ status: 503, error: { code: "08006", message: "connection failure" } })).toEqual({
      db: "down",
      reason: "status-503-08006",
    });
    expect(classifyDbProbe({ status: 0, error: { message: "fetch failed" } })).toEqual({ db: "down", reason: "status-0" });
  });
});

describe("supabaseRefFromUrl (/api/health, supabaseRef)", () => {
  it("віддає лише ref проєкту з адреси Supabase", () => {
    expect(supabaseRefFromUrl("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
    expect(supabaseRefFromUrl("https://abcdefghijklmnop.supabase.co/")).toBe("abcdefghijklmnop");
  });

  it("розбирає адресу як URL: регістр хоста й порт 443 не заважають, сторонні хости відхиляються", () => {
    expect(supabaseRefFromUrl("https://ABCDEFGHIJKLMNOP.supabase.co")).toBe("abcdefghijklmnop");
    expect(supabaseRefFromUrl("https://abcdefghijklmnop.supabase.co:443/rest/v1")).toBe("abcdefghijklmnop");
    expect(supabaseRefFromUrl("http://abcdefghijklmnop.supabase.co")).toBe("");
    expect(supabaseRefFromUrl("https://abcdefghijklmnop.supabase.co.evil.example.com")).toBe("");
    expect(supabaseRefFromUrl("https://user@evil.example.com/abcdefghijklmnop.supabase.co")).toBe("");
  });

  it("повертає порожній рядок, коли адреси немає чи вона не Supabase (локальна розробка)", () => {
    expect(supabaseRefFromUrl(undefined)).toBe("");
    expect(supabaseRefFromUrl("")).toBe("");
    expect(supabaseRefFromUrl("http://127.0.0.1:54321")).toBe("");
    expect(supabaseRefFromUrl("https://evil.example.com/abcdefghijklmnop.supabase.co")).toBe("");
  });
});
