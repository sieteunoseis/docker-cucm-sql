import { ChevronRight, FileCode, Folder, FolderOpen, MoreHorizontal } from "lucide-react";
import type { TreeNode } from "@shared/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DialogKind } from "./QueryDialogs";

interface Props {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  isExpanded: (path: string) => boolean;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
  onAction: (kind: DialogKind, node: TreeNode) => void;
  onCopyLink: (path: string) => void;
}

export function QueryTreeNode(props: Props) {
  const { node, depth, selectedPath, isExpanded, onToggle, onOpen, onAction, onCopyLink } = props;
  const isFolder = node.type === "folder";
  const expanded = isFolder && isExpanded(node.path);
  const selected = node.path === selectedPath;

  return (
    <li>
      <div
        data-testid="tree-row"
        data-path={node.path}
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-muted",
          selected && "bg-secondary font-medium",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
          onClick={() => (isFolder ? onToggle(node.path) : onOpen(node.path))}
          title={node.description || node.path}
        >
          {isFolder ? (
            <>
              <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")} />
              {expanded ? <FolderOpen className="size-4 shrink-0 text-amber-500" /> : <Folder className="size-4 shrink-0 text-amber-500" />}
            </>
          ) : (
            <FileCode className="ml-5 size-4 shrink-0 text-sky-500" />
          )}
          <span className="min-w-0">
            <span className="block truncate">{node.name}</span>
            {node.description && <span className="block truncate text-xs text-muted-foreground">{node.description}</span>}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${node.name}`}
            className="rounded p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 aria-expanded:opacity-100 hover:bg-background"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isFolder && <DropdownMenuItem onClick={() => onAction("newFolder", node)}>New folder</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => onAction("rename", node)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("move", node)}>Move to…</DropdownMenuItem>
            {!isFolder && <DropdownMenuItem onClick={() => onAction("duplicate", node)}>Duplicate</DropdownMenuItem>}
            {!isFolder && <DropdownMenuItem onClick={() => onCopyLink(node.path)}>Copy link</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onAction("delete", node)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && node.children && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <QueryTreeNode key={child.path} {...props} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
