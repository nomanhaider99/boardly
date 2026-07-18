"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Settings2,
  Users,
  Palette,
  Tag,
  SlidersHorizontal,
  Loader2,
  Search,
  X,
  Check,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LabelPill } from "@/components/card-label";
import { BOARD_BACKGROUNDS, resolveBackground } from "@/lib/board-backgrounds";
import {
  getBoardMemberLabels,
  setBoardMemberLabel,
  setMemberCanMoveCards,
  setBoardBackground,
  renameBoard,
  deleteBoard,
  type MemberWithBoardLabel,
} from "@/app/actions/board";
import {
  createLabel,
  updateLabel,
  deleteLabel,
} from "@/app/actions/label";
import { LABEL_COLORS } from "@/lib/labels";
import type { CardLabel } from "@/db/schema";
import { cn } from "@/lib/utils";

type Tab = "members" | "appearance" | "labels" | "board";

interface Props {
  boardId: string;
  isOwner: boolean;
  labels: CardLabel[];
  onLabelsChange: (labels: CardLabel[]) => void;
  background: string | null;
  onBackgroundChange: (value: string | null) => void;
}

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "members", label: "Members", icon: Users },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "labels", label: "Labels", icon: Tag },
  { key: "board", label: "Board", icon: SlidersHorizontal },
];

