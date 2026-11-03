import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RunState } from "@/hooks/useRun";
import { ClusterStatusChips } from "./ClusterStatusChips";

const runWith = (total: number, suggested: number, maxBatches: number): RunState => ({
  results: [
    {
      clusterId: "a",
      status: "throttled",
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 1,
      error: "too large",
      throttle: { totalRows: total, suggestedRows: suggested },
    },
  ],
  running: false,
  error: null,
  progress: null,
  maxBatches,
  run: vi.fn(),
  fetchAll: vi.fn(),
  paginate: () => ({ ok: true }),
  cancel: vi.fn(),
});

describe("ClusterStatusChips", () => {
  it("offers to fetch all when within the batch limit", () => {
    render(<ClusterStatusChips run={runWith(2816, 844, 200)} names={{ a: "BRB" }} />);
    expect(screen.getByRole("button", { name: /Fetch all 2,816 in 17 batches/ })).toBeInTheDocument();
  });

  it("says up front when the batch limit will cut the fetch short", () => {
    render(<ClusterStatusChips run={runWith(38558, 896, 200)} names={{ a: "BRB" }} />);
    expect(screen.getByRole("button", { name: /Fetch first 35,800 rows \(200-batch limit\)/ })).toBeInTheDocument();
  });
});
