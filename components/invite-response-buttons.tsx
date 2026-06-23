"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { respondToInvite } from "@/app/actions/invite";
import { Button } from "@/components/ui/button";

export function InviteResponseButtons({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accepted" | "declined" | null>(null);

  async function handle(response: "accepted" | "declined") {
    setLoading(response);
    const result = await respondToInvite(inviteId, response);
    setLoading(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (response === "accepted") {
      toast.success("You've joined the workspace!");
      router.push("/dashboard");
    } else {
      toast.success("Invite declined.");
    }
    router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        size="sm"
        variant="outline"
        disabled={loading !== null}
        onClick={() => handle("declined")}
        className="gap-1.5"
      >
        {loading === "declined" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
        Decline
      </Button>
      <Button
        size="sm"
        disabled={loading !== null}
        onClick={() => handle("accepted")}
        className="gap-1.5"
      >
        {loading === "accepted" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        Accept
      </Button>
    </div>
  );
}
