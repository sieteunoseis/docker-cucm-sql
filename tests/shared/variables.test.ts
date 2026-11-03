import { describe, it, expect } from "vitest";
import { extractVariables, resolveVariables, missingVariables } from "../../shared/variables.js";

describe("extractVariables", () => {
  it("extracts name and default, dedupes", () => {
    expect(extractVariables("where a=:dn and b=:pt=Internal and c=:dn")).toEqual([
      { name: "dn", defaultValue: "" },
      { name: "pt", defaultValue: "Internal" },
    ]);
  });

  it("ignores casts and quoted", () => {
    expect(extractVariables("select x::INTEGER, ':notvar' from t")).toEqual([]);
  });

  it("default ends at comma and paren", () => {
    expect(extractVariables("in (:a=1,:b=2)")).toEqual([
      { name: "a", defaultValue: "1" },
      { name: "b", defaultValue: "2" },
    ]);
  });
});

describe("resolveVariables", () => {
  it("resolves with quoting", () => {
    expect(resolveVariables("a=:n", { n: "O'Neil" })).toBe("a='O''Neil'");
  });

  it("uses default when value empty", () => {
    expect(resolveVariables("p=:pt=Internal", {})).toBe("p='Internal'");
  });

  it("replaces every occurrence and leaves casts alone", () => {
    expect(resolveVariables("x::INTEGER = :n or y = :n", { n: "5" })).toBe("x::INTEGER = '5' or y = '5'");
  });

  it("leaves empty no-default variable in place", () => {
    expect(resolveVariables("a=:n", {})).toBe("a=:n");
  });

  it("does not replace a longer name sharing a prefix", () => {
    expect(resolveVariables(":dn and :dnpart", { dn: "1", dnpart: "2" })).toBe("'1' and '2'");
  });
});

describe("missingVariables", () => {
  it("lists only no-default empties", () => {
    expect(missingVariables(":a and :b=1", {})).toEqual(["a"]);
    expect(missingVariables(":a and :b=1", { a: "x" })).toEqual([]);
  });
});
