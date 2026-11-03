import { describe, it, expect } from "vitest";
import { toCsv } from "../../shared/csv.js";

describe("toCsv", () => {
  it("quotes commas quotes and newlines", () => {
    expect(toCsv(["a", "b"], [{ a: 'x,"y"', b: "line1\nline2" }, { a: "plain" }])).toBe(
      'a,b\r\n"x,""y""","line1\nline2"\r\nplain,\r\n',
    );
  });
});
