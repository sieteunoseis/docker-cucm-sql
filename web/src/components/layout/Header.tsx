import { Link, useLocation } from "react-router-dom";
import { Database, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Editor", path: "/" },
  { label: "Log", path: "/log" },
  { label: "Help", path: "/help" },
];

export function Header() {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Database className="size-5 text-sky-500" />
            CUCM SQL
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/" || location.pathname.startsWith("/q/")
                  : location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} to={item.path}>
                  <Button variant={isActive ? "secondary" : "ghost"} size="sm" className="text-sm">
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
