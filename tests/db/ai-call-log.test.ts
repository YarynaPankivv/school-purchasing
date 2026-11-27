// ai_call_log (SLO-2): запис лише через public.record_ai_call, а не прямим INSERT — інакше будь-який активний користувач міг би
// дописувати рядки «unavailable» через PostgREST і псувати частку. Справжні запити від імені користувачів у PGlite.
// Назви без AC ID: це операційна перевірка WS11, а не критерій приймання PM.
import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

let t: PurchasingDb;
let andrii: string;
let inactive: string;

const DENIED = /permission denied|row-level security|violates row-level|not allowed/i;
const CALL = "select public.record_ai_call($1, $2, $3, $4, $5, $6)";
const args = (state = "ok") => [state, null, "google/gemma-4-31b-it:free", false, 1200, "suggest-v3"];
const rows = () => t.asService<{ state: string; user_id: string }>("select state, user_id from public.ai_call_log order by id");

beforeAll(async () => {
  t = await createPurchasingDb();
  andrii = await t.addUser("andrii@example.test");
  inactive = await t.addUser("gone@example.test", { isActive: false });
});

describe("public.record_ai_call і прямий запис", () => {
  it("прямий INSERT у ai_call_log від імені користувача відхилено (таблицю нікому не можна «малювати»)", async () => {
    await expect(
      t.asUser(
        andrii,
        "insert into public.ai_call_log (state, prompt_version) values ('unavailable', 'suggest-v3')",
      ),
    ).rejects.toThrow(DENIED);
    expect(await rows()).toHaveLength(0);
  });

  it("гість не викликає функцію", async () => {
    await expect(t.asAnon(CALL, args())).rejects.toThrow(DENIED);
  });

  it("активний користувач записує рядок про себе: user_id береться з auth.uid(), а не з аргументів", async () => {
    await t.asUser(andrii, CALL, args("ok"));
    const saved = await rows();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual({ state: "ok", user_id: andrii });
  });

  it("деактивований користувач не записує", async () => {
    await expect(t.asUser(inactive, CALL, args())).rejects.toThrow(/not allowed/i);
  });

  it("невірний стан чи формат поля відхиляє CHECK таблиці", async () => {
    await expect(t.asUser(andrii, CALL, ["hacked", null, "m", false, 1, "suggest-v3"])).rejects.toThrow(/check constraint/i);
    await expect(t.asUser(andrii, CALL, ["ok", "Free text with spaces!", "m", false, 1, "suggest-v3"])).rejects.toThrow(/check constraint/i);
  });

  it("користувач не читає журнал (SELECT лише в service_role)", async () => {
    await expect(t.asUser(andrii, "select * from public.ai_call_log")).rejects.toThrow(DENIED);
  });

  it("ліміт: більше 200 записів на користувача за годину — відмова", async () => {
    await t.asService(
      "insert into public.ai_call_log (user_id, state, prompt_version) select $1::uuid, 'ok', 'suggest-v3' from generate_series(1, 199)",
      [andrii],
    );
    // у журналі вже 1 + 199 = 200 рядків за останню годину
    await expect(t.asUser(andrii, CALL, args())).rejects.toThrow(/too many records/i);
  });
});
