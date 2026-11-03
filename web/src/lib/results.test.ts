import { describe, it, expect } from "vitest";
import { mergeResults, csvFilename } from "./results";

const r = (clusterId: string, rows: Record<string, string>[], columns = Object.keys(rows[0] ?? {})) => ({
  clusterId,
  status: "ok" as const,
  columns,
  rows,
  rowCount: rows.length,
  durationMs: 1,
});

describe("mergeResults", () => {
  it("single cluster keeps columns and rows as-is", () => {
    expect(mergeResults([r("a", [{ x: "1" }])], { a: "A" })).toEqual({ columns: ["x"], rows: [{ x: "1" }] });
  });

  it("multiple clusters add a leading cluster column with the cluster name", () => {
    const m = mergeResults([r("a", [{ x: "1" }]), r("b", [{ x: "2", y: "3" }])], { a: "BRB", b: "Lab" });
    expect(m.columns).toEqual(["cluster", "x", "y"]);
    expect(m.rows).toEqual([
      { cluster: "BRB", x: "1" },
      { cluster: "Lab", x: "2", y: "3" },
    ]);
  });

  it("a real column named cluster is not clobbered", () => {
    const m = mergeResults([r("a", [{ cluster: "c1" }]), r("b", [{ cluster: "c2" }])], { a: "A", b: "B" });
    expect(m.columns).toEqual(["cucm_cluster", "cluster"]);
    expect(m.rows[0]).toEqual({ cucm_cluster: "A", cluster: "c1" });
  });
});

describe("csvFilename", () => {
  it("uses the last path segment and a timestamp", () => {
    expect(csvFilename("Phones/Phones_with_DN", new Date(2026, 10, 3, 14, 5))).toBe("Phones_with_DN-20261103-1405.csv");
    expect(csvFilename(null, new Date(2026, 0, 2, 3, 4))).toBe("query-20260102-0304.csv");
  });
});
