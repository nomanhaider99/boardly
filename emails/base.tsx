import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from "@react-email/components";

interface BaseEmailProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseEmail({ preview, children }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Text style={s.wordmark}>Boardly</Text>
          </Section>
          <Hr style={s.divider} />
          <Section style={s.content}>{children}</Section>
          <Hr style={s.divider} />
          <Section style={s.footerSection}>
            <Text style={s.footer}>
              © 2025 Boardly · You received this because an action was taken on
              your account. If this wasn&apos;t you, you can safely ignore this
              email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const s: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#f4f4f5",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    margin: "0",
    padding: "40px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    maxWidth: "560px",
    margin: "0 auto",
    border: "1px solid #e4e4e7",
  },
  header: {
    padding: "28px 32px 20px",
  },
  wordmark: {
    color: "#22c55e",
    fontSize: "22px",
    fontWeight: 800,
    margin: "0",
    letterSpacing: "-0.5px",
  },
  divider: {
    borderColor: "#e4e4e7",
    borderTopWidth: "1px",
    margin: "0",
  },
  content: {
    padding: "32px 32px 28px",
  },
  footerSection: {
    padding: "16px 32px 28px",
  },
  footer: {
    color: "#a1a1aa",
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "0",
    textAlign: "center",
  },
};
