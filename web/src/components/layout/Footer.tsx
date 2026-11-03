import { useEffect, useState } from "react";
import { api } from "@/api/client";

export function Footer() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInfo()
      .then((info) => setVersion(info.imageTag && info.imageTag !== info.version ? `${info.version} (${info.imageTag})` : info.version))
      .catch(() => setVersion(null));
  }, []);

  return (
    <footer className="border-t border-border px-6 py-2 text-xs text-muted-foreground flex justify-between">
      <span>CUCM SQL Editor{version ? ` v${version}` : ""}</span>
      <a href="/api/docs" className="hover:underline">
        API docs
      </a>
    </footer>
  );
}
