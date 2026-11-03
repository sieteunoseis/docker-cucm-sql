import { useState } from "react";
import type { TreeNode } from "@shared/types";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { folderPaths } from "@/hooks/useQueryTree";

interface Props {
  tree: TreeNode[];
  initialFolder: string;
  /** overwrite=false must fail with a 409 ApiError when the name is taken */
  onSave: (path: string, overwrite: boolean) => Promise<void>;
  onClose: () => void;
}

export function SaveDialog({ tree, initialFolder, onSave, onClose }: Props) {
  const [folder, setFolder] = useState(initialFolder);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(false);

  const submit = async (overwrite: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(folder ? `${folder}/${name.trim()}` : name.trim(), overwrite);
      onClose();
    } catch (err) {
      const exists = err instanceof ApiError && err.status === 409;
      setTaken(exists);
      setError(exists ? `${err.message}. Overwrite it? The Log keeps the old version.` : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Save query</DialogTitle>
            <DialogDescription>Saved as a .sql file in the data folder. Spaces and special characters become _.</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Folder</span>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            >
              {["", ...folderPaths(tree)].map((f) => (
                <option key={f} value={f}>
                  {f || "(top level)"}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTaken(false);
              }}
              placeholder="Phones_with_DN"
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {taken ? (
              <Button type="button" variant="destructive" disabled={busy} onClick={() => submit(true)}>
                Overwrite
              </Button>
            ) : (
              <Button type="submit" disabled={busy || !name.trim()}>
                Save
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
