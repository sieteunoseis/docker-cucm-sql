import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ClusterResult } from "@shared/types";
import { api } from "@/api/client";
import { useRun } from "./useRun";

const throttled = (id = "a", total = 2816, suggested = 844): ClusterResult => ({
  clusterId: id,
  status: "throttled",
  columns: [],
  rows: [],
  rowCount: 0,
  durationMs: 5,
  error: "Query request too large",
  throttle: { totalRows: total, suggestedRows: suggested },
});

const okRows = (id: string, n: number, start = 0): ClusterResult => ({
  clusterId: id,
  status: "ok",
  columns: ["i"],
  rows: Array.from({ length: n }, (_, k) => ({ i: String(start + k) })),
  rowCount: n,
  durationMs: 1,
});

/** fake AXL: returns rows for "SKIP s FIRST f" up to total, throttling when f > limit */
function fakePaging(total: number, limit = Infinity) {
  return vi.spyOn(api, "runQuery").mockImplementation(async ({ sql, clusters }) => {
    const m = /SKIP (\d+) FIRST (\d+)/.exec(sql);
    if (!m) return { results: [throttled(clusters[0], total)] };
    const skip = Number(m[1]);
    const first = Number(m[2]);
    if (first > limit) return { results: [throttled(clusters[0], total, limit)] };
    return { results: [okRows(clusters[0], Math.max(0, Math.min(first, total - skip)), skip)] };
  });
}

beforeEach(() => vi.restoreAllMocks());

describe("useRun.fetchAll", () => {
  it("batches with floor(suggested/5) and merges all rows", async () => {
    const spy = fakePaging(2816);
    const { result } = renderHook(() => useRun({ maxBatches: 200 }));
    await act(() => result.current.run("select i from t", ["a"]));
    expect(result.current.results[0].status).toBe("throttled");
    await act(() => result.current.fetchAll("a"));
    const batchCalls = spy.mock.calls.slice(1).map(([b]) => b.sql);
    expect(batchCalls).toHaveLength(17);
    expect(batchCalls[0]).toBe("select SKIP 0 FIRST 168 i from t");
    expect(batchCalls[16]).toBe("select SKIP 2688 FIRST 168 i from t");
    const r = result.current.results[0];
    expect(r.status).toBe("ok");
    expect(r.rowCount).toBe(2816);
    expect(r.rows[2815]).toEqual({ i: "2815" });
  });

  it("halves batch size on re-throttle", async () => {
    const spy = fakePaging(500, 100);
    const { result } = renderHook(() => useRun({ maxBatches: 200 }));
    await act(() => result.current.run("select i from t", ["a"]));
    // suggested 844 → 168 → throttles (limit 100) → 84
    await act(() => result.current.fetchAll("a"));
    const firsts = spy.mock.calls.slice(1).map(([b]) => Number(/FIRST (\d+)/.exec(b.sql)![1]));
    expect(firsts.slice(0, 3)).toEqual([168, 84, 84]);
    expect(result.current.results[0].rowCount).toBe(500);
  });

  it("stops at maxBatches", async () => {
    fakePaging(2816);
    const { result } = renderHook(() => useRun({ maxBatches: 3 }));
    await act(() => result.current.run("select i from t", ["a"]));
    await act(() => result.current.fetchAll("a"));
    const r = result.current.results[0];
    expect(r.rowCount).toBe(3 * 168);
    expect(r.error).toMatch(/Stopped after 3 batches/);
  });

  it("cancel stops the loop", async () => {
    const spy = fakePaging(2816);
    const { result } = renderHook(() => useRun({ maxBatches: 200 }));
    await act(() => result.current.run("select i from t", ["a"]));
    spy.mockImplementation(async ({ sql }) => {
      if (sql.includes("SKIP 168 ")) result.current.cancel();
      return { results: [okRows("a", 168)] };
    });
    await act(() => result.current.fetchAll("a"));
    expect(spy.mock.calls.length).toBeLessThan(5);
    expect(result.current.results[0].error).toMatch(/Cancelled/);
  });

  it("leaves other clusters' rows untouched", async () => {
    vi.spyOn(api, "runQuery").mockResolvedValueOnce({ results: [throttled("a", 10, 10), okRows("b", 2)] });
    const { result } = renderHook(() => useRun({ maxBatches: 200 }));
    await act(() => result.current.run("select i from t", ["a", "b"]));
    vi.spyOn(api, "runQuery").mockImplementation(async () => ({ results: [okRows("a", 2)] }));
    await act(() => result.current.fetchAll("a"));
    expect(result.current.results[1]).toEqual(okRows("b", 2));
  });

  it("refuses queries that can't be paginated", async () => {
    vi.spyOn(api, "runQuery").mockResolvedValueOnce({ results: [throttled("a")] });
    const { result } = renderHook(() => useRun({ maxBatches: 200 }));
    await act(() => result.current.run("select a from t union select a from u", ["a"]));
    expect(result.current.paginate("a")).toMatchObject({ ok: false });
  });
});
