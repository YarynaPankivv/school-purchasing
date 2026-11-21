import { describe, expect, it } from "vitest";
import { checkSupabaseRef } from "../../scripts/lib/supabase-ref.mjs";

// Дія з postmortem 2026-11-21-supabase-url-typo: smoke звіряє supabaseRef з health з очікуваним для середовища.
// Назви тестів без AC ID: це операційна перевірка WS11, а не критерій приймання PM (інакше ac:coverage покаже ORPHAN).
const STAGING = "nrapwkzhqplxvwgittly";
const PROD = "rgpngqhjkawryldpyxzl";
const TYPO = "nrapwkzhqplxvwgittlz"; // хибний ref з дрілу: один символ змінено

describe("checkSupabaseRef (smoke, дія з postmortem)", () => {
  it("зелений стан: деплой staging показує ref staging", () => {
    expect(checkSupabaseRef({ actual: STAGING, expect: STAGING, forbid: PROD })).toEqual([]);
  });

  it("червоний стан дрілу: ref із помилкою в одному символі не збігається з очікуваним і названо змінну для перевірки", () => {
    const [message, ...rest] = checkSupabaseRef({ actual: TYPO, expect: STAGING, forbid: PROD });
    expect(rest).toEqual([]);
    expect(message).toContain(TYPO);
    expect(message).toContain(STAGING);
    expect(message).toContain("SUPABASE_STAGING_REF");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("staging чи PR-preview, що ходить у базу проду, — збій навіть коли база відповідає", () => {
    const messages = checkSupabaseRef({ actual: PROD, expect: STAGING, forbid: PROD });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("ЗАБОРОНЕНОЇ бази");
  });

  it("прод показує ref проду і зелений; ref staging на проді — збій", () => {
    expect(checkSupabaseRef({ actual: PROD, expect: PROD, forbid: STAGING })).toEqual([]);
    expect(checkSupabaseRef({ actual: STAGING, expect: PROD, forbid: STAGING })).toHaveLength(1);
  });

  it("порожній ref (NEXT_PUBLIC_SUPABASE_URL не схожий на адресу Supabase) — збій", () => {
    expect(checkSupabaseRef({ actual: "", expect: STAGING, forbid: PROD })).toHaveLength(1);
  });

  it("не збій, коли очікування не задано (змінні репо відсутні) або в старішій збірці немає поля supabaseRef", () => {
    expect(checkSupabaseRef({ actual: TYPO })).toEqual([]);
    expect(checkSupabaseRef({ actual: undefined, expect: STAGING, forbid: PROD })).toEqual([]);
  });

  it("у повідомленнях немає значень секретів: лише refи проєктів і назви змінних", () => {
    const text = checkSupabaseRef({ actual: TYPO, expect: STAGING, forbid: PROD }).join(" ");
    expect(text).not.toMatch(/sb_secret|eyJ|sbp_|postgres(ql)?:\/\//);
  });
});
