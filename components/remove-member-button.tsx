"use client";

import { useState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { removeMember } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";

export function RemoveMemberButton({
  workspaceId,
  targetUserId,
  memberName,
}: {
  workspaceId: string;
  targetUserId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (
      !window.confirm(
        `Remove ${memberName} from this workspace? They'll lose access, but their comments and cards stay intact.`
      )
    ) {
      return;
    }
    setLoading(true);
    const result = await removeMember(workspaceId, targetUserId);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`${memberName} was removed.`);
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={loading}
      aria-label={`Remove ${memberName}`}
      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <UserMinus className="h-3.5 w-3.5" />
      )}
      Remove
    </Button>
  );
}
