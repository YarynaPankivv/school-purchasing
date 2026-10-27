// Без AC PM: proxy — це UX, а не захист, але «публічні» сторінки мають збігатися точно (AC-FRM-09: гість бачить вхід).
import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/supabase/proxy";

describe("isPublicPath", () => {
  it("treats the sign-in and auth routes (and their sub-paths) as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });

  it("does not treat paths that merely start with a public name as public", () => {
    expect(isPublicPath("/loginfoo")).toBe(false);
    expect(isPublicPath("/authx")).toBe(false);
    expect(isPublicPath("/requests")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
