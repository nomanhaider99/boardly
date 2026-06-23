# Trello Clone — "Boardly" — Project Spec for Claude Code

> Give Claude Code this entire file as context (e.g. `claude code "read PROJECT_SPEC.md and let's start with Phase 1"` or just drop this file into the repo root and reference it). Build phase by phase — don't ask for the whole app in one shot.

## 1. Product Summary

A multi-tenant project management tool (Trello-style) where users sign up, create workspaces, invite teammates by email, and manage card-based boards (lists/decks + cards) with comments and file attachments. Personal use first, multi-user later — so auth, workspace isolation, and invites must be solid from day one.

## 2. Tech Stack (recommended — matches Noman's existing stack)

- **Framework:** Next.js (App Router) + TypeScript
- **DB:** PostgreSQL (Neon) + Drizzle ORM
- **Auth:** Auth.js (NextAuth) credentials provider OR Lucia/jose-based custom auth with email verification — reuse the `jose` JWT pattern from the Nodus project for Edge-compatible middleware
- **Styling:** Tailwind CSS + shadcn/ui
- **File uploads:** UploadThing or Cloudinary
- **Email:** Nodemailer (verification + invite emails)
- **State/data fetching:** Server Actions + React Query (for optimistic UI on drag-and-drop, comments)
- **Drag and drop:** `@dnd-kit/core`
- **Theming:** `next-themes` for dark/light toggle

## 3. Design System

- Dark theme: near-black background (`#0a0a0a` / `#0d0d0d`), green accent (`#22c55e` / emerald-500, or teal-leaning green like in the reference image), frosted-glass cards (`backdrop-blur`, semi-transparent borders)
- Light theme: white/off-white background, same green accent, subtle shadows instead of glass
- Headings: bold, large, modern sans (Syne or similar weight 700–800)
- Global theme toggle in navbar — persisted (cookie or localStorage), no flash-of-wrong-theme on load
- Landing page layout reference: hero with bold headline, subtext, primary CTA button, app/product preview mockup, small floating stat/feature cards (like the "Payment Successful" card in the reference) — adapt that pattern to a board/workspace preview instead of a car rental app
- Auth pages reference: split-screen layout — one side branded panel with numbered onboarding steps (1. Create account → 2. Set up workspace → 3. Set up profile), other side the actual form (Google/GitHub OAuth buttons, divider "Or", First/Last Name, Email, Password with show/hide toggle, helper text "Must be at least 8 characters", primary submit button, "Already have an account? Log in" link)

## 4. Core Feature List

### 4.1 Landing Page
- Public, unauthenticated
- Hero, feature highlights, CTA → Sign Up / Log In
- Theme toggle visible here too

### 4.2 Auth
- **Sign up:** First name, Last name, Email, Password
  - Client + server validation (Zod)
  - Password strength hint
  - On submit: disable button, show spinner in-button, then redirect or show "check your email" state
  - Send verification email (Nodemailer) with a tokenized link
  - User record created with `emailVerified: false` until they click the link
- **Email verification:** dedicated route that consumes the token, marks user verified, redirects to login with a success toast
- **Log in:** Email + password, "forgot password" link, same loading/disabled-button UX
- **Forgot/reset password:** reuse pattern from Nodus
- Toast notifications (e.g. `sonner`) for every success/error state — no silent failures, no raw error dumps to the user

### 4.3 Workspaces
- On first login, user sees a workspace picker/dashboard (like Trello's home)
- **Create workspace:** name, optional description/icon color
- Each workspace has members with roles (Owner, Member — keep it simple to start, can add Admin later)
- **Invite flow:**
  1. Owner/member searches by email inside workspace settings
  2. If user exists → invite record created, invitee gets email + in-app notification
  3. Invitee accepts (via emailed link or in-app "Invites" inbox) → added to `workspace_members`
  4. If user doesn't exist yet → store as a pending invite by email, auto-attach when they sign up (optional v2)

### 4.4 Boards / Lists / Cards
- Inside a workspace: one or more **boards**
- Inside a board: **lists** (the "decks" you mentioned — e.g. "Phase 1", "Phase 2"), each with a custom title, reorderable
- Inside a list: **cards**, each with:
  - Title, description (rich text optional v2, plain markdown is fine v1)
  - Drag-and-drop reorder within a list and across lists (optimistic UI, persists position on drop)
  - **Comments** thread per card
  - **Attachments**: images + documents (preview thumbnails for images, file icon + name/size for docs)
  - Due date, labels (nice-to-have, not blocking v1)
- All board/list/card mutations should feel instant (optimistic updates, rollback on error, toast on failure)

### 4.5 Cross-cutting UX requirements
- Every async action (signup, login, invite, create workspace, create card, upload file, delete) needs: disabled state on the trigger button, inline spinner, success/error toast or inline message
- Empty states designed, not blank (e.g. "No boards yet — create your first one")
- Skeleton loaders for board/list fetches, not blank white/black flashes
- Responsive — works on mobile (Trello-style horizontal scroll for lists)

## 5. Data Model (draft — Claude Code should propose/refine via Drizzle schema)

- `users` (id, firstName, lastName, email, passwordHash, emailVerified, createdAt)
- `workspaces` (id, name, ownerId, createdAt)
- `workspace_members` (workspaceId, userId, role)
- `workspace_invites` (id, workspaceId, invitedEmail, invitedByUserId, status, token, createdAt)
- `boards` (id, workspaceId, name, createdAt)
- `lists` (id, boardId, title, position)
- `cards` (id, listId, title, description, position, dueDate, createdAt)
- `comments` (id, cardId, userId, body, createdAt)
- `attachments` (id, cardId, url, type, fileName, size, uploadedByUserId, createdAt)

## 6. Build Order (give this to Claude Code as phases — one phase per session/prompt)

1. **Project setup** — Next.js + TS + Tailwind + shadcn + Drizzle + Neon connection + theme toggle wired up, no features yet, just shell + working dark/light toggle
2. **Auth** — schema, signup/login/verify-email/reset-password flows end-to-end with the UX polish described above
3. **Landing page** — full marketing page matching the visual direction
4. **Workspaces** — create, list, switch between workspaces; basic member list (no invites yet)
5. **Invites** — search-by-email, send invite, accept/decline flow
6. **Boards/Lists/Cards core** — CRUD + drag-and-drop reordering
7. **Comments + Attachments** — per-card threads and file uploads
8. **Polish pass** — skeletons, empty states, responsive QA, accessibility pass

## 7. Constraints / Preferences

- Reuse `jose` (not `jsonwebtoken`) for any JWT handling in middleware — Edge runtime compatibility, per past Nodus project
- Keep components in shadcn/ui style — don't hand-roll basic primitives (buttons, dialogs, dropdowns) that shadcn already covers
- Server Actions preferred over API routes where possible; use Route Handlers only where a true REST endpoint is needed (e.g. webhook from email provider)
