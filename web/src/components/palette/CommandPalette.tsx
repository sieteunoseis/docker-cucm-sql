import { useMemo, useState } from "react";
import { FileCode, Zap } from "lucide-react";
import type { TreeNode } from "@shared/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface PaletteAction {
  id: string;
  label: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tree: TreeNode[];
  actions: PaletteAction[];
  onOpenQuery: (path: string) => void;
}

interface Item {
  key: string;
  label: string;
  hint?: string;
  kind: "query" | "action";
  run: () => void;
}

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => (n.type === "folder" ? flatten(n.children ?? []) : [n]));
}

/** every character of the query appears in order in the text */
function fuzzy(text: string, q: string): boolean {
  let i = 0;
  for (const ch of text.toLowerCase()) if (ch === q[i]) i++;
  return i === q.length;
}

export function CommandPalette({ open, onClose, tree, actions, onOpenQuery }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...actions.map((a) => ({ key: `a:${a.id}`, label: a.label, kind: "action" as const, run: a.run })),
      ...flatten(tree).map((n) => ({
        key: `q:${n.path}`,
        label: n.path,
        hint: n.description,
        kind: "query" as const,
        run: () => onOpenQuery(n.path),
      })),
    ];
    const needle = q.trim().toLowerCase().replace(/\s+/g, "");
    return (needle ? all.filter((i) => fuzzy(`${i.label} ${i.hint ?? ""}`, needle)) : all).slice(0, 50);
  }, [q, tree, actions, onOpenQuery]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    setQ("");
    item.run();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(items[active]);
            }
          }}
          placeholder="Search saved queries and actions…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
          {items.length === 0 && <li className="px-4 py-2 text-sm text-muted-foreground">No matches</li>}
          {items.map((item, i) => (
            <li
              key={item.key}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
              className={cn("flex cursor-pointer items-center gap-2 px-4 py-1.5 text-sm", i === active && "bg-muted")}
            >
              {item.kind === "query" ? <FileCode className="size-4 text-sky-500" /> : <Zap className="size-4 text-amber-500" />}
              <span className="truncate">{item.label}</span>
              {item.hint && <span className="ml-auto truncate text-xs text-muted-foreground">{item.hint}</span>}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
