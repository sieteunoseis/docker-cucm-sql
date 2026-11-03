import { encodePath } from "@/api/client";

export function linkFor(path: string, params?: URLSearchParams) {
  const qs = params?.toString();
  return `${window.location.origin}/q/${encodePath(path)}${qs ? `?${qs}` : ""}`;
}
