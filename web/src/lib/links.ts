import { encodePath } from "@/api/client";

export function linkFor(path: string, params?: URLSearchParams) {
  const qs = params?.toString();
  return `${window.location.origin}/q/${encodePath(path)}${qs ? `?${qs}` : ""}`;
}

/** sessionStorage key prefix for SQL handed from the Log page to a new editor tab */
export const OPEN_KEY_PREFIX = "cucm-sql:open:";
