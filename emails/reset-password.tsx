import * as React from "react";
import { Heading, Text, Button, Link } from "@react-email/components";
import { BaseEmail } from "./base";

interface ResetPasswordEmailProps {
  url: string;
}

export function ResetPasswordEmail({ url }: ResetPasswordEmailProps) {
  return (
    <BaseEmail preview="Reset your Boardly password">
      <Heading style={s.heading}>Reset your password</Heading>
      <Text style={s.body}>
        We received a request to reset the password for your Boardly account.
        Click the button below to choose a new password. This link expires in{" "}
        <strong>1 hour</strong>.
      </Text>
      <Button href={url} style={s.cta}>
        Reset Password
      </Button>
      <Text style={s.safety}>
        If you didn&apos;t request a password reset, you can safely ignore this
        email — your password will not change.
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
  safety: {
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
