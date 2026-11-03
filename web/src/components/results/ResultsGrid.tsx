import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Columns3, Download, Search } from "lucide-react";
import type { Row } from "@shared/types";
import { toCsv } from "@shared/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { csvFilename } from "@/lib/results";

interface Props {
  columns: string[];
  rows: Row[];
  queryName: string | null;
}

const ROW_HEIGHT = 30;

const numericAware: SortingFn<Row> = (a, b, id) =>
  String(a.getValue(id) ?? "").localeCompare(String(b.getValue(id) ?? ""), undefined, { numeric: true });

export function ResultsGrid({ columns, rows, queryName }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const defs = useMemo<ColumnDef<Row>[]>(
    () =>
      columns.map((c) => ({
        id: c,
        accessorFn: (row) => row[c] ?? "",
        header: c,
        sortingFn: numericAware,
        filterFn: "includesString",
      })),
    [columns],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting, globalFilter, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setVisibility,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const visibleRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const exportCsv = () => {
    const cols = table.getVisibleLeafColumns().map((c) => c.id);
    const data = visibleRows.map((r) => r.original);
    const blob = new Blob([toCsv(cols, data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = csvFilename(queryName);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0);
  const leafColumns = table.getVisibleLeafColumns();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search all columns"
            className="h-7 pl-7 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {visibleRows.length === rows.length
            ? `${rows.length.toLocaleString()} rows`
            : `${visibleRows.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <Columns3 className="size-4" /> Columns
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              {table.getAllLeafColumns().map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  closeOnClick={false}
                >
                  {col.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visibleRows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-[60vh] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  return (
                    <th key={h.id} className="border-b border-border px-2 py-1 text-left align-top font-medium">
                      <button
                        type="button"
                        className="flex items-center gap-1 whitespace-nowrap"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === "asc" && <ArrowUp className="size-3" />}
                        {dir === "desc" && <ArrowDown className="size-3" />}
                      </button>
                      <input
                        value={(h.column.getFilterValue() as string) ?? ""}
                        onChange={(e) => h.column.setFilterValue(e.target.value || undefined)}
                        placeholder="Filter"
                        aria-label={`Filter ${h.column.id}`}
                        className="mt-1 h-6 w-full min-w-16 rounded border border-border bg-background px-1 text-xs font-normal"
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && (
              <tr>
                <td style={{ height: padTop }} colSpan={leafColumns.length} />
              </tr>
            )}
            {items.map((vi) => {
              const row = visibleRows[vi.index];
              return (
                <tr key={row.id} className="border-b border-border/60 hover:bg-muted/50" style={{ height: ROW_HEIGHT }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-2 font-mono text-xs">
                      {String(cell.getValue() ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
            {padBottom > 0 && (
              <tr>
                <td style={{ height: padBottom }} colSpan={leafColumns.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
