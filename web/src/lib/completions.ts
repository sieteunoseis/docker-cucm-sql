import type { Schema } from "@shared/types";

const KEYWORDS = new Set(["where", "on", "join", "inner", "left", "right", "outer", "order", "group", "union", "and", "or", "set"]);

/** Table that a "qualifier." refers to: a table name, or an alias declared as "table alias" / "table AS alias". */
export function tableForQualifier(qualifier: string, sql: string, schema: Schema): string | null {
  const q = qualifier.toLowerCase();
  if (schema[q]) return q;
  // lookahead so word pairs can overlap ("select d from device d")
  const re = /\b([a-z_][a-z0-9_]*)\s+(?=(?:as\s+)?([a-z_][a-z0-9_]*)\b)/gi;
  for (const m of sql.matchAll(re)) {
    const table = m[1].toLowerCase();
    const alias = m[2].toLowerCase();
    if (alias === q && schema[table] && !KEYWORDS.has(alias)) return table;
  }
  return null;
}
