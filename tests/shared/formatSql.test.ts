import { describe, it, expect } from "vitest";
import { formatForSave } from "../../shared/formatSql.js";

describe("formatForSave", () => {
  it("keeps variable defaults intact", () => {
    const out = formatForSave("select * from device where name like :pat=SEP% and x=:y");
    expect(out).toContain(":pat=SEP%");
    expect(out).toContain(":y");
  });

  it("keeps quoted defaults intact", () => {
    expect(formatForSave("select * from t where m = :mask='EXTERNAL MASK'")).toContain(":mask='EXTERNAL MASK'");
  });

  it("keeps :: casts", () => {
    expect(formatForSave("select x::INTEGER from t")).toContain("::INTEGER");
  });

  it("keeps the Informix || concatenation operator together", () => {
    const out = formatForSave("select d.name from device d where d.description not like '%' || right(n.dnorpattern, 5) || '%'");
    expect(out).toContain("'%' || RIGHT(n.dnorpattern, 5) || '%'");
    expect(out).not.toContain("| |");
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
