import { describe, it, expect } from "vitest";
import { tableForQualifier } from "./completions";

const schema = { device: [{ name: "name", type: "varchar" }], numplan: [{ name: "dnorpattern", type: "varchar" }] };

describe("tableForQualifier", () => {
  it("matches a table name directly", () => {
    expect(tableForQualifier("Device", "select * from device", schema)).toBe("device");
  });

  it("resolves an alias from the query text", () => {
    expect(tableForQualifier("d", "select d. from device d, numplan as n", schema)).toBe("device");
    expect(tableForQualifier("n", "select d. from device d, numplan as n", schema)).toBe("numplan");
  });

  it("returns null for unknown qualifiers", () => {
    expect(tableForQualifier("x", "select x. from device d", schema)).toBeNull();
  });
});
