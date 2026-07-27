# Proboardive — Fixes & Improvements

**Project:** Proboardive (https://proboardive.com)
**Prepared:** 23 July 2026
**Scope:** Rebrand from "Boardly" → "Proboardive", form validation, board/card UX fixes, real-time updates (no sockets), admin permissions, and SEO.

> **Critical constraint (applies to every item):** All changes must be **non-destructive to existing data**. No migration may drop, truncate, or overwrite existing boards, lists, cards, comments, members, invitations, labels, or user records. Test every change against a copy of production data before shipping. See §15.

---

## Priority legend

| Priority | Meaning |
|----------|---------|
| 🔴 P0 | Blocking / brand-critical / data-safety — do first |
| 🟠 P1 | High-impact bug or expected feature |
| 🟡 P2 | Polish / enhancement |

---

## 1. Rebrand "Boardly" → "Proboardive" (global) 🔴 P0

**Covers original items 1, 4, 12 (branding portion).**

The platform is being renamed. "Boardly" must not appear anywhere in the product, marketing site, or metadata.

**Tasks**
- Change the logo/wordmark text in the header to **Proboardive**. Update the logo asset/SVG if the name is baked into the image.
- Global find-and-replace of every user-visible "Boardly" string → "Proboardive" across the whole app: navbar, footer, auth pages, emails (subject + body), toasts, tooltips, empty states, modal titles, marketing/landing pages, pricing page, 404 page, loading screens, meta tags, `manifest.json` / PWA name, favicon alt text, and `package.json` name if surfaced anywhere.
- Update transactional email sender name and templates (currently branded "Boardly").
- Update the browser tab title (`<title>`) — currently just "Boardly".

**Watch out for**
- Do **not** blind-replace in code identifiers, variables, DB table/column names, API routes, or CSS classes that contain "boardly" — those are internal and changing them risks breakage. Only change **user-facing strings and copy**.
- Check hardcoded strings in both frontend and backend (server-rendered emails, error messages).

**Acceptance criteria**
- Searching the running app (UI + emails + meta) for "Boardly" returns zero results.
- Logo reads "Proboardive" on every page.

---

## 2. Full form validation on Sign Up & Sign In 🔴 P0

**Covers original item 2.**

Add complete client-side **and** server-side validation to every auth form (and any other forms of the same class).

**Password rules (signup / reset)**
- Minimum 8 characters.
- At least one uppercase letter and one lowercase letter.
- At least one number.
- At least one special character (e.g. `!@#$%^&*`).
- Show a live requirement checklist / strength meter as the user types.
- "Confirm password" must match.

**Email**
- Valid email format (RFC-style regex or library validation).
- Trim whitespace; normalize to lowercase before submit.
- Duplicate-email check on signup with a clear message.

**General**
- Required-field validation with inline error messages under each field (not just a single generic alert).
- Disable the submit button while a request is in flight; show a spinner.
- Validate on blur and on submit; clear errors as the user corrects them.
- **Server-side validation must mirror client-side** — never trust the client alone.
- Consistent, accessible error styling (aria-invalid, associated error text).

**Acceptance criteria**
- A weak password (e.g. `password`) is rejected with specific reasons listed.
- Invalid email, empty fields, and mismatched passwords each produce a clear inline error.
- Server rejects invalid payloads even if client validation is bypassed.

---

## 3. Edit Profile dialog fixes 🟠 P1

**Covers original item 3.**

- Audit the Edit Profile dialog end-to-end; ensure every field saves correctly and persists after reload.
- Add a **"Delete profile picture"** button that removes the avatar and reverts to the default/initials avatar.
- Ensure the delete removes the stored file (or dereferences it) without breaking cards/comments that reference the user.
- Validate inputs in this dialog (name not empty, valid image type/size on upload, max file size).
- Show success/error toasts; close the dialog only on success.
- Fix any fields that currently don't persist or throw on save.

**Acceptance criteria**
- Changing name/avatar/etc. saves and survives a page refresh.
- "Delete profile picture" visibly removes the avatar and persists the change.
- Uploading an oversized or non-image file is rejected with a clear message.

---

## 4. Contact email → info@proboardive.com 🟠 P1

**Covers original item 5.**

- Replace the current contact email (`hello@boardly.app`) with **info@proboardive.com** everywhere: footer, contact page, `mailto:` links, support/help text, and any transactional email "reply-to" / footer contact line.

**Acceptance criteria**
- No `hello@boardly.app` (or any `@boardly.app`) remains anywhere.
- All contact links point to `info@proboardive.com`.

---

## 5. Footer cleanup — remove undeveloped static pages 🟡 P2

**Covers original item 6.**

- Remove footer links to pages that don't exist yet (e.g. **Privacy Policy**, **Terms of Service**, and any other placeholder/404 links).
- Alternatively, if these are legally desirable, keep them but point to real content — but per request, **remove** the dead links for now.
- Verify no remaining footer link leads to a 404.

**Acceptance criteria**
- Every footer link resolves to a live page.
- Privacy Policy / Terms of Service links are gone (until real pages exist).

---

## 6. List titles must show the full name 🟠 P1

**Covers original item 7.**

List names are being truncated. Example — the full name is:
`2. Brief Ready - PM finalizes the project scope, uploads docs, and move the card to In scope.`
but only `2. Brief Ready - PM` shows.

**Likely cause:** CSS truncation (`text-overflow: ellipsis` / fixed width / `line-clamp`), or the name is being cut in code before render.

**Tasks**
- Ensure the **full** list name is stored and rendered (verify the value isn't truncated at save/read time).
- Allow the list header to wrap to multiple lines, or provide a tooltip / expand-on-hover showing the full title, so long names are fully visible.
- Confirm this doesn't break horizontal board layout — allow the header to grow in height, not squash the column.

**Acceptance criteria**
- The example list displays its complete title.
- Long list names are fully readable (wrapped or via tooltip), not cut off.

---

## 7. Chat button z-index overlap with agent chat 🟠 P1

**Covers original item 8.**

- When the AI agent chat panel is open, the floating chat button overlaps it (z-index conflict).
- Fix stacking order so the button sits **behind** or hides when the chat panel is open, or repositions so it never overlaps interactive content.
- Verify on mobile and desktop widths.

**Acceptance criteria**
- Opening the agent chat no longer shows the button overlapping the panel or its controls.

---

## 8. Remove vertical scrollbar on the board 🟡 P2

**Covers original item 9.**

- Remove the unwanted vertical scroller on the board view (boards should scroll horizontally across lists; individual lists scroll internally).
- Fix the container height/overflow CSS causing the stray outer vertical scrollbar.
- Ensure the fix doesn't clip content on short screens.

**Acceptance criteria**
- No redundant outer vertical scrollbar on the board.
- Lists still scroll internally when they have many cards.

---

## 9. Fix "Remove / Clear due date" 🟠 P1

**Covers original item 10.**

- Clearing a card's due date currently does not work.
- Ensure the clear action sends the correct payload (e.g. `dueDate: null`) and the backend persists the null value.
- Update the card UI immediately (badge disappears) and after reload.

**Acceptance criteria**
- Clicking "remove due date" removes the badge, persists, and stays cleared after refresh.

---

## 10. Rich comment editor + paste handling 🟠 P1

**Covers original item 11.**

Upgrade the comment input into a proper rich-text editor.

**Formatting toolbar**
- **Bold**, *Italic*, <u>Underline</u>, bulleted list, numbered list — and any other standard controls (links, strikethrough, code).
- Keyboard shortcuts (Ctrl/Cmd+B, I, U).

**Paste handling (Ctrl+V)**
- Pasting an **image** (from clipboard) uploads it and inserts it inline / adds it to the card **Attachments**.
- Pasting a **file** routes it to Attachments.
- Pasting a **URL** auto-linkifies it (clickable link).
- Preserve reasonable formatting on paste; strip dangerous HTML (sanitize to prevent XSS).

**Notes**
- Consider a maintained editor (e.g. TipTap / Lexical / ProseMirror) rather than hand-rolling.
- Sanitize all rendered comment HTML server-side and client-side.

**Acceptance criteria**
- Toolbar formatting works and renders correctly in the saved comment.
- Ctrl+V of an image pastes/uploads it; a pasted link is clickable; a pasted file lands in Attachments.

---

## 11. SEO optimization 🟠 P1

**Covers original item 12 (SEO portion).**

Current meta is bare: title "Boardly", description "A modern project management tool". Optimize for the rebranded platform.

**Tasks**
- Unique, descriptive `<title>` per page (e.g. `Proboardive — Organize your work, ship what matters` on home).
- Meta description per page (~150–160 chars) using platform value props.
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) and Twitter Card tags for rich link previews — with a Proboardive-branded share image.
- Canonical URLs.
- `robots.txt` and an auto-generated `sitemap.xml`.
- Semantic headings (one `<h1>` per page) and descriptive `alt` text on images.
- JSON-LD structured data (`SoftwareApplication` / `Organization`).
- Favicon + PWA `manifest.json` updated to Proboardive.
- Suggested keywords: project management, kanban boards, task organization, team collaboration, drag-and-drop, AI board agent, workspace management.
- Ensure fast load / good Core Web Vitals (ties into §16 performance).

**Acceptance criteria**
- Lighthouse SEO score ≥ 90.
- Every page has a unique title + meta description; share previews render with Proboardive branding.

---

## 12. Fix zoomed-in / cropped card images 🟠 P1

**Covers original item 13.**

- Card cover images are zoomed/cropped. Adjust the image container so images display at proper aspect ratio.
- Use `object-fit: contain` (or a correct `cover` with proper container aspect ratio) and a sensible max height so covers look right across card sizes.
- Verify with portrait, landscape, and square images.

**Acceptance criteria**
- Card cover images display fully/proportionally without excessive zoom or crop.

---

## 13. Email verification → OTP 🟠 P1

**Covers original item 14.**

- Replace the "click the verification link" email flow with a **numeric OTP** flow.
- On signup, email a 6-digit OTP; user enters it on a verification screen to activate the account.
- OTP expiry (e.g. 10 min), rate limiting, resend with cooldown, and limited attempts before lockout.
- Store OTP hashed, not plaintext; invalidate after use.
- Keep existing verified users verified — do **not** force re-verification of current accounts (data-safety, §15).

**Acceptance criteria**
- New users verify via OTP; expired/incorrect codes are rejected clearly; resend works with cooldown.
- Existing verified accounts remain verified.

---

## 14. Real-time updates without WebSockets 🟠 P1

**Covers original item 16.**

Users currently must refresh to see changes (e.g. board invitations / notifications don't appear live).

**Approach (no sockets)**
- Use **polling** or **Server-Sent Events (SSE)** / long-polling to push updates. Options:
  - Lightweight interval polling for notifications, board membership, and card/list changes.
  - Or SSE for a one-way server→client stream (works without full WebSocket infra).
  - A data-fetching layer with background refetch (e.g. React Query / SWR with `refetchInterval`, refetch-on-focus, and stale-while-revalidate).
- Apply to: notifications/invitations, board membership changes, card moves, comments, labels, due dates.
- Optimistic UI updates for the acting user, reconciled with server state.

**Notes**
- Keep intervals reasonable and back off when the tab is inactive to control load.
- This overlaps with performance (§16) — cache well and avoid over-fetching.

**Acceptance criteria**
- An invited user sees the notification/board **without manually refreshing** (within the polling/SSE interval).
- Key board changes propagate to other viewers without a full reload.

---

## 15. Admin-only permissions & authorization 🔴 P0

**Covers original items 17 & 19 (authorization portion).**

Enforce role-based access control so only a board **admin** can perform privileged actions.

**Admin-only actions**
- Change board settings.
- Add members / send invitations to a board.
- **Delete a pending invitation** (see §17).
- **Remove a member** from a board (see §17).
- Delete labels (see §16) and other destructive/board-config actions.

**Requirements**
- Enforce on the **server side** (API authorization checks), not just by hiding UI. Hiding buttons is necessary but not sufficient.
- Hide/disable admin-only controls for non-admins in the UI.
- Return proper 403s for unauthorized attempts.
- Confirm the role model (owner/admin/member) is correctly assigned and checked.

**Acceptance criteria**
- A non-admin cannot change settings, invite, remove members, or delete invitations/labels — via UI or direct API call.
- Admins can perform all of the above.

---

## 16. Delete card labels 🟡 P2

**Covers original item 18.**

- Allow deleting existing card labels (e.g. "Urgent") from the label manager.
- Deleting a label removes it from all cards using it (or prompts to confirm) — decide and document the behavior; must not corrupt cards.
- Admin-only per §15.

**Acceptance criteria**
- A label can be deleted; it's removed from the picker and from cards, with no orphaned references or errors.

---

## 17. Delete invitations & remove members (admin only) 🟠 P1

**Covers original item 19.**

- Add a **"Delete invitation"** button so an admin can revoke a pending invitation they sent (invalidate the token/link so it can no longer be accepted).
- Add a **"Remove member"** button so an admin can remove a member from a board.
- Both actions are **admin-only** (§15) and enforced server-side.
- Confirm-before-action dialogs to prevent accidents.
- Removing a member should not delete their authored content (comments/cards) — just their access (data-safety, §15).

**Acceptance criteria**
- Admin can revoke a pending invitation; the invitee can no longer accept it.
- Admin can remove a member; that user loses board access but their existing content remains intact.
- Non-admins cannot see or perform either action.

---

## 18. Performance optimization 🟡 P2

**Covers original item 16 (performance portion).**

- Reduce over-fetching; cache with a data layer (React Query/SWR); dedupe requests.
- Code-split / lazy-load heavy routes and components; optimize bundle size.
- Optimize images (next/image or equivalent, proper sizing, modern formats).
- Add pagination / virtualization for long lists/boards where needed.
- Memoize expensive renders; avoid unnecessary re-renders.
- Ensure the polling/SSE from §14 is efficient (backoff, conditional requests / ETags).
- Target good Core Web Vitals (LCP, CLS, INP).

**Acceptance criteria**
- Measurable improvement in load and interaction times (Lighthouse Performance ≥ 90 on key pages).
- No regressions in real-time behavior.

---

## 19. Data safety — non-destructive delivery 🔴 P0

**Covers original item 15. Applies to ALL of the above.**

- **No change may delete, overwrite, or corrupt existing data**: boards, lists, cards, comments, attachments, members, invitations, labels, users, verification status.
- Any DB schema change must use **additive, reversible migrations**; back up production before migrating.
- Test the full change set against a **staging copy of production data** before release.
- Rebrand, OTP switch, permission changes, and label/member deletions especially must preserve existing records and relationships.
- Keep existing verified users verified; keep existing invitations/members valid unless explicitly revoked by an admin.

**Acceptance criteria**
- After deploying all fixes, a spot-check of existing boards/cards/comments/members shows everything intact.
- Migrations are reversible and were tested on a data copy first.

---

## Suggested delivery order

1. **P0 first:** §19 data-safety guardrails, §1 rebrand, §2 validation, §15 admin permissions.
2. **P1 bugs/features:** §3, §4, §6, §7, §9, §10, §11 (SEO), §12, §13 (OTP), §14 (real-time), §17.
3. **P2 polish:** §5, §8, §16 (label delete), §18 (performance).

## Cross-cutting checklist before release

- [ ] Zero occurrences of "Boardly" / "@boardly.app" in UI, emails, and meta.
- [ ] All auth forms validated client + server side.
- [ ] Admin-only actions enforced on the server (verified via direct API calls, not just hidden buttons).
- [ ] Real-time updates verified without a manual refresh.
- [ ] All changes tested against a copy of production data; existing data intact.
- [ ] Lighthouse SEO ≥ 90 and Performance ≥ 90 on key pages.
