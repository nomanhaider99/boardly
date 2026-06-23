"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Settings, ChevronLeft } from "lucide-react";
import { WorkspaceAvatar } from "@/components/workspace-avatar";
import { ThemeToggle } from "@/components/theme-toggle";

interface WorkspaceMobileNavProps {
  workspaceId: string;
  workspaceName: string;
  workspaceIconColor: string;
}

export function WorkspaceMobileNav({
  workspaceId,
  workspaceName,
  workspaceIconColor,
}: WorkspaceMobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="flex md:hidden items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <WorkspaceAvatar name={workspaceName} iconColor={workspaceIconColor} size="sm" />
          <span className="font-heading font-semibold text-sm">{workspaceName}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen(true)}
            aria-label="Open workspace menu"
            className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col bg-card border-r border-border/40 shadow-xl transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Workspace navigation"
      >
        <div className="flex items-center justify-between border-b border-border/40 p-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <WorkspaceAvatar name={workspaceName} iconColor={workspaceIconColor} size="sm" />
            <p className="font-heading font-semibold text-sm truncate">{workspaceName}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          <Link
            href={`/workspace/${workspaceId}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4" />
            Boards
          </Link>
          <Link
            href={`/workspace/${workspaceId}/settings`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings &amp; Members
          </Link>
        </nav>

        <div className="border-t border-border/40 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            All workspaces
          </Link>
        </div>
      </aside>
    </>
  );
}
