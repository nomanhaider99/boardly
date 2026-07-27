"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, updateAvatar, removeAvatar } from "@/app/actions/profile";
import { useUploadThing } from "@/lib/uploadthing";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // matches the 2MB uploadthing limit

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
}

export function ProfileBasicInfo({ firstName, lastName, email, avatarUrl }: Props) {
  const router = useRouter();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("userAvatar", {
    onClientUploadComplete: async (res) => {
      const url = res[0]?.url;
      if (!url) return;
      const result = await updateAvatar(url);
      if (result.success) {
        toast.success("Avatar updated.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update avatar.");
      }
      setUploading(false);
    },
    onUploadError: (err) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file after an error still fires.
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image is too large. Maximum size is 2MB.");
      return;
    }

    setUploading(true);
    await startUpload([file]);
  }

  async function handleRemoveAvatar() {
    setRemovingAvatar(true);
    const result = await removeAvatar();
    setRemovingAvatar(false);
    if (result.success) {
      toast.success("Profile picture removed.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to remove profile picture.");
    }
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateProfile({ firstName: first, lastName: last });
    setSaving(false);
    if (result.success) {
      toast.success("Profile updated.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update profile.");
    }
  }

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <h2 className="text-base font-semibold">Basic Information</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Avatar"
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{initials}</span>
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            {firstName} {lastName}
          </p>
          <p className="text-xs text-muted-foreground">{email}</p>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={removingAvatar || uploading}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              {removingAvatar ? "Removing…" : "Delete profile picture"}
            </button>
          )}
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            maxLength={50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            maxLength={50}
          />
        </div>
      </div>

      {/* Email — read-only */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={
            saving ||
            uploading ||
            !first.trim() ||
            !last.trim() ||
            (first === firstName && last === lastName)
          }
          size="sm"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </section>
  );
}
