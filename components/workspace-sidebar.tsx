"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Settings,
} from "lucide-react";
import { WorkspaceAvatar } from "@/components/workspace-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/actions/auth";

interface WorkspaceSidebarProps {
  workspaceId: string;
  workspaceName: string;
  workspaceIconColor: string;
  workspaceRole: string;
}

export function WorkspaceSidebar({
  workspaceId,
  workspaceName,
  workspaceIconColor,
  workspaceRole,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border/40 bg-card/50 backdrop-blur-sm shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      {/* Workspace header */}
      <div
        className={`flex items-center border-b border-border/40 shrink-0 ${
          collapsed ? "justify-center p-3" : "gap-2.5 p-4"
        }`}
      >
        <WorkspaceAvatar
          name={workspaceName}
          iconColor={workspaceIconColor}
          size="sm"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-heading font-semibold text-sm truncate">
              {workspaceName}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {workspaceRole}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2">
        <Link
          href={`/workspace/${workspaceId}`}
          title={collapsed ? "Boards" : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            collapsed
              ? "justify-center p-2.5"
              : "gap-2.5 px-3 py-2"
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {!collapsed && "Boards"}
        </Link>
        <Link
          href={`/workspace/${workspaceId}/settings`}
          title={collapsed ? "Settings & Members" : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            collapsed
              ? "justify-center p-2.5"
              : "gap-2.5 px-3 py-2"
          }`}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && "Settings & Members"}
        </Link>
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-border/40 p-3 ${
          collapsed ? "flex flex-col items-center gap-2" : "space-y-2"
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                All workspaces
              </Link>
              <ThemeToggle />
            </div>
            <form action={signOut} className="w-full">
              <button
                type="submit"
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </form>
            <button
              onClick={() => setCollapsed(true)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
              Collapse
            </button>
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link
              href="/dashboard"
              title="All workspaces"
              className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
