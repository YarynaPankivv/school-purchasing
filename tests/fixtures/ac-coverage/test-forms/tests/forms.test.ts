import { describe, it, test } from "vitest";

// it("AC-DEMO-01: commented out with a line comment", () => {});
/*
it("AC-DEMO-02: commented out in a block comment", () => {});
*/
it("AC-DEMO-03: a title with http://example.test/a and /* is still a live test", () => {});
it.each([[1], [2]])("AC-DEMO-04: parameterized %s", () => {});
test.concurrent.each([[1]])("AC-DEMO-05: concurrent each %s", () => {});
test.for([[1]])("AC-DEMO-06: for %s", () => {});
describe.skip("a skipped group", () => {
  it("AC-DEMO-08: never runs inside describe.skip", () => {});
});
test.fail("AC-DEMO-09: Playwright test.fail is expected to fail, so it does not count", () => {});
