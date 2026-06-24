"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { setMemberRoleLabel } from "@/app/actions/workspace";

interface MemberRoleLabelEditorProps {
  workspaceId: string;
  targetUserId: string;
  initialRoleLabel: string | null;
  isOwner: boolean;
}

export function MemberRoleLabelEditor({
  workspaceId,
  targetUserId,
  initialRoleLabel,
  isOwner,
}: MemberRoleLabelEditorProps) {
  const [label, setLabel] = useState(initialRoleLabel);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialRoleLabel ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(label ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function handleSave() {
    const trimmed = draft.trim() || null;
    setSaving(true);
    const result = await setMemberRoleLabel(workspaceId, targetUserId, trimmed);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setLabel(trimmed);
    setEditing(false);
    toast.success(trimmed ? "Role label saved." : "Role label removed.");
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={50}
          placeholder="e.g. General Manager"
          className="h-6 w-40 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring/50 placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") cancelEdit();
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-primary hover:text-primary/80 transition-colors"
          aria-label="Save role label"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={cancelEdit}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (label) {
    return (
      <div className="flex items-center gap-1 mt-0.5">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {label}
        </span>
        {isOwner && (
          <button
            onClick={startEdit}
            className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/member:opacity-100"
            aria-label="Edit role label"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  if (!isOwner) return null;

  return (
    <button
      onClick={startEdit}
      className="mt-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover/member:opacity-100"
    >
      + Add role
    </button>
  );
}
