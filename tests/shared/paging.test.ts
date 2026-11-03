import { describe, it, expect } from "vitest";
import { parseThrottle, batchSize, pageSql, canPaginate } from "../../shared/paging.js";

const FAULT =
  "Query request too large. Total rows matched: 2816 rows. Suggested row fetch: less than 844 rows";

describe("parseThrottle", () => {
  it("parses CUCM throttle fault", () => {
    const t = parseThrottle(FAULT);
    expect(t).toEqual({ totalRows: 2816, suggestedRows: 844 });
    expect(batchSize(t!)).toBe(168);
  });

  it("parses the CUCM 15 'Suggestive Row Fetch' wording", () => {
    expect(
      parseThrottle("Query request too large. Total rows matched: 38558 rows. Suggestive Row Fetch: less than 896 rows"),
    ).toEqual({ totalRows: 38558, suggestedRows: 896 });
  });

  it("returns null for other errors", () => {
    expect(parseThrottle("A syntax error has occurred.")).toBeNull();
  });

  it("batch size is at least 1", () => {
    expect(batchSize({ totalRows: 10, suggestedRows: 3 })).toBe(1);
  });
});

describe("pageSql", () => {
  it("inserts SKIP FIRST after SELECT", () => {
    expect(pageSql("select name from device", 0, 100)).toBe("select SKIP 0 FIRST 100 name from device");
  });

  it("preserves leading whitespace and comments", () => {
    expect(pageSql("-- description: x\n  SELECT a FROM t", 200, 100)).toBe(
      "-- description: x\n  SELECT SKIP 200 FIRST 100 a FROM t",
    );
  });

  it("keeps DISTINCT after SKIP FIRST", () => {
    expect(pageSql("SELECT DISTINCT x FROM t", 0, 100)).toBe("SELECT SKIP 0 FIRST 100 DISTINCT x FROM t");
  });
});

describe("canPaginate", () => {
  it.each(["UNION", "INTERSECT", "MINUS"])("refuses top-level %s", (kw) => {
    const r = canPaginate(`select a from t ${kw} select a from u`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(kw);
  });

  it.each(["SKIP 5", "FIRST 10", "LIMIT 10"])("refuses existing %s", (clause) => {
    const kw = clause.split(" ")[0];
    const r = canPaginate(`select ${kw === "LIMIT" ? "" : clause + " "}a from t${kw === "LIMIT" ? " " + clause : ""}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(kw);
  });

  it("allows UNION inside a subquery", () => {
    expect(canPaginate("select a from t where a in (select a from u union select a from v)").ok).toBe(true);
  });

  it("ignores keywords in literals and comments", () => {
    expect(canPaginate("select a from t where n = 'union first' -- limit\n and x=1").ok).toBe(true);
  });

  it("allows plain select", () => {
    expect(canPaginate("select name from device").ok).toBe(true);
  });
});
