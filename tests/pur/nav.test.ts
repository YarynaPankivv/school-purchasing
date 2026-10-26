// Допоміжні функції навігації списків: параметри адреси, безпечне повернення, сусіди в порядку списку.
import { describe, expect, it } from "vitest";
import {
  detailHref,
  nextDir,
  parseDepartment,
  parseDir,
  parsePage,
  parseSortKey,
  parseStatus,
  parseView,
  requestsHref,
  safeBack,
  statusRank,
} from "@/app/(app)/requests/_lib/nav";
import { pageWindow } from "@/components/ui/pagination";

const A = "3f0c2a5e-9b1d-4c7e-8a2f-1b6d5e4c3a21";

describe("requests list navigation", () => {
  it("parses only known status, sort, view, department and page values", () => {
    expect(parseStatus("draft")).toBe("draft");
    expect(parseStatus("rejected")).toBeNull();
    expect(parseSortKey("total")).toBe("total");
    expect(parseSortKey("random")).toBeNull();
    expect(parseDir("desc")).toBe("desc");
    expect(parseDir("up")).toBeNull();
    expect(parseView("decide")).toBe("decide");
    expect(parseView("all")).toBeNull();
    expect(parseDepartment(A)).toBe(A);
    expect(parseDepartment("dep")).toBeNull();
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("builds list links with only the parameters that are set", () => {
    expect(requestsHref({})).toBe("/requests");
    expect(requestsHref({ status: "pending", q: "Upper School" })).toBe("/requests?q=Upper+School&status=pending");
    expect(requestsHref({ view: "decide", sort: "updated", dir: "asc" })).toBe("/requests?view=decide&sort=updated&dir=asc");
    // Напрямок без колонки не потрапляє в адресу; перша сторінка — теж.
    expect(requestsHref({ dir: "asc", pages: { mine: 1, all: 3 } })).toBe("/requests?p_all=3");
    expect(requestsHref({ department: A })).toBe(`/requests?department=${A}`);
  });

  it("picks the next sort direction and the order of statuses", () => {
    expect(nextDir("updated", { key: null, dir: "asc" })).toBe("desc");
    expect(nextDir("department", { key: null, dir: "desc" })).toBe("asc");
    expect(nextDir("department", { key: "department", dir: "asc" })).toBe("desc");
    expect(nextDir("department", { key: "department", dir: "desc" })).toBe("asc");
    expect(statusRank("pending")).toBeLessThan(statusRank("draft"));
    expect(statusRank("unknown")).toBeGreaterThan(statusRank("draft"));
  });

  it("shows first, last and neighbouring pages with gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 20)).toEqual([1, "gap", 4, 5, 6, "gap", 20]);
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, "gap", 20]);
  });

  it("allows only in-app return addresses", () => {
    expect(safeBack("/")).toBe("/");
    expect(safeBack("/requests?status=draft")).toBe("/requests?status=draft");
    expect(safeBack("https://example.test")).toBeNull();
    expect(safeBack("//example.test")).toBeNull();
    expect(safeBack("/admin/users")).toBeNull();
    expect(safeBack(undefined)).toBeNull();
  });

  it("builds a detail link that carries the way back", () => {
    expect(detailHref(A, {})).toBe(`/requests/${A}`);
    expect(detailHref(A, { back: "/requests?status=draft" })).toBe(`/requests/${A}?back=%2Frequests%3Fstatus%3Ddraft`);
  });
});
