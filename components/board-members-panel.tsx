"use client";

import { useState, useMemo } from "react";
import { Users, Loader2, Pencil, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  getBoardMemberLabels,
  setBoardMemberLabel,
  setBoardMemberMovePermission,
  type MemberWithBoardLabel,
} from "@/app/actions/board";

interface Props {
  boardId: string;
  isOwner: boolean;
}

export function BoardMembersPanel({ boardId, isOwner }: Props) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberWithBoardLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    const data = await getBoardMemberLabels(boardId);
    setMembers(data);
    setLoading(false);
  }

  function updateMemberLabel(userId: string, label: string | null) {
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, boardLabel: label } : m))
    );
  }

  function updateMemberCanMove(userId: string, canMove: boolean) {
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, canMoveCards: canMove } : m))
    );
  }

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.boardLabel?.toLowerCase().includes(q) ||
        m.workspaceRoleLabel?.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleOpen}>
        <Users className="h-3.5 w-3.5" />
        Members
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Board Members</DialogTitle>
            <DialogDescription>
              {isOwner
                ? "Set a per-board label for each member. Labels are visible only on this board."
                : "Members who have access to this board."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members…"
              className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredMembers.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  boardId={boardId}
                  isOwner={isOwner}
                  onLabelChange={(label) => updateMemberLabel(member.userId, label)}
                  onCanMoveChange={(canMove) => updateMemberCanMove(member.userId, canMove)}
                />
              ))}
              {members.length > 0 && filteredMembers.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No members match your search.</p>
              )}
              {members.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No members found.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MemberRow({
  member,
  boardId,
  isOwner,
  onLabelChange,
  onCanMoveChange,
}: {
  member: MemberWithBoardLabel;
  boardId: string;
  isOwner: boolean;
  onLabelChange: (label: string | null) => void;
  onCanMoveChange: (canMove: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.boardLabel ?? "");
  const [saving, setSaving] = useState(false);
  const [savingMove, setSavingMove] = useState(false);

  async function handleSave() {
    const trimmed = draft.trim() || null;
    setSaving(true);
    const result = await setBoardMemberLabel(boardId, member.userId, trimmed);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onLabelChange(trimmed);
    setEditing(false);
    toast.success(trimmed ? "Board label saved." : "Board label removed.");
  }

  async function handleMovePermissionChange(canMove: boolean) {
    setSavingMove(true);
    const result = await setBoardMemberMovePermission(boardId, member.userId, canMove);
    setSavingMove(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onCanMoveChange(canMove);
    toast.success(canMove ? "Card move enabled." : "Card move disabled.");
  }

  function handleCancel() {
    setEditing(false);
    setDraft(member.boardLabel ?? "");
  }

  return (
    <div className="group/member flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {member.firstName[0]}{member.lastName[0]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">
          {member.firstName} {member.lastName}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>

        {member.workspaceRoleLabel && (
          <span className="mt-0.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {member.workspaceRoleLabel}
          </span>
        )}

        {editing ? (
          <div className="mt-1 flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={50}
              placeholder="e.g. Upseller"
              autoFocus
              className="h-6 w-36 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring/50"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-primary hover:text-primary/80 disabled:opacity-50"
              aria-label="Save label"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="mt-0.5 flex items-center gap-1.5">
            {member.boardLabel ? (
              <>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {member.boardLabel}
                </span>
                {isOwner && (
                  <button
                    onClick={() => { setDraft(member.boardLabel!); setEditing(true); }}
                    className="opacity-0 group-hover/member:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                    aria-label="Edit board label"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </>
            ) : (
              isOwner && (
                <button
                  onClick={() => { setDraft(""); setEditing(true); }}
                  className="opacity-0 group-hover/member:opacity-100 text-[10px] text-muted-foreground hover:text-primary transition-opacity"
                >
                  + Add board label
                </button>
              )
            )}
          </div>
        )}

        {isOwner && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={member.canMoveCards}
              onCheckedChange={handleMovePermissionChange}
              disabled={savingMove}
              aria-label="Allow card movement"
            />
            <span>Allow card movement</span>
          </div>
        )}
      </div>
    </div>
  );
}
