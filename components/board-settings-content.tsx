"use client";

import { useState } from "react";
import { Users, Palette, Settings, Tag, History, Bell, Zap, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { setBoardMemberMovePermission, type MemberWithBoardLabel } from "@/app/actions/board";
import type { Workspace } from "@/db/schema";

type Tab = "members" | "appearance" | "settings" | "labels" | "activity" | "notifications" | "automation";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "members", label: "Manage Members", icon: <Users className="h-4 w-4" /> },
  { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
  { id: "settings", label: "Board Settings", icon: <Settings className="h-4 w-4" /> },
  { id: "labels", label: "Labels", icon: <Tag className="h-4 w-4" /> },
  { id: "activity", label: "Activity Log", icon: <History className="h-4 w-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { id: "automation", label: "Automation", icon: <Zap className="h-4 w-4" /> },
];

interface BoardSettingsContentProps {
  workspace: Workspace & { members: any[]; currentUserRole: "owner" | "member" };
  board: { id: string; name: string; workspaceId: string };
  members: MemberWithBoardLabel[];
  currentUserId: string;
  isOwner: boolean;
}

export function BoardSettingsContent({
  workspace,
  board,
  members,
  currentUserId,
  isOwner,
}: BoardSettingsContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState(board.name);

  async function handleRename() {
    try {
      const res = await fetch(`/api/board/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      toast.success("Board renamed");
      setRenameDialogOpen(false);
    } catch {
      toast.error("Failed to rename board");
    }
  }

  async function handleMovePermissionChange(member: MemberWithBoardLabel, canMove: boolean) {
    try {
      const res = await fetch(`/api/board/${board.id}/members/${member.userId}/move-permission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canMove }),
      });
      if (!res.ok) throw new Error("Failed");
      // Update local state via toast - the component will refetch or we could use a callback
      toast.success(canMove ? "Card move enabled" : "Card move disabled");
    } catch {
      toast.error("Failed to update permission");
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar navigation */}
      <aside className="w-56 shrink-0 border-r border-border/40 bg-card/50 p-4 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">{board.name}</h1>
            <p className="text-sm text-muted-foreground">Workspace: {workspace.name}</p>
          </div>
          <Button variant="outline" onClick={() => { setNewName(board.name); setRenameDialogOpen(true); }}>
            <ChevronRight className="h-4 w-4 mr-1" />
            Rename
          </Button>
        </div>

        {activeTab === "members" && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Manage Members</h2>
            <p className="text-sm text-muted-foreground">
              Control member permissions on this board. Changes take effect immediately.
            </p>
            <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/40 overflow-hidden">
              {members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {member.firstName[0]}{member.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.firstName} {member.lastName}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    {member.workspaceRoleLabel && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {member.workspaceRoleLabel}
                      </span>
                    )}
                    {member.boardLabel && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {member.boardLabel}
                      </span>
                    )}
                  </div>
                  {member.userId !== currentUserId && isOwner && (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Switch
                          checked={member.canMoveCards}
                          onCheckedChange={(checked) => handleMovePermissionChange(member, checked)}
                          aria-label="Allow card movement"
                        />
                        <span>Allow card movement</span>
                      </label>
                    </div>
                  )}
                  {member.userId === currentUserId && (
                    <span className="text-xs text-muted-foreground italic">(You)</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "appearance" && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Customize the look of this board. Background images coming soon.
            </p>
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {["#1e3a5f", "#3a2e5c", "#1a4d3a", "#4d3a1a"].map((color) => (
                  <button
                    key={color}
                    className="relative aspect-square rounded-lg border-2 transition-all hover:scale-105"
                    style={{ backgroundColor: color, borderColor: color }}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Board Settings</h2>
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Board Name</label>
                <Input defaultValue={board.name} disabled />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Workspace</label>
                <Input defaultValue={workspace.name} disabled />
              </div>
              <Button variant="destructive" onClick={() => { if (confirm("Delete this board? This cannot be undone.")) { /* delete logic */ } }}>
                Delete Board
              </Button>
            </div>
          </section>
        )}

        {activeTab === "labels" && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Labels</h2>
            <p className="text-sm text-muted-foreground">Manage board labels. Priority labels are seeded by default.</p>
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <p className="text-sm text-muted-foreground">Label management UI coming soon.</p>
            </div>
          </section>
        )}

        {activeTab === "activity" && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Activity Log</h2>
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <p className="text-sm text-muted-foreground">Activity log coming soon.</p>
            </div>
          </section>
        )}

        {activeTab === "notifications" && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Notifications</h2>
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
              <label className="flex items-center gap-3">
                <Switch defaultChecked />
                <span className="text-sm">Email me when I'm mentioned</span>
              </label>
              <label className="flex items-center gap-3">
                <Switch defaultChecked />
                <span className="text-sm">Email me when a card is assigned to me</span>
              </label>
              <label className="flex items-center gap-3">
                <Switch />
                <span className="text-sm">Email me daily summary</span>
              </label>
            </div>
          </section>
        )}

        {activeTab === "automation" && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Automation</h2>
            <p className="text-sm text-muted-foreground">Automation rules and integrations coming soon.</p>
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <Button variant="outline" className="w-full">Add Rule</Button>
            </div>
          </section>
        )}

        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Board</DialogTitle>
              <DialogDescription>Enter a new name for this board.</DialogDescription>
            </DialogHeader>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRename} disabled={!newName.trim()}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}