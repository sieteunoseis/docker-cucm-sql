import { format } from "sql-formatter";

// Variable tokens (:name, :name=default) are swapped for placeholders while formatting so the
// formatter can't split "=default" off or space out "::" casts.
const TOKEN_REGEX = /::[a-zA-Z_][a-zA-Z0-9_]*|:[a-zA-Z_][a-zA-Z0-9_]*(?:=[^\s,)]+)?/g;

export function formatForSave(sql: string): string {
  const tokens: string[] = [];
  const masked = sql.replace(TOKEN_REGEX, (t) => {
    tokens.push(t);
    return `__cucmsqlvar${tokens.length - 1}__`;
  });
  try {
    const formatted = format(masked, {
      // postgresql keeps Informix || and :: intact (transactsql splits || into | |)
      language: "postgresql",
      keywordCase: "upper",
      functionCase: "upper",
      linesBetweenQueries: 2,
    });
    return formatted
      .replace(/\s*__cucmsqlvar(\d+)__/g, (m, i) => {
        const t = tokens[Number(i)];
        // casts attach to the preceding expression; variables keep their leading whitespace
        return t.startsWith("::") ? t : m.replace(/__cucmsqlvar\d+__/, t);
      });
  } catch {
    return sql;
  }
}
