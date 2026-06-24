# Boardly — Change Request & New Features Spec (v2)

> Give this to Claude Code alongside the original `PROJECT_SPEC.md` (keep that file — this is additive, not a replacement). Work through section by section, same rules as before: plan first, confirm, then code.

## 0. Context for Claude Code

Boardly (live at boardly-psi-ruby.vercel.app) is built and working off `PROJECT_SPEC.md`. This document lists changes to existing features and new features to add on top of that. Read the existing codebase structure before proposing changes — don't assume file locations, inspect first.

---

## 1. Card Detail: Sidebar → Dialog, with View/Edit modes

**Current:** card details open in a sidebar.
**Change to:** a centered modal dialog (like real Trello), large (roughly 700–900px wide, scrollable body, sticky header with close button).

Behavior:
- Default state on open = **read-only view** — title, description, due date, banner, attachments, comments all rendered as static content, not inputs
- Clicking on a field (title, description) switches **just that field** into edit mode in place — no separate "Edit" button needed for text fields, click-to-edit is fine, but make the clickable affordance obvious (hover state, pencil icon, etc.)
- On edit: show Save / Cancel actions for that field. Save = optimistic update + toast on success/failure, disable Save while in flight
- Clicking outside the dialog or pressing Esc closes it (confirm if there are unsaved edits in progress)

## 2. Card Banner Image

- Add `bannerUrl` to the `cards` table
- Shown at the top of the card (inside the dialog) and as a thumbnail strip on the card preview in the list/board view if present
- Upload via the same upload provider already wired up for attachments
- If no banner set, dialog header has an unobtrusive "Add cover" action (Trello-style)

## 3. Due Date Urgency Flags

- Add a derived/computed urgency level based on `dueDate` vs now: e.g. `overdue` (red), `urgent` — due within 24–48h (orange), `upcoming` — due within the next week (yellow), `normal` — further out (green or neutral), `none` if no due date set
- Show this as a small colored pill/flag both on the card preview (board view) and inside the card dialog, with the literal date as well, not just the color
- Exact thresholds are a judgment call — Claude Code should propose them, we can tune later

## 4. Real-time Collaboration (WebSockets)

- When User A drags a card to a new position/list, User B (viewing the same board) should see the move reflected live, without refreshing
- Recommend using **Pusher** (per earlier exploration in PROJECT_SPEC, serverless-friendly — Vercel doesn't support persistent socket servers) or **Liveblocks**/**Ably** as alternatives — Claude Code should pick one, justify the choice given Vercel hosting, and confirm before implementing
- Scope for this pass: card move/reorder events only (not full multiplayer cursors or live typing — that's a future nice-to-have)
- Events: on successful card move mutation, broadcast `{ cardId, fromListId, toListId, newPosition }` to a board-scoped channel; other connected clients apply the same reorder locally
- Handle conflict edge case: if two people move the same card near-simultaneously, last-write-wins is acceptable for now

## 5. Custom Role Labels per Workspace Member

- Admin/owner of a board (or workspace — confirm scope, recommend workspace-level since members are workspace-scoped) can assign a free-text role label to each member, e.g. "General Manager", "Upseller", "Developer"
- New column on `workspace_members`: `roleLabel` (free text, separate from the existing permission `role` enum — don't conflate display label with actual permissions)
- Editable from workspace settings → members list, inline edit per member, owner/admin only
- Shown next to the member's name wherever members are listed (member list, card assignee picker, etc.)

## 6. Comments: Newest First + @Mentions

- Change comment query/order to newest-first (currently presumably oldest-first or insertion order)
- Add `@username` tagging in the comment composer:
  - Typing `@` opens an autocomplete dropdown of workspace members filtered by what's typed
  - Selecting inserts a styled mention token in the text
  - Support multiple mentions in one comment
  - On submit, parse mentions and store a `comment_mentions` join table (commentId, mentionedUserId) so we can notify those users (in-app notification at minimum; email notification can be a follow-up)
  - Rendered mentions are visually distinct (e.g. accent-colored, slightly bolder) and link to that user's profile

## 7. Profile Page + 2FA

- New `/profile` (or `/settings/profile`) page matching existing dark/light theme system
- Sections: basic info (name, email, avatar upload), password change, **Security** section with 2FA
- 2FA:
  - Off by default for all existing and new users
  - User opts in from profile/settings: TOTP-based (e.g. `otplib` + QR code via `qrcode` package) is the standard, recommended approach — shows QR code to scan in an authenticator app, user confirms with a 6-digit code to activate, show backup codes once
  - Once enabled, login flow requires the 6-digit code as a second step after password
  - Allow disabling 2FA from the same settings page (require current password or a valid code to disable)

## 8. Email Templates — On-Brand Design

- Redesign all transactional emails (verification, password reset, workspace invite, @mention notification if implemented) to match the app's visual identity: dark background option or clean light card, green accent buttons, logo/wordmark at top, clear single CTA button, simple footer
- Recommend using `react-email` (component-based, renders to HTML, plays well with Resend) instead of hand-written HTML strings if not already doing so
- Keep one shared base template/layout component, individual emails just fill in the content slot — avoids visual drift between email types

---

## Suggested Order of Implementation

1. Card dialog conversion (view/edit modes) — foundational, other card features build on this UI
2. Card banner image
3. Due date urgency flags
4. Custom role labels (independent, low risk, quick win)
5. Comments reorder + @mentions
6. Email template redesign (can happen in parallel with anything above — isolated)
7. Profile page + 2FA (independent, but do after card/comment work so attention isn't split across auth-sensitive code and UI work in the same session)
8. WebSockets / real-time card movement (most architecturally invasive — do last, once everything else is stable, so you're not debugging real-time sync on top of a still-changing card/board UI)