export function BoardSettingsDialog({
  boardId,
  isOwner,
  labels,
  onLabelsChange,
  background,
  onBackgroundChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<MemberWithBoardLabel[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  async function handleOpen() {
    setOpen(true);
    setLoadingMembers(true);
    const data = await getBoardMemberLabels(boardId);
    setMembers(data);
    setLoadingMembers(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleOpen}>
        <Settings2 className="h-3.5 w-3.5" />
        Settings
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="text-base">Board settings</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-[26rem] max-h-[70vh]">
            {/* Tab rail */}
            <nav className="w-44 shrink-0 border-r border-border/60 p-2 space-y-0.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    tab === t.key
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </nav>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 min-w-0">
              {tab === "members" && (
                <MembersTab
                  boardId={boardId}
                  isOwner={isOwner}
                  members={members}
                  loading={loadingMembers}
                  onMembersChange={setMembers}
                />
              )}
              {tab === "appearance" && (
                <AppearanceTab
                  boardId={boardId}
                  isOwner={isOwner}
                  background={background}
                  onBackgroundChange={onBackgroundChange}
                />
              )}
              {tab === "labels" && (
                <LabelsTab
                  boardId={boardId}
                  labels={labels}
                  onLabelsChange={onLabelsChange}
                />
              )}
              {tab === "board" && <BoardTab boardId={boardId} isOwner={isOwner} />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───────────────────────── Members ───────────────────────── */

function MembersTab({
  boardId,
  isOwner,
  members,
  loading,
  onMembersChange,
}: {
  boardId: string;
  isOwner: boolean;
  members: MemberWithBoardLabel[];
  loading: boolean;
  onMembersChange: (m: MemberWithBoardLabel[]) => void;
}) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? members.filter((m) =>
        `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q)
      )
    : members;

  function patch(userId: string, partial: Partial<MemberWithBoardLabel>) {
    onMembersChange(members.map((m) => (m.userId === userId ? { ...m, ...partial } : m)));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name or email…"
          className="w-full h-9 rounded-lg border border-input bg-background pl-8 pr-7 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No members found.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((m) => (
            <MemberRow
              key={m.userId}
              boardId={boardId}
              isOwner={isOwner}
              member={m}
              onPatch={(partial) => patch(m.userId, partial)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  boardId,
  isOwner,
  member,
  onPatch,
}: {
  boardId: string;
  isOwner: boolean;
  member: MemberWithBoardLabel;
  onPatch: (partial: Partial<MemberWithBoardLabel>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.boardLabel ?? "");
  const [savingLabel, setSavingLabel] = useState(false);
  const [togglingMove, setTogglingMove] = useState(false);

  async function saveLabel() {
    const trimmed = draft.trim() || null;
    setSavingLabel(true);
    const result = await setBoardMemberLabel(boardId, member.userId, trimmed);
    setSavingLabel(false);
    if (!result.success) { toast.error(result.error); return; }
    onPatch({ boardLabel: trimmed });
    setEditing(false);
    toast.success(trimmed ? "Board label saved." : "Board label removed.");
  }

  async function toggleMove(next: boolean) {
    setTogglingMove(true);
    const result = await setMemberCanMoveCards(boardId, member.userId, next);
    setTogglingMove(false);
    if (!result.success) { toast.error(result.error); return; }
    onPatch({ canMoveCards: next });
  }

  return (
    <div className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {member.firstName[0]}{member.lastName[0]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium leading-tight truncate">
            {member.firstName} {member.lastName}
          </p>
          {member.role === "owner" && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Owner
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>

        {member.boardLabel && !editing && (
          <span className="mt-0.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {member.boardLabel}
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
                if (e.key === "Enter") saveLabel();
                if (e.key === "Escape") { setEditing(false); setDraft(member.boardLabel ?? ""); }
              }}
            />
            <button onClick={saveLabel} disabled={savingLabel} className="text-primary hover:text-primary/80 disabled:opacity-50" aria-label="Save label">
              {savingLabel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => { setEditing(false); setDraft(member.boardLabel ?? ""); }} className="text-muted-foreground hover:text-foreground" aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          isOwner && (
            <button
              onClick={() => { setDraft(member.boardLabel ?? ""); setEditing(true); }}
              className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Pencil className="h-2.5 w-2.5" />
              {member.boardLabel ? "Edit board label" : "Add board label"}
            </button>
          )
        )}
      </div>

      {/* Move-cards permission */}
      <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
        <span className="text-[10px] text-muted-foreground">Move cards</span>
        {member.role === "owner" ? (
          <span className="text-[10px] font-medium text-primary">Always</span>
        ) : (
          <Switch
            checked={member.canMoveCards}
            onCheckedChange={toggleMove}
            disabled={!isOwner || togglingMove}
            aria-label={`Allow ${member.firstName} to move cards`}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Appearance ───────────────────────── */

function AppearanceTab({
  boardId,
  isOwner,
  background,
  onBackgroundChange,
}: {
  boardId: string;
  isOwner: boolean;
  background: string | null;
  onBackgroundChange: (value: string | null) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  async function choose(value: string | null) {
    if (!isOwner) return;
    setSaving(value ?? "none");
    const prev = background;
    onBackgroundChange(value); // optimistic
    const result = await setBoardBackground(boardId, value);
    setSaving(null);
    if (!result.success) { toast.error(result.error); onBackgroundChange(prev); }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Background</h3>
        <p className="text-xs text-muted-foreground">
          {isOwner ? "Pick a background for this board." : "Only workspace owners can change the background."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {BOARD_BACKGROUNDS.map((bg) => {
          const active = background === bg.value;
          return (
            <button
              key={bg.key}
              onClick={() => choose(bg.value)}
              disabled={!isOwner || saving !== null}
              style={{ background: resolveBackground(bg.value) }}
              className={cn(
                "relative h-16 rounded-lg border-2 transition-all",
                active ? "border-foreground ring-2 ring-ring/40" : "border-transparent hover:scale-[1.03]",
                !isOwner && "cursor-default opacity-90"
              )}
              aria-label={bg.label}
            >
              {active && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-5 w-5 text-white drop-shadow" />
                </span>
              )}
            </button>
          );
        })}

        {/* None / plain */}
        <button
          onClick={() => choose(null)}
          disabled={!isOwner || saving !== null}
          className={cn(
            "relative h-16 rounded-lg border-2 bg-muted transition-all flex items-center justify-center text-xs text-muted-foreground",
            background == null ? "border-foreground ring-2 ring-ring/40" : "border-transparent hover:scale-[1.03]",
            !isOwner && "cursor-default"
          )}
          aria-label="No background"
        >
          None
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Labels ───────────────────────── */

function LabelsTab({
  boardId,
  labels,
  onLabelsChange,
}: {
  boardId: string;
  labels: CardLabel[];
  onLabelsChange: (labels: CardLabel[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const priority = labels.filter((l) => l.type === "priority");
  const custom = labels.filter((l) => l.type === "custom");

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setSaving(true);
    const result = await createLabel(boardId, { title, color: newColor });
    setSaving(false);
    if (!result.success || !result.label) {
      toast.error(result.success ? "Could not create label." : result.error);
      return;
    }
    onLabelsChange([...labels, result.label]);
    setNewTitle("");
    setNewColor(LABEL_COLORS[0]);
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Priority labels
        </h3>
        <p className="text-xs text-muted-foreground">Built-in priorities available on every card.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {priority.map((l) => (
            <LabelPill key={l.id} label={l} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Custom labels</h3>
        {custom.length === 0 && <p className="text-xs text-muted-foreground">No custom labels yet.</p>}
        <div className="space-y-1">
          {custom.map((l) => (
            <LabelEditorRow
              key={l.id}
              label={l}
              onUpdated={(updated) => onLabelsChange(labels.map((x) => (x.id === updated.id ? updated : x)))}
              onDeleted={(id) => onLabelsChange(labels.filter((x) => x.id !== id))}
            />
          ))}
        </div>

        {creating ? (
          <div className="space-y-2 rounded-lg border border-border/60 p-2.5">
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={50}
              placeholder="Label name"
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            />
            <div className="flex flex-wrap gap-1.5">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn("h-6 w-6 rounded-full border-2", newColor === c ? "border-foreground scale-110" : "border-transparent")}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleCreate} disabled={saving || !newTitle.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Create label
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Create a new label
          </button>
        )}
      </div>
    </div>
  );
}

function LabelEditorRow({
  label,
  onUpdated,
  onDeleted,
}: {
  label: CardLabel;
  onUpdated: (label: CardLabel) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(label.title);
  const [color, setColor] = useState(label.color);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    const result = await updateLabel(label.id, { title: title.trim(), color });
    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    onUpdated({ ...label, title: title.trim(), color });
    setEditing(false);
  }

  async function remove() {
    setDeleting(true);
    const result = await deleteLabel(label.id);
    setDeleting(false);
    if (!result.success) { toast.error(result.error); return; }
    onDeleted(label.id);
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-border/60 p-2.5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} className="h-8 text-sm" />
        <div className="flex flex-wrap gap-1.5">
          {LABEL_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }}
              className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-foreground scale-110" : "border-transparent")}
              aria-label={`Color ${c}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={save} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(false); setTitle(label.title); setColor(label.color); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted/50 transition-colors">
      <span className="flex-1"><LabelPill label={label} /></span>
      <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Edit label">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={remove} disabled={deleting} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete label">
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/* ───────────────────────── Board ───────────────────────── */

function BoardTab({ boardId, isOwner }: { boardId: string; isOwner: boolean }) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRename() {
    if (!name.trim()) return;
    setRenaming(true);
    const result = await renameBoard(boardId, name.trim());
    setRenaming(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Board renamed.");
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm("Delete this board and everything on it? This cannot be undone.")) return;
    setDeleting(true);
    const result = await deleteBoard(boardId);
    setDeleting(false);
    if (!result.success) { toast.error(result.error ?? "Failed to delete board."); return; }
    toast.success("Board deleted.");
    router.push(`/workspace/${params.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Rename board</h3>
        {isOwner ? (
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New board name"
              maxLength={80}
              className="h-9 max-w-xs"
            />
            <Button size="sm" onClick={handleRename} disabled={renaming || !name.trim()} className="h-9 gap-1.5">
              {renaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Only workspace owners can rename the board.</p>
        )}
      </div>

      {isOwner && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
          <p className="text-xs text-muted-foreground">
            Deleting a board removes all its lists, cards, comments and attachments.
          </p>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete board
          </Button>
        </div>
      )}
    </div>
  );
}
