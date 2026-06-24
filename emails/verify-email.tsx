import * as React from "react";
import { Heading, Text, Button, Link } from "@react-email/components";
import { BaseEmail } from "./base";

interface VerifyEmailProps {
  url: string;
}

export function VerifyEmail({ url }: VerifyEmailProps) {
  return (
    <BaseEmail preview="Verify your Boardly account">
      <Heading style={s.heading}>Verify your email address</Heading>
      <Text style={s.body}>
        Thanks for signing up for Boardly! Click the button below to confirm
        your email address and activate your account. This link expires in{" "}
        <strong>24 hours</strong>.
      </Text>
      <Button href={url} style={s.cta}>
        Verify Email Address
      </Button>
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
