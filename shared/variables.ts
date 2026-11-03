// Query variables, same syntax as cisco-cdr-ui: :name or :name=default
// (default ends at whitespace, "," or ")"). ::type casts and tokens right after a quote are ignored.

export interface VarDef {
  name: string;
  defaultValue: string;
}

const VAR_REGEX = /:([a-zA-Z_][a-zA-Z0-9_]*)(?:=([^\s,)]+))?/g;

function isVariableAt(sql: string, index: number): boolean {
  const before = sql[index - 1];
  return before !== ":" && before !== "'";
}

export function extractVariables(sql: string): VarDef[] {
  const seen = new Set<string>();
  const vars: VarDef[] = [];
  for (const m of sql.matchAll(VAR_REGEX)) {
    if (!isVariableAt(sql, m.index!) || seen.has(m[1])) continue;
    seen.add(m[1]);
    vars.push({ name: m[1], defaultValue: m[2] || "" });
  }
  return vars;
}

/** Replace every occurrence of each variable with its quoted value (value, else default). */
export function resolveVariables(sql: string, values: Record<string, string>): string {
  const defaults = new Map(extractVariables(sql).map((v) => [v.name, v.defaultValue]));
  return sql.replace(VAR_REGEX, (token, name: string, _def, offset: number) => {
    if (!isVariableAt(sql, offset)) return token;
    const value = values[name] || defaults.get(name) || "";
    if (!value) return `:${name}`;
    return `'${value.replace(/'/g, "''")}'`;
  });
}

export function missingVariables(sql: string, values: Record<string, string>): string[] {
  return extractVariables(sql)
    .filter((v) => !v.defaultValue && !values[v.name])
    .map((v) => v.name);
}
