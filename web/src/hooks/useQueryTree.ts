import { useCallback, useEffect, useState } from "react";
import type { TreeNode } from "@shared/types";
import { api } from "@/api/client";

export function useQueryTree() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTree((await api.getTree()).tree);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getTree()
      .then((res) => !cancelled && setTree(res.tree))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  return { tree, refresh, error };
}

export function folderPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.type === "folder" ? [n.path, ...folderPaths(n.children ?? [])] : []));
}

export function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    const hit = n.children && findNode(n.children, path);
    if (hit) return hit;
  }
  return null;
}
