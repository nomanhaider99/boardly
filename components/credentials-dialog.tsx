"use client";

import { useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  X,
  Check,
  Pencil,
  Copy,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCardCredentialsMeta,
  revealCredentialFields,
  createCredential,
  updateCredential,
  deleteCredential,
  type CredentialMeta,
  type CredentialFieldData,
} from "@/app/actions/credential";

type Row = { key: string; value: string };
type FormState = { id: string | null; title: string; icon: string; rows: Row[] };

const emptyForm = (): FormState => ({
  id: null,
  title: "",
  icon: "",
  rows: [
    { key: "", value: "" },
    { key: "", value: "" },
  ],
});

interface Props {
  cardId: string;
  initialCredentials: CredentialMeta[];
}

export function CredentialsSection({ cardId, initialCredentials }: Props) {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<CredentialMeta[]>(initialCredentials);
  const [view, setView] = useState<"list" | "form">("list");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  async function refresh() {
    const data = await getCardCredentialsMeta(cardId);
    setCreds(data);
  }

  function openAdd() {
    setForm(emptyForm());
    setView("form");
  }

  async function openEdit(meta: CredentialMeta) {
    setLoadingEdit(meta.id);
    const result = await revealCredentialFields(meta.id);
    setLoadingEdit(null);
    if (!result.success) { toast.error(result.error); return; }
    setForm({
      id: meta.id,
      title: meta.title,
      icon: meta.icon ?? "",
      rows: result.fields.length
        ? result.fields.map((f) => ({ key: f.key, value: f.value }))
        : [{ key: "", value: "" }],
    });
    setView("form");
  }

  function setRow(i: number, patch: Partial<Row>) {
    setForm((f) => ({ ...f, rows: f.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  }
  function addRow() {
    setForm((f) => ({ ...f, rows: [...f.rows, { key: "", value: "" }] }));
  }
  function removeRow(i: number) {
    setForm((f) => ({ ...f, rows: f.rows.filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    const title = form.title.trim();
    if (!title) { toast.error("Title is required."); return; }
    const fields = form.rows.map((r) => ({ key: r.key.trim(), value: r.value })).filter((r) => r.key && r.value);
    if (fields.length === 0) { toast.error("Add at least one key and value."); return; }

    setSaving(true);
    const result = form.id
      ? await updateCredential(form.id, { title, icon: form.icon, fields })
      : await createCredential(cardId, { title, icon: form.icon, fields });
    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(form.id ? "Credential updated." : "Credential saved.");
    await refresh();
    setView("list");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this credential entry?")) return;
    const result = await deleteCredential(id);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Credential deleted.");
    setCreds((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5" />
        Credentials
      </Label>

      <button
        onClick={() => { setView("list"); setOpen(true); }}
        className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <KeyRound className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-sm">
          {creds.length === 0 ? "Add credentials" : `${creds.length} credential${creds.length === 1 ? "" : "s"}`}
        </span>
        <span className="text-xs text-muted-foreground">Manage</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              {view === "form" && (
                <button onClick={() => setView("list")} className="text-muted-foreground hover:text-foreground" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <KeyRound className="h-4 w-4 text-primary" />
              {view === "form" ? (form.id ? "Edit credential" : "New credential") : "Credentials"}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto p-5">
            {view === "list" ? (
              <div className="space-y-2">
                {creds.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No credentials saved for this card yet.
                  </p>
                )}
                {creds.map((c) => (
                  <CredentialEntry
                    key={c.id}
                    meta={c}
                    onEdit={() => openEdit(c)}
                    onDelete={() => handleDelete(c.id)}
                    editLoading={loadingEdit === c.id}
                  />
                ))}
                <Button onClick={openAdd} size="sm" className="w-full gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add New Credential
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input
                    autoFocus
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Hostinger Hosting Credentials"
                    maxLength={100}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Service / icon (optional)</Label>
                  <Input
                    value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                    placeholder="e.g. Hostinger, GoDaddy, or an emoji 🔑"
                    maxLength={100}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Fields</Label>
                  <div className="space-y-2">
                    {form.rows.map((row, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={row.key}
                          onChange={(e) => setRow(i, { key: e.target.value })}
                          placeholder="KEY"
                          className="h-8 flex-1 font-mono text-xs"
                        />
                        <span className="text-muted-foreground">=</span>
                        <Input
                          value={row.value}
                          onChange={(e) => setRow(i, { value: e.target.value })}
                          placeholder="value"
                          className="h-8 flex-1 font-mono text-xs"
                        />
                        <button
                          onClick={() => removeRow(i)}
                          disabled={form.rows.length <= 1}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                          aria-label="Remove field"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another field
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setView("list")}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialEntry({
  meta,
  onEdit,
  onDelete,
  editLoading,
}: {
  meta: CredentialMeta;
  onEdit: () => void;
  onDelete: () => void;
  editLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<CredentialFieldData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !fields) {
      setLoading(true);
      const result = await revealCredentialFields(meta.id);
      setLoading(false);
      if (!result.success) { toast.error(result.error); setExpanded(false); return; }
      setFields(result.fields);
    }
  }

  const isEmoji = meta.icon && /\p{Emoji}/u.test(meta.icon) && meta.icon.length <= 4;

  return (
    <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center gap-2.5 p-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-sm">
          {isEmoji ? meta.icon : <KeyRound className="h-4 w-4" />}
        </span>
        <button onClick={toggleExpand} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium truncate">{meta.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {meta.icon && !isEmoji ? `${meta.icon} · ` : ""}
            {meta.fieldCount} field{meta.fieldCount === 1 ? "" : "s"}
          </p>
        </button>
        <button onClick={onEdit} disabled={editLoading} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit credential">
          {editLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Delete credential">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={toggleExpand} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={expanded ? "Hide" : "Reveal"}>
          {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/30 px-2.5 py-2 space-y-1.5">
          {loading ? (
            <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Decrypting…
            </div>
          ) : (
            fields?.map((f, i) => {
              const show = revealed.has(i);
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-muted-foreground min-w-0 max-w-[40%] truncate">{f.key}</span>
                  <span className="font-mono flex-1 min-w-0 truncate">
                    {show ? f.value : "•".repeat(Math.min(f.value.length, 12))}
                  </span>
                  <button
                    onClick={() =>
                      setRevealed((prev) => {
                        const n = new Set(prev);
                        n.has(i) ? n.delete(i) : n.add(i);
                        return n;
                      })
                    }
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label={show ? "Hide value" : "Show value"}
                  >
                    {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(f.value); toast.success("Copied."); }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label="Copy value"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
