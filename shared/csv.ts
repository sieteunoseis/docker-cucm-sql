// RFC 4180: CRLF line endings, fields quoted only when they contain a comma, quote or newline.
function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(columns: string[], rows: Record<string, string>[]): string {
  const lines = [columns.map(field).join(",")];
  for (const row of rows) lines.push(columns.map((c) => field(row[c] ?? "")).join(","));
  return lines.join("\r\n") + "\r\n";
}
