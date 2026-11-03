import { useMemo, useState } from "react";
import { FolderPlus, Search } from "lucide-react";
import type { TreeNode } from "@shared/types";
import { linkFor } from "@/lib/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJson, writeJson } from "@/lib/storage";
import { QueryTreeNode } from "./QueryTreeNode";
import { QueryDialogs, type DialogState } from "./QueryDialogs";

interface Props {
  tree: TreeNode[];
  selectedPath: string | null;
  onOpen: (path: string) => void;
  onChanged: () => void;
  onMoved?: (from: string, to: string) => void;
  onDeleted?: (paths: string[]) => void;
}

const EXPANDED_KEY = "cucm-sql:expanded";

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  return nodes.flatMap((n) => {
    const hit = n.name.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q);
    if (n.type === "query") return hit ? [n] : [];
    const children = filterTree(n.children ?? [], q);
    return hit || children.length ? [{ ...n, children: hit && !children.length ? n.children : children }] : [];
  });
}

export function QueryTree({ tree, selectedPath, onOpen, onChanged, onMoved, onDeleted }: Props) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string[]>(() => readJson(EXPANDED_KEY, []));
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const q = filter.trim().toLowerCase();
  const visible = useMemo(() => (q ? filterTree(tree, q) : tree), [tree, q]);

  // a selected query's folders, and every folder while filtering, are always open
  const isExpanded = (path: string) =>
    !!q || expanded.includes(path) || (!!selectedPath && selectedPath.startsWith(`${path}/`));

  const toggle = (path: string) => {
    const next = expanded.includes(path) ? expanded.filter((p) => p !== path) : [...expanded, path];
    setExpanded(next);
    writeJson(EXPANDED_KEY, next);
  };

  const copyLink = async (path: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(path));
      setCopied(path);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy link", linkFor(path));
    }
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter queries" className="h-7 pl-7 text-sm" />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New top-level folder"
          title="New folder"
          onClick={() => setDialog({ kind: "newFolder", node: null })}
        >
          <FolderPlus className="size-4" />
        </Button>
      </div>
      {copied && <p className="text-xs text-muted-foreground">Link copied</p>}
      {visible.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{q ? "No matching queries" : "No saved queries yet"}</p>
      ) : (
        <ul className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
          {visible.map((n) => (
            <QueryTreeNode
              key={n.path}
              node={n}
              depth={0}
              selectedPath={selectedPath}
              isExpanded={isExpanded}
              onToggle={toggle}
              onOpen={onOpen}
              onAction={(kind, node) => setDialog({ kind, node })}
              onCopyLink={copyLink}
            />
          ))}
        </ul>
      )}
      <QueryDialogs
        state={dialog}
        tree={tree}
        onClose={() => setDialog(null)}
        onChanged={onChanged}
        onMoved={onMoved}
        onDeleted={onDeleted}
      />
    </div>
  );
}
