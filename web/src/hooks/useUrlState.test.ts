import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { parseUrl, buildLink, useUrlState } from "./useUrlState";

describe("parseUrl", () => {
  it("parses path, clusters, vars and run", () => {
    expect(parseUrl("/q/Phones/Phones_with_DN", "?cluster=brb,lab&dn=1234&run=1")).toEqual({
      path: "Phones/Phones_with_DN",
      clusters: ["brb", "lab"],
      vars: { dn: "1234" },
      autorun: true,
      openId: null,
    });
  });

  it("decodes encoded segments", () => {
    expect(parseUrl("/q/My%20Folder/a%23b", "").path).toBe("My Folder/a#b");
  });

  it("root has no path", () => {
    expect(parseUrl("/", "?open=abc")).toMatchObject({ path: null, clusters: [], autorun: false, openId: "abc" });
  });
});

describe("buildLink", () => {
  it("round-trips", () => {
    const link = buildLink("https://sql.example", { path: "My Folder/q", clusters: ["brb", "lab"], vars: { dn: "12 34", empty: "" } });
    expect(link).toBe("https://sql.example/q/My%20Folder/q?cluster=brb%2Clab&dn=12+34");
    const u = new URL(link);
    expect(parseUrl(u.pathname, u.search)).toMatchObject({ path: "My Folder/q", clusters: ["brb", "lab"], vars: { dn: "12 34" } });
  });
});

describe("useUrlState", () => {
  it("reads the router location", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: ["/q/A/b?x=1"] }, children);
    const { result } = renderHook(() => useUrlState(), { wrapper });
    expect(result.current.path).toBe("A/b");
    expect(result.current.vars).toEqual({ x: "1" });
  });
});
