import { useEffect, useState } from "react";
import type { TreeNode } from "@shared/types";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { folderPaths } from "@/hooks/useQueryTree";

export type DialogKind = "rename" | "move" | "duplicate" | "delete" | "newFolder";

export interface DialogState {
  kind: DialogKind;
  /** target node; for newFolder, the parent folder (null = root) */
  node: TreeNode | null;
}

interface Props {
  state: DialogState | null;
  tree: TreeNode[];
  onClose: () => void;
  onChanged: () => void;
  onMoved?: (from: string, to: string) => void;
  onDeleted?: (paths: string[]) => void;
}

const parentOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const join = (parent: string, name: string) => (parent ? `${parent}/${name}` : name);

const TITLES: Record<DialogKind, string> = {
  rename: "Rename",
  move: "Move",
  duplicate: "Duplicate",
  delete: "Delete",
  newFolder: "New folder",
};

function initialValue({ kind, node }: DialogState): string {
  if (kind === "rename") return node?.name ?? "";
  if (kind === "move") return parentOf(node?.path ?? "");
  if (kind === "duplicate") return `${node?.path}_copy`;
  return "";
}

export function QueryDialogs(props: Props) {
  if (!props.state) return null;
  // remount per dialog so its form state starts fresh
  return <QueryDialog key={`${props.state.kind}:${props.state.node?.path ?? ""}`} {...props} state={props.state} />;
}

function QueryDialog({ state, tree, onClose, onChanged, onMoved, onDeleted }: Props & { state: DialogState }) {
  const [value, setValue] = useState(() => initialValue(state));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const node = state.node;

  useEffect(() => {
    if (state.kind === "delete" && node?.type === "folder") {
      api.countQueries(node.path).then((r) => setCount(r.count)).catch(() => setCount(null));
    }
  }, [state.kind, node]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (state.kind === "rename" || state.kind === "move") {
        const to = state.kind === "rename" ? join(parentOf(node!.path), value.trim()) : join(value, node!.name);
        const res = await api.moveQuery(node!.path, to);
        onMoved?.(node!.path, res.path);
      } else if (state.kind === "duplicate") {
        await api.duplicateQuery(node!.path, value.trim());
      } else if (state.kind === "newFolder") {
        await api.createFolder(join(node?.path ?? "", value.trim()));
      } else {
        const res = await api.deleteQuery(node!.path);
        onDeleted?.(res.deleted);
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const isFolder = node?.type === "folder";
  let description: string;
  if (state.kind === "delete") {
    description = isFolder
      ? count === null
        ? `Delete folder "${node!.name}"?`
        : `Delete folder "${node!.name}" and ${count} ${count === 1 ? "query" : "queries"}?`
      : `Delete query "${node!.name}"?`;
  } else if (state.kind === "move") {
    description = `Move "${node!.name}" to another folder.`;
  } else if (state.kind === "newFolder") {
    description = node ? `Create a folder inside "${node.path}".` : "Create a top-level folder.";
  } else if (state.kind === "duplicate") {
    description = "Path for the copy. Use / for folders.";
  } else {
    description = `New name for "${node!.name}".`;
  }

  const moveTargets = ["", ...folderPaths(tree)].filter(
    (f) => !isFolder || (f !== node!.path && !f.startsWith(`${node!.path}/`)),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{TITLES[state.kind]}</DialogTitle>
            <DialogDescription>
              {description}
              {state.kind === "delete" && " This can't be undone; the Log keeps a copy of the SQL."}
            </DialogDescription>
          </DialogHeader>
          {state.kind === "move" ? (
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Destination folder"
            >
              {moveTargets.map((f) => (
                <option key={f} value={f}>
                  {f || "(top level)"}
                </option>
              ))}
            </select>
          ) : state.kind !== "delete" ? (
            <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          ) : null}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={state.kind === "delete" ? "destructive" : "default"}
              disabled={busy || (state.kind !== "delete" && state.kind !== "move" && !value.trim())}
            >
              {state.kind === "newFolder" ? "Create" : TITLES[state.kind]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
