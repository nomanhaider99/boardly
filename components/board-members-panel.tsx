"use client";

import { useState } from "react";
import { Users, Loader2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getBoardMemberLabels,
  setBoardMemberLabel,
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

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  boardId={boardId}
                  isOwner={isOwner}
                  onLabelChange={(label) => updateMemberLabel(member.userId, label)}
                />
              ))}
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
}: {
  member: MemberWithBoardLabel;
  boardId: string;
  isOwner: boolean;
  onLabelChange: (label: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.boardLabel ?? "");
  const [saving, setSaving] = useState(false);

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
      </div>
    </div>
  );
}
