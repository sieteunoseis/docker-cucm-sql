import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { LogEntry } from "@shared/types";
import { api } from "@/api/client";
import { LogPage } from "./LogPage";

const entry = (id: string, over: Partial<LogEntry> = {}): LogEntry => ({
  id,
  ts: "2026-11-03T12:00:00.000Z",
  user: "jw",
  action: "run",
  source: "ui",
  sql: `select ${id} from device`,
  path: "Phones/q",
  clusters: [{ id: "brb", status: "ok", rowCount: 3, durationMs: 40 }],
  ...over,
});

beforeEach(() => vi.restoreAllMocks());

const renderPage = (url = "/log") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LogPage />
    </MemoryRouter>,
  );

describe("LogPage", () => {
  it("renders entries and loads more with cursor", async () => {
    const spy = vi
      .spyOn(api, "getLog")
      .mockResolvedValueOnce({ entries: [entry("e1"), entry("e2")], nextCursor: "e2" })
      .mockResolvedValueOnce({ entries: [entry("e3", { action: "delete", sql: undefined, path: "Old" })], nextCursor: null });
    renderPage();
    expect(await screen.findByText(/select e1 from device/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Old")).toBeInTheDocument();
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "e2" }));
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("filters update request params", async () => {
    const spy = vi.spyOn(api, "getLog").mockResolvedValue({ entries: [], nextCursor: null });
    renderPage("/log?user=alice");
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ user: "alice" })));
    await userEvent.selectOptions(screen.getByLabelText("Action"), "delete");
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ user: "alice", action: "delete" })));
  });

  it("open in editor hands sql over via sessionStorage", async () => {
    vi.spyOn(api, "getLog").mockResolvedValue({ entries: [entry("e1")], nextCursor: null });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Open in editor" }));
    expect(sessionStorage.getItem("cucm-sql:open:e1")).toBe("select e1 from device");
    expect(open).toHaveBeenCalledWith("/?open=e1", "_blank");
  });
});
