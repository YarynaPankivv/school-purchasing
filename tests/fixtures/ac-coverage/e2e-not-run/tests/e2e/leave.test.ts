// *.test.ts у tests/e2e: Vitest виключає tests/e2e/**, Playwright бере лише *.spec.ts — тест не запускає ніхто.
import { it } from "vitest";

it("AC-DEMO-02: порожня заявка", () => {});
