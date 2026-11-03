import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiError } from "./client";

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

describe("api client", () => {
  it("throws ApiError with status and code on 409", async () => {
    mockFetch(409, { error: "exists", message: '"b" already exists' });
    const err = await api.moveQuery("a", "b").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("exists");
    expect(err.message).toBe('"b" already exists');
  });

  it("encodes each path segment but keeps slashes", async () => {
    const spy = mockFetch(200, { path: "My Folder/q#1", sql: "x" });
    await api.readQuery("My Folder/q#1");
    expect(spy.mock.calls[0][0]).toBe("/api/queries/My%20Folder/q%231");
  });

  it("posts run with clusters and path", async () => {
    const spy = mockFetch(200, { results: [] });
    await api.runQuery({ sql: "select 1", clusters: ["a"], path: "p" });
    const [, init] = spy.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ sql: "select 1", clusters: ["a"], path: "p" });
  });

  it("builds log query string without empty filters", async () => {
    const spy = mockFetch(200, { entries: [], nextCursor: null });
    await api.getLog({ user: "jw", action: "", q: undefined });
    expect(spy.mock.calls[0][0]).toBe("/api/log?user=jw");
  });
});
