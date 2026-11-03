import { describe, it, expect } from "vitest";
import { formatForSave } from "../../shared/formatSql.js";

describe("formatForSave", () => {
  it("keeps variable defaults intact", () => {
    const out = formatForSave("select * from device where name like :pat=SEP% and x=:y");
    expect(out).toContain(":pat=SEP%");
    expect(out).toContain(":y");
  });

  it("keeps :: casts", () => {
    expect(formatForSave("select x::INTEGER from t")).toContain("::INTEGER");
  });

  it("uppercases keywords", () => {
    const out = formatForSave("select name from device");
    expect(out).toContain("SELECT");
    expect(out).toContain("FROM");
  });

  it("returns input unchanged on formatter failure", () => {
    const bad = "select ( from where ''' unterminated";
    expect(formatForSave(bad)).toBe(bad);
  });
});
