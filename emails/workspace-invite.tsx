import * as React from "react";
import { Heading, Text, Button, Link } from "@react-email/components";
import { BaseEmail } from "./base";

interface WorkspaceInviteEmailProps {
  url: string;
  workspaceName: string;
  inviterName: string;
}

export function WorkspaceInviteEmail({
  url,
  workspaceName,
  inviterName,
}: WorkspaceInviteEmailProps) {
  return (
    <BaseEmail preview={`${inviterName} invited you to ${workspaceName} on Boardly`}>
      <Heading style={s.heading}>You&apos;ve been invited!</Heading>
      <Text style={s.body}>
        <strong>{inviterName}</strong> has invited you to join the{" "}
        <strong>{workspaceName}</strong> workspace on Boardly. Accept the
        invitation below to start collaborating.
      </Text>
      <Button href={url} style={s.cta}>
        Accept Invitation
      </Button>
      <Text style={s.expiry}>
        This invitation expires in <strong>7 days</strong>. If you weren&apos;t
        expecting this invite, you can safely ignore this email.
      </Text>
      <Text style={s.fallback}>
        Or copy this link into your browser:{" "}
        <Link href={url} style={s.link}>
          {url}
        </Link>
      </Text>
    </BaseEmail>
  );
}

const s: Record<string, React.CSSProperties> = {
  heading: {
    color: "#09090b",
    fontSize: "20px",
    fontWeight: 700,
    margin: "0 0 12px",
    lineHeight: "1.3",
  },
  body: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 24px",
  },
  cta: {
    backgroundColor: "#22c55e",
    borderRadius: "8px",
    color: "#000000",
    display: "block",
    fontSize: "15px",
    fontWeight: 700,
    padding: "14px 32px",
    textAlign: "center",
    textDecoration: "none",
    margin: "0 0 20px",
  },
  expiry: {
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "1.5",
    margin: "0 0 16px",
  },
  fallback: {
    color: "#71717a",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "0",
    wordBreak: "break-all",
  },
  link: {
    color: "#22c55e",
    textDecoration: "underline",
  },
};
