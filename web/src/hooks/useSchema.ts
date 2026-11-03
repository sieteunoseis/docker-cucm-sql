import { useEffect, useState } from "react";
import type { Schema } from "@shared/types";
import { api } from "@/api/client";

const cache = new Map<string, Promise<Schema>>();

export function useSchema(clusterId: string | null): Schema | null {
  const [schema, setSchema] = useState<{ id: string; schema: Schema } | null>(null);

  useEffect(() => {
    if (!clusterId) return;
    let cancelled = false;
    let p = cache.get(clusterId);
    if (!p) {
      p = api.getSchema(clusterId).then((r) => r.tables);
      cache.set(clusterId, p);
      p.catch(() => cache.delete(clusterId));
    }
    p.then((s) => !cancelled && setSchema({ id: clusterId, schema: s })).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clusterId]);

  return schema && schema.id === clusterId ? schema.schema : null;
}
