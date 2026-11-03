// UCM caps executeSQLQuery responses at 8 MB and returns a fault with the matched row count.
// Large results are re-fetched in Informix SELECT SKIP n FIRST m batches.
export function parseThrottle(message) {
    const m = /Total rows matched:\s*(\d+).*?Suggested row fetch:\s*less than\s*(\d+)/is.exec(message);
    return m ? { totalRows: Number(m[1]), suggestedRows: Number(m[2]) } : null;
}
/** UCM's suggestion is unreliable on wide rows; a 5x margin avoids re-throttling (see axlrows). */
export function batchSize(t) {
    return Math.max(1, Math.floor(t.suggestedRows / 5));
}
/** Blank out string literals and comments so keyword checks only see SQL structure. */
function stripLiteralsAndComments(sql) {
    return sql
        .replace(/'(?:[^']|'')*'/g, (s) => " ".repeat(s.length))
        .replace(/--[^\n]*/g, (s) => " ".repeat(s.length))
        .replace(/\/\*[\s\S]*?\*\//g, (s) => " ".repeat(s.length));
}
/** Words that appear outside any parentheses. */
function topLevelWords(sql) {
    const clean = stripLiteralsAndComments(sql);
    let depth = 0;
    let top = "";
    for (const ch of clean) {
        if (ch === "(")
            depth++;
        else if (ch === ")")
            depth = Math.max(0, depth - 1);
        else if (depth === 0)
            top += ch;
        if (depth > 0)
            top += " ";
    }
    return top.toUpperCase().split(/[^A-Z0-9_]+/).filter(Boolean);
}
export function canPaginate(sql) {
    const words = new Set(topLevelWords(sql));
    for (const kw of ["UNION", "INTERSECT", "MINUS"]) {
        if (words.has(kw))
            return { ok: false, reason: `Can't fetch in batches: the query has a top-level ${kw}.` };
    }
    for (const kw of ["SKIP", "FIRST", "LIMIT"]) {
        if (words.has(kw))
            return { ok: false, reason: `Can't fetch in batches: the query already uses ${kw}.` };
    }
    if (!words.has("SELECT"))
        return { ok: false, reason: "Can't fetch in batches: no SELECT found." };
    return { ok: true };
}
export function pageSql(sql, skip, first) {
    const clean = stripLiteralsAndComments(sql);
    const m = /\bselect\b/i.exec(clean);
    if (!m)
        return sql;
    const at = m.index + m[0].length;
    return `${sql.slice(0, at)} SKIP ${skip} FIRST ${first}${sql.slice(at)}`;
}
//# sourceMappingURL=paging.js.map